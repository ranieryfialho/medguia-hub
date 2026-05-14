-- Índices para atendimentos
-- agendamento_id não possui índice (Postgres não indexa FKs automaticamente).
-- O índice composto cobre tanto o filtro por agendamento_id quanto a ordenação
-- por data_agendamento, eliminando um sort separado nas queries de recorrência.
CREATE INDEX IF NOT EXISTS atendimentos_agendamento_data_idx
  ON atendimentos(agendamento_id, data_agendamento);

-- Cobre queries por paciente (ex: contagem de atendimentos na jornada)
CREATE INDEX IF NOT EXISTS atendimentos_paciente_id_idx
  ON atendimentos(paciente_id);

-- Cobre queries por profissional + data (ex: agenda do dia, disponibilidade)
CREATE INDEX IF NOT EXISTS atendimentos_profissional_data_idx
  ON atendimentos(profissional_id, data_agendamento);
