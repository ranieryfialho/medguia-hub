-- fn_vendas_resumo_mensal: CTE canônica de "venda contável", compartilhada
-- por /relatorios/vendas (KPIs de topo, T-011) e /relatorios/vendas-historicas
-- (evolução mensal, T-014).
--
-- Regra de venda contável: apenas vendas com status = 'venda_confirmada'
-- entram em faturamento/qtd_vendas. Uma venda confirmada sem itens em
-- itens_venda soma R$ 0,00 ao faturamento mas soma 1 a qtd_vendas — nunca é
-- descartada do denominador do ticket médio (AC-066). Orçamentos
-- (pendente/recusado) nunca entram em faturamento nem em qtd_vendas, mas são
-- contados à parte (AC-068). Um mês do período sem nenhuma venda aparece com
-- zeros, nunca é omitido (AC-067).
--
-- @spec:AC-065 @spec:AC-066 @spec:AC-067 @spec:AC-068 @spec:AC-070
-- feature: venda-consultorio-vendas-historicas

CREATE OR REPLACE FUNCTION public.fn_vendas_resumo_mensal(
  p_data_inicio date,
  p_data_fim date,
  p_profissional_id uuid DEFAULT NULL,
  p_medico_id uuid DEFAULT NULL,
  p_origem text DEFAULT NULL,
  p_categoria text DEFAULT NULL,
  p_modalidade text DEFAULT NULL
)
RETURNS TABLE (
  mes date,
  faturamento numeric,
  qtd_vendas integer,
  ticket_medio numeric,
  faturamento_consultorio numeric,
  qtd_consultorio integer,
  faturamento_fisio numeric,
  qtd_fisio integer,
  qtd_nao_classificada integer,
  qtd_orcamento_pendente integer,
  qtd_orcamento_recusado integer,
  top_produto text,
  top_profissional text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_data_inicio IS NULL OR p_data_fim IS NULL THEN
    RAISE EXCEPTION 'p_data_inicio e p_data_fim são obrigatórios';
  END IF;

  IF p_origem IS NOT NULL AND p_origem NOT IN ('medico', 'leads', 'indicacao', 'renovacao', 'campanha') THEN
    RAISE EXCEPTION 'origem inválida: %', p_origem;
  END IF;

  IF p_categoria IS NOT NULL AND p_categoria NOT IN ('tratamento', 'consulta') THEN
    RAISE EXCEPTION 'categoria inválida: %', p_categoria;
  END IF;

  IF p_modalidade IS NOT NULL AND p_modalidade NOT IN ('consultorio', 'fisio') THEN
    RAISE EXCEPTION 'modalidade inválida: %', p_modalidade;
  END IF;

  RETURN QUERY
  WITH meses AS (
    SELECT generate_series(
      date_trunc('month', p_data_inicio),
      date_trunc('month', p_data_fim),
      interval '1 month'
    )::date AS mes
  ),
  vendas_filtradas AS (
    SELECT
      v.id,
      v.status,
      v.profissional_id,
      v.venda_em_consultorio,
      date_trunc('month', (v.data_venda AT TIME ZONE 'America/Sao_Paulo')::date)::date AS mes
    FROM public.vendas v
    WHERE (v.data_venda AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_data_inicio AND p_data_fim
      AND v.status IN ('venda_confirmada', 'orcamento_pendente', 'orcamento_recusado')
      AND (p_profissional_id IS NULL OR v.profissional_id = p_profissional_id)
      AND (p_medico_id IS NULL OR v.medico_referenciador_id = p_medico_id)
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
      vf.mes,
      iv.quantidade,
      iv.preco_unitario,
      p.nome AS produto_nome
    FROM vendas_filtradas vf
    JOIN public.itens_venda iv ON iv.venda_id = vf.id
    LEFT JOIN public.produtos p ON p.id = iv.produto_id
    WHERE vf.status = 'venda_confirmada'
      AND (p_categoria IS NULL OR p.categoria = p_categoria)
  ),
  totais_por_venda AS (
    SELECT venda_id, SUM(quantidade * preco_unitario) AS total
    FROM itens_contaveis
    GROUP BY venda_id
  ),
  -- Venda confirmada sem itens (ou sem itens da categoria filtrada) entra
  -- com total 0 — nunca é descartada do denominador (AC-066).
  vendas_confirmadas AS (
    SELECT
      vf.id,
      vf.mes,
      vf.profissional_id,
      vf.venda_em_consultorio,
      COALESCE(tv.total, 0) AS total_venda
    FROM vendas_filtradas vf
    LEFT JOIN totais_por_venda tv ON tv.venda_id = vf.id
    WHERE vf.status = 'venda_confirmada'
  ),
  resumo_mes AS (
    SELECT
      mes,
      SUM(total_venda) AS faturamento,
      COUNT(*) AS qtd_vendas,
      SUM(total_venda) FILTER (WHERE venda_em_consultorio = true) AS faturamento_consultorio,
      COUNT(*) FILTER (WHERE venda_em_consultorio = true) AS qtd_consultorio,
      SUM(total_venda) FILTER (WHERE venda_em_consultorio = false) AS faturamento_fisio,
      COUNT(*) FILTER (WHERE venda_em_consultorio = false) AS qtd_fisio,
      COUNT(*) FILTER (WHERE venda_em_consultorio IS NULL) AS qtd_nao_classificada
    FROM vendas_confirmadas
    GROUP BY mes
  ),
  -- Orçamentos nunca somam em faturamento/qtd_vendas (AC-068) — contados à parte.
  orcamentos_mes AS (
    SELECT
      mes,
      COUNT(*) FILTER (WHERE status = 'orcamento_pendente') AS qtd_orcamento_pendente,
      COUNT(*) FILTER (WHERE status = 'orcamento_recusado') AS qtd_orcamento_recusado
    FROM vendas_filtradas
    WHERE status IN ('orcamento_pendente', 'orcamento_recusado')
    GROUP BY mes
  ),
  produto_top AS (
    SELECT DISTINCT ON (mes) mes, produto_nome
    FROM (
      SELECT mes, produto_nome, SUM(quantidade * preco_unitario) AS total
      FROM itens_contaveis
      WHERE produto_nome IS NOT NULL
      GROUP BY mes, produto_nome
    ) por_produto
    ORDER BY mes, total DESC, produto_nome ASC
  ),
  profissional_top AS (
    SELECT DISTINCT ON (por_profissional.mes) por_profissional.mes, pr.full_name AS profissional_nome
    FROM (
      SELECT mes, profissional_id, SUM(total_venda) AS total
      FROM vendas_confirmadas
      WHERE profissional_id IS NOT NULL
      GROUP BY mes, profissional_id
    ) por_profissional
    LEFT JOIN public.profiles pr ON pr.id = por_profissional.profissional_id
    ORDER BY por_profissional.mes, por_profissional.total DESC, pr.full_name ASC
  )
  SELECT
    m.mes,
    COALESCE(rm.faturamento, 0) AS faturamento,
    COALESCE(rm.qtd_vendas, 0)::integer AS qtd_vendas,
    -- Mês sem vendas nunca produz divisão por zero (AC-067): ticket médio 0.
    CASE
      WHEN COALESCE(rm.qtd_vendas, 0) = 0 THEN 0
      ELSE ROUND(rm.faturamento / rm.qtd_vendas, 2)
    END AS ticket_medio,
    COALESCE(rm.faturamento_consultorio, 0) AS faturamento_consultorio,
    COALESCE(rm.qtd_consultorio, 0)::integer AS qtd_consultorio,
    COALESCE(rm.faturamento_fisio, 0) AS faturamento_fisio,
    COALESCE(rm.qtd_fisio, 0)::integer AS qtd_fisio,
    COALESCE(rm.qtd_nao_classificada, 0)::integer AS qtd_nao_classificada,
    COALESCE(om.qtd_orcamento_pendente, 0)::integer AS qtd_orcamento_pendente,
    COALESCE(om.qtd_orcamento_recusado, 0)::integer AS qtd_orcamento_recusado,
    pt.produto_nome AS top_produto,
    pft.profissional_nome AS top_profissional
  FROM meses m
  LEFT JOIN resumo_mes rm ON rm.mes = m.mes
  LEFT JOIN orcamentos_mes om ON om.mes = m.mes
  LEFT JOIN produto_top pt ON pt.mes = m.mes
  LEFT JOIN profissional_top pft ON pft.mes = m.mes
  ORDER BY m.mes;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_vendas_resumo_mensal(date, date, uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_vendas_resumo_mensal(date, date, uuid, uuid, text, text, text) TO service_role, authenticated;
