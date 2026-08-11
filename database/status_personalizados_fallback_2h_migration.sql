-- ─── Migration: o teto do bloco volta para 2 horas ────────────────────────────
-- Feature: status-personalizados-ciclo-vida (T-015 / AC-004, AC-005, AC-006, AC-019)
--
-- SUPERSEDE status_personalizados_fallback_1h_migration.sql, aplicada em
-- 10/08/2026. Aquele arquivo NÃO é editado: ele é o registro do que rodou em
-- produção. Esta migration reagenda o mesmo job com o teto de 2 horas.
--
-- POR QUE VOLTOU: a Suposição 1 do RFC 002 previa o risco textualmente — "se
-- reuniões de 2h+ forem rotina, o atrito de reafirmar pode gerar sub-registro
-- sistemático no Tempo Fábril". Na primeira semana com o teto de 1h isso se
-- confirmou: reuniões e horas administrativas de 1h30–2h são rotina, e o teto
-- cortava no meio delas.
--
-- O QUE **NÃO** VOLTA: o teto de 2h de antes de 10/08 fechava só o histórico e
-- deixava o profissional travado no status ao vivo para sempre — o defeito
-- central do RFC 002. As duas correções continuam aqui: o reset para
-- 'disponivel' (AC-005) e a rede de segurança para quem já dessincronizou
-- (AC-019). O que muda é o prazo, não o contrato.
--
-- ORDEM É CRÍTICA (AC-006): o histórico precisa ser fechado ANTES do reset do
-- status. Se a ordem fosse invertida, a UPDATE em status_disponibilidade
-- dispararia fn_log_mudanca_status_disponibilidade (ver
-- historico_status_disponibilidade_migration.sql), que fecharia o registro de
-- histórico com fim = NOW() — a duração INTEIRA do esquecimento, não capada em
-- 2h — inflando o Tempo Fábril. Por isso o fechamento do histórico roda como
-- CTE (WITH) e conclui antes da UPDATE em status_disponibilidade, que só lê o
-- profissional_id já retornado por ela — a ordem textual reflete a ordem real
-- de execução dentro do mesmo statement.
--
-- A armadilha é a mesma da migration anterior. Ela não fica menos perigosa por
-- ser a segunda vez que escrevemos este statement.

-- ─── 1. Reagenda o job: teto de 2h + devolução a Disponível ───────────────────
-- A coluna 'origem' e sua constraint já foram criadas pela migration de 1h.
SELECT cron.schedule(
  'fechar-status-esquecidos',
  '*/10 * * * *',
  $cron$
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

  -- ─── Rede de segurança: destrava quem dessincronizou (AC-019) ──────────────
  -- O comando acima só alcança quem tinha bloco ABERTO. Em 10/08 havia três
  -- profissionais em produção com status personalizado ao vivo e o bloco já
  -- fechado — um deles preso há 2 dias e 20 horas. Para esses, o CTE não
  -- devolve nada e eles ficariam presos para sempre.
  -- Este comando não depende do histórico: olha só o estado ao vivo.
  UPDATE status_disponibilidade sd
  SET status = 'disponivel',
      atualizado_em = NOW(),
      origem = 'fallback'
  WHERE sd.status NOT IN ('disponivel', 'ausente', 'ocupado')
    AND sd.atualizado_em < NOW() - INTERVAL '2 hours';
  $cron$
);

-- ─── 2. Conferência: o job vigente é o de 2h ──────────────────────────────────
-- Precisa devolver teto_2h = true e resquicio_1h = false. Se resquicio_1h vier
-- true, o cron.schedule acima não substituiu o job antigo — investigue antes de
-- seguir, porque conviver com os dois prazos é pior que qualquer um dos dois.
SELECT jobid,
       jobname,
       schedule,
       active,
       command LIKE '%2 hours%' AS teto_2h,
       command LIKE '%1 hour%'  AS resquicio_1h
FROM cron.job
WHERE jobname = 'fechar-status-esquecidos';

-- ─── 3. Nota sobre quem está entre 1h e 2h neste instante ─────────────────────
-- Nenhum comando de destravamento imediato aqui, ao contrário da migration de
-- 1h. Naquele momento havia gente presa há dias e era preciso agir na hora.
-- Agora o teto está AFROUXANDO: quem foi expirado com 1h já voltou para
-- 'disponivel', e quem está em bloco aberto há mais de 1h simplesmente ganha
-- mais uma hora de vida. Não há estado inconsistente a corrigir — o próximo
-- ciclo do cron, em até 10 minutos, já aplica o prazo novo.
