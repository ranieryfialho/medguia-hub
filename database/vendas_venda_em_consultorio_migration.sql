-- Adiciona coluna venda_em_consultorio à tabela vendas
-- Distingue, para vendas de origem "médico", se o próprio médico já fechou a
-- venda no consultório (true) ou se o fisioterapeuta converteu a indicação
-- na clínica (false). NULL = não classificada (vendas legadas ou de origem
-- diferente de "médico" — nunca ganha `false` por default de banco).
--
-- @spec:AC-063 @spec:AC-064
-- feature: venda-consultorio-vendas-historicas

ALTER TABLE vendas
  ADD COLUMN IF NOT EXISTS venda_em_consultorio BOOLEAN NULL;

COMMENT ON COLUMN vendas.venda_em_consultorio IS
  'Só aplicável a origem = ''medico''. true = venda fechada pelo médico no consultório; false = conversão da indicação pelo fisioterapeuta; NULL = não classificada (venda legada ou origem diferente de medico).';

-- Garante que só vendas de origem "médico" podem ter o toggle marcado
-- (true ou false). Qualquer outra origem só aceita NULL.
ALTER TABLE vendas
  DROP CONSTRAINT IF EXISTS vendas_consultorio_apenas_origem_medico;

ALTER TABLE vendas
  ADD CONSTRAINT vendas_consultorio_apenas_origem_medico
  CHECK (venda_em_consultorio IS NULL OR origem = 'medico');

-- Índices de suporte aos relatórios de vendas (filtros por período/status e
-- por médico referenciador)
CREATE INDEX IF NOT EXISTS idx_vendas_data_status
  ON vendas (data_venda, status);

CREATE INDEX IF NOT EXISTS idx_vendas_medico_ref_id
  ON vendas (medico_referenciador_id)
  WHERE medico_referenciador_id IS NOT NULL;
