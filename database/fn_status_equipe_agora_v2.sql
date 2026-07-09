-- Reescreve fn_status_equipe_agora para computar status efetivo em tempo real.
--
-- Regras:
--   1. 'ocupado'   → tem atendimento ativo AGORA (profissional_id OU fisioterapeuta_id)
--   2. 'reuniao'   → status manual = 'reuniao' (sem atendimento ativo sobreposto)
--   3. 'disponivel'→ default; ausência de jornada é tratada no cliente via estaDentroDaJornadaAgora
--
-- Também garante que atendimentos aparece na publication do Realtime para que o
-- hook de disponibilidade possa se inscrever em mudanças de status de atendimento.

-- Habilita Realtime na tabela atendimentos (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'atendimentos'
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
BEGIN
  -- Inicializa linhas faltantes para garantir que o Realtime tenha o que escutar
  INSERT INTO public.status_disponibilidade (profissional_id, status, atualizado_em, origem)
  SELECT p.id, 'disponivel', now(), 'automatico'
  FROM unnest(p_ids) AS p(id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.status_disponibilidade sd WHERE sd.profissional_id = p.id
  )
  ON CONFLICT (profissional_id) DO NOTHING;

  RETURN QUERY
  SELECT
    p.id AS profissional_id,
    CASE
      -- Atendimento em curso (responsável ou fisioterapeuta executor)
      WHEN EXISTS (
        SELECT 1
        FROM public.atendimentos a
        WHERE (a.profissional_id = p.id OR a.fisioterapeuta_id = p.id)
          AND a.status IN ('Aguardando', 'Aguardando Consulta', 'Confirmado')
          AND a.data_agendamento <= now()
          AND a.data_agendamento + (COALESCE(a.duracao_minutos, 60) || ' minutes')::interval >= now()
      ) THEN 'ocupado'
      -- Status manual de reunião preservado
      WHEN sd.status = 'reuniao' THEN 'reuniao'
      -- Padrão livre (ausente é calculado no cliente pela jornada)
      ELSE 'disponivel'
    END AS status,
    -- Para reunião: mostra quando entrou na reunião; demais: now() (evita "há Xh" desatualizado)
    CASE
      WHEN sd.status = 'reuniao' THEN COALESCE(sd.atualizado_em, now())
      ELSE now()
    END AS atualizado_em
  FROM unnest(p_ids) AS p(id)
  LEFT JOIN public.status_disponibilidade sd ON sd.profissional_id = p.id;
END;
$$;
