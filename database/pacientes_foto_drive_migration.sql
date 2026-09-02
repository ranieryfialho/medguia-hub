-- Adiciona colunas de foto de perfil (Google Drive) em `pacientes`.
-- Feature: foto-paciente-drive-avatar (spec.md, US-026, US-028)
--
-- Decisão A da RFC 006: sem coluna `foto_drive_url`/`webViewLink` — a foto é
-- servida sempre pelo proxy autenticado `/api/drive/file/[fileId]`, nunca por
-- link direto do Drive.
--
-- DDL: aplicar via SQL Editor do Studio (não passa por REST).

ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS foto_drive_file_id text;
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS foto_atualizada_em timestamptz;

-- Índice parcial: só indexa pacientes que de fato têm foto, mantendo o
-- índice pequeno (a maioria dos pacientes não tem foto).
CREATE INDEX IF NOT EXISTS idx_pacientes_foto_drive_file_id
  ON pacientes (foto_drive_file_id)
  WHERE foto_drive_file_id IS NOT NULL;
