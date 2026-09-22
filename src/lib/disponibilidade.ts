import { parseAppDate } from '@/lib/datetime'
import {
  formatarIntervalos,
  obterIntervalosJornada,
  subtrairIntervalos,
  toMin,
  type IntervaloMinutos,
  type JornadaDia,
} from '@/lib/jornada'
import {
  obterJornadaMensalDoDia,
  resolverJornadaDoDia,
  type JornadaMensalDiaPlanejado,
} from '@/lib/jornada-planejada'

export type DisponibilidadeDia = JornadaDia
export type DisponibilidadeMensalMap = Map<string, JornadaMensalDiaPlanejado>

export type BloqueioHorario = { hora_inicio: string; hora_fim: string }
export type BloqueiosPorDataMap = Map<string, BloqueioHorario[]>

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

export function obterIntervalosDisponiveisDoDia(
  disponibilidades: Map<number, DisponibilidadeDia>,
  data: string,
  disponibilidadesMensais?: DisponibilidadeMensalMap,
  bloqueiosDoDia?: BloqueioHorario[],
): IntervaloMinutos[] {
  const { disponibilidade } = obterDisponibilidadeDoDia(disponibilidades, data, disponibilidadesMensais)
  if (!disponibilidade) return []

  const base = obterIntervalosJornada(disponibilidade)
  if (!bloqueiosDoDia || bloqueiosDoDia.length === 0) return base

  const bloqueiosMin = bloqueiosDoDia.map((b) => ({ inicio: toMin(b.hora_inicio), fim: toMin(b.hora_fim) }))
  return subtrairIntervalos(base, bloqueiosMin)
}

export function validarHorarioDisponibilidade(
  disponibilidades: Map<number, DisponibilidadeDia>,
  data: string,
  horaInicio: string,
  horaFim: string,
  disponibilidadesMensais?: DisponibilidadeMensalMap,
  bloqueiosDoDia?: BloqueioHorario[],
) {
  const { disponibilidade } = obterDisponibilidadeDoDia(disponibilidades, data, disponibilidadesMensais)

  if (!disponibilidade) {
    return {
      ok: false,
      motivo: 'sem_jornada' as const,
      faixas: '',
    }
  }

  const intervalosDisponiveis = obterIntervalosDisponiveisDoDia(
    disponibilidades,
    data,
    disponibilidadesMensais,
    bloqueiosDoDia,
  )
  const faixas = formatarIntervalos(intervalosDisponiveis)
  const inicio = toMin(horaInicio)
  const fim = toMin(horaFim)
  const ok = fim > inicio && intervalosDisponiveis.some((intervalo) => inicio >= intervalo.inicio && fim <= intervalo.fim)

  return {
    ok,
    motivo: ok ? ('ok' as const) : ('fora_da_jornada' as const),
    faixas,
  }
}

// Checa apenas bloqueios explícitos (dia inteiro ou faixa de horário),
// sem exigir jornada semanal cadastrada — usada para profissionais cujo
// agendamento não depende de jornada fixa (ex.: médicos), mas cuja agenda
// pode ainda assim ser bloqueada pontualmente.
export function validarBloqueioExplicito(
  data: string,
  horaInicio: string,
  horaFim: string,
  disponibilidadesMensais?: DisponibilidadeMensalMap,
  bloqueiosDoDia?: BloqueioHorario[],
) {
  const jornadaMensal = obterJornadaMensalDoDia(parseAppDate(data), disponibilidadesMensais)

  if (jornadaMensal && !jornadaMensal.ativo) {
    return { ok: false, motivo: 'dia_bloqueado' as const }
  }

  const inicio = toMin(horaInicio)
  const fim = toMin(horaFim)
  const bloqueado = (bloqueiosDoDia ?? []).some(
    (b) => inicio < toMin(b.hora_fim) && fim > toMin(b.hora_inicio),
  )

  if (bloqueado) {
    return { ok: false, motivo: 'horario_bloqueado' as const }
  }

  return { ok: true, motivo: 'ok' as const }
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
