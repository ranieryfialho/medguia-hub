-- Adiciona campo status ao módulo de vendas para suportar ciclo de orçamento
-- Status possíveis:
--   orcamento_pendente  → orçamento enviado, aguardando resposta
--   orcamento_recusado  → proposta não aceita pelo paciente
--   venda_confirmada    → orçamento aceito ou venda direta (padrão)

ALTER TABLE vendas
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'venda_confirmada'
    CHECK (status IN ('orcamento_pendente', 'orcamento_recusado', 'venda_confirmada'));

-- Registros existentes já ficam como 'venda_confirmada' pelo DEFAULT acima.
-- Índice para acelerar filtros por status na listagem e relatórios
CREATE INDEX IF NOT EXISTS idx_vendas_status ON vendas (status);
