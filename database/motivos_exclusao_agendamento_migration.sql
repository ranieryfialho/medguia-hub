-- T-034 (auditoria-exclusao-agendamentos): catálogo de motivos de exclusão de
-- agendamento + seed das 6 categorias do PRD 003.
--
-- A validação de que a categoria existe e está ativa acontece no servidor,
-- dentro de fn_excluir_atendimentos (T-035) — este catálogo é a fonte única
-- de verdade consultada por essa função e pelo modal. AC-057.
--
-- Ver .spec/features/auditoria-exclusao-agendamentos/spec.md
--   AC-044 — confirmação de exclusão avulsa fica bloqueada sem motivo
--   AC-045 — categoria "Outros" exige observação preenchida
--   AC-057 — categoria de motivo inexistente ou inativa é recusada

CREATE TABLE IF NOT EXISTS motivos_exclusao_agendamento (
  slug              TEXT    PRIMARY KEY,
  label             TEXT    NOT NULL,
  exige_observacao  BOOLEAN NOT NULL DEFAULT false,
  ordem             INTEGER NOT NULL,
  ativo             BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO motivos_exclusao_agendamento (slug, label, exige_observacao, ordem, ativo)
VALUES
  ('desistencia_paciente', 'Desistência do paciente (motivos pessoais/tempo)', false, 1, true),
  ('desistencia_financeira', 'Desistência por questões financeiras', false, 2, true),
  ('erro_agendamento', 'Erro de agendamento / duplicidade', false, 3, true),
  ('indisponibilidade_profissional', 'Indisponibilidade do profissional', false, 4, true),
  ('alta_medica', 'Alta médica / tratamento concluído antes do previsto', false, 5, true),
  ('outros', 'Outros', true, 6, true)
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  exige_observacao = EXCLUDED.exige_observacao,
  ordem = EXCLUDED.ordem,
  ativo = EXCLUDED.ativo;

ALTER TABLE motivos_exclusao_agendamento ENABLE ROW LEVEL SECURITY;

-- Catálogo é lido pelo modal (para montar os botões de categoria) e por
-- fn_excluir_atendimentos (SECURITY DEFINER, T-035) para validar a categoria
-- informada. Sem escrita liberada para authenticated: o catálogo é mantido
-- via migration/SQL Editor do Studio.
CREATE POLICY "Autenticados podem ler o catálogo de motivos de exclusão" ON motivos_exclusao_agendamento
  FOR SELECT TO authenticated USING (true);
