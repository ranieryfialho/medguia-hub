-- ─── Diagnóstico: o Realtime de status_disponibilidade está funcionando? ──────
-- Feature: status-personalizados-ciclo-vida (T-018 / AC-027) · Responde Q-002
--
-- SOMENTE LEITURA. Nenhum comando altera dado ou estrutura.
-- Rodar no SQL Editor do Studio — pg_publication_tables, pg_class e cron.* não
-- saem via REST.
--
-- A PERGUNTA: as escritas que o `pg_cron` faz em status_disponibilidade chegam
-- às telas, ou só as escritas feitas pela aplicação chegam? Se só as da
-- aplicação chegarem, o profissional expirado continua aparecendo em status
-- personalizado até alguém recarregar a página.
--
-- Isso NÃO bloqueia a entrega do contador: por AC-026 ele é derivado do
-- instante de abertura e fica correto de qualquer forma. O que está em jogo é a
-- decisão de Q-003 — se o card da agenda precisa da rede de polling de 60s que
-- o widget já tem em useRealtimeDisponibilidade.
--
-- COMO LER O RESULTADO: as quatro seções são uma corrente. Basta uma falhar
-- para o evento não chegar ao navegador. Leia na ordem.

-- ─── 1. A tabela está publicada para o Realtime? ──────────────────────────────
-- Condição necessária. Se não estiver, nenhum evento sai — nem do cron, nem da
-- aplicação. `status_disponibilidade_migration.sql:26` diz que foi adicionada;
-- esta consulta confirma que continua lá.
--
-- ESPERADO: uma linha para status_disponibilidade.
SELECT schemaname,
       tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('status_disponibilidade', 'atendimentos')
ORDER BY tablename;

-- ─── 2. A publicação entrega UPDATE? ──────────────────────────────────────────
-- Uma publicação pode existir e mesmo assim não publicar updates.
--
-- ESPERADO: pubupdate = true.
SELECT pubname,
       pubinsert,
       pubupdate,
       pubdelete
FROM pg_publication
WHERE pubname = 'supabase_realtime';

-- ─── 3. A replica identity permite identificar a linha alterada? ──────────────
-- 'd' (default) = só a chave primária vai no WAL. Suficiente para o payload
-- `new`, que é o que o cliente lê (`payload.new`) tanto em CardStatusEquipe
-- quanto em useRealtimeDisponibilidade.
-- 'f' (full) = a linha antiga inteira também vai. Necessário só se algum dia
-- precisarmos comparar `old` com `new`.
--
-- ESPERADO: 'd' ou 'f'. Se vier 'n' (nothing), o UPDATE não é replicável e o
-- Realtime silencia — é o achado que explicaria tudo.
SELECT c.relname          AS tabela,
       c.relreplident     AS replica_identity,
       CASE c.relreplident
         WHEN 'd' THEN 'default (chave primária) — suficiente para payload.new'
         WHEN 'f' THEN 'full (linha inteira)'
         WHEN 'i' THEN 'index'
         WHEN 'n' THEN 'NOTHING — UPDATE não replica, o Realtime silencia'
       END               AS leitura,
       c.relhasindex     AS tem_indice
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'status_disponibilidade';

-- ─── 4. Existe política de leitura para quem assina? ──────────────────────────
-- O Realtime aplica a RLS do assinante antes de entregar o evento. Tabela
-- publicada com RLS ligada e SEM política de SELECT para o papel autenticado
-- entrega silêncio — sem erro no console, sem evento. É a falha mais difícil
-- de diagnosticar pelo front, e o motivo de esta seção existir.
--
-- ESPERADO: rls_ligada = true E ao menos uma política de SELECT abrangendo
-- 'authenticated'. Se rls_ligada = false, não há filtro e todos recebem.
SELECT c.relrowsecurity AS rls_ligada
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'status_disponibilidade';

SELECT policyname,
       cmd,
       roles,
       qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'status_disponibilidade'
ORDER BY cmd, policyname;

-- ─── 5. O job está de fato alterando linhas? ──────────────────────────────────
-- Se o cron nunca escreve, não há evento a propagar e o Realtime está sendo
-- acusado de um crime que não cometeu. `return_message` traz o "UPDATE n" —
-- foi assim que a execução runid 2603 foi flagrada em 10/08.
--
-- ESPERADO: execuções 'succeeded' recentes. "UPDATE 0" é normal e saudável
-- (ninguém a expirar no ciclo); o que importa é ver algum "UPDATE n" com n > 0
-- em algum momento do dia.
SELECT jrd.runid,
       jrd.start_time,
       jrd.status,
       jrd.return_message
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname = 'fechar-status-esquecidos'
ORDER BY jrd.start_time DESC
LIMIT 20;

-- ─── 6. Quem está em status personalizado neste instante ──────────────────────
-- Contraprova direta: rode esta consulta, abra a rota de agendamento e compare.
-- Se o banco mostra alguém já devolvido para 'disponivel' e a tela ainda mostra
-- o status personalizado sem recarregar, o Realtime não propagou a escrita do
-- cron — e Q-003 (polling no card) passa a ser sim.
--
-- Com o teto de 2h vigente, `deveria_ter_expirado = true` só é aceitável para
-- quem venceu há menos de 10 minutos: é a janela do próximo ciclo do cron.
SELECT sd.profissional_id,
       p.full_name,
       sd.status,
       sd.origem,
       sd.observacao,
       sd.atualizado_em,
       NOW() - sd.atualizado_em                             AS ha_quanto_tempo,
       sd.atualizado_em < NOW() - INTERVAL '2 hours'        AS deveria_ter_expirado
FROM status_disponibilidade sd
JOIN profiles p ON p.id = sd.profissional_id
WHERE sd.status NOT IN ('disponivel', 'ausente', 'ocupado')
  AND p.ativo
ORDER BY sd.atualizado_em;
