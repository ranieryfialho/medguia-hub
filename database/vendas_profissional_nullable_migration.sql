-- Permite criar vendas/orçamentos sem profissional definido
-- (paciente ainda não avaliado, somente orçamento)
ALTER TABLE public.vendas ALTER COLUMN profissional_id DROP NOT NULL;
