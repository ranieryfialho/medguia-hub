-- Atualiza as funções de prontuários pendentes para:
-- 1. Incluir atendimentos onde o profissional é fisioterapeuta executor (fisioterapeuta_id)
-- 2. Excluir atendimentos cujo responsável (profissional_id) seja médico

CREATE OR REPLACE FUNCTION public.listar_atendimentos_sem_prontuario(
  limit_count integer DEFAULT 300,
  fisio_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  paciente_nome text,
  agendamento_tipo text,
  tipo text,
  profissional_id uuid,
  data_agendamento timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    p.nome            AS paciente_nome,
    ag.tipo           AS agendamento_tipo,
    a.tipo,
    a.profissional_id,
    a.data_agendamento
  FROM public.atendimentos a
  JOIN public.pacientes p ON p.id = a.paciente_id
  LEFT JOIN public.agendamentos ag ON ag.id = a.agendamento_id
  LEFT JOIN public.prontuarios pr ON pr.atendimento_id = a.id
  LEFT JOIN public.profiles prof ON prof.id = a.profissional_id
  WHERE a.status = 'Concluído'
    AND pr.atendimento_id IS NULL
    AND (prof.role IS NULL OR prof.role <> 'medico')
    AND (
      fisio_id IS NULL
      OR a.profissional_id = fisio_id
      OR a.fisioterapeuta_id = fisio_id
    )
  ORDER BY a.data_agendamento DESC
  LIMIT limit_count;
$$;

CREATE OR REPLACE FUNCTION public.contar_prontuarios_pendentes(
  limit_count integer DEFAULT 300,
  fisio_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM (
    SELECT 1
    FROM public.atendimentos a
    LEFT JOIN public.prontuarios pr ON pr.atendimento_id = a.id
    LEFT JOIN public.profiles prof ON prof.id = a.profissional_id
    WHERE a.status = 'Concluído'
      AND pr.atendimento_id IS NULL
      AND (prof.role IS NULL OR prof.role <> 'medico')
      AND (
        fisio_id IS NULL
        OR a.profissional_id = fisio_id
        OR a.fisioterapeuta_id = fisio_id
      )
    LIMIT limit_count
  ) sub;
$$;
