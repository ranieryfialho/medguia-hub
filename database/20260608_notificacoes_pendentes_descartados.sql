ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pendentes_descartados text[] DEFAULT '{}' NOT NULL;
