import {
  addDays,
  endOfMonth,
  endOfWeek,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { formatAppDateKey, parseAppDate, APP_TIME_ZONE } from '@/lib/datetime'
import { calcularMinutosJornada, obterIntervalosJornada, toHora } from '@/lib/jornada'
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
  fisioterapeuta_id?: string | null
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

export type HistoricoStatus = {
  profissional_id: string
  status: string
  inicio: string
  fim: string
  duracao_minutos: number
}

export type KPIsProfissional = {
  profissionalId: string
  nome: string
  jornadaContratadaMin: number
  tempoFabrilMin: number
  tempoReuniaoMin: number       // alias para tempoStatusMin['reuniao'] ?? 0
  tempoStatusMin: Record<string, number>  // slug → minutos
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

// Calcula quantos minutos de [inicio, fim] caem dentro das horas de trabalho do profissional.
// Usa os intervalos reais da jornada (já excluindo almoço) dia a dia.
// Garante que um status aberto por engano nunca inflacione o relatório além da jornada.
function calcularMinutosStatusNaJornada(
  inicio: Date,
  fim: Date,
  jornadaSemanalMap: Map<number, JornadaSemanal>,
  jornadaMensalMap: Map<string, JornadaMensalDiaPlanejado> | undefined,
): number {
  let total = 0
  let cursorKey = formatAppDateKey(inicio)
  const fimKey = formatAppDateKey(fim)

  while (cursorKey <= fimKey) {
    const cursorDate = parseAppDate(cursorKey)
    const jornada = resolverJornadaDoDia(cursorDate, jornadaSemanalMap, jornadaMensalMap)

    if (jornada) {
      for (const intervalo of obterIntervalosJornada(jornada)) {
        // São Paulo é sempre UTC-3 (sem horário de verão desde 2020)
        const intervaloInicioMs = new Date(`${cursorKey}T${toHora(intervalo.inicio)}:00-03:00`).getTime()
        const intervaloFimMs   = new Date(`${cursorKey}T${toHora(intervalo.fim)}:00-03:00`).getTime()

        const overlapStart = Math.max(inicio.getTime(), intervaloInicioMs)
        const overlapEnd   = Math.min(fim.getTime(),   intervaloFimMs)

        if (overlapEnd > overlapStart) {
          total += Math.round((overlapEnd - overlapStart) / 60_000)
        }
      }
    }

    cursorKey = formatAppDateKey(addDays(parseAppDate(cursorKey), 1))
  }

  return Math.max(0, total)
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
  historico: HistoricoStatus[] = [],
): KPIsProfissional[] {
  const kpis: KPIsProfissional[] = []
  const jornadasSemanaisPorProfissional = buildMapaSemanalPorProfissional(jornadas)
  const jornadasMensaisPorProfissional = buildMapaMensalPorProfissional(jornadasPlanejadas)

  for (const prof of profissionaisLista) {
    const jornadaSemanalMap = jornadasSemanaisPorProfissional.get(prof.id) ?? new Map()
    const jornadaMensalMap = jornadasMensaisPorProfissional.get(prof.id)

    // Inclui atendimentos onde o profissional é responsável OU executor atribuído
    // Usa Set para evitar duplicatas quando profissional_id === fisioterapeuta_id
    const atsIds = new Set<string>()
    const atsProfissional: Atendimento[] = []
    for (const a of atendimentos) {
      if ((a.profissional_id === prof.id || a.fisioterapeuta_id === prof.id) && !atsIds.has(a.id)) {
        atsIds.add(a.id)
        atsProfissional.push(a)
      }
    }

    // Agrega tempo por status a partir do histórico automático,
    // capando cada registro pela interseção real com a jornada do profissional.
    const tempoStatusMin: Record<string, number> = {}
    for (const h of historico) {
      if (h.profissional_id !== prof.id) continue
      const ini = new Date(h.inicio)
      const fim = new Date(h.fim)
      if (ini > dataFim || fim < dataInicio) continue

      // Limita o período ao intervalo do relatório
      const inicioEfetivo = ini < dataInicio ? dataInicio : ini
      const fimEfetivo    = fim > dataFim    ? dataFim    : fim

      const minNaJornada = calcularMinutosStatusNaJornada(
        inicioEfetivo,
        fimEfetivo,
        jornadaSemanalMap,
        jornadaMensalMap,
      )
      if (minNaJornada > 0) {
        tempoStatusMin[h.status] = (tempoStatusMin[h.status] ?? 0) + minNaJornada
      }
    }

    // Merge legado: historico_reunioes alimenta o slug 'reuniao' (dados anteriores ao trigger)
    const legadoReuniaoMin = reunioes
      .filter(r => r.profissional_id === prof.id && r.duracao_minutos !== null)
      .filter(r => {
        const ini = new Date(r.inicio)
        return ini >= dataInicio && ini <= dataFim
      })
      .reduce((acc, r) => acc + (r.duracao_minutos ?? 0), 0)

    if (legadoReuniaoMin > 0) {
      tempoStatusMin['reuniao'] = (tempoStatusMin['reuniao'] ?? 0) + legadoReuniaoMin
    }

    const tempoReuniaoMin = tempoStatusMin['reuniao'] ?? 0

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
      tempoStatusMin,
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
