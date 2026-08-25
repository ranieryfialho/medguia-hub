-- T-033 (auditoria-exclusao-agendamentos): tabela de auditoria append-only das
-- exclusões de agendamento, índices de leitura, trigger de imutabilidade e RLS
-- de SELECT.
--
-- Deliberadamente SEM `REFERENCES` para atendimentos/pacientes/profiles: o
-- registro de auditoria precisa sobreviver mesmo que o paciente, o profissional
-- ou o atendimento original sejam removidos depois (ver design.md, "Restrição
-- de integridade deliberada" / TDD 003). Por isso os dados relevantes ficam
-- desnormalizados nas colunas *_nome e no snapshot `dados_agendamento`.
--
-- Ver .spec/features/auditoria-exclusao-agendamentos/spec.md
--   AC-053 — snapshot reflete o estado do atendimento antes da remoção
--   AC-055 — registro não pode ser alterado nem apagado, nem pelo service role
--   AC-058 — aba Logs lista as exclusões do paciente em ordem cronológica decrescente

CREATE TABLE IF NOT EXISTS agendamentos_auditoria (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acao                TEXT        NOT NULL,
  motivo_categoria    TEXT        NOT NULL,
  motivo_observacao   TEXT,
  usuario_id          UUID        NOT NULL,
  usuario_nome        TEXT,
  paciente_id         UUID,
  paciente_nome       TEXT,
  profissional_id     UUID,
  profissional_nome   TEXT,
  atendimento_id      UUID        NOT NULL,
  agendamento_id      UUID,
  dados_agendamento   JSONB       NOT NULL
);

CREATE INDEX IF NOT EXISTS agendamentos_auditoria_paciente_criado_em_idx
  ON agendamentos_auditoria (paciente_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS agendamentos_auditoria_criado_em_idx
  ON agendamentos_auditoria (criado_em DESC);

CREATE INDEX IF NOT EXISTS agendamentos_auditoria_usuario_id_idx
  ON agendamentos_auditoria (usuario_id);

CREATE INDEX IF NOT EXISTS agendamentos_auditoria_profissional_id_idx
  ON agendamentos_auditoria (profissional_id);

CREATE INDEX IF NOT EXISTS agendamentos_auditoria_motivo_categoria_idx
  ON agendamentos_auditoria (motivo_categoria);

-- Append-only: nenhuma linha pode ser alterada ou apagada depois de gravada,
-- nem pelo service role (que ignora RLS, mas não escapa de um trigger). AC-055.
CREATE OR REPLACE FUNCTION fn_agendamentos_auditoria_bloquear_alteracao()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'agendamentos_auditoria é append-only: % não é permitido', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_auditoria_append_only ON agendamentos_auditoria;

CREATE TRIGGER trg_auditoria_append_only
  BEFORE UPDATE OR DELETE ON agendamentos_auditoria
  FOR EACH ROW
  EXECUTE FUNCTION fn_agendamentos_auditoria_bloquear_alteracao();

ALTER TABLE agendamentos_auditoria ENABLE ROW LEVEL SECURITY;

-- ASM-012: a aba "Logs" do paciente é visível para qualquer usuário com acesso
-- ao paciente, sem restrição adicional a gestor — mesmo gate de módulo das
-- demais abas de /pacientes/[id]. AC-058.
CREATE POLICY "Autenticados podem ler auditoria de exclusão" ON agendamentos_auditoria
  FOR SELECT TO authenticated USING (true);

-- Sem política de INSERT/UPDATE/DELETE para authenticated: a única via de
-- escrita é fn_excluir_atendimentos (SECURITY DEFINER, T-035), e o trigger
-- acima recusa UPDATE/DELETE mesmo vindos do service role.
