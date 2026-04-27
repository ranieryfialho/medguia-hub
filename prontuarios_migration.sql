-- Tabela de prontuários (evolução clínica por sessão)
CREATE TABLE IF NOT EXISTS prontuarios (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  atendimento_id    UUID NOT NULL REFERENCES atendimentos(id) ON DELETE CASCADE,
  paciente_id       UUID NOT NULL REFERENCES pacientes(id),
  profissional_id   UUID REFERENCES profiles(id),
  queixa_principal  TEXT,
  evolucao          TEXT,
  procedimentos     TEXT,
  escala_dor        SMALLINT CHECK (escala_dor BETWEEN 0 AND 10),
  observacoes       TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (atendimento_id)
);

CREATE INDEX IF NOT EXISTS prontuarios_paciente_id_idx    ON prontuarios(paciente_id);
CREATE INDEX IF NOT EXISTS prontuarios_atendimento_id_idx ON prontuarios(atendimento_id);

-- RLS
ALTER TABLE prontuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prontuarios_select" ON prontuarios
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "prontuarios_insert" ON prontuarios
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "prontuarios_update" ON prontuarios
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);