-- ─── 0. Adiciona novo módulo ao perfil de gestores e masters existentes ─────────
--
-- Só atualiza perfis que já têm modulos_liberados preenchido (array não-vazio).
-- Perfis com array vazio = acesso total, não precisam de ajuste.
UPDATE profiles
SET modulos_liberados = array_append(modulos_liberados, 'configuracoes:status_disponibilidade')
WHERE (role IN ('gestor', 'master') OR nivel_acesso IN ('gestor', 'master'))
  AND modulos_liberados IS NOT NULL
  AND array_length(modulos_liberados, 1) > 0
  AND NOT ('configuracoes:status_disponibilidade' = ANY(modulos_liberados));

-- ─── 1. Remove check constraint para permitir status customizados ──────────────
ALTER TABLE status_disponibilidade
  DROP CONSTRAINT IF EXISTS status_disponibilidade_status_check;

-- ─── 2. Tabela de opções de status configuráveis pelo gestor ───────────────────
CREATE TABLE IF NOT EXISTS status_disponibilidade_opcoes (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  slug        TEXT        NOT NULL UNIQUE,
  label       TEXT        NOT NULL,
  label_curto TEXT        NOT NULL,
  cor         TEXT        NOT NULL DEFAULT 'slate',
  ordem       INT         NOT NULL DEFAULT 0,
  sistema     BOOLEAN     NOT NULL DEFAULT false,
  ativo       BOOLEAN     NOT NULL DEFAULT true,
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE status_disponibilidade_opcoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura autenticados" ON status_disponibilidade_opcoes;
CREATE POLICY "Leitura autenticados"
  ON status_disponibilidade_opcoes FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Escrita gestores" ON status_disponibilidade_opcoes;
CREATE POLICY "Escrita gestores"
  ON status_disponibilidade_opcoes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND (role IN ('gestor', 'master') OR nivel_acesso IN ('gestor', 'master'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND (role IN ('gestor', 'master') OR nivel_acesso IN ('gestor', 'master'))
    )
  );

-- ─── 3. Seed com os status existentes ──────────────────────────────────────────
INSERT INTO status_disponibilidade_opcoes (slug, label, label_curto, cor, ordem, sistema) VALUES
  ('disponivel', 'Disponível', 'livre',    'emerald',     0,  true),
  ('reuniao',    'Em reunião', 'reunião',  'amber',       1,  false),
  ('ocupado',    'Ocupado',    'ocupado',  'slate',       2,  false),
  ('ausente',    'Ausente',    'ausente',  'slate-light', 99, true)
ON CONFLICT (slug) DO NOTHING;

-- ─── 4. Atualiza fn_status_equipe_agora para respeitar status manuais custom ───
--
-- Mudança na regra 2: antes só 'reuniao' era preservado como override manual.
-- Agora qualquer status que não seja computado automaticamente (disponivel,
-- ausente, ocupado) é tratado como override manual — incluindo 'reuniao' e
-- qualquer status criado pelo gestor.
CREATE OR REPLACE FUNCTION public.fn_status_equipe_agora(p_ids uuid[])
RETURNS TABLE (
  profissional_id uuid,
  status          text,
  atualizado_em   timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_agora      timestamptz := now();
  v_hora_atual time        := (v_agora AT TIME ZONE 'America/Sao_Paulo')::time;
  v_dow        int         := EXTRACT(dow FROM v_agora AT TIME ZONE 'America/Sao_Paulo')::int;
  v_hoje       date        := (v_agora AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  INSERT INTO public.status_disponibilidade (profissional_id, status, atualizado_em)
  SELECT p.id, 'disponivel', v_agora
  FROM unnest(p_ids) AS p(id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.status_disponibilidade sd WHERE sd.profissional_id = p.id
  )
  ON CONFLICT DO NOTHING;

  RETURN QUERY
  SELECT
    p.id AS profissional_id,

    CASE
      -- 1. Atendimento ativo (responsável OU fisioterapeuta executor) → ocupado
      WHEN EXISTS (
        SELECT 1
        FROM public.atendimentos a
        WHERE (a.profissional_id = p.id OR a.fisioterapeuta_id = p.id)
          AND a.status IN ('Aguardando', 'Aguardando Consulta', 'Confirmado')
          AND a.data_agendamento <= v_agora
          AND a.data_agendamento + (COALESCE(a.duracao_minutos, 60) || ' minutes')::interval >= v_agora
      ) THEN 'ocupado'

      -- 2. Status manual (reuniao ou qualquer status customizado pelo gestor)
      WHEN sd.status IS NOT NULL AND sd.status NOT IN ('disponivel', 'ausente', 'ocupado')
        THEN sd.status

      -- 3a. Override mensal ativo para hoje + dentro do horário
      WHEN EXISTS (
        SELECT 1
        FROM public.jornada_mensal_profissional jmp
        WHERE jmp.profissional_id = p.id
          AND jmp.data  = v_hoje
          AND jmp.ativo = true
          AND jmp.jornada_inicio IS NOT NULL
          AND jmp.jornada_fim    IS NOT NULL
          AND v_hora_atual >= jmp.jornada_inicio::time
          AND v_hora_atual <  jmp.jornada_fim::time
          AND NOT (
            jmp.intervalo_inicio IS NOT NULL
            AND jmp.intervalo_fim IS NOT NULL
            AND v_hora_atual >= jmp.intervalo_inicio::time
            AND v_hora_atual <  jmp.intervalo_fim::time
          )
      ) THEN 'disponivel'

      -- 3b. Sem override mensal + dentro da jornada semanal
      WHEN NOT EXISTS (
        SELECT 1
        FROM public.jornada_mensal_profissional jmp
        WHERE jmp.profissional_id = p.id AND jmp.data = v_hoje
      )
      AND EXISTS (
        SELECT 1
        FROM public.disponibilidade_profissional dp
        WHERE dp.profissional_id = p.id
          AND dp.dia_semana = v_dow
          AND dp.ativo     = true
          AND v_hora_atual >= dp.jornada_inicio::time
          AND v_hora_atual <  dp.jornada_fim::time
          AND NOT (
            dp.intervalo_inicio IS NOT NULL
            AND dp.intervalo_fim IS NOT NULL
            AND v_hora_atual >= dp.intervalo_inicio::time
            AND v_hora_atual <  dp.intervalo_fim::time
          )
      ) THEN 'disponivel'

      -- 4. Fora da jornada ou sem agenda
      ELSE 'ausente'
    END AS status,

    CASE
      WHEN sd.status IS NOT NULL AND sd.status NOT IN ('disponivel', 'ausente', 'ocupado')
        THEN COALESCE(sd.atualizado_em, v_agora)
      ELSE v_agora
    END AS atualizado_em

  FROM unnest(p_ids) AS p(id)
  LEFT JOIN public.status_disponibilidade sd ON sd.profissional_id = p.id;
END;
$$;