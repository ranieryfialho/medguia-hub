-- Feature: status-personalizados-ciclo-vida (US-001, AC-003)
--
-- Dá lastro no histórico à observação que o profissional registra ao assumir
-- um status personalizado. Sem isso, a observação escrita hoje some na
-- próxima troca de status (RFC 002, Opção 2, item a).

-- ─── 1. Colunas novas, aditivas ────────────────────────────────────────────────
ALTER TABLE status_disponibilidade
  ADD COLUMN IF NOT EXISTS observacao TEXT;

ALTER TABLE historico_status_disponibilidade
  ADD COLUMN IF NOT EXISTS observacao TEXT;

ALTER TABLE status_disponibilidade_opcoes
  ADD COLUMN IF NOT EXISTS observacao_obrigatoria BOOLEAN NOT NULL DEFAULT false;

-- ─── 2. Trigger de log passa a copiar a observação na abertura do bloco ───────
--
-- O trigger é AFTER UPDATE OF status: editar só a observação sem trocar o
-- status não dispara nada, e o upsert de setStatusDisponibilidade não gera
-- INSERT para profissional novo com status manual. Decisão do RFC (10/08):
-- a observação só é definida no ato da troca — não precisa virar
-- AFTER INSERT OR UPDATE.
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

  -- Abre novo registro para o status manual entrante, com a observação
  -- que sobrevive à próxima troca de status.
  IF NOT (NEW.status = ANY(v_auto)) THEN
    INSERT INTO historico_status_disponibilidade (profissional_id, status, inicio, observacao)
    VALUES (NEW.profissional_id, NEW.status, NOW(), NEW.observacao);
  END IF;

  RETURN NEW;
END;
$$;
