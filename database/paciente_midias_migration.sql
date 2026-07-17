-- Arquivos do paciente armazenados no Google Drive
-- (análoga a atendimento_midias, mas ligada ao paciente_id)

CREATE TABLE IF NOT EXISTS paciente_midias (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id     UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  google_drive_file_id  TEXT NOT NULL,
  google_drive_file_url TEXT,
  nome            TEXT NOT NULL,
  mime_type       TEXT,
  tamanho_bytes   BIGINT,
  criado_em       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paciente_midias_paciente_id ON paciente_midias(paciente_id);
