ALTER TABLE public.atendimentos
  ADD COLUMN IF NOT EXISTS token_curto text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_atendimentos_token_curto
  ON public.atendimentos(token_curto)
  WHERE token_curto IS NOT NULL;
