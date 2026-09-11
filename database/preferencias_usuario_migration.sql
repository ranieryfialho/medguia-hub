-- ================================================================
-- Preferências de tela por usuário (filtros, ordenação, etc.)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.preferencias_usuario (
  id           uuid         DEFAULT gen_random_uuid() NOT NULL,
  usuario_id   uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tela         text         NOT NULL,
  preferencias jsonb        NOT NULL DEFAULT '{}'::jsonb,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT preferencias_usuario_pkey PRIMARY KEY (id),
  CONSTRAINT preferencias_usuario_usuario_tela_unique UNIQUE (usuario_id, tela)
);

CREATE INDEX IF NOT EXISTS idx_preferencias_usuario_usuario_tela
  ON public.preferencias_usuario (usuario_id, tela);

-- ================================================================
-- RLS
-- ================================================================

ALTER TABLE public.preferencias_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "preferencias_usuario_select_own"
  ON public.preferencias_usuario FOR SELECT
  USING (auth.uid() = usuario_id);

CREATE POLICY "preferencias_usuario_insert_own"
  ON public.preferencias_usuario FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "preferencias_usuario_update_own"
  ON public.preferencias_usuario FOR UPDATE
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "preferencias_usuario_delete_own"
  ON public.preferencias_usuario FOR DELETE
  USING (auth.uid() = usuario_id);
