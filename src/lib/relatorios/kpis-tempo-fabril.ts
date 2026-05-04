import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { formatAppDateKey } from '@/lib/datetime'
import { calcularMinutosJornada } from '@/lib/jornada'

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

export type Jornada = {
  profissional_id: string
  dia_semana: number
  hora_inicio: string
  hora_fim: string
  almoco_inicio?: string | null
  almoco_fim?: string | null
}

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

export const STATUS_FABRIL = ['Concluído', 'Em atendimento']

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
  jornadaPorDiaSemana: Map<number, Jornada>,
  dataInicio: Date,
  dataFim: Date,
): number {
  let totalMinutos = 0
  let cursor = new Date(dataInicio)

  while (cursor <= dataFim) {
    const diaSemana = cursor.getDay()
    const jornada = jornadaPorDiaSemana.get(diaSemana)

    if (jornada) {
      totalMinutos += calcularMinutosJornada(jornada)
    }

    cursor = addDays(cursor, 1)
  }

  return totalMinutos
}

export function agruparPorSemana(
  atendimentos: Atendimento[],
  jornadaPorDiaSemana: Map<number, Jornada>,
  dataInicio: Date,
  dataFim: Date,
): EvolucaoSemanalKPI[] {
  const semanas: EvolucaoSemanalKPI[] = []
  let cursor = startOfWeek(dataInicio, { weekStartsOn: 0 })

  while (cursor <= dataFim) {
    const fimSemana = endOfWeek(cursor, { weekStartsOn: 0 })
    const inicioEfetivo = cursor < dataInicio ? dataInicio : cursor
    const fimEfetivo = fimSemana > dataFim ? dataFim : fimSemana

    const inicioEfetivoStr = format(inicioEfetivo, 'yyyy-MM-dd')
    const fimEfetivoStr = format(fimEfetivo, 'yyyy-MM-dd')

    const atsSemana = atendimentos.filter((a) => {
      const dataKeyAtt = formatAppDateKey(new Date(a.data_agendamento))
      return dataKeyAtt >= inicioEfetivoStr && dataKeyAtt <= fimEfetivoStr
    })

    const fabrilMin = atsSemana
      .filter((a) => STATUS_FABRIL.includes(a.status))
      .reduce((acc, a) => acc + (a.duracao_minutos ?? 0), 0)

    const jornadaMin = calcularJornadaContratadaMinutos(
      jornadaPorDiaSemana,
      inicioEfetivo,
      fimEfetivo,
    )

    const pct = jornadaMin > 0 ? Math.round((fabrilMin / jornadaMin) * 100) : 0

    semanas.push({
      label: `${format(inicioEfetivo, 'dd/MM')}–${format(fimEfetivo, 'dd/MM')}`,
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
  dataInicio: Date,
  dataFim: Date,
  reunioes: Reuniao[] = [],
): KPIsProfissional[] {
  const kpis: KPIsProfissional[] = []

  for (const prof of profissionaisLista) {
    const jornadaMap = new Map<number, Jornada>()

    for (const j of jornadas) {
      if (j.profissional_id === prof.id) {
        jornadaMap.set(j.dia_semana, j)
      }
    }

    const atsProfissional = atendimentos.filter((a) => a.profissional_id === prof.id)

    const tempoReuniaoMin = reunioes
      .filter(r => r.profissional_id === prof.id && r.duracao_minutos !== null)
      .filter(r => {
        const ini = new Date(r.inicio)
        return ini >= dataInicio && ini <= dataFim
      })
      .reduce((acc, r) => acc + (r.duracao_minutos ?? 0), 0)

    const jornadaContratadaMin = calcularJornadaContratadaMinutos(
      jornadaMap,
      dataInicio,
      dataFim,
    )

    const tempoFabrilMin = atsProfissional
      .filter((a) => STATUS_FABRIL.includes(a.status))
      .reduce((acc, a) => acc + (a.duracao_minutos ?? 0), 0)

    const qtdAtendimentos = atsProfissional.filter((a) =>
      STATUS_FABRIL.includes(a.status),
    ).length

    const tempoMedioMin = qtdAtendimentos > 0 ? Math.round(tempoFabrilMin / qtdAtendimentos) : 0

    const taxaOcupacao = jornadaContratadaMin > 0
      ? Math.round((tempoFabrilMin / jornadaContratadaMin) * 100)
      : 0

    let diasSubutilizados = 0
    let cursor = new Date(dataInicio)

    while (cursor <= dataFim) {
      const diaSemana = cursor.getDay()
      const jornDia = jornadaMap.get(diaSemana)

      if (jornDia) {
        const atsDoDia = atsProfissional.filter((a) => {
          const dataKeyAtt = formatAppDateKey(new Date(a.data_agendamento))
          const dataKeyCursor = format(cursor, 'yyyy-MM-dd')
          return dataKeyAtt === dataKeyCursor
        })

        const tempoFabrilDia = atsDoDia
          .filter((a) => STATUS_FABRIL.includes(a.status))
          .reduce((acc, a) => acc + (a.duracao_minutos ?? 0), 0)

        const jornadaDia = calcularMinutosJornada(jornDia)
        const ocupacaoDia = jornadaDia > 0 ? tempoFabrilDia / jornadaDia : 0

        if (ocupacaoDia < 0.5 && jornadaDia > 0) {
          diasSubutilizados++
        }
      }

      cursor = addDays(cursor, 1)
    }

    const evolucaoPorSemana = agruparPorSemana(atsProfissional, jornadaMap, dataInicio, dataFim)

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
