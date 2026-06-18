import {
  addDays,
  endOfMonth,
  endOfWeek,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { formatAppDateKey, APP_TIME_ZONE } from '@/lib/datetime'
import { calcularMinutosJornada } from '@/lib/jornada'
import {
  buildMapaMensalPorProfissional,
  buildMapaSemanalPorProfissional,
  resolverJornadaDoDia,
  type JornadaMensalDiaPlanejado,
  type JornadaMensalPlanejada,
  type JornadaSemanal,
} from '@/lib/jornada-planejada'
import { isStatusFabril } from '@/lib/atendimento-status'

export type Atendimento = {
  id: string
  profissional_id: string
  data_agendamento: string
  duracao_minutos: number | null
  status: string
  tipo: string
  numero_sessao: number | null
  paciente_id: string
}

export type Jornada = JornadaSemanal
export type JornadaPlanejada = JornadaMensalPlanejada

export type EvolucaoSemanalKPI = {
  label: string
  fabrilMin: number
  jornadaMin: number
  pct: number
}

export type Reuniao = {
  profissional_id: string
  inicio: string
  fim: string | null
  duracao_minutos: number | null
}

export type KPIsProfissional = {
  profissionalId: string
  nome: string
  jornadaContratadaMin: number
  tempoFabrilMin: number
  tempoReuniaoMin: number
  taxaOcupacao: number
  qtdAtendimentos: number
  tempoMedioMin: number
  diasSubutilizados: number
  evolucaoPorSemana: EvolucaoSemanalKPI[]
}

export function toMin(hora: string): number {
  const [hh, mm] = hora.slice(0, 5).split(':').map(Number)
  return hh * 60 + mm
}

export function formatarMinutos(min: number): string {
  if (min === 0) return '0h'

  const h = Math.floor(min / 60)
  const m = min % 60

  return m > 0 ? `${h}h${m}min` : `${h}h`
}

export function calcularJornadaContratadaMinutos(
  jornadaSemanalMap: Map<number, JornadaSemanal>,
  jornadaMensalMap: Map<string, JornadaMensalDiaPlanejado> | undefined,
  dataInicio: Date,
  dataFim: Date,
): number {
  let totalMinutos = 0
  let cursor = new Date(dataInicio)

  while (cursor <= dataFim) {
    const jornada = resolverJornadaDoDia(cursor, jornadaSemanalMap, jornadaMensalMap)

    if (jornada) {
      totalMinutos += calcularMinutosJornada(jornada)
    }

    cursor = addDays(cursor, 1)
  }

  return totalMinutos
}

export function agruparPorSemana(
  atendimentos: Atendimento[],
  jornadaSemanalMap: Map<number, JornadaSemanal>,
  jornadaMensalMap: Map<string, JornadaMensalDiaPlanejado> | undefined,
  dataInicio: Date,
  dataFim: Date,
): EvolucaoSemanalKPI[] {
  const semanas: EvolucaoSemanalKPI[] = []
  let cursor = startOfWeek(dataInicio, { weekStartsOn: 0 })

  while (cursor <= dataFim) {
    const fimSemana = endOfWeek(cursor, { weekStartsOn: 0 })
    const inicioEfetivo = cursor < dataInicio ? dataInicio : cursor
    const fimEfetivo = fimSemana > dataFim ? dataFim : fimSemana

    const inicioEfetivoStr = formatAppDateKey(inicioEfetivo)
    const fimEfetivoStr = formatAppDateKey(fimEfetivo)

    const atsSemana = atendimentos.filter((a) => {
      const dataKeyAtt = formatAppDateKey(new Date(a.data_agendamento))
      return dataKeyAtt >= inicioEfetivoStr && dataKeyAtt <= fimEfetivoStr
    })

    const fabrilMin = atsSemana
      .filter((a) => isStatusFabril(a.status))
      .reduce((acc, a) => acc + (a.duracao_minutos ?? 0), 0)

    const jornadaMin = calcularJornadaContratadaMinutos(
      jornadaSemanalMap,
      jornadaMensalMap,
      inicioEfetivo,
      fimEfetivo,
    )

    const pct = jornadaMin > 0 ? Math.round((fabrilMin / jornadaMin) * 100) : 0

    const fmtDia = (d: Date) =>
      new Intl.DateTimeFormat('pt-BR', { timeZone: APP_TIME_ZONE, day: '2-digit', month: '2-digit' }).format(d)

    semanas.push({
      label: `${fmtDia(inicioEfetivo)}–${fmtDia(fimEfetivo)}`,
      fabrilMin,
      jornadaMin,
      pct,
    })

    cursor = addDays(fimSemana, 1)
  }

  return semanas
}

export function calcularKPIs(
  profissionaisLista: { id: string; nome: string }[],
  atendimentos: Atendimento[],
  jornadas: Jornada[],
  jornadasPlanejadas: JornadaPlanejada[],
  dataInicio: Date,
  dataFim: Date,
  reunioes: Reuniao[] = [],
): KPIsProfissional[] {
  const kpis: KPIsProfissional[] = []
  const jornadasSemanaisPorProfissional = buildMapaSemanalPorProfissional(jornadas)
  const jornadasMensaisPorProfissional = buildMapaMensalPorProfissional(jornadasPlanejadas)

  for (const prof of profissionaisLista) {
    const jornadaSemanalMap = jornadasSemanaisPorProfissional.get(prof.id) ?? new Map()
    const jornadaMensalMap = jornadasMensaisPorProfissional.get(prof.id)

    const atsProfissional = atendimentos.filter((a) => a.profissional_id === prof.id)

    const tempoReuniaoMin = reunioes
      .filter(r => r.profissional_id === prof.id && r.duracao_minutos !== null)
      .filter(r => {
        const ini = new Date(r.inicio)
        return ini >= dataInicio && ini <= dataFim
      })
      .reduce((acc, r) => acc + (r.duracao_minutos ?? 0), 0)

    const jornadaContratadaMin = calcularJornadaContratadaMinutos(
      jornadaSemanalMap,
      jornadaMensalMap,
      dataInicio,
      dataFim,
    )

    const tempoFabrilMin = atsProfissional
      .filter((a) => isStatusFabril(a.status))
      .reduce((acc, a) => acc + (a.duracao_minutos ?? 0), 0)

    const qtdAtendimentos = atsProfissional.filter((a) =>
      isStatusFabril(a.status),
    ).length

    const tempoMedioMin = qtdAtendimentos > 0 ? Math.round(tempoFabrilMin / qtdAtendimentos) : 0

    const taxaOcupacao = jornadaContratadaMin > 0
      ? Math.round((tempoFabrilMin / jornadaContratadaMin) * 100)
      : 0

    let diasSubutilizados = 0
    let cursor = new Date(dataInicio)

    while (cursor <= dataFim) {
      const jornDia = resolverJornadaDoDia(cursor, jornadaSemanalMap, jornadaMensalMap)

      if (jornDia) {
        const dataKeyCursor = formatAppDateKey(cursor)
        const atsDoDia = atsProfissional.filter((a) => {
          const dataKeyAtt = formatAppDateKey(new Date(a.data_agendamento))
          return dataKeyAtt === dataKeyCursor
        })

        const tempoFabrilDia = atsDoDia
          .filter((a) => isStatusFabril(a.status))
          .reduce((acc, a) => acc + (a.duracao_minutos ?? 0), 0)

        const jornadaDia = calcularMinutosJornada(jornDia)
        const ocupacaoDia = jornadaDia > 0 ? tempoFabrilDia / jornadaDia : 0

        if (ocupacaoDia < 0.5 && jornadaDia > 0) {
          diasSubutilizados++
        }
      }

      cursor = addDays(cursor, 1)
    }

    const evolucaoPorSemana = agruparPorSemana(
      atsProfissional,
      jornadaSemanalMap,
      jornadaMensalMap,
      dataInicio,
      dataFim,
    )

    kpis.push({
      profissionalId: prof.id,
      nome: prof.nome,
      jornadaContratadaMin,
      tempoFabrilMin,
      tempoReuniaoMin,
      taxaOcupacao,
      qtdAtendimentos,
      tempoMedioMin,
      diasSubutilizados,
      evolucaoPorSemana,
    })
  }

  return kpis
}

export function resolverPeriodo(
  params: Record<string, string | string[] | undefined>,
): { dataInicio: Date; dataFim: Date } {
  const hoje = new Date()
  const hojeStr = formatAppDateKey(hoje)
  const periodo = typeof params.periodo === 'string' ? params.periodo : 'este-mes'

  switch (periodo) {
    case 'esta-semana':
      return {
        dataInicio: startOfWeek(parseISO(hojeStr), { weekStartsOn: 0 }),
        dataFim: endOfWeek(parseISO(hojeStr), { weekStartsOn: 0 }),
      }
    case 'mes-passado': {
      const mesPassado = subMonths(parseISO(hojeStr), 1)
      return {
        dataInicio: startOfMonth(mesPassado),
        dataFim: endOfMonth(mesPassado),
      }
    }
    case 'personalizado': {
      const de = typeof params.de === 'string' ? params.de : hojeStr
      const ate = typeof params.ate === 'string' ? params.ate : hojeStr
      return {
        dataInicio: parseISO(de),
        dataFim: parseISO(ate),
      }
    }
    default:
      return {
        dataInicio: startOfMonth(parseISO(hojeStr)),
        dataFim: endOfMonth(parseISO(hojeStr)),
      }
  }
}
