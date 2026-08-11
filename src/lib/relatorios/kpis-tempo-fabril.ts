import { addDays } from 'date-fns'
import {
  formatAppDateKey,
  parseAppDate,
  APP_TIME_ZONE,
  startOfAppWeekKey,
  endOfAppWeekKey,
  startOfAppMonthKey,
  endOfAppMonthKey,
  subAppMonthsKey,
} from '../datetime.ts'
import { calcularMinutosJornada, obterIntervalosJornada, toHora } from '../jornada.ts'
import {
  buildMapaMensalPorProfissional,
  buildMapaSemanalPorProfissional,
  resolverJornadaDoDia,
  type JornadaMensalDiaPlanejado,
  type JornadaMensalPlanejada,
  type JornadaSemanal,
} from '../jornada-planejada.ts'
import { isStatusFabril } from '../atendimento-status.ts'

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
  paciente_nome?: string | null
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
  id: string
  profissional_id: string
  status: string
  observacao: string | null
  inicio: string
  fim: string
  duracao_minutos: number
}

// Status manual ainda em aberto (fim IS NULL) — usado só pra exibir na conferência,
// não entra nos cálculos agregados de tempo fábril.
export type HistoricoStatusAberto = {
  id: string
  profissional_id: string
  status: string
  observacao: string | null
  inicio: string
}

export type StatusDetalheKPI = {
  id: string
  status: string
  /** AC-034: o motivo declarado no ato da troca, copiado para o bloco pelo gatilho. */
  observacao: string | null
  inicio: string
  fim: string | null
  duracaoMinutos: number
  aberto: boolean
}

export type AtendimentoDetalheKPI = {
  id: string
  pacienteNome: string
  tipo: string
  duracaoMinutos: number
  data: string
}

export type KPIsProfissional = {
  profissionalId: string
  nome: string
  jornadaContratadaMin: number
  tempoFabrilMin: number
  horasAgendamentoMin: number   // soma bruta dos atendimentos concluídos/em atendimento (sem status personalizados)
  tempoReuniaoMin: number       // alias para tempoStatusMin['reuniao'] ?? 0
  tempoStatusMin: Record<string, number>  // slug → minutos
  taxaOcupacao: number
  qtdAtendimentos: number
  tempoMedioMin: number
  diasSubutilizados: number
  evolucaoPorSemana: EvolucaoSemanalKPI[]
  detalheAtendimentos: AtendimentoDetalheKPI[]
  detalheStatus: StatusDetalheKPI[]
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

// Soma o tempo de status personalizados (reunião, hora administrativa, etc.) que caiu
// dentro de um intervalo específico, já capado pela jornada real do profissional.
function somarTempoStatusNoIntervalo(
  historico: HistoricoStatus[],
  jornadaSemanalMap: Map<number, JornadaSemanal>,
  jornadaMensalMap: Map<string, JornadaMensalDiaPlanejado> | undefined,
  inicio: Date,
  fim: Date,
): number {
  let total = 0

  for (const h of historico) {
    const ini = new Date(h.inicio)
    const hFim = new Date(h.fim)
    if (ini > fim || hFim < inicio) continue

    const inicioEfetivo = ini < inicio ? inicio : ini
    const fimEfetivo = hFim > fim ? fim : hFim

    total += calcularMinutosStatusNaJornada(inicioEfetivo, fimEfetivo, jornadaSemanalMap, jornadaMensalMap)
  }

  return total
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
  historicoProfissional: HistoricoStatus[],
  reuniaoProfissional: Reuniao[],
  jornadaSemanalMap: Map<number, JornadaSemanal>,
  jornadaMensalMap: Map<string, JornadaMensalDiaPlanejado> | undefined,
  dataInicio: Date,
  dataFim: Date,
): EvolucaoSemanalKPI[] {
  const semanas: EvolucaoSemanalKPI[] = []
  const dataInicioStr = formatAppDateKey(dataInicio)
  const dataFimStr = formatAppDateKey(dataFim)
  let cursorStr = startOfAppWeekKey(dataInicioStr)

  while (cursorStr <= dataFimStr) {
    const fimSemanaStr = endOfAppWeekKey(cursorStr)
    const inicioEfetivoStr = cursorStr < dataInicioStr ? dataInicioStr : cursorStr
    const fimEfetivoStr = fimSemanaStr > dataFimStr ? dataFimStr : fimSemanaStr

    const inicioEfetivo = parseAppDate(inicioEfetivoStr)
    const fimEfetivo = parseAppDate(fimEfetivoStr)

    const atsSemana = atendimentos.filter((a) => {
      const dataKeyAtt = formatAppDateKey(new Date(a.data_agendamento))
      return dataKeyAtt >= inicioEfetivoStr && dataKeyAtt <= fimEfetivoStr
    })

    const fabrilAtendimentosMin = atsSemana
      .filter((a) => isStatusFabril(a.status))
      .reduce((acc, a) => acc + (a.duracao_minutos ?? 0), 0)

    const statusPersonalizadoMin = somarTempoStatusNoIntervalo(
      historicoProfissional,
      jornadaSemanalMap,
      jornadaMensalMap,
      inicioEfetivo,
      fimEfetivo,
    )

    const legadoReuniaoMin = reuniaoProfissional
      .filter((r) => r.duracao_minutos !== null)
      .filter((r) => {
        const ini = new Date(r.inicio)
        return ini >= inicioEfetivo && ini <= fimEfetivo
      })
      .reduce((acc, r) => acc + (r.duracao_minutos ?? 0), 0)

    const fabrilMin = fabrilAtendimentosMin + statusPersonalizadoMin + legadoReuniaoMin

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

    cursorStr = formatAppDateKey(addDays(parseAppDate(fimSemanaStr), 1))
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
  historicoAberto: HistoricoStatusAberto[] = [],
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

    const historicoProfissional = historico.filter((h) => h.profissional_id === prof.id)
    const reuniaoProfissional = reunioes.filter((r) => r.profissional_id === prof.id)

    // Agrega tempo por status a partir do histórico automático,
    // capando cada registro pela interseção real com a jornada do profissional.
    const tempoStatusMin: Record<string, number> = {}
    for (const h of historicoProfissional) {
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
    const legadoReuniaoMin = reuniaoProfissional
      .filter(r => r.duracao_minutos !== null)
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

    const horasAgendamentoMin = atsProfissional
      .filter((a) => isStatusFabril(a.status))
      .reduce((acc, a) => acc + (a.duracao_minutos ?? 0), 0)

    // Tempo Fábril = consultas concluídas/em atendimento + status personalizados
    // (reunião, hora administrativa, etc. registrados em historico_status_disponibilidade)
    const tempoStatusPersonalizadoMin = Object.values(tempoStatusMin).reduce((acc, min) => acc + min, 0)
    const tempoFabrilMin = horasAgendamentoMin + tempoStatusPersonalizadoMin

    const qtdAtendimentos = atsProfissional.filter((a) =>
      isStatusFabril(a.status),
    ).length

    const tempoMedioMin = qtdAtendimentos > 0 ? Math.round(horasAgendamentoMin / qtdAtendimentos) : 0

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
      historicoProfissional,
      reuniaoProfissional,
      jornadaSemanalMap,
      jornadaMensalMap,
      dataInicio,
      dataFim,
    )

    const detalheAtendimentos: AtendimentoDetalheKPI[] = atsProfissional
      .filter((a) => isStatusFabril(a.status))
      .map((a) => ({
        id: a.id,
        pacienteNome: a.paciente_nome?.trim() || 'Sem paciente',
        tipo: a.tipo || 'Sem tipo',
        duracaoMinutos: a.duracao_minutos ?? 0,
        data: a.data_agendamento,
      }))
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())

    // Conferência de status: entradas fechadas no período + qualquer entrada ainda
    // em aberto agora (não entra no cálculo de tempoStatusMin, só é exibida pra
    // o gestor conseguir revisar/pegar anomalias antes do fallback de 2h agir).
    const historicoAbertoProfissional = historicoAberto.filter((h) => h.profissional_id === prof.id)

    const detalheStatusFechados: StatusDetalheKPI[] = historicoProfissional
      .filter((h) => {
        const ini = new Date(h.inicio)
        const fim = new Date(h.fim)
        return !(ini > dataFim || fim < dataInicio)
      })
      .map((h) => ({
        id: h.id,
        status: h.status,
        observacao: h.observacao,
        inicio: h.inicio,
        fim: h.fim,
        duracaoMinutos: h.duracao_minutos,
        aberto: false,
      }))

    const detalheStatusAbertos: StatusDetalheKPI[] = historicoAbertoProfissional.map((h) => ({
      id: h.id,
      status: h.status,
      observacao: h.observacao,
      inicio: h.inicio,
      fim: null,
      duracaoMinutos: Math.max(0, Math.round((Date.now() - new Date(h.inicio).getTime()) / 60_000)),
      aberto: true,
    }))

    const detalheStatus = [...detalheStatusAbertos, ...detalheStatusFechados]
      .sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime())

    kpis.push({
      profissionalId: prof.id,
      nome: prof.nome,
      jornadaContratadaMin,
      tempoFabrilMin,
      horasAgendamentoMin,
      tempoReuniaoMin,
      tempoStatusMin,
      taxaOcupacao,
      qtdAtendimentos,
      tempoMedioMin,
      diasSubutilizados,
      evolucaoPorSemana,
      detalheAtendimentos,
      detalheStatus,
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
        dataInicio: parseAppDate(startOfAppWeekKey(hojeStr)),
        dataFim: parseAppDate(endOfAppWeekKey(hojeStr)),
      }
    case 'mes-passado': {
      const mesPassadoStr = subAppMonthsKey(hojeStr, 1)
      return {
        dataInicio: parseAppDate(startOfAppMonthKey(mesPassadoStr)),
        dataFim: parseAppDate(endOfAppMonthKey(mesPassadoStr)),
      }
    }
    case 'personalizado': {
      const de = typeof params.de === 'string' ? params.de : hojeStr
      const ate = typeof params.ate === 'string' ? params.ate : hojeStr
      return {
        dataInicio: parseAppDate(de),
        dataFim: parseAppDate(ate),
      }
    }
    default:
      return {
        dataInicio: parseAppDate(startOfAppMonthKey(hojeStr)),
        dataFim: parseAppDate(endOfAppMonthKey(hojeStr)),
      }
  }
}
