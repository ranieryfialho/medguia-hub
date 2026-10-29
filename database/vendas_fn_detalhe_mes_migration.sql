-- fn_vendas_detalhe_mes: drill-down mensal sob demanda, consumido por
-- /relatorios/vendas-historicas ao expandir uma linha da tabela mês a mês
-- (T-015). Reaproveita a mesma regra de "venda contável" de
-- fn_vendas_resumo_mensal (T-006): apenas vendas com status =
-- 'venda_confirmada' entram nas agregações, venda confirmada sem itens
-- (ou sem itens da categoria filtrada) soma R$ 0,00 sem ser descartada.
--
-- Retorna uma única linha com 4 colunas jsonb (array de objetos cada):
-- quebra por origem, quebra por categoria, ranking de médicos
-- referenciadores e ranking de fisioterapeutas (profissionais que
-- converteram vendas médicas, venda_em_consultorio = false) do mês.
--
-- @spec:AC-069 @spec:AC-070
-- feature: venda-consultorio-vendas-historicas

CREATE OR REPLACE FUNCTION public.fn_vendas_detalhe_mes(
  p_mes date,
  p_profissional_id uuid DEFAULT NULL,
  p_medico_id uuid DEFAULT NULL,
  p_origem text DEFAULT NULL,
  p_categoria text DEFAULT NULL,
  p_modalidade text DEFAULT NULL
)
RETURNS TABLE (
  quebra_origem jsonb,
  quebra_categoria jsonb,
  ranking_medicos jsonb,
  ranking_fisios jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_data_inicio date;
  v_data_fim date;
BEGIN
  IF p_mes IS NULL THEN
    RAISE EXCEPTION 'p_mes é obrigatório';
  END IF;

  IF p_origem IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.origens_venda ov WHERE ov.valor = p_origem) THEN
    RAISE EXCEPTION 'origem inválida: %', p_origem;
  END IF;

  IF p_categoria IS NOT NULL AND p_categoria NOT IN ('tratamento', 'consulta') THEN
    RAISE EXCEPTION 'categoria inválida: %', p_categoria;
  END IF;

  IF p_modalidade IS NOT NULL AND p_modalidade NOT IN ('consultorio', 'fisio') THEN
    RAISE EXCEPTION 'modalidade inválida: %', p_modalidade;
  END IF;

  v_data_inicio := date_trunc('month', p_mes)::date;
  v_data_fim := (date_trunc('month', p_mes) + interval '1 month' - interval '1 day')::date;

  RETURN QUERY
  WITH vendas_filtradas AS (
    SELECT
      v.id,
      v.origem,
      v.profissional_id,
      v.medico_referenciador_nome,
      v.venda_em_consultorio
    FROM public.vendas v
    WHERE (v.data_venda AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_data_inicio AND v_data_fim
      AND v.status = 'venda_confirmada'
      AND (p_profissional_id IS NULL OR v.profissional_id = p_profissional_id)
      AND (
        p_medico_id IS NULL
        OR v.medico_referenciador_nome = (SELECT pr.full_name FROM public.profiles pr WHERE pr.id = p_medico_id)
      )
      AND (p_origem IS NULL OR v.origem = p_origem)
      AND (
        p_modalidade IS NULL
        OR (p_modalidade = 'consultorio' AND v.venda_em_consultorio = true)
        OR (p_modalidade = 'fisio' AND v.venda_em_consultorio = false)
      )
      AND (
        p_categoria IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.itens_venda iv
          JOIN public.produtos p ON p.id = iv.produto_id
          WHERE iv.venda_id = v.id AND p.categoria = p_categoria
        )
      )
  ),
  itens_contaveis AS (
    SELECT
      vf.id AS venda_id,
      iv.quantidade,
      iv.preco_unitario,
      p.categoria AS produto_categoria
    FROM vendas_filtradas vf
    JOIN public.itens_venda iv ON iv.venda_id = vf.id
    LEFT JOIN public.produtos p ON p.id = iv.produto_id
    WHERE (p_categoria IS NULL OR p.categoria = p_categoria)
  ),
  totais_por_venda AS (
    SELECT venda_id, SUM(quantidade * preco_unitario) AS total
    FROM itens_contaveis
    GROUP BY venda_id
  ),
  -- Venda confirmada sem itens (ou sem itens da categoria filtrada) entra
  -- com total 0 — nunca é descartada da agregação (mesma regra de AC-066).
  vendas_contaveis AS (
    SELECT
      vf.id,
      vf.origem,
      vf.profissional_id,
      vf.medico_referenciador_nome,
      vf.venda_em_consultorio,
      COALESCE(tv.total, 0) AS total_venda
    FROM vendas_filtradas vf
    LEFT JOIN totais_por_venda tv ON tv.venda_id = vf.id
  ),
  origem_agg AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'origem', origem,
        'faturamento', faturamento,
        'qtd_vendas', qtd_vendas
      ) ORDER BY faturamento DESC, origem ASC
    ) AS dados
    FROM (
      SELECT origem, SUM(total_venda) AS faturamento, COUNT(*) AS qtd_vendas
      FROM vendas_contaveis
      GROUP BY origem
    ) x
  ),
  categoria_agg AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'categoria', produto_categoria,
        'faturamento', faturamento,
        'qtd_vendas', qtd_vendas
      ) ORDER BY faturamento DESC, produto_categoria ASC
    ) AS dados
    FROM (
      SELECT produto_categoria, SUM(quantidade * preco_unitario) AS faturamento, COUNT(DISTINCT venda_id) AS qtd_vendas
      FROM itens_contaveis
      WHERE produto_categoria IS NOT NULL
      GROUP BY produto_categoria
    ) x
  ),
  medicos_agg AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'medico_id', medico_id,
        'medico_nome', medico_nome,
        'faturamento', faturamento,
        'qtd_vendas', qtd_vendas
      ) ORDER BY faturamento DESC, medico_nome ASC
    ) AS dados
    FROM (
      SELECT
        pr.id AS medico_id,
        vc.medico_referenciador_nome AS medico_nome,
        SUM(vc.total_venda) AS faturamento,
        COUNT(*) AS qtd_vendas
      FROM vendas_contaveis vc
      LEFT JOIN public.profiles pr ON pr.full_name = vc.medico_referenciador_nome AND pr.role = 'medico'
      WHERE vc.medico_referenciador_nome IS NOT NULL
      GROUP BY pr.id, vc.medico_referenciador_nome
    ) x
  ),
  -- Ranking de fisioterapeutas: profissionais que converteram encaminhamentos
  -- médicos (venda_em_consultorio = false). A CHECK de vendas garante que
  -- venda_em_consultorio só é preenchido quando origem = 'medico'.
  fisios_agg AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'profissional_id', profissional_id,
        'profissional_nome', profissional_nome,
        'faturamento', faturamento,
        'qtd_vendas', qtd_vendas
      ) ORDER BY faturamento DESC, profissional_nome ASC
    ) AS dados
    FROM (
      SELECT
        vc.profissional_id,
        pr.full_name AS profissional_nome,
        SUM(vc.total_venda) AS faturamento,
        COUNT(*) AS qtd_vendas
      FROM vendas_contaveis vc
      LEFT JOIN public.profiles pr ON pr.id = vc.profissional_id
      WHERE vc.profissional_id IS NOT NULL
        AND vc.venda_em_consultorio = false
      GROUP BY vc.profissional_id, pr.full_name
    ) x
  )
  SELECT
    COALESCE(origem_agg.dados, '[]'::jsonb),
    COALESCE(categoria_agg.dados, '[]'::jsonb),
    COALESCE(medicos_agg.dados, '[]'::jsonb),
    COALESCE(fisios_agg.dados, '[]'::jsonb)
  FROM origem_agg, categoria_agg, medicos_agg, fisios_agg;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_vendas_detalhe_mes(date, uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_vendas_detalhe_mes(date, uuid, uuid, text, text, text) TO service_role, authenticated;
