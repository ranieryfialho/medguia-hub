-- ================================================================
-- Tabela de notificações
-- ================================================================

CREATE TABLE IF NOT EXISTS public.notificacoes (
  id          uuid         DEFAULT gen_random_uuid() NOT NULL,
  usuario_id  uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo        text         NOT NULL,
  titulo      text         NOT NULL,
  mensagem    text         NOT NULL,
  lida        boolean      NOT NULL DEFAULT false,
  link        text,
  metadados   jsonb,
  criado_em   timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT notificacoes_pkey PRIMARY KEY (id)
);

-- Necessário para Supabase Realtime funcionar com INSERT/UPDATE
ALTER TABLE public.notificacoes REPLICA IDENTITY FULL;

CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario_id_criado_em
  ON public.notificacoes (usuario_id, criado_em DESC);

-- ================================================================
-- RLS
-- ================================================================

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notificacoes_select_own"
  ON public.notificacoes FOR SELECT
  USING (auth.uid() = usuario_id);

CREATE POLICY "notificacoes_update_own"
  ON public.notificacoes FOR UPDATE
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

-- Triggers inserem via SECURITY DEFINER — INSERT liberado para todos
CREATE POLICY "notificacoes_insert_service"
  ON public.notificacoes FOR INSERT
  WITH CHECK (true);

-- ================================================================
-- Trigger 1: contato_confirmacao (confirmou / vai_faltar / nao_atendeu)
-- ================================================================

CREATE OR REPLACE FUNCTION public.fn_notif_confirmacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome text;
BEGIN
  IF OLD.contato_confirmacao IS NOT DISTINCT FROM NEW.contato_confirmacao THEN
    RETURN NEW;
  END IF;

  IF NEW.contato_confirmacao NOT IN ('confirmou', 'vai_faltar', 'nao_atendeu') THEN
    RETURN NEW;
  END IF;

  IF NEW.profissional_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT nome INTO v_nome FROM pacientes WHERE id = NEW.paciente_id;
  v_nome := COALESCE(v_nome, 'Paciente');

  INSERT INTO notificacoes (usuario_id, tipo, titulo, mensagem, link, metadados)
  VALUES (
    NEW.profissional_id,
    CASE NEW.contato_confirmacao
      WHEN 'confirmou'    THEN 'agenda_confirmou'
      WHEN 'vai_faltar'   THEN 'agenda_vai_faltar'
      WHEN 'nao_atendeu'  THEN 'agenda_nao_atendeu'
    END,
    CASE NEW.contato_confirmacao
      WHEN 'confirmou'    THEN 'Confirmação recebida'
      WHEN 'vai_faltar'   THEN 'Paciente vai faltar'
      WHEN 'nao_atendeu'  THEN 'Sem contato com paciente'
    END,
    CASE NEW.contato_confirmacao
      WHEN 'confirmou'    THEN v_nome || ' confirmou o atendimento'
      WHEN 'vai_faltar'   THEN v_nome || ' informou que vai faltar'
      WHEN 'nao_atendeu'  THEN 'Não foi possível contatar ' || v_nome
    END,
    '/agenda',
    jsonb_build_object('atendimento_id', NEW.id, 'paciente_id', NEW.paciente_id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_confirmacao ON public.atendimentos;
CREATE TRIGGER trg_notif_confirmacao
  AFTER UPDATE OF contato_confirmacao ON public.atendimentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_notif_confirmacao();

-- ================================================================
-- Trigger 2: status → 'Falta'
-- ================================================================

CREATE OR REPLACE FUNCTION public.fn_notif_falta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  IF NEW.status <> 'Falta' THEN RETURN NEW; END IF;
  IF NEW.profissional_id IS NULL THEN RETURN NEW; END IF;

  SELECT nome INTO v_nome FROM pacientes WHERE id = NEW.paciente_id;
  v_nome := COALESCE(v_nome, 'Paciente');

  INSERT INTO notificacoes (usuario_id, tipo, titulo, mensagem, link, metadados)
  VALUES (
    NEW.profissional_id,
    'agenda_falta',
    'Paciente faltou',
    v_nome || ' não compareceu ao atendimento',
    '/agenda',
    jsonb_build_object('atendimento_id', NEW.id, 'paciente_id', NEW.paciente_id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_falta ON public.atendimentos;
CREATE TRIGGER trg_notif_falta
  AFTER UPDATE OF status ON public.atendimentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_notif_falta();

-- ================================================================
-- Trigger 3: prontuário com escala_dor >= 8
-- Nota: prontuários pendentes são calculados em tempo real na aplicação,
-- não via trigger, para refletir o estado atual sem dados históricos.
-- ================================================================

CREATE OR REPLACE FUNCTION public.fn_notif_dor_alta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome text;
BEGIN
  IF NEW.escala_dor IS NULL OR NEW.escala_dor < 8 THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.escala_dor IS NOT DISTINCT FROM NEW.escala_dor THEN RETURN NEW; END IF;
  IF NEW.profissional_id IS NULL THEN RETURN NEW; END IF;

  SELECT nome INTO v_nome FROM pacientes WHERE id = NEW.paciente_id;
  v_nome := COALESCE(v_nome, 'Paciente');

  INSERT INTO notificacoes (usuario_id, tipo, titulo, mensagem, link, metadados)
  VALUES (
    NEW.profissional_id,
    'prontuario_dor_alta',
    'Dor de alta intensidade registrada',
    v_nome || ' relatou dor ' || NEW.escala_dor || '/10',
    '/prontuarios/' || NEW.atendimento_id,
    jsonb_build_object(
      'prontuario_id', NEW.id,
      'paciente_id',   NEW.paciente_id,
      'escala_dor',    NEW.escala_dor
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_dor_alta ON public.prontuarios;
CREATE TRIGGER trg_notif_dor_alta
  AFTER INSERT OR UPDATE OF escala_dor ON public.prontuarios
  FOR EACH ROW EXECUTE FUNCTION public.fn_notif_dor_alta();

-- ================================================================
-- Trigger 5: permissões de acesso alteradas (só o usuário afetado)
-- ================================================================

CREATE OR REPLACE FUNCTION public.fn_notif_acesso_alterado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.modulos_liberados IS NOT DISTINCT FROM NEW.modulos_liberados THEN
    RETURN NEW;
  END IF;

  INSERT INTO notificacoes (usuario_id, tipo, titulo, mensagem, link, metadados)
  VALUES (
    NEW.id,
    'acesso_alterado',
    'Suas permissões foram atualizadas',
    'Um administrador modificou suas permissões de acesso ao sistema',
    NULL,
    jsonb_build_object(
      'modulos_anteriores', OLD.modulos_liberados,
      'modulos_novos',      NEW.modulos_liberados
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_acesso_alterado ON public.profiles;
CREATE TRIGGER trg_notif_acesso_alterado
  AFTER UPDATE OF modulos_liberados ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_notif_acesso_alterado();
