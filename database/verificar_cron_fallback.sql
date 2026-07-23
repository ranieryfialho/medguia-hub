-- ─── Verificação: o cron de segurança está mesmo ativo e rodando? ─────────────
-- Somente leitura.

-- 1. O job existe e está agendado como esperado?
SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE jobname = 'fechar-status-esquecidos';

-- 2. Ele já rodou alguma vez? Com sucesso?
SELECT jrd.runid, jrd.status, jrd.return_message, jrd.start_time, jrd.end_time
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname = 'fechar-status-esquecidos'
ORDER BY jrd.start_time DESC
LIMIT 10;

-- 3. Existe algum status manual aberto agora, e há quanto tempo?
SELECT
  h.profissional_id,
  p.full_name,
  h.status,
  h.inicio,
  NOW() - h.inicio AS tempo_aberto
FROM historico_status_disponibilidade h
JOIN profiles p ON p.id = h.profissional_id
WHERE h.fim IS NULL
ORDER BY h.inicio;
