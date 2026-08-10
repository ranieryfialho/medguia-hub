-- ─── Migration: teto de 1 hora e devolução para Disponível ────────────────────
-- Feature: status-personalizados-ciclo-vida (T-006 / AC-004, AC-005, AC-006)
--
-- Duas mudanças no job 'fechar-status-esquecidos':
--   1. O teto passa de 2h para 1h (AC-004).
--   2. Além de fechar o histórico, o job agora devolve o profissional para
--      'disponivel' em status_disponibilidade, marcando origem = 'fallback' (AC-005).
--
-- ORDEM É CRÍTICA (AC-006): o histórico precisa ser fechado ANTES do reset do
-- status. Se a ordem fosse invertida, a UPDATE em status_disponibilidade
-- dispararia fn_log_mudanca_status_disponibilidade (ver
-- historico_status_disponibilidade_migration.sql), que fecharia o registro de
-- histórico com fim = NOW() — a duração INTEIRA do esquecimento, não capada em
-- 1h — inflando o Tempo Fábril. Por isso o fechamento do histórico roda como
-- CTE (WITH) e conclui antes da UPDATE em status_disponibilidade, que só lê o
-- profissional_id já retornado por ela — a ordem textual reflete a ordem real
-- de execução dentro do mesmo statement.

-- ─── 1. Garante a coluna 'origem' e amplia seu domínio ───────────────────────
--
-- A coluna NÃO existe em produção (verificado em 10/08: information_schema não
-- retorna linha para status_disponibilidade.origem). É por isso que
-- setStatusDisponibilidade carrega um caminho defensivo que reescreve o upsert
-- sem 'origem' quando o banco reclama que a coluna não existe.
-- Sem este ADD COLUMN, a constraint abaixo e o reset do cron falhariam.
ALTER TABLE status_disponibilidade
  ADD COLUMN IF NOT EXISTS origem TEXT;

ALTER TABLE status_disponibilidade
  DROP CONSTRAINT IF EXISTS status_disponibilidade_origem_check;

ALTER TABLE status_disponibilidade
  ADD CONSTRAINT status_disponibilidade_origem_check
  CHECK (origem IN ('manual', 'automatico', 'fallback'));

-- ─── 2. Reagenda o job: teto de 1h + devolução a Disponível ───────────────────
SELECT cron.schedule(
  'fechar-status-esquecidos',
  '*/10 * * * *',
  $cron$
  WITH fechados AS (
    UPDATE historico_status_disponibilidade
    SET fim = inicio + INTERVAL '1 hour'
    WHERE fim IS NULL
      AND inicio < NOW() - INTERVAL '1 hour'
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
    AND sd.atualizado_em < NOW() - INTERVAL '1 hour';
  $cron$
);

-- ─── 3. Destrava agora quem já está preso ─────────────────────────────────────
-- Mesmo par de comandos do cron, aplicado uma vez para não esperar até 10
-- minutos pelo próximo ciclo.
--
-- A MESMA ORDEM DO CRON VALE AQUI (AC-006). Se o reset viesse primeiro, o
-- gatilho de log fecharia com fim = NOW() o bloco de quem está em reunião
-- legítima há mais de 1h neste instante — gravando a duração inteira em vez
-- do teto. Fechar o histórico antes elimina essa janela.
WITH fechados AS (
  UPDATE historico_status_disponibilidade
  SET fim = inicio + INTERVAL '1 hour'
  WHERE fim IS NULL
    AND inicio < NOW() - INTERVAL '1 hour'
  RETURNING profissional_id
)
UPDATE status_disponibilidade sd
SET status = 'disponivel',
    atualizado_em = NOW(),
    origem = 'fallback'
FROM fechados f
WHERE sd.profissional_id = f.profissional_id;

UPDATE status_disponibilidade sd
SET status = 'disponivel',
    atualizado_em = NOW(),
    origem = 'fallback'
WHERE sd.status NOT IN ('disponivel', 'ausente', 'ocupado')
  AND sd.atualizado_em < NOW() - INTERVAL '1 hour';

-- Confirma o novo agendamento
SELECT jobid, jobname, schedule, active, command
FROM cron.job
WHERE jobname = 'fechar-status-esquecidos';
