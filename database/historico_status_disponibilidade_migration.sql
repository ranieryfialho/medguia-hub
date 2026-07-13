-- ─── 1. Tabela de histórico de status de disponibilidade ──────────────────────
CREATE TABLE IF NOT EXISTS historico_status_disponibilidade (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  profissional_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status          TEXT        NOT NULL,
  inicio          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fim             TIMESTAMPTZ,
  duracao_minutos INT         GENERATED ALWAYS AS (
    CASE
      WHEN fim IS NOT NULL
      THEN GREATEST(0, ROUND(EXTRACT(EPOCH FROM (fim - inicio)) / 60)::INT)
      ELSE NULL
    END
  ) STORED,
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hist_status_prof_inicio
  ON historico_status_disponibilidade(profissional_id, inicio);

CREATE INDEX IF NOT EXISTS idx_hist_status_fim_null
  ON historico_status_disponibilidade(profissional_id)
  WHERE fim IS NULL;

ALTER TABLE historico_status_disponibilidade ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura autenticados" ON historico_status_disponibilidade;
CREATE POLICY "Leitura autenticados"
  ON historico_status_disponibilidade FOR SELECT
  TO authenticated
  USING (true);

-- Cada profissional escreve/fecha apenas o próprio histórico (via trigger SECURITY DEFINER)
-- Gestores podem ler tudo (policy acima já cobre)

-- ─── 2. Função de trigger ──────────────────────────────────────────────────────
--
-- Regra: status automáticos (disponivel, ausente, ocupado) não são logados.
-- Qualquer outro status (reuniao, ou customizados pelo gestor) é logado com início/fim.
--
-- Fluxo ao atualizar status:
--   1. Se o status anterior era manual → fecha o registro aberto
--   2. Se o novo status é manual → abre novo registro
CREATE OR REPLACE FUNCTION fn_log_mudanca_status_disponibilidade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auto TEXT[] := ARRAY['disponivel', 'ausente', 'ocupado'];
BEGIN
  -- Só age quando o status efetivamente mudou
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Fecha qualquer registro aberto (o status anterior, ou um aberto por engano)
  IF NOT (OLD.status = ANY(v_auto)) THEN
    UPDATE historico_status_disponibilidade
    SET fim = NOW()
    WHERE profissional_id = NEW.profissional_id
      AND fim IS NULL;
  END IF;

  -- Abre novo registro para o status manual entrante
  IF NOT (NEW.status = ANY(v_auto)) THEN
    INSERT INTO historico_status_disponibilidade (profissional_id, status, inicio)
    VALUES (NEW.profissional_id, NEW.status, NOW());
  END IF;

  RETURN NEW;
END;
$$;

-- ─── 3. pg_cron: válvula de segurança para registros esquecidos abertos ───────
--
-- Roda às 4h (horário de Brasília = 7h UTC) todos os dias.
-- Fecha qualquer registro aberto há mais de 24h, capando em 8h de duração máxima.
-- Requer pg_cron habilitado no Supabase (Database → Extensions → pg_cron).
-- Se não estiver habilitado, este bloco é ignorado sem erro.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'fechar-status-esquecidos',
      '0 7 * * *',
      $cron$
      UPDATE historico_status_disponibilidade
      SET fim = inicio + INTERVAL '8 hours'
      WHERE fim IS NULL
        AND inicio < NOW() - INTERVAL '24 hours';
      $cron$
    );
  END IF;
END $$;

-- ─── 5. Trigger na tabela de status ───────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_log_status_disponibilidade ON status_disponibilidade;

CREATE TRIGGER trg_log_status_disponibilidade
  AFTER UPDATE OF status ON status_disponibilidade
  FOR EACH ROW
  EXECUTE FUNCTION fn_log_mudanca_status_disponibilidade();