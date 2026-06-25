ALTER TABLE follow_ups
ADD COLUMN status TEXT NOT NULL DEFAULT 'pendente'
  CHECK (status IN ('pendente', 'concluido'));

CREATE INDEX follow_ups_status_idx ON follow_ups(status);
