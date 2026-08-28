-- Roteiro de teste manual: fn_vendas_resumo_mensal e fn_vendas_detalhe_mes
-- (T-008, feature venda-consultorio-vendas-historicas)
--
-- Cobre os cenários críticos do TDD 004 que não existem hoje na base real e
-- por isso não são verificáveis por dado real: venda confirmada sem itens
-- (AC-066), mês sem venda (AC-067), orçamentos fora do faturamento (AC-068),
-- e filtros combinados (AC-065). Rodar no SQL Editor do Studio, um bloco de
-- cada vez, dentro de uma transação que é sempre desfeita ao final — nenhum
-- dado de teste fica na base.
--
-- @spec:AC-065 @spec:AC-066 @spec:AC-067 @spec:AC-068 @spec:AC-069
-- feature: venda-consultorio-vendas-historicas

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Fixture: um paciente, um profissional já existente (reaproveita o primeiro
-- profissional ativo da base, para não depender de criar um novo), um médico
-- referenciador, dois produtos (um de cada categoria) e seis vendas cobrindo
-- os cenários abaixo, todas em 2026-06 (mês de teste isolado, sem vendas reais).
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_profissional_id uuid;
  v_medico_id uuid;
  v_paciente_id uuid;
  v_produto_tratamento_id uuid;
  v_produto_consulta_id uuid;
  v_venda_com_itens_id uuid;
  v_venda_sem_itens_id uuid;
  v_venda_consultorio_id uuid;
  v_venda_fisio_id uuid;
  v_orcamento_pendente_id uuid;
  v_orcamento_recusado_id uuid;
BEGIN
  SELECT id INTO v_profissional_id FROM public.profiles WHERE role = 'fisioterapeuta' LIMIT 1;
  SELECT id INTO v_medico_id FROM public.profiles WHERE role = 'medico' LIMIT 1;

  IF v_profissional_id IS NULL OR v_medico_id IS NULL THEN
    RAISE EXCEPTION 'roteiro requer ao menos 1 profissional e 1 médico já cadastrados na base';
  END IF;

  INSERT INTO public.pacientes (nome) VALUES ('[TESTE T-008] Paciente Roteiro')
  RETURNING id INTO v_paciente_id;

  INSERT INTO public.produtos (nome, categoria, preco_padrao, ativo)
  VALUES ('[TESTE T-008] Protocolo Tratamento', 'tratamento', 1000, true)
  RETURNING id INTO v_produto_tratamento_id;

  INSERT INTO public.produtos (nome, categoria, preco_padrao, ativo)
  VALUES ('[TESTE T-008] Avaliação Consulta', 'consulta', 300, true)
  RETURNING id INTO v_produto_consulta_id;

  -- Cenário 1: venda confirmada COM itens — caso normal, R$ 1000.
  INSERT INTO public.vendas (status, origem, data_venda, profissional_id, paciente_id, nome)
  VALUES ('venda_confirmada', 'leads', '2026-06-10', v_profissional_id, v_paciente_id, '[TESTE T-008] Com itens')
  RETURNING id INTO v_venda_com_itens_id;
  INSERT INTO public.itens_venda (venda_id, produto_id, quantidade, preco_unitario)
  VALUES (v_venda_com_itens_id, v_produto_tratamento_id, 1, 1000);

  -- Cenário 2 (AC-066): venda confirmada SEM itens — deve somar R$0 ao
  -- faturamento mas +1 a qtd_vendas (nunca descartada do denominador).
  INSERT INTO public.vendas (status, origem, data_venda, profissional_id, paciente_id, nome)
  VALUES ('venda_confirmada', 'leads', '2026-06-12', v_profissional_id, v_paciente_id, '[TESTE T-008] Sem itens')
  RETURNING id INTO v_venda_sem_itens_id;

  -- Cenário 3: venda médica em consultório — entra em faturamento_consultorio.
  INSERT INTO public.vendas (status, origem, data_venda, profissional_id, paciente_id, medico_referenciador_id, venda_em_consultorio, nome)
  VALUES ('venda_confirmada', 'medico', '2026-06-15', v_profissional_id, v_paciente_id, v_medico_id, true, '[TESTE T-008] Consultório')
  RETURNING id INTO v_venda_consultorio_id;
  INSERT INTO public.itens_venda (venda_id, produto_id, quantidade, preco_unitario)
  VALUES (v_venda_consultorio_id, v_produto_consulta_id, 1, 300);

  -- Cenário 4: venda médica convertida pelo fisio — entra em faturamento_fisio
  -- e no ranking_fisios do drill-down.
  INSERT INTO public.vendas (status, origem, data_venda, profissional_id, paciente_id, medico_referenciador_id, venda_em_consultorio, nome)
  VALUES ('venda_confirmada', 'medico', '2026-06-18', v_profissional_id, v_paciente_id, v_medico_id, false, '[TESTE T-008] Conversão fisio')
  RETURNING id INTO v_venda_fisio_id;
  INSERT INTO public.itens_venda (venda_id, produto_id, quantidade, preco_unitario)
  VALUES (v_venda_fisio_id, v_produto_tratamento_id, 1, 1000);

  -- Cenário 5 e 6 (AC-068): orçamentos — nunca somam em faturamento/qtd_vendas,
  -- só em qtd_orcamento_pendente/qtd_orcamento_recusado.
  INSERT INTO public.vendas (status, origem, data_venda, profissional_id, paciente_id, nome)
  VALUES ('orcamento_pendente', 'leads', '2026-06-20', v_profissional_id, v_paciente_id, '[TESTE T-008] Orçamento pendente')
  RETURNING id INTO v_orcamento_pendente_id;
  INSERT INTO public.itens_venda (venda_id, produto_id, quantidade, preco_unitario)
  VALUES (v_orcamento_pendente_id, v_produto_tratamento_id, 1, 1000);

  INSERT INTO public.vendas (status, origem, data_venda, profissional_id, paciente_id, nome)
  VALUES ('orcamento_recusado', 'leads', '2026-06-22', v_profissional_id, v_paciente_id, '[TESTE T-008] Orçamento recusado')
  RETURNING id INTO v_orcamento_recusado_id;

  RAISE NOTICE 'Fixture criada: paciente=%, profissional=%, médico=%', v_paciente_id, v_profissional_id, v_medico_id;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Teste 1 (AC-065, AC-066, AC-067, AC-068): resumo de 3 meses (mai/jun/jul 2026),
-- sem filtros. Esperado:
--   - mai/2026: faturamento 0, qtd_vendas 0, ticket_medio 0 (mês sem venda —
--     AC-067; nunca omitido da lista).
--   - jun/2026: faturamento 2300 (1000 + 0 + 300 + 1000), qtd_vendas 4
--     (com_itens + sem_itens + consultório + fisio), ticket_medio 575.00,
--     faturamento_consultorio 300, qtd_consultorio 1, faturamento_fisio 1000,
--     qtd_fisio 1, qtd_orcamento_pendente 1, qtd_orcamento_recusado 1.
--   - jul/2026: faturamento 0, qtd_vendas 0 (mês sem venda).
-- ─────────────────────────────────────────────────────────────────────────────
SELECT * FROM public.fn_vendas_resumo_mensal('2026-05-01', '2026-07-31');

-- ─────────────────────────────────────────────────────────────────────────────
-- Teste 2 (AC-065): filtro por origem = 'medico' isola as 2 vendas médicas.
-- Esperado em jun/2026: faturamento 1300 (300 + 1000), qtd_vendas 2,
-- faturamento_consultorio 300, faturamento_fisio 1000.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT * FROM public.fn_vendas_resumo_mensal('2026-06-01', '2026-06-30', p_origem => 'medico');

-- ─────────────────────────────────────────────────────────────────────────────
-- Teste 3 (AC-065): filtro por modalidade = 'consultorio' isola só a venda
-- em consultório. Esperado em jun/2026: faturamento 300, qtd_vendas 1.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT * FROM public.fn_vendas_resumo_mensal('2026-06-01', '2026-06-30', p_modalidade => 'consultorio');

-- ─────────────────────────────────────────────────────────────────────────────
-- Teste 4 (AC-065): filtro por categoria = 'consulta' isola vendas com item
-- dessa categoria. Esperado em jun/2026: apenas a venda em consultório
-- (produto de categoria 'consulta'), faturamento 300, qtd_vendas 1.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT * FROM public.fn_vendas_resumo_mensal('2026-06-01', '2026-06-30', p_categoria => 'consulta');

-- ─────────────────────────────────────────────────────────────────────────────
-- Teste 5: valor inválido de origem é rejeitado pela função (proteção contra
-- concatenação/valor fora da lista fechada).
-- Esperado: erro "origem inválida: nao_existe".
-- ─────────────────────────────────────────────────────────────────────────────
SELECT * FROM public.fn_vendas_resumo_mensal('2026-06-01', '2026-06-30', p_origem => 'nao_existe');

-- ─────────────────────────────────────────────────────────────────────────────
-- Teste 6 (AC-069): drill-down de jun/2026, sem filtros.
-- Esperado:
--   - quebra_origem: 2 entradas — 'medico' (faturamento 1300, qtd 2) e
--     'leads' (faturamento 1000, qtd 2 — com_itens + sem_itens).
--   - quebra_categoria: 'tratamento' (faturamento 2000, qtd_vendas 2) e
--     'consulta' (faturamento 300, qtd_vendas 1).
--   - ranking_medicos: 1 entrada, o médico do fixture, faturamento 1300,
--     qtd_vendas 2 (soma consultório + fisio).
--   - ranking_fisios: 1 entrada, o profissional do fixture, mas SÓ contando
--     a venda de conversão (venda_em_consultorio = false) — faturamento 1000,
--     qtd_vendas 1. A venda em consultório NÃO entra aqui.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT * FROM public.fn_vendas_detalhe_mes('2026-06-01');

-- ─────────────────────────────────────────────────────────────────────────────
-- Teste 7 (AC-070): confirma SECURITY DEFINER e search_path fixo nas duas
-- funções — proteção contra sequestro de resolução de nomes via search_path
-- mutável do chamador.
-- Esperado: prosecurity = true e proconfig contendo 'search_path=public, pg_temp'
-- para ambas as linhas.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  p.proname,
  p.prosecdef AS security_definer,
  p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('fn_vendas_resumo_mensal', 'fn_vendas_detalhe_mes');

ROLLBACK;

-- A transação inteira é desfeita aqui — nenhuma linha de teste permanece na
-- base. Se algum SELECT acima não bater com o esperado, o defeito está na
-- CTE canônica (fn_vendas_resumo_mensal / fn_vendas_detalhe_mes), não no
-- fixture: revisar antes de seguir para T-009 em diante.
