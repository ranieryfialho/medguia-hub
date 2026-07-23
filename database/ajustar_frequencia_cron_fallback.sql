-- ─── Aumenta a frequência de checagem do fallback (mantém o cap em 2h) ────────
-- Antes: rodava de hora em hora ('0 * * * *').
-- Agora: roda a cada 10 minutos ('*/10 * * * *'), continua fechando qualquer
-- status manual/personalizado aberto há mais de 2h. Custo desprezível: a query
-- usa o índice parcial idx_hist_status_fim_null (só olha registros com fim IS
-- NULL, tipicamente poucas linhas — um por profissional em status manual agora).
SELECT cron.schedule(
  'fechar-status-esquecidos',
  '*/10 * * * *',
  $cron$
  UPDATE historico_status_disponibilidade
  SET fim = inicio + INTERVAL '2 hours'
  WHERE fim IS NULL
    AND inicio < NOW() - INTERVAL '2 hours';
  $cron$
);

-- Confirma o novo agendamento
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'fechar-status-esquecidos';
