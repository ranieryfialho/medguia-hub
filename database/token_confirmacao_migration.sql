ALTER TABLE atendimentos
  ADD COLUMN IF NOT EXISTS token_confirmacao UUID DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS atendimentos_token_confirmacao_idx
  ON atendimentos (token_confirmacao)
  WHERE token_confirmacao IS NOT NULL;
