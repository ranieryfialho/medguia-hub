-- Reescreve fn_status_equipe_agora para computar status efetivo em tempo real.
--
-- Ordem de precedência:
--   1. 'ocupado'   → atendimento ativo AGORA (profissional_id OU fisioterapeuta_id)
--   2. 'reuniao'   → status manual = 'reuniao'
--   3. 'disponivel'→ dentro da jornada de hoje (override mensal > jornada semanal)
--   4. 'ausente'   → fora da jornada, sem jornada hoje, ou override com ativo=false
--
-- O check de jornada acontece integralmente no servidor; os componentes não precisam
-- mais aplicar estaDentroDaJornadaAgora() no cliente.

-- Habilita Realtime na tabela atendimentos (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename  = 'atendimentos'
      AND schemaname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.atendimentos;
  END IF;
END $$;

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
  -- Inicializa linhas faltantes para o Realtime ter o que escutar
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
      -- ── 1. Atendimento ativo (responsável OU fisioterapeuta executor) ─────────
      WHEN EXISTS (
        SELECT 1
        FROM public.atendimentos a
        WHERE (a.profissional_id = p.id OR a.fisioterapeuta_id = p.id)
          AND a.status IN ('Aguardando', 'Aguardando Consulta', 'Confirmado')
          AND a.data_agendamento <= v_agora
          AND a.data_agendamento + (COALESCE(a.duracao_minutos, 60) || ' minutes')::interval >= v_agora
      ) THEN 'ocupado'

      -- ── 2. Status manual de reunião ─────────────────────────────────────────
      WHEN sd.status = 'reuniao' THEN 'reuniao'

      -- ── 3a. Override mensal ativo para hoje + dentro do horário ─────────────
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

      -- ── 3b. Sem override mensal para hoje + dentro da jornada semanal ───────
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

      -- ── 4. Fora da jornada ou dia sem agenda ─────────────────────────────────
      ELSE 'ausente'
    END AS status,

    -- atualizado_em: preserva timestamp real para 'reuniao'; demais usam now()
    CASE
      WHEN sd.status = 'reuniao' THEN COALESCE(sd.atualizado_em, v_agora)
      ELSE v_agora
    END AS atualizado_em

  FROM unnest(p_ids) AS p(id)
  LEFT JOIN public.status_disponibilidade sd ON sd.profissional_id = p.id;
END;
$$;
