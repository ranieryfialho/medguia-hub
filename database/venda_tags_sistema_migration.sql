-- Tags padrão do sistema para vendas: SEM CONTRATO (nasce com a venda) e
-- CONTRATO ASSINADO (substitui a anterior quando o contrato é gerado).
-- Identificadas por `sistema_chave` (estável), não pelo nome, e protegidas
-- contra renomear/excluir.

ALTER TABLE venda_tags ADD COLUMN IF NOT EXISTS sistema_chave TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_venda_tags_sistema_chave
  ON venda_tags (sistema_chave)
  WHERE sistema_chave IS NOT NULL;

-- Marca as tags já existentes (pelo nome, sem diferenciar caixa).
UPDATE venda_tags SET sistema_chave = 'sem_contrato', ativo = true
 WHERE sistema_chave IS NULL
   AND id = (SELECT id FROM venda_tags
              WHERE lower(trim(nome)) = 'sem contrato'
              ORDER BY ativo DESC, criado_em LIMIT 1);

UPDATE venda_tags SET sistema_chave = 'contrato_assinado', ativo = true
 WHERE sistema_chave IS NULL
   AND id = (SELECT id FROM venda_tags
              WHERE lower(trim(nome)) = 'contrato assinado'
              ORDER BY ativo DESC, criado_em LIMIT 1);

-- Cria as que ainda não existirem.
INSERT INTO venda_tags (nome, cor, ordem, sistema_chave)
SELECT 'SEM CONTRATO', 'rose', COALESCE((SELECT max(ordem) FROM venda_tags), 0) + 1, 'sem_contrato'
 WHERE NOT EXISTS (SELECT 1 FROM venda_tags WHERE sistema_chave = 'sem_contrato');

INSERT INTO venda_tags (nome, cor, ordem, sistema_chave)
SELECT 'CONTRATO ASSINADO', 'emerald', COALESCE((SELECT max(ordem) FROM venda_tags), 0) + 1, 'contrato_assinado'
 WHERE NOT EXISTS (SELECT 1 FROM venda_tags WHERE sistema_chave = 'contrato_assinado');

-- ─── Backfill: vendas de 01/08/2026 em diante ──────────────────────────────────
-- Com contrato (venda_termos tipo 'termo') -> CONTRATO ASSINADO; sem -> SEM CONTRATO.
-- Idempotente: não duplica vínculo e não mexe em quem já tem uma das duas tags.
INSERT INTO venda_tags_vinculos (venda_id, tag_id)
SELECT v.id,
       CASE WHEN EXISTS (SELECT 1 FROM venda_termos t WHERE t.venda_id = v.id AND t.tipo = 'termo')
            THEN (SELECT id FROM venda_tags WHERE sistema_chave = 'contrato_assinado')
            ELSE (SELECT id FROM venda_tags WHERE sistema_chave = 'sem_contrato')
       END
  FROM vendas v
 WHERE (v.data_venda AT TIME ZONE 'America/Sao_Paulo')::date >= DATE '2026-08-01'
   AND NOT EXISTS (
     SELECT 1 FROM venda_tags_vinculos x
       JOIN venda_tags g ON g.id = x.tag_id
      WHERE x.venda_id = v.id
        AND g.sistema_chave IN ('sem_contrato', 'contrato_assinado')
   )
ON CONFLICT DO NOTHING;
