-- Adiciona coluna motivo_recusa na tabela vendas
-- Armazena o motivo informado ao marcar um orçamento como recusado

ALTER TABLE vendas
  ADD COLUMN IF NOT EXISTS motivo_recusa TEXT NULL;

-- Limpa o motivo quando o status muda para qualquer coisa diferente de recusado
-- (opcional: pode ser gerenciado pela aplicação)
COMMENT ON COLUMN vendas.motivo_recusa IS 'Motivo informado ao recusar um orçamento. Nulo para vendas confirmadas e orçamentos pendentes.';
