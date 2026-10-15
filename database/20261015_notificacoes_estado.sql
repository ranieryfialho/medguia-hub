-- ================================================================
-- Estado (lida / dispensada) das notificações derivadas
-- ================================================================
-- Notificações derivadas (prontuário pendente, follow-up, base fria, ...)
-- são calculadas em tempo real e não existem em public.notificacoes.
-- Esta tabela guarda, por usuário e chave estável, se foram lidas ou
-- dispensadas. Linhas cuja chave deixou de ser gerada (pendência
-- resolvida) são podadas pela aplicação.

CREATE TABLE IF NOT EXISTS public.notificacoes_estado (
  usuario_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  chave          text        NOT NULL,
  lida           boolean     NOT NULL DEFAULT false,
  dispensada     boolean     NOT NULL DEFAULT false,
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notificacoes_estado_pkey PRIMARY KEY (usuario_id, chave)
);

ALTER TABLE public.notificacoes_estado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notificacoes_estado_select_own" ON public.notificacoes_estado;
CREATE POLICY "notificacoes_estado_select_own" ON public.notificacoes_estado
  FOR SELECT USING (auth.uid() = usuario_id);
DROP POLICY IF EXISTS "notificacoes_estado_insert_own" ON public.notificacoes_estado;
CREATE POLICY "notificacoes_estado_insert_own" ON public.notificacoes_estado
  FOR INSERT WITH CHECK (auth.uid() = usuario_id);
DROP POLICY IF EXISTS "notificacoes_estado_update_own" ON public.notificacoes_estado;
CREATE POLICY "notificacoes_estado_update_own" ON public.notificacoes_estado
  FOR UPDATE USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);
DROP POLICY IF EXISTS "notificacoes_estado_delete_own" ON public.notificacoes_estado;
CREATE POLICY "notificacoes_estado_delete_own" ON public.notificacoes_estado
  FOR DELETE USING (auth.uid() = usuario_id);

-- Importa descartes antigos (profiles.pendentes_descartados)
INSERT INTO public.notificacoes_estado (usuario_id, chave, lida, dispensada)
SELECT p.id, d, true, true
FROM public.profiles p, unnest(p.pendentes_descartados) AS d
ON CONFLICT DO NOTHING;

-- ================================================================
-- Policies de public.notificacoes
-- ================================================================
-- Os triggers são SECURITY DEFINER (dono da tabela, ignoram RLS), então
-- INSERT aberto para todos não é necessário e permitia forjar
-- notificações para outros usuários.
DROP POLICY IF EXISTS "notificacoes_insert_service" ON public.notificacoes;

-- Necessária para "Limpar notificações" (delete do próprio usuário)
DROP POLICY IF EXISTS "notificacoes_delete_own" ON public.notificacoes;
CREATE POLICY "notificacoes_delete_own"
  ON public.notificacoes FOR DELETE
  USING (auth.uid() = usuario_id);

-- ================================================================
-- Modal diário de pendências (1x por dia, fuso America/Sao_Paulo)
-- ================================================================
-- Guarda o dia (local da clínica) em que o usuário já viu o modal.
-- Uma escrita por usuário por dia; a leitura vem junto da query de
-- profiles que o sino já faz, sem consulta extra.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS modal_notif_visto_em date;
