CREATE TABLE IF NOT EXISTS public.atendimento_midias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atendimento_id uuid NOT NULL REFERENCES public.atendimentos(id) ON DELETE CASCADE,
  google_drive_file_id text NOT NULL,
  google_drive_file_url text,
  nome text NOT NULL,
  mime_type text NOT NULL,
  tamanho_bytes bigint,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_atendimento_midias_atendimento_id
  ON public.atendimento_midias(atendimento_id);

ALTER TABLE public.atendimento_midias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autenticados_atendimento_midias"
  ON public.atendimento_midias
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
