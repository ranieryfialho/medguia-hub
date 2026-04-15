import { parseAppDate } from '@/lib/datetime'
import {
  formatarFaixasJornada,
  obterIntervalosJornada,
  toMin,
  type JornadaDia,
} from '@/lib/jornada'

export type DisponibilidadeDia = JornadaDia

export function normalizarDisponibilidade(dia: {
  hora_inicio: string
  hora_fim: string
  almoco_inicio?: string | null
  almoco_fim?: string | null
}): DisponibilidadeDia {
  return {
    hora_inicio: dia.hora_inicio.slice(0, 5),
    hora_fim: dia.hora_fim.slice(0, 5),
    almoco_inicio: dia.almoco_inicio?.slice(0, 5) ?? null,
    almoco_fim: dia.almoco_fim?.slice(0, 5) ?? null,
  }
}

export function horarioDentroDaDisponibilidade(
  disponibilidade: DisponibilidadeDia,
  horaInicio: string,
  horaFim: string,
) {
  const inicio = toMin(horaInicio)
  const fim = toMin(horaFim)

  if (fim <= inicio) {
    return false
  }

  return obterIntervalosJornada(disponibilidade).some(
    (intervalo) => inicio >= intervalo.inicio && fim <= intervalo.fim,
  )
}

export function obterDisponibilidadeDoDia(
  disponibilidades: Map<number, DisponibilidadeDia>,
  data: string,
) {
  const diaSemana = parseAppDate(data).getDay()
  return {
    diaSemana,
    disponibilidade: disponibilidades.get(diaSemana) ?? null,
  }
}

export function validarHorarioDisponibilidade(
  disponibilidades: Map<number, DisponibilidadeDia>,
  data: string,
  horaInicio: string,
  horaFim: string,
) {
  const { disponibilidade } = obterDisponibilidadeDoDia(disponibilidades, data)

  if (!disponibilidade) {
    return {
      ok: false,
      motivo: 'sem_jornada' as const,
      faixas: '',
    }
  }

  const faixas = formatarFaixasJornada(disponibilidade)
  const ok = horarioDentroDaDisponibilidade(disponibilidade, horaInicio, horaFim)

  return {
    ok,
    motivo: ok ? ('ok' as const) : ('fora_da_jornada' as const),
    faixas,
  }
}
