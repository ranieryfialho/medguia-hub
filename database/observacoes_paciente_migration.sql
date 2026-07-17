-- Tabela de observações do paciente com tags por tema
-- Substitui o campo observacoes_gerais para observações manuais

CREATE TABLE IF NOT EXISTS observacoes_paciente (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id             UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  texto                   TEXT,
  tag                     TEXT NOT NULL DEFAULT 'geral'
                            CHECK (tag IN ('agendamentos', 'comercial', 'contatos', 'followups', 'geral')),
  google_drive_file_id    TEXT,
  google_drive_file_url   TEXT,
  google_drive_file_nome  TEXT,
  google_drive_file_mime  TEXT,
  autor_id                UUID,
  criado_em               TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_observacoes_paciente_paciente_id ON observacoes_paciente(paciente_id);
CREATE INDEX IF NOT EXISTS idx_observacoes_paciente_tag ON observacoes_paciente(tag);

-- Migrar observações existentes de pacientes.observacoes_gerais → observacoes_paciente
-- Exclui linhas de metadados de inativação (__META__ / INATIVADO)
INSERT INTO observacoes_paciente (paciente_id, texto, tag, criado_em)
SELECT
  p.id AS paciente_id,
  trim(
    regexp_replace(
      regexp_replace(trim(linha), '^[•\-]\s*', ''),
      '^\[\d{2}/\d{2}/\d{4}\]\s*', ''
    )
  ) AS texto,
  'geral' AS tag,
  COALESCE(
    to_timestamp(
      (regexp_match(trim(linha), '\[(\d{2}/\d{2}/\d{4})\]'))[1],
      'DD/MM/YYYY'
    ),
    p.created_at,
    now()
  ) AS criado_em
FROM pacientes p,
  unnest(string_to_array(p.observacoes_gerais, E'\n')) AS linha
WHERE
  p.observacoes_gerais IS NOT NULL
  AND trim(linha) != ''
  AND trim(linha) NOT LIKE '%__META__%'
  AND trim(linha) NOT LIKE '%INATIVADO%'
  AND length(trim(
    regexp_replace(
      regexp_replace(trim(linha), '^[•\-]\s*', ''),
      '^\[\d{2}/\d{2}/\d{4}\]\s*', ''
    )
  )) > 0;