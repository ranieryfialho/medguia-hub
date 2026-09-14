-- Preferência do usuário para pular a tela informativa do prompt "Tem
-- pré-consulta de fisioterapia?" (a pré-consulta em si sempre usa o tipo
-- fixo "Pré-consulta" — não há mais seleção de tipo nesse fluxo).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ocultar_aviso_pre_consulta BOOLEAN NOT NULL DEFAULT false;
