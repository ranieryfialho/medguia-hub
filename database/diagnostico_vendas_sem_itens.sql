-- Diagnóstico: vendas confirmadas sem itens (TDD 004, Questão em Aberto 2 / Ação 2 do RFC 004)
--
-- Contexto: src/app/(painel)/relatorios/vendas/page.tsx:211 faz
-- `if (itens.length === 0) continue` — uma venda confirmada sem itens é
-- descartada do faturamento E do denominador do ticket médio. O PRD 004 proíbe
-- isso. Corrigir muda um número que a gestão já vê hoje.
--
-- Estas 4 consultas dimensionam a mudança ANTES do deploy. Rodar no SQL Editor
-- do Studio, uma de cada vez. Nenhuma escreve nada.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. O NÚMERO QUE DECIDE: impacto no ticket médio, hoje vs. depois
-- ─────────────────────────────────────────────────────────────────────────────
WITH totais AS (
  SELECT
    v.id,
    v.data_venda,
    COALESCE(SUM(iv.quantidade * iv.preco_unitario), 0) AS total_venda,
    COUNT(iv.id)                                         AS qtd_itens
  FROM public.vendas v
  LEFT JOIN public.itens_venda iv ON iv.venda_id = v.id
  WHERE v.status = 'venda_confirmada'
  GROUP BY v.id, v.data_venda
)
SELECT
  COUNT(*)                                          AS vendas_confirmadas_total,
  COUNT(*) FILTER (WHERE qtd_itens = 0)             AS sem_itens,
  ROUND(100.0 * COUNT(*) FILTER (WHERE qtd_itens = 0) / NULLIF(COUNT(*), 0), 2)
                                                    AS pct_sem_itens,
  SUM(total_venda)                                  AS faturamento_total,
  -- Ticket médio como o relatório calcula HOJE (denominador exclui sem-itens)
  ROUND(SUM(total_venda) / NULLIF(COUNT(*) FILTER (WHERE qtd_itens > 0), 0), 2)
                                                    AS ticket_medio_hoje,
  -- Ticket médio como a CTE canônica calcularia (sem-itens conta como R$ 0,00)
  ROUND(SUM(total_venda) / NULLIF(COUNT(*), 0), 2)  AS ticket_medio_depois,
  -- A queda percentual: este é o número a comunicar à gestão
  ROUND(
    100.0 * (
      SUM(total_venda) / NULLIF(COUNT(*), 0)
      - SUM(total_venda) / NULLIF(COUNT(*) FILTER (WHERE qtd_itens > 0), 0)
    ) / NULLIF(SUM(total_venda) / NULLIF(COUNT(*) FILTER (WHERE qtd_itens > 0), 0), 0)
  , 2)                                              AS variacao_pct_ticket_medio
FROM totais;

-- Leitura do resultado:
--   pct_sem_itens < 1%   → ruído. Deploy normal, nota de rodapé basta.
--   pct_sem_itens alto   → avisar a gestão ANTES, com os dois tickets lado a lado.
--   variacao_pct grande  → a comunicação prévia deixa de ser opcional.


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. DISTRIBUIÇÃO NO TEMPO: é problema antigo, atual, ou pontual?
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  DATE_TRUNC('month', v.data_venda)::DATE            AS mes,
  COUNT(*)                                           AS confirmadas,
  COUNT(*) FILTER (WHERE iv.venda_id IS NULL)        AS sem_itens
FROM public.vendas v
LEFT JOIN (SELECT DISTINCT venda_id FROM public.itens_venda) iv
  ON iv.venda_id = v.id
WHERE v.status = 'venda_confirmada'
GROUP BY 1
HAVING COUNT(*) FILTER (WHERE iv.venda_id IS NULL) > 0
ORDER BY 1 DESC;

-- Leitura do resultado:
--   Concentrado num mês antigo   → incidente pontual já superado.
--   Espalhado, incluindo recentes → o fluxo de cadastro ainda produz esses casos.
--     Nesse cenário, contar como R$ 0,00 conserta a fórmula mas mantém a fonte
--     do lixo. Vale investigar o cadastro antes de decidir (ver TDD 004).


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. AMOSTRA: são erro de cadastro ou vendas legítimas de valor zero?
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  v.id,
  v.data_venda::DATE      AS data,
  v.status,
  v.origem,
  v.nome                  AS protocolo,
  v.forma_pagamento,
  p.nome                  AS paciente,
  v.observacoes
FROM public.vendas v
LEFT JOIN public.pacientes p ON p.id = v.paciente_id
WHERE v.status = 'venda_confirmada'
  AND NOT EXISTS (SELECT 1 FROM public.itens_venda iv WHERE iv.venda_id = v.id)
ORDER BY v.data_venda DESC
LIMIT 30;

-- Leitura do resultado: olhar `protocolo`, `observacoes` e `paciente`.
--   Registros vazios/duplicados/de teste → erro de cadastro. A resposta correta
--     pode ser corrigir os registros, não contá-los como R$ 0,00.
--   Vendas com contexto real (cortesia, bonificação, permuta) → são vendas
--     legítimas de valor zero e DEVEM contar no denominador.


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. CONTROLE: o mesmo problema existe nos orçamentos?
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  v.status,
  COUNT(*)                                    AS total,
  COUNT(*) FILTER (WHERE iv.venda_id IS NULL) AS sem_itens
FROM public.vendas v
LEFT JOIN (SELECT DISTINCT venda_id FROM public.itens_venda) iv
  ON iv.venda_id = v.id
GROUP BY v.status
ORDER BY v.status;

-- Leitura do resultado: se orçamentos pendentes/recusados sem itens forem
-- proporcionalmente comuns, reforça a hipótese de "rascunho salvo sem itens"
-- como fluxo real de uso — e não de defeito.
