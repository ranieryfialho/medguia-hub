-- Adiciona coluna ultima_atividade em contatos_base
-- Usada para detectar contatos "frios" (sem atividade por X dias)

ALTER TABLE contatos_base
ADD COLUMN IF NOT EXISTS ultima_atividade TIMESTAMPTZ DEFAULT now();

-- Preenche registros existentes com a data da última nota, ou agora()
UPDATE contatos_base cb
SET ultima_atividade = COALESCE(
  (SELECT MAX(n.criado_em) FROM notas_contato n WHERE n.paciente_id = cb.paciente_id),
  now()
);

-- Trigger: atualiza ultima_atividade quando uma nota é inserida no card
CREATE OR REPLACE FUNCTION fn_atualizar_ultima_atividade_contato()
RETURNS trigger AS $$
BEGIN
  UPDATE contatos_base SET ultima_atividade = NOW()
  WHERE paciente_id = NEW.paciente_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_ultima_atividade_contato ON notas_contato;
CREATE TRIGGER trg_ultima_atividade_contato
AFTER INSERT ON notas_contato
FOR EACH ROW EXECUTE FUNCTION fn_atualizar_ultima_atividade_contato();

-- Trigger: reseta ultima_atividade quando o contato muda de status ou coluna
CREATE OR REPLACE FUNCTION fn_atualizar_ultima_atividade_status_contato()
RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.kanban_coluna_chave IS DISTINCT FROM OLD.kanban_coluna_chave THEN
    NEW.ultima_atividade = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ultima_atividade_status_contato ON contatos_base;
CREATE TRIGGER trg_ultima_atividade_status_contato
BEFORE UPDATE ON contatos_base
FOR EACH ROW EXECUTE FUNCTION fn_atualizar_ultima_atividade_status_contato();
