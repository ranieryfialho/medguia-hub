-- ─── Diagnóstico: o worker do pg_cron está carregado no servidor? ─────────────
-- Somente leitura. Se 'pg_cron' NÃO aparecer em shared_preload_libraries,
-- o worker nunca vai rodar os jobs — precisa editar postgresql.conf (ou a
-- config do container) e reiniciar o Postgres pra valer.

SELECT name, setting
FROM pg_settings
WHERE name IN ('shared_preload_libraries', 'cron.database_name', 'cron.host', 'cron.max_running_jobs');

-- Confere também se o processo do worker aparece na lista de atividade:
SELECT pid, application_name, state, query, backend_start
FROM pg_stat_activity
WHERE application_name ILIKE '%cron%' OR query ILIKE '%cron%';
