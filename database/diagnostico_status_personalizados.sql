-- ═══════════════════════════════════════════════════════════════════════════
-- Diagnóstico pré-decisão — RFC 002 (Ciclo de Vida dos Status Personalizados)
-- docs/rfcs/002-ciclo-de-vida-dos-status-personalizados.md — Ações 1, 2 e 3
--
-- SOMENTE LEITURA. Nenhum comando altera dado ou estrutura.
-- Rodar no SQL Editor do Studio (supabase.medguia.cloud) — cron.* e agregações
-- não saem via REST.
--
-- Rode um bloco por vez e anote o resultado no RFC.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- AÇÃO 1 — O pg_cron está ativo e rodando de fato?
--
-- Por que bloqueia: todo o desenho do fallback (item b da Opção 2) pressupõe
-- que este job roda. Se ele nunca rodou, o fallback de 2h também nunca
-- funcionou — e a Suposição 3 do RFC cai, mudando a solução, não só o prazo.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1.1 — A extensão está instalada?
--   instalado = false  → o fallback é 100% teórico hoje. Ver plano B no fim.
SELECT
  EXISTS (SELECT 1 FROM pg_extension          WHERE extname = 'pg_cron') AS instalado,
  EXISTS (SELECT 1 FROM pg_available_extensions WHERE name  = 'pg_cron') AS disponivel_para_instalar;

-- 1.2 — O job existe e está ativo?
--   Esperado: schedule = '*/10 * * * *', active = true, command com INTERVAL '2 hours'.
--   Zero linhas → o job foi perdido em algum restore/migração.
SELECT jobid, jobname, schedule, active, command
FROM cron.job
WHERE jobname = 'fechar-status-esquecidos';

-- 1.3 — Ele rodou mesmo? Com sucesso?  ◄── ESTA É A PERGUNTA QUE IMPORTA
--   Um job pode existir, estar ativo e nunca ter executado (típico quando o
--   worker do pg_cron não sobe, ou aponta para outro database).
--   Esperado: linhas recentes com status = 'succeeded', a cada ~10 min.
SELECT
  jrd.runid,
  jrd.status,
  jrd.return_message,
  jrd.start_time,
  jrd.end_time
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname = 'fechar-status-esquecidos'
ORDER BY jrd.start_time DESC
LIMIT 20;

-- 1.4 — Resumo: quando foi a última execução bem-sucedida?
--   ultima_execucao NULL, ou muito antiga → o fallback está morto.
SELECT
  COUNT(*)                                          AS execucoes_registradas,
  COUNT(*) FILTER (WHERE jrd.status = 'succeeded')  AS sucessos,
  COUNT(*) FILTER (WHERE jrd.status = 'failed')     AS falhas,
  MAX(jrd.start_time)                               AS ultima_execucao,
  NOW() - MAX(jrd.start_time)                       AS tempo_desde_ultima
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname = 'fechar-status-esquecidos';

-- 1.5 — Em qual database o pg_cron está apontando?
--   Causa clássica de "job existe mas nunca roda": cron.database_name aponta
--   para 'postgres' enquanto os dados vivem em outro database.
SELECT name, setting FROM pg_settings WHERE name LIKE 'cron.%';


-- ═══════════════════════════════════════════════════════════════════════════
-- AÇÃO 2 — Quantos profissionais estão travados agora?
--
-- Por que bloqueia: dimensiona o backfill (Ação 11) e mede o tamanho real do
-- defeito descrito no Sumário Executivo do RFC.
-- ═══════════════════════════════════════════════════════════════════════════

-- 2.1 — Registros de histórico ainda ABERTOS (fim IS NULL).
--   Se o cron estiver funcionando, nenhum deve passar de ~2h10.
--   Qualquer linha com tempo_aberto > 2h30 é prova de que o cron NÃO está rodando.
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

-- 2.2 — Profissionais TRAVADOS no status ao vivo.  ◄── O DEFEITO CENTRAL DO RFC
--   Status manual em status_disponibilidade cujo histórico já foi fechado pelo
--   cron (ou nem existe). Estes aparecem "Em reunião há N horas" no widget —
--   e apareceriam assim no card novo da agenda.
--   Cada linha aqui é um profissional que a equipe enxerga como indisponível
--   sem que nenhum tempo esteja sendo registrado.
SELECT
  sd.profissional_id,
  p.full_name,
  sd.status,
  sd.atualizado_em,
  NOW() - sd.atualizado_em AS travado_ha,
  EXISTS (
    SELECT 1 FROM historico_status_disponibilidade h
    WHERE h.profissional_id = sd.profissional_id AND h.fim IS NULL
  ) AS tem_historico_aberto
FROM status_disponibilidade sd
JOIN profiles p ON p.id = sd.profissional_id
WHERE sd.status NOT IN ('disponivel', 'ausente', 'ocupado')
  AND sd.atualizado_em < NOW() - INTERVAL '2 hours'
ORDER BY sd.atualizado_em;

-- 2.3 — Resumo do backfill: quantos e há quanto tempo.
SELECT
  COUNT(*)                                     AS profissionais_travados,
  MIN(NOW() - sd.atualizado_em)                AS menor_tempo_travado,
  MAX(NOW() - sd.atualizado_em)                AS maior_tempo_travado,
  COUNT(*) FILTER (
    WHERE sd.atualizado_em < NOW() - INTERVAL '24 hours'
  )                                            AS travados_ha_mais_de_24h
FROM status_disponibilidade sd
WHERE sd.status NOT IN ('disponivel', 'ausente', 'ocupado')
  AND sd.atualizado_em < NOW() - INTERVAL '2 hours';

-- 2.4 — Distribuição: quais status prendem mais?
SELECT
  sd.status,
  COUNT(*) AS qtd
FROM status_disponibilidade sd
WHERE sd.status NOT IN ('disponivel', 'ausente', 'ocupado')
GROUP BY sd.status
ORDER BY qtd DESC;


-- ═══════════════════════════════════════════════════════════════════════════
-- AÇÃO 3 — A contagem dupla retroativa é material?
--
-- Por que bloqueia: se for grande, os números de Tempo Fábril já usados em
-- decisão de gestão estão INFLADOS. Muda o escopo (Ação 7) e a comunicação.
--
-- O defeito: kpis-tempo-fabril.ts soma horasAgendamentoMin (atendimentos
-- fabris) + tempoStatusMin (status personalizados) sem verificar sobreposição.
-- Quando um fisio marca "Reunião" durante o horário de um atendimento
-- Concluído/Em Atendimento, o mesmo tempo de relógio conta DUAS vezes.
--
-- NOTA: este é o LIMITE SUPERIOR. O cálculo real capa o tempo de status pela
-- interseção com a jornada do profissional (calcularMinutosStatusNaJornada),
-- então a inflação efetiva é ≤ ao que aparece aqui. Serve para decidir se vale
-- investigar a fundo, não como número final.
-- ═══════════════════════════════════════════════════════════════════════════

-- 3.1 — Sobreposições nos últimos 90 dias, uma linha por par.
WITH atendimentos_fabris AS (
  SELECT
    a.id,
    COALESCE(a.fisioterapeuta_id, a.profissional_id) AS executor_id,
    a.profissional_id,
    a.fisioterapeuta_id,
    a.data_agendamento                                                        AS ini,
    a.data_agendamento + (COALESCE(a.duracao_minutos, 60) || ' min')::interval AS fim
  FROM atendimentos a
  WHERE a.data_agendamento >= NOW() - INTERVAL '90 days'
    -- fabril = Concluído ou Em Atendimento (isStatusFabril).
    -- LIKE 'conclu%' cobre as variantes de acento e o mojibake conhecido.
    AND (lower(a.status) LIKE 'conclu%' OR lower(a.status) = 'em atendimento')
)
SELECT
  p.full_name,
  h.status                                     AS status_personalizado,
  h.inicio                                     AS status_inicio,
  h.fim                                        AS status_fim,
  af.id                                        AS atendimento_id,
  af.ini                                       AS atendimento_inicio,
  af.fim                                       AS atendimento_fim,
  ROUND(EXTRACT(EPOCH FROM (
    LEAST(af.fim, h.fim) - GREATEST(af.ini, h.inicio)
  )) / 60)::int                                AS minutos_contados_2x
FROM historico_status_disponibilidade h
JOIN profiles p ON p.id = h.profissional_id
JOIN atendimentos_fabris af
  ON (af.profissional_id = h.profissional_id OR af.fisioterapeuta_id = h.profissional_id)
 AND af.ini < h.fim
 AND af.fim > h.inicio
WHERE h.fim IS NOT NULL
  AND h.inicio >= NOW() - INTERVAL '90 days'
ORDER BY minutos_contados_2x DESC
LIMIT 100;

-- 3.2 — VEREDITO: quanto do Tempo Fábril é contagem dupla?
--   pct_inflacao_estimada é o número que decide o escopo da Ação 7:
--     < 1%   → ruído. Corrigir por higiene, sem urgência.
--     1–5%   → material. Corrigir e mencionar no comunicado.
--     > 5%   → grave. Números históricos usados em decisão estão errados;
--              exige comunicação explícita à gestão.
WITH atendimentos_fabris AS (
  SELECT
    a.id,
    a.profissional_id,
    a.fisioterapeuta_id,
    COALESCE(a.duracao_minutos, 60)                                           AS dur,
    a.data_agendamento                                                        AS ini,
    a.data_agendamento + (COALESCE(a.duracao_minutos, 60) || ' min')::interval AS fim
  FROM atendimentos a
  WHERE a.data_agendamento >= NOW() - INTERVAL '90 days'
    AND (lower(a.status) LIKE 'conclu%' OR lower(a.status) = 'em atendimento')
),
sobreposicao AS (
  SELECT
    ROUND(EXTRACT(EPOCH FROM (
      LEAST(af.fim, h.fim) - GREATEST(af.ini, h.inicio)
    )) / 60)::int AS min
  FROM historico_status_disponibilidade h
  JOIN atendimentos_fabris af
    ON (af.profissional_id = h.profissional_id OR af.fisioterapeuta_id = h.profissional_id)
   AND af.ini < h.fim
   AND af.fim > h.inicio
  WHERE h.fim IS NOT NULL
    AND h.inicio >= NOW() - INTERVAL '90 days'
),
totais AS (
  SELECT
    (SELECT COALESCE(SUM(dur), 0) FROM atendimentos_fabris) AS min_atendimentos,
    (SELECT COALESCE(SUM(duracao_minutos), 0)
       FROM historico_status_disponibilidade
      WHERE fim IS NOT NULL
        AND inicio >= NOW() - INTERVAL '90 days')           AS min_status,
    (SELECT COALESCE(SUM(min), 0) FROM sobreposicao)        AS min_duplicados,
    (SELECT COUNT(*) FROM sobreposicao)                     AS pares_sobrepostos
)
SELECT
  min_atendimentos,
  min_status,
  min_atendimentos + min_status                          AS tempo_fabril_bruto_min,
  min_duplicados,
  pares_sobrepostos,
  ROUND(min_duplicados / 60.0, 1)                        AS horas_contadas_2x,
  CASE
    WHEN min_atendimentos + min_status = 0 THEN 0
    ELSE ROUND(100.0 * min_duplicados / (min_atendimentos + min_status), 2)
  END                                                    AS pct_inflacao_estimada
FROM totais;

-- 3.3 — Quem é mais afetado (para checar se é sistêmico ou um caso isolado).
WITH atendimentos_fabris AS (
  SELECT
    a.profissional_id,
    a.fisioterapeuta_id,
    a.data_agendamento                                                        AS ini,
    a.data_agendamento + (COALESCE(a.duracao_minutos, 60) || ' min')::interval AS fim
  FROM atendimentos a
  WHERE a.data_agendamento >= NOW() - INTERVAL '90 days'
    AND (lower(a.status) LIKE 'conclu%' OR lower(a.status) = 'em atendimento')
)
SELECT
  p.full_name,
  COUNT(*)                                     AS ocorrencias,
  ROUND(SUM(EXTRACT(EPOCH FROM (
    LEAST(af.fim, h.fim) - GREATEST(af.ini, h.inicio)
  )) / 3600)::numeric, 1)                      AS horas_contadas_2x
FROM historico_status_disponibilidade h
JOIN profiles p ON p.id = h.profissional_id
JOIN atendimentos_fabris af
  ON (af.profissional_id = h.profissional_id OR af.fisioterapeuta_id = h.profissional_id)
 AND af.ini < h.fim
 AND af.fim > h.inicio
WHERE h.fim IS NOT NULL
  AND h.inicio >= NOW() - INTERVAL '90 days'
GROUP BY p.full_name
ORDER BY horas_contadas_2x DESC;


-- ═══════════════════════════════════════════════════════════════════════════
-- BÔNUS — confirma as Divergências 1 e 3 da seção "Contrato dos Status"
-- ═══════════════════════════════════════════════════════════════════════════

-- B.1 — 'ocupado' está mesmo marcado como não-sistema?
--   Esperado (confirmando o defeito): sistema = false para 'ocupado'.
--   Enquanto for false, ele aparece na lista "Meu status" do widget.
SELECT slug, label, label_curto, sistema, ativo, ordem
FROM status_disponibilidade_opcoes
ORDER BY ordem;

-- B.2 — Alguém já se marcou como 'ocupado' manualmente?
--   Quem fez isso encerrou o próprio status personalizado sem abrir outro
--   (Divergência 1, efeito 2). Se vier > 0, o defeito não é teórico.
SELECT COUNT(*) AS profissionais_em_ocupado_agora
FROM status_disponibilidade
WHERE status = 'ocupado';


-- ═══════════════════════════════════════════════════════════════════════════
-- AÇÃO 3B — ESCRITORES LEGADOS EM status_disponibilidade   ◄── RODAR ISTO
--
-- Motivo: database/status_disponibilidade_automatico.sql (migração antiga)
-- criou DOIS escritores que gravam direto em status_disponibilidade:
--
--   1. cron 'atualizar-status-em-atendimento' — roda A CADA MINUTO e escreve
--      'ocupado' para quem tem atendimento em curso.
--   2. trigger 'trg_concluir_atendimento' em atendimentos — escreve
--      'disponivel' ao concluir um atendimento sem próximo em 90min.
--
-- Se ainda estiverem ativos, ambos SOBRESCREVEM o status personalizado do
-- profissional. Isso dispara fn_log_mudanca_status_disponibilidade, que vê
-- OLD.status = 'reuniao' e FECHA o registro de histórico sem abrir outro —
-- encerrando a reunião de alguém sem que ninguém perceba.
--
-- É a mesma classe do defeito de julho (escritor legado nunca desativado).
-- A query 1.2 não pegou isso porque filtrava por um jobname específico.
-- ═══════════════════════════════════════════════════════════════════════════

-- 3B.1 — TODOS os jobs de cron, sem filtro.  ◄── A PERGUNTA PRINCIPAL
--   Se 'atualizar-status-em-atendimento' aparecer com active = true,
--   existem TRÊS fontes escrevendo em status_disponibilidade.
SELECT jobid, jobname, schedule, active, command
FROM cron.job
ORDER BY jobid;

-- 3B.2 — O job legado rodou recentemente? Quantas linhas ele altera por vez?
--   return_message 'INSERT 0 N' com N > 0 = ele está sobrescrevendo status agora.
SELECT
  j.jobname,
  jrd.status,
  jrd.return_message,
  jrd.start_time
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname = 'atualizar-status-em-atendimento'
ORDER BY jrd.start_time DESC
LIMIT 20;

-- 3B.3 — Quais triggers estão vivos em atendimentos e status_disponibilidade?
--   Procurar por: trg_concluir_atendimento (legado, escreve 'disponivel')
--                 trg_log_status_disponibilidade (atual, alimenta o histórico)
SELECT
  c.relname   AS tabela,
  t.tgname    AS trigger_name,
  p.proname   AS funcao,
  t.tgenabled AS habilitado   -- 'O' = ativo, 'D' = desabilitado
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_proc  p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal
  AND c.relname IN ('atendimentos', 'status_disponibilidade')
ORDER BY c.relname, t.tgname;

-- 3B.4 — A função legada ainda existe no banco?
SELECT proname
FROM pg_proc
WHERE proname IN (
  'fn_atualizar_status_em_atendimento',
  'fn_trigger_concluir_atendimento',
  'fn_trigger_historico_reuniao'   -- esta deveria ter sumido no fix de julho
);

-- 3B.5 — Evidência do estrago: registros de histórico com duração suspeita.
--   Blocos personalizados que duraram < 5 min são candidatos a terem sido
--   fechados por um escritor legado, não pelo profissional.
SELECT
  p.full_name,
  h.status,
  h.inicio,
  h.fim,
  h.duracao_minutos
FROM historico_status_disponibilidade h
JOIN profiles p ON p.id = h.profissional_id
WHERE h.fim IS NOT NULL
  AND h.duracao_minutos < 5
  AND h.inicio >= NOW() - INTERVAL '90 days'
ORDER BY h.inicio DESC
LIMIT 50;

-- 3B.6 — Quem está em 'ocupado' agora, e há atendimento que justifique?
--   origem = 'manual' + sem atendimento em curso → foi escolha do profissional.
--   Sem origem manual + com atendimento em curso → foi o job legado.
SELECT
  p.full_name,
  sd.status,
  sd.atualizado_em,
  EXISTS (
    SELECT 1 FROM atendimentos a
    WHERE (a.profissional_id = sd.profissional_id OR a.fisioterapeuta_id = sd.profissional_id)
      AND a.status IN ('Aguardando', 'Aguardando Consulta', 'Confirmado')
      AND a.data_agendamento <= NOW()
      AND a.data_agendamento + (COALESCE(a.duracao_minutos, 60) || ' min')::interval >= NOW()
  ) AS tem_atendimento_em_curso
FROM status_disponibilidade sd
JOIN profiles p ON p.id = sd.profissional_id
WHERE sd.status = 'ocupado';


-- ═══════════════════════════════════════════════════════════════════════════
-- PLANO B — se a Ação 1 mostrar que o pg_cron não está disponível
--
-- Criar src/app/api/cron/fechar-status-esquecidos/route.ts rodando as mesmas
-- duas queries (na ordem: fechar histórico → resetar status) via service role,
-- e chamá-la por crontab do SO na VPS:
--
--   */10 * * * * curl -s -X POST https://hub.medguia.cloud/api/cron/fechar-status-esquecidos \
--     -H "Authorization: Bearer $CRON_SECRET" >> /var/log/fechar-status-esquecidos.log 2>&1
--
-- Esboço já registrado em database/fix_reuniao_duplicidade_migration.sql.
-- ═══════════════════════════════════════════════════════════════════════════
