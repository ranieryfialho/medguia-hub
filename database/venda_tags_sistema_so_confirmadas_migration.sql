-- Tags SEM CONTRATO / CONTRATO ASSINADO só existem em vendas confirmadas.
-- Remove os vínculos que o backfill anterior colocou em orçamentos
-- (pendentes ou recusados). Idempotente.
DELETE FROM venda_tags_vinculos x
 USING venda_tags g, vendas v
 WHERE g.id = x.tag_id
   AND g.sistema_chave IN ('sem_contrato', 'contrato_assinado')
   AND v.id = x.venda_id
   AND v.status <> 'venda_confirmada';
