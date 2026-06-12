-- Tipos de follow-up (configurável pelo admin)
CREATE TABLE IF NOT EXISTS public.follow_up_tipos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL,
  cor        TEXT,
  ativo      BOOLEAN NOT NULL DEFAULT true,
  ordem      INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS follow_up_tipos_nome_unique
  ON public.follow_up_tipos (lower(nome));

CREATE INDEX IF NOT EXISTS follow_up_tipos_ativos_idx
  ON public.follow_up_tipos (ativo, ordem, nome);

INSERT INTO public.follow_up_tipos (nome, ordem) VALUES
  ('Alta', 1), ('Avaliação', 2), ('Pré Consulta', 3),
  ('Reavaliação', 4), ('CTA', 5), ('Confirmação de Agenda', 6),
  ('Pesquisa de Satisfação', 7), ('Relacionamento', 8),
  ('Prospecção', 9), ('Pós Venda', 10), ('Ausência', 11),
  ('Reclamação', 12), ('Triagem', 13), ('Atendimento On-line', 14),
  ('Continuidade Indicada', 15), ('Campanha', 16),
  ('Tráfego Pago', 17), ('Aniversário', 18)
ON CONFLICT ((lower(nome))) DO NOTHING;

-- Templates por tipo
CREATE TABLE IF NOT EXISTS public.follow_up_templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_id    UUID NOT NULL REFERENCES public.follow_up_tipos(id) ON DELETE CASCADE,
  titulo     TEXT NOT NULL,
  conteudo   TEXT NOT NULL,
  ativo      BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS follow_up_templates_tipo_idx
  ON public.follow_up_templates (tipo_id, ativo);

-- Registros de follow-up
CREATE TABLE IF NOT EXISTS public.follow_ups (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id    UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  atendimento_id UUID REFERENCES public.atendimentos(id) ON DELETE SET NULL,
  tipo_id        UUID NOT NULL REFERENCES public.follow_up_tipos(id),
  descricao      TEXT,
  responsavel_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  criado_por     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS follow_ups_paciente_idx    ON public.follow_ups (paciente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS follow_ups_atendimento_idx ON public.follow_ups (atendimento_id);
CREATE INDEX IF NOT EXISTS follow_ups_responsavel_idx ON public.follow_ups (responsavel_id);

-- RLS
ALTER TABLE public.follow_up_tipos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups          ENABLE ROW LEVEL SECURITY;

CREATE POLICY "follow_up_tipos_select"     ON public.follow_up_tipos     FOR SELECT TO authenticated USING (true);
CREATE POLICY "follow_up_tipos_insert"     ON public.follow_up_tipos     FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "follow_up_tipos_update"     ON public.follow_up_tipos     FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "follow_up_templates_select" ON public.follow_up_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "follow_up_templates_insert" ON public.follow_up_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "follow_up_templates_update" ON public.follow_up_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "follow_ups_select"          ON public.follow_ups FOR SELECT TO authenticated USING (true);
CREATE POLICY "follow_ups_insert"          ON public.follow_ups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "follow_ups_update"          ON public.follow_ups FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "follow_ups_delete"          ON public.follow_ups FOR DELETE TO authenticated USING (true);