-- ─── Migration: havendo atendimento marcado, o status para e vira "Em atendimento" ───
-- Feature: status-personalizados-ciclo-vida (T-028 / AC-037, AC-038, AC-042)
--
-- SUPERSEDE status_personalizados_fallback_2h_migration.sql, aplicada em
-- 11/08/2026. Aquele arquivo NÃO é editado: ele é o registro do que rodou em
-- produção. Como `cron.schedule` substitui o comando INTEIRO do job, esta
-- migration reagenda `fechar-status-esquecidos` carregando os dois comandos que
-- já existiam — teto de 2h (AC-004/005/006) e rede de destravamento (AC-019) —
-- textualmente iguais, mais o comando novo.
--
-- O QUE MOTIVOU (12/08/2026): uma fisioterapeuta declarou "Hora administrativa"
-- tendo atendimento marcado na mesma janela. A tela mostrava um estado (o
-- atendimento vence, decisão de 10/08) e o relatório somava os dois —
-- `tempoFabril = horasAgendamento + tempoStatusPersonalizado`, sem subtrair
-- interseção. É a última violação de C1 (fonte única da verdade) que o RFC 002
-- deixou de pé.
--
-- POR QUE O GANCHO É O RELÓGIO, E NÃO O CLIQUE: a primeira versão desta regra
-- usava a transição do atendimento para "Em Atendimento" como gatilho. Está
-- errada na operação real — **os fisioterapeutas nem sempre marcam "Em
-- Atendimento"**. Amarrar a regra a esse clique a deixaria inerte justamente
-- nos casos em que ninguém mexe no sistema, que são os mesmos em que a pessoa
-- também esquece de sair do status. A regra depende só da agenda e do relógio.
--
-- O QUE ESTA MIGRATION **NÃO** FAZ: não grava 'ocupado' em
-- status_disponibilidade, por mais que o critério fale em "Em atendimento".
-- `ocupado` é status DERIVADO — a regra 1 da fn_status_equipe_agora já o
-- devolve para quem tem atendimento na janela, com prioridade sobre qualquer
-- declaração, e AC-011 o marcou como status de sistema exatamente para que
-- ninguém o escreva à mão. Gravá-lo reintroduziria a Divergência 1 do RFC 002,
-- que esta feature acabou de fechar. O job apaga a DECLARAÇÃO; a derivação
-- assume e mostra "Em atendimento" enquanto durar a janela do atendimento.

-- ─── 1. 'agenda' passa a ser uma origem válida ────────────────────────────────
-- Sem isto o comando novo viola status_disponibilidade_origem_check e o job
-- falha A CADA 10 MINUTOS EM SILÊNCIO: o pg_cron registra o erro em
-- cron.job_run_details e nada mais aparece. É o mesmo modo de falha que manteve
-- o Realtime quebrado por dois meses sem ninguém notar (Q-002).
--
-- A constraint foi criada em status_personalizados_fallback_1h_migration.sql:34
-- com o domínio ('manual', 'automatico', 'fallback').
ALTER TABLE status_disponibilidade
  DROP CONSTRAINT IF EXISTS status_disponibilidade_origem_check;

ALTER TABLE status_disponibilidade
  ADD CONSTRAINT status_disponibilidade_origem_check
  CHECK (origem IN ('manual', 'automatico', 'fallback', 'agenda'));

-- ─── 2. Reagenda o job com o comando novo à frente dos dois antigos ───────────
SELECT cron.schedule(
  'fechar-status-esquecidos',
  '*/10 * * * *',
  $cron$
  -- ─── NOVO: o bloco para na hora marcada do atendimento (AC-037) ────────────
  --
  -- VEM PRIMEIRO de propósito. Um bloco aberto há mais de 2h que TAMBÉM tenha
  -- atendimento marcado deve fechar na hora do atendimento, não em inicio+2h.
  -- Se o teto rodasse antes, ele fecharia o bloco e este comando não acharia
  -- mais nada aberto — gravando a hora errada de forma permanente.
  --
  -- MIN É OBRIGATÓRIO (AC-038). Havendo dois atendimentos elegíveis na janela,
  -- um UPDATE ... FROM sem agregação deixa o Postgres escolher QUALQUER um dos
  -- dois. O bloco fecharia numa hora não determinística — o pior tipo de
  -- defeito para auditar depois, porque roda diferente a cada execução.
  --
  -- FILTRO POSITIVO DE STATUS (AC-037). Uma lista negativa ("tudo que não for
  -- cancelado") erraria em silêncio: 'Reagendado' tem variantes de grafia em
  -- STATUS_RAW_VALUES_BY_KEY ('Reposição', 'reposicao', 'reposiçao'), e
  -- esquecer uma delas encerraria o bloco de alguém por causa de um atendimento
  -- que não aconteceu. lower() cobre as variantes de caixa.
  --
  -- data_agendamento >= h.inicio (AC-042): não fecha bloco em hora anterior ao
  -- próprio início. Um status declarado NO MEIO de um atendimento em curso tem
  -- hora marcada anterior ao bloco; gravar esse fim produziria duração zero ou
  -- negativa. Essa sobreposição residual é tratada pelo desconto no cálculo do
  -- Tempo Fábril (AC-039), não aqui.
  WITH blocos_com_atendimento AS (
    SELECT h.id                     AS historico_id,
           h.profissional_id        AS profissional_id,
           MIN(a.data_agendamento)  AS hora_marcada
    FROM historico_status_disponibilidade h
    JOIN public.atendimentos a
      ON (a.profissional_id = h.profissional_id OR a.fisioterapeuta_id = h.profissional_id)
    WHERE h.fim IS NULL
      AND a.data_agendamento >= h.inicio
      AND a.data_agendamento <= NOW()
      AND lower(a.status) IN (
        'confirmado', 'aguardando', 'aguardando consulta', 'em atendimento',
        'concluído', 'concluido'
      )
    GROUP BY h.id, h.profissional_id
  ),
  -- ORDEM É CRÍTICA (AC-038), mesma armadilha do AC-006: o histórico fecha
  -- ANTES do reset do status. Invertida, a UPDATE em status_disponibilidade
  -- dispararia fn_log_mudanca_status_disponibilidade, que fecha o bloco com
  -- fim = NOW() — até 10 minutos DEPOIS da hora marcada, porque o job roda a
  -- cada 10 min. Seriam minutos de tempo fábril que não existiram. O CTE
  -- garante que o fechamento conclui antes, dentro do mesmo statement.
  fechados_pela_agenda AS (
    UPDATE historico_status_disponibilidade h
    SET fim = b.hora_marcada
    FROM blocos_com_atendimento b
    WHERE h.id = b.historico_id
    RETURNING h.profissional_id
  )
  UPDATE status_disponibilidade sd
  SET status = 'disponivel',
      atualizado_em = NOW(),
      origem = 'agenda'
  FROM fechados_pela_agenda f
  WHERE sd.profissional_id = f.profissional_id;

  -- ─── Teto de 2 horas (AC-004, AC-005, AC-006) — inalterado ────────────────
  WITH fechados AS (
    UPDATE historico_status_disponibilidade
    SET fim = inicio + INTERVAL '2 hours'
    WHERE fim IS NULL
      AND inicio < NOW() - INTERVAL '2 hours'
    RETURNING profissional_id
  )
  UPDATE status_disponibilidade sd
  SET status = 'disponivel',
      atualizado_em = NOW(),
      origem = 'fallback'
  FROM fechados f
  WHERE sd.profissional_id = f.profissional_id;

  -- ─── Rede de segurança: destrava quem dessincronizou (AC-019) — inalterado ─
  UPDATE status_disponibilidade sd
  SET status = 'disponivel',
      atualizado_em = NOW(),
      origem = 'fallback'
  WHERE sd.status NOT IN ('disponivel', 'ausente', 'ocupado')
    AND sd.atualizado_em < NOW() - INTERVAL '2 hours';
  $cron$
);

-- ─── 3. Conferência: o job vigente tem os três comandos ───────────────────────
-- Precisa devolver para_na_agenda = true, teto_2h = true e resquicio_1h = false.
-- Se para_na_agenda vier false, o cron.schedule acima não substituiu o job
-- antigo — investigue antes de seguir.
SELECT jobid,
       jobname,
       schedule,
       active,
       command LIKE '%blocos_com_atendimento%' AS para_na_agenda,
       command LIKE '%2 hours%'                AS teto_2h,
       command LIKE '%1 hour%'                 AS resquicio_1h
FROM cron.job
WHERE jobname = 'fechar-status-esquecidos';

-- ─── 4. Conferência: o job não está falhando em silêncio ──────────────────────
-- Rodar DEPOIS de esperar um ciclo (até 10 min). Qualquer linha com status
-- 'failed' aqui é a constraint de origem ou um erro de sintaxe no $cron$ — o
-- job continuaria agendado e "ativo", sem fazer nada.
SELECT status, return_message, start_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'fechar-status-esquecidos')
ORDER BY start_time DESC
LIMIT 5;

-- ─── 5. Conferência: quem foi encerrado pela agenda ───────────────────────────
-- Depois de um dia rodando, mostra se a regra está pegando os casos reais.
SELECT p.full_name,
       h.status,
       h.inicio,
       h.fim,
       h.duracao_minutos
FROM historico_status_disponibilidade h
JOIN profiles p ON p.id = h.profissional_id
WHERE h.fim IS NOT NULL
  AND h.inicio > NOW() - INTERVAL '7 days'
  AND h.duracao_minutos < 120
ORDER BY h.inicio DESC
LIMIT 20;
