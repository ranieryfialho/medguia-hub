import { parseAppDate } from '@/lib/datetime'
import {
  formatarFaixasJornada,
  obterIntervalosJornada,
  toMin,
  type JornadaDia,
} from '@/lib/jornada'
import { resolverJornadaDoDia, type JornadaMensalDiaPlanejado } from '@/lib/jornada-planejada'

export type DisponibilidadeDia = JornadaDia
export type DisponibilidadeMensalMap = Map<string, JornadaMensalDiaPlanejado>

export function normalizarDisponibilidade(dia: {
  jornada_inicio: string
  jornada_fim: string
  intervalo_inicio?: string | null
  intervalo_fim?: string | null
}): DisponibilidadeDia {
  return {
    jornada_inicio: dia.jornada_inicio.slice(0, 5),
    jornada_fim: dia.jornada_fim.slice(0, 5),
    intervalo_inicio: dia.intervalo_inicio?.slice(0, 5) ?? null,
    intervalo_fim: dia.intervalo_fim?.slice(0, 5) ?? null,
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
  disponibilidadesMensais?: DisponibilidadeMensalMap,
) {
  const dataDate = parseAppDate(data)
  const diaSemana = dataDate.getDay()
  return {
    diaSemana,
    disponibilidade: resolverJornadaDoDia(dataDate, disponibilidades, disponibilidadesMensais) ?? null,
  }
}

export function validarHorarioDisponibilidade(
  disponibilidades: Map<number, DisponibilidadeDia>,
  data: string,
  horaInicio: string,
  horaFim: string,
  disponibilidadesMensais?: DisponibilidadeMensalMap,
) {
  const { disponibilidade } = obterDisponibilidadeDoDia(disponibilidades, data, disponibilidadesMensais)

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

function getNowParts(timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(new Date())
  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? 'Sun'
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0')

  return { weekday, currentMin: hour * 60 + minute }
}

export function estaDentroDaJornadaAgora(
  disponibilidade: DisponibilidadeDia | null | undefined,
  timeZone = 'America/Sao_Paulo',
) {
  if (!disponibilidade) return false

  const { currentMin } = getNowParts(timeZone)
  return obterIntervalosJornada(disponibilidade).some(
    (intervalo) => currentMin >= intervalo.inicio && currentMin < intervalo.fim,
  )
}

export function getDiaSemanaAtualNaTimezone(timeZone = 'America/Sao_Paulo') {
  const { weekday } = getNowParts(timeZone)
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday)
}
