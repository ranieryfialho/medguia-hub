-- ─── Migration: profissional inativo ───────────────────────────────────────
-- Feature: status-personalizados-ciclo-vida (T-008 / AC-017)
--
-- Hoje desligar um profissional em `profiles.ativo = false` não limpa o
-- estado ao vivo: a linha em `status_disponibilidade` continua lá e um bloco
-- aberto em `historico_status_disponibilidade` fica sem `fim` para sempre.
-- Esta migration:
--   1. Acrescenta `inativado_em`, para registrar quando o desligamento
--      aconteceu (ASM-004: nenhum ponto de criação de profile toca em
--      `ativo`, o default `true` da coluna cobre — seguro tornar obrigatório).
--   2. Normaliza nulos em `ativo` e torna a coluna obrigatória.
--   3. Cria o gatilho `trg_profiles_inativar`, que ao marcar `ativo = false`:
--        a. grava `inativado_em = NOW()`;
--        b. fecha o bloco aberto no histórico (preserva o passado);
--        c. remove a linha de estado ao vivo em `status_disponibilidade`
--           (sem histórico ali — é só o "agora").

begin;

-- ─── 1. Coluna nova, aditiva ────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS inativado_em TIMESTAMPTZ;

-- ─── 2. Normaliza nulos e torna `ativo` obrigatório (ASM-004) ──────────────
UPDATE profiles
SET ativo = true
WHERE ativo IS NULL;

ALTER TABLE profiles
  ALTER COLUMN ativo SET DEFAULT true;

ALTER TABLE profiles
  ALTER COLUMN ativo SET NOT NULL;

-- ─── 3. Gatilho: desligar limpa o estado ao vivo ───────────────────────────
--
-- Ordem dentro da função é a mesma do fallback de 1h (T-006): fecha o
-- histórico ANTES de remover a linha de estado ao vivo, para não deixar o
-- bloco aberto para sempre.
CREATE OR REPLACE FUNCTION fn_inativar_profissional()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Só age na transição de ativo para inativo
  IF NEW.ativo = false AND OLD.ativo = true THEN
    NEW.inativado_em := NOW();

    UPDATE historico_status_disponibilidade
    SET fim = NOW()
    WHERE profissional_id = NEW.id
      AND fim IS NULL;

    DELETE FROM status_disponibilidade
    WHERE profissional_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_inativar ON public.profiles;

CREATE TRIGGER trg_profiles_inativar
  BEFORE UPDATE OF ativo ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION fn_inativar_profissional();

commit;
