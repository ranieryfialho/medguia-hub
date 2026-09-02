import {
  ChevronLeft,
  ChevronRight,
  CalendarCheck,
  User,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  format, startOfWeek, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths,
  isSameDay, parseISO, isValid, isSameMonth
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { AgendaFiltrosAutoSubmit, SlideNovoAgendamento, AgendaDatePicker } from '@/components/features/agenda'
import { AgendamentoItemDia, AgendamentoItemSemana } from '@/components/features/agenda'
import type { AgendamentoDetalhe } from '@/components/features/agenda'
import { CardStatusEquipe, type StatusEquipeDeclaracaoRow } from '@/components/features/agenda/CardStatusEquipe'
import { buildSessaoEfetivaMap } from '@/lib/sessoes'
import { listarTodasDisponibilidades } from '@/actions/disponibilidade'
import { listarPlanosSaudeAtivos } from '@/actions/planos-saude'
import { listarStatusOpcoesParaExibicao } from '@/actions/status-disponibilidade-config'
import { formatAppDateKey, formatAppTime, getAppDayRangeUTC, getAppHour, parseAppDate } from '@/lib/datetime'
import { normalizarDisponibilidade, type DisponibilidadeDia } from '@/lib/disponibilidade'
import { buildMapaMensalPorProfissional, resolverJornadaDoDia } from '@/lib/jornada-planejada'
import { podeEntrarNaAgendaOuRelatorio } from '@/lib/profissionais'
import { ehStatusPersonalizado } from '@/lib/status-disponibilidade-regras'
import { requireModulo } from '@/lib/guard'
import { podeGerirEquipe, isGestorSistema } from '@/lib/permissoes'
import {
  getAtendimentoStatusKey,
  getStatusRawValuesForKeys,
  isStatusConcluido,
} from '@/lib/atendimento-status'

type StatusConfig = { badgeBg: string; label: string }
type RelacaoPaciente = AgendamentoDetalhe['pacientes'] | AgendamentoDetalhe['pacientes'][]
type RelacaoProfissional = AgendamentoDetalhe['profissional'] | AgendamentoDetalhe['profissional'][]
type RelacaoAgendamentoPai = NonNullable<AgendamentoDetalhe['agendamento_pai']> | NonNullable<AgendamentoDetalhe['agendamento_pai']>[]

type AgendaQueryOverrides = {
  data?: string
  view?: string
  meus?: boolean
  profissional?: string | null
  horario?: string | null
  statuses?: string[] | null
  clearPersistedStatuses?: boolean
}

const STATUS_FILTER_OPTIONS = [
  { value: 'confirmado',          label: 'Confirmado',          badgeBg: 'bg-green-600' },
  { value: 'aguardando',          label: 'Aguardando',          badgeBg: 'bg-amber-500' },
  { value: 'aguardando_consulta', label: 'Ag. Consulta',        badgeBg: 'bg-teal-500' },
  { value: 'em_atendimento',      label: 'Em Atendimento',      badgeBg: 'bg-blue-600' },
  { value: 'concluido',           label: 'Concluído',           badgeBg: 'bg-violet-600' },
  { value: 'cancelado',           label: 'Cancelado',           badgeBg: 'bg-red-600' },
  { value: 'falta',               label: 'Falta',               badgeBg: 'bg-gray-500' },
  { value: 'reagendado',          label: 'Reagendado',          badgeBg: 'bg-orange-500' },
] as const

const ALL_STATUS_FILTER_VALUES = STATUS_FILTER_OPTIONS.map((status) => status.value)

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function buildAgendaUrl(base: {
  data: string
  view: string
  meus: boolean
  profissional: string
  horario: string
  statuses: string[]
}, overrides: AgendaQueryOverrides = {}) {
  const query = new URLSearchParams()
  const data = overrides.data ?? base.data
  const view = overrides.view ?? base.view
  const meus = overrides.meus ?? base.meus
  const profissional = overrides.profissional === undefined ? base.profissional : (overrides.profissional ?? '')
  const horario = overrides.horario === undefined ? base.horario : (overrides.horario ?? '')
  const statuses = overrides.statuses === undefined ? base.statuses : (overrides.statuses ?? [])
  const clearPersistedStatuses = overrides.clearPersistedStatuses ?? false

  query.set('view', view)
  query.set('data', data)

  if (meus) query.set('meus', 'true')
  if (profissional) query.set('profissional', profissional)
  if (horario) query.set('horario', horario)
  if (clearPersistedStatuses) query.set('clear_status_filters', 'true')
  for (const status of statuses) {
    query.append('status', status)
  }

  return `?${query.toString()}`
}

const getStatusConfig = (status: string) => {
  const configs: Record<string, StatusConfig> = {
    confirmado:          { badgeBg: 'bg-green-600',  label: 'Confirmado' },
    aguardando:          { badgeBg: 'bg-amber-500',  label: 'Aguardando' },
    aguardando_consulta: { badgeBg: 'bg-teal-500',   label: 'Ag. Consulta' },
    em_atendimento:      { badgeBg: 'bg-blue-600',   label: 'Em Atend.' },
    concluido:           { badgeBg: 'bg-violet-600', label: 'Concluído' },
    cancelado:           { badgeBg: 'bg-red-600',    label: 'Cancelado' },
    falta:               { badgeBg: 'bg-gray-500',   label: 'Falta' },
    reagendado:          { badgeBg: 'bg-orange-500', label: 'Reagendado' },
    desconhecido:        { badgeBg: 'bg-gray-400',   label: 'Agendado' },
  }
  return configs[getAtendimentoStatusKey(status)] || configs.desconhecido
}

const HORAS_DIA = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function AgendaPage({ searchParams }: PageProps) {
  const { user, profile } = await requireModulo('agenda')

  const supabase = await createClient()

  const podeGerirAgendaEquipe = podeGerirEquipe({
    role: profile?.role,
    nivelAcesso: profile?.nivel_acesso,
  })
  const podeVerComercial = isGestorSistema(profile?.nivel_acesso)

  const params = await searchParams
  const view = typeof params.view === 'string' ? params.view : 'dia'
  const dataParam = typeof params.data === 'string' ? params.data : undefined
  const myAppointmentsOnly = params.meus === 'true'
  const profissionalSelecionado = typeof params.profissional === 'string' ? params.profissional : ''
  const horarioSelecionado = typeof params.horario === 'string' ? params.horario.slice(0, 5) : ''
  const clearPersistedStatuses = params.clear_status_filters === 'true'
  const statusParams = Array.isArray(params.status)
    ? params.status
    : typeof params.status === 'string'
      ? [params.status]
      : []
  const statusSelecionados = statusParams.filter((status): status is (typeof ALL_STATUS_FILTER_VALUES)[number] =>
    ALL_STATUS_FILTER_VALUES.includes(status as (typeof ALL_STATUS_FILTER_VALUES)[number])
  )
  const statusSelecionadosSet = new Set<string>(statusSelecionados)
  const shouldFilterByStatus = statusSelecionadosSet.size > 0
  const statusRawValues = shouldFilterByStatus ? getStatusRawValuesForKeys(statusSelecionados) : []
  const matchesStatusFilter = (status: string) =>
    !shouldFilterByStatus || statusSelecionadosSet.has(getAtendimentoStatusKey(status))

  const hojeString = formatAppDateKey(new Date())
  let dataSelecionada = parseAppDate(hojeString)
  if (dataParam) {
    const dataParseada = parseISO(dataParam)
    if (isValid(dataParseada)) {
      dataSelecionada = parseAppDate(dataParam)
    }
  }

  const dataString = formatAppDateKey(dataSelecionada)

  let prevDate, nextDate
  if (view === 'mes') {
    prevDate = subMonths(dataSelecionada, 1)
    nextDate = addMonths(dataSelecionada, 1)
  } else if (view === 'semana') {
    prevDate = subWeeks(dataSelecionada, 1)
    nextDate = addWeeks(dataSelecionada, 1)
  } else {
    prevDate = subDays(dataSelecionada, 1)
    nextDate = addDays(dataSelecionada, 1)
  }

  const baseQuery = {
    data: dataString,
    view,
    meus: myAppointmentsOnly,
    profissional: profissionalSelecionado,
    horario: horarioSelecionado,
    statuses: statusSelecionados,
  }
  const prevUrl = buildAgendaUrl(baseQuery, { data: formatAppDateKey(prevDate) })
  const nextUrl = buildAgendaUrl(baseQuery, { data: formatAppDateKey(nextDate) })

  const baseParamsDatePicker = (() => {
    const p = new URLSearchParams()
    p.set('view', view)
    if (myAppointmentsOnly) p.set('meus', 'true')
    if (profissionalSelecionado) p.set('profissional', profissionalSelecionado)
    if (horarioSelecionado) p.set('horario', horarioSelecionado)
    for (const status of statusSelecionados) p.append('status', status)
    return p.toString()
  })()

  const inicioDaSemana = startOfWeek(dataSelecionada, { weekStartsOn: 0 })
  const diasDaSemana = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(inicioDaSemana, i)
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0))
  })

  const mesAnoAtual = format(dataSelecionada, "MMMM, yyyy", { locale: ptBR })
  const diaFormatadoSelecionado = format(dataSelecionada, "dd MMM", { locale: ptBR })

  const anoMes = dataString.slice(0, 7) // 'yyyy-MM'
  const ano = parseInt(anoMes.slice(0, 4), 10)
  const mesIndex = parseInt(anoMes.slice(5, 7), 10) - 1
  const totalDiasNoMes = new Date(Date.UTC(ano, mesIndex + 1, 0)).getUTCDate()
  const diasDoMes = Array.from({ length: totalDiasNoMes }, (_, i) =>
    parseAppDate(`${anoMes}-${(i + 1).toString().padStart(2, '0')}`)
  )
  const inicioDoMes = diasDoMes[0]
  const fimDoMes = diasDoMes[diasDoMes.length - 1]
  const diaDaSemanaInicio = inicioDoMes.getUTCDay()
  const diasVaziosInicio = Array.from({ length: diaDaSemanaInicio }, (_, i) => {
    const prevDate = new Date(inicioDoMes)
    prevDate.setUTCDate(prevDate.getUTCDate() - (diaDaSemanaInicio - i))
    return prevDate
  }).reverse()
  const todosDiasMes = [...diasVaziosInicio, ...diasDoMes]

  let { start: fetchInicio, end: fetchFim } = getAppDayRangeUTC(dataString)
  const shouldFilterByProfissional = !podeGerirAgendaEquipe || myAppointmentsOnly
  const profissionalIdFiltro = shouldFilterByProfissional ? user.id : profissionalSelecionado || ''

  if (view === 'semana') {
    fetchInicio = getAppDayRangeUTC(formatAppDateKey(diasDaSemana[0])).start
    fetchFim = getAppDayRangeUTC(formatAppDateKey(diasDaSemana[6])).end
  } else if (view === 'mes') {
    fetchInicio = getAppDayRangeUTC(formatAppDateKey(inicioDoMes)).start
    fetchFim = getAppDayRangeUTC(formatAppDateKey(fimDoMes)).end
  }

  let agendamentosComEfetivo: AgendamentoDetalhe[] = []

  if (view === 'mes') {
    const agendamentosMesLevesQuery = supabase
      .from('atendimentos')
      .select('id, data_agendamento, status')
      .gte('data_agendamento', fetchInicio)
      .lte('data_agendamento', fetchFim)
      .order('data_agendamento', { ascending: true })

    if (profissionalIdFiltro) {
      agendamentosMesLevesQuery.or(`profissional_id.eq.${profissionalIdFiltro},fisioterapeuta_id.eq.${profissionalIdFiltro}`)
    }
    if (shouldFilterByStatus) {
      agendamentosMesLevesQuery.in('status', statusRawValues)
    }

    const { data: agendamentosMesLeves } = await agendamentosMesLevesQuery
    agendamentosComEfetivo = (agendamentosMesLeves ?? [])
      .map((a) => ({
        id: a.id,
        paciente_id: '',
        data_agendamento: a.data_agendamento,
        status: a.status,
        tipo: '',
        pacientes: null,
      }))
      .filter((agendamento) => matchesStatusFilter(agendamento.status))
      .filter((agendamento) =>
        !horarioSelecionado || formatAppTime(agendamento.data_agendamento) === horarioSelecionado,
      )
  } else {
    const usarQueryLeveAgenda = view === 'semana' || view === 'dia'
    const agendamentosQuery = usarQueryLeveAgenda
      ? (
        profissionalIdFiltro
          ? supabase
              .from('atendimentos')
              .select(`
                id,
                paciente_id,
                profissional_id,
                fisioterapeuta_id,
                agendamento_id,
                data_agendamento,
                status,
                tipo,
                observacoes,
                numero_sessao,
                total_sessoes,
                marcou_retorno,
                aguardando_desde,
                em_atendimento_desde,
                agendamento_pai:agendamentos(plano_saude, tipo),
                pacientes (nome, foto_drive_file_id, foto_atualizada_em),
                profissional:profiles!profissional_id(full_name),
                fisioterapeuta_executor:profiles!fisioterapeuta_id(full_name)
              `)
              .gte('data_agendamento', fetchInicio)
              .lte('data_agendamento', fetchFim)
              .or(`profissional_id.eq.${profissionalIdFiltro},fisioterapeuta_id.eq.${profissionalIdFiltro}`)
              .order('data_agendamento', { ascending: true })
          : supabase
              .from('atendimentos')
              .select(`
                id,
                paciente_id,
                profissional_id,
                fisioterapeuta_id,
                agendamento_id,
                data_agendamento,
                status,
                tipo,
                observacoes,
                numero_sessao,
                total_sessoes,
                marcou_retorno,
                aguardando_desde,
                em_atendimento_desde,
                agendamento_pai:agendamentos(plano_saude, tipo),
                pacientes (nome, foto_drive_file_id, foto_atualizada_em),
                profissional:profiles!profissional_id(full_name),
                fisioterapeuta_executor:profiles!fisioterapeuta_id(full_name)
              `)
              .gte('data_agendamento', fetchInicio)
              .lte('data_agendamento', fetchFim)
              .order('data_agendamento', { ascending: true })
      )
      : (
        profissionalIdFiltro
          ? supabase
              .from('atendimentos')
              .select(`
                id,
                paciente_id,
                profissional_id,
                fisioterapeuta_id,
                agendamento_id,
                data_agendamento,
                status,
                tipo,
                duracao_minutos,
                observacoes,
                numero_sessao,
                total_sessoes,
                marcou_retorno,
                aguardando_desde,
                em_atendimento_desde,
                agendamento_pai:agendamentos(plano_saude, tipo),
                pacientes (nome, telefone, email, foto_drive_file_id, foto_atualizada_em),
                profissional:profiles!profissional_id(full_name, role),
                fisioterapeuta_executor:profiles!fisioterapeuta_id(full_name)
              `)
              .gte('data_agendamento', fetchInicio)
              .lte('data_agendamento', fetchFim)
              .or(`profissional_id.eq.${profissionalIdFiltro},fisioterapeuta_id.eq.${profissionalIdFiltro}`)
              .order('data_agendamento', { ascending: true })
          : supabase
              .from('atendimentos')
              .select(`
                id,
                paciente_id,
                profissional_id,
                fisioterapeuta_id,
                agendamento_id,
                data_agendamento,
                status,
                tipo,
                duracao_minutos,
                observacoes,
                numero_sessao,
                total_sessoes,
                marcou_retorno,
                aguardando_desde,
                em_atendimento_desde,
                agendamento_pai:agendamentos(plano_saude, tipo),
                pacientes (nome, telefone, email, foto_drive_file_id, foto_atualizada_em),
                profissional:profiles!profissional_id(full_name, role),
                fisioterapeuta_executor:profiles!fisioterapeuta_id(full_name)
              `)
              .gte('data_agendamento', fetchInicio)
              .lte('data_agendamento', fetchFim)
              .order('data_agendamento', { ascending: true })
      )
    const agendamentosQueryFiltrada = shouldFilterByStatus
      ? agendamentosQuery.in('status', statusRawValues)
      : agendamentosQuery
    const { data: agendamentos } = await agendamentosQueryFiltrada

    const agendamentoIds = [...new Set(
      (agendamentos ?? [])
        .filter(a => !!a.agendamento_id && (a.total_sessoes ?? 0) > 1)
        .map(a => a.agendamento_id) as string[]
    )]
    let sessaoEfetivaMap = new Map<string, {
      sessao_efetiva: number
      total_efetivo: number
      sessao_tipo_efetiva: number
      total_tipo_efetivo: number
    }>()
    if (agendamentoIds.length > 0) {
      const { data: todasSessoes } = await supabase
        .from('atendimentos')
        .select('id, agendamento_id, data_agendamento, status, tipo')
        .in('agendamento_id', agendamentoIds)
      if (todasSessoes) {
        sessaoEfetivaMap = buildSessaoEfetivaMap(todasSessoes)
      }
    }

    agendamentosComEfetivo = (agendamentos ?? []).map(a => {
      const efetivo = sessaoEfetivaMap.get(a.id)
      return {
        ...a,
        pacientes: firstRelation(a.pacientes as RelacaoPaciente),
        profissional: firstRelation(a.profissional as RelacaoProfissional) ?? undefined,
        agendamento_pai: firstRelation(a.agendamento_pai as RelacaoAgendamentoPai) ?? undefined,
        fisioterapeuta_executor: firstRelation(a.fisioterapeuta_executor as { full_name?: string | null } | { full_name?: string | null }[]) ?? undefined,
        numero_sessao: efetivo?.sessao_efetiva ?? a.numero_sessao,
        total_sessoes: efetivo?.total_efetivo ?? a.total_sessoes,
        numero_sessao_tipo: efetivo?.sessao_tipo_efetiva ?? null,
        total_sessoes_tipo: efetivo?.total_tipo_efetivo ?? null,
      }
    }).filter((agendamento) =>
      matchesStatusFilter(agendamento.status)
    ).filter((agendamento) =>
      !horarioSelecionado || formatAppTime(agendamento.data_agendamento) === horarioSelecionado,
    )
  }

  // Na view mês, agendamentosComEfetivo já cobre o mês inteiro com os mesmos
  // filtros — reaproveita em vez de repetir a query ao Supabase.
  let agendamentosMesFiltrados: { data_agendamento: string; status: string }[]
  if (view === 'mes') {
    agendamentosMesFiltrados = agendamentosComEfetivo
  } else {
    const agendamentosMesQuery = supabase
      .from('atendimentos')
      .select('data_agendamento, status')
      .gte('data_agendamento', getAppDayRangeUTC(formatAppDateKey(inicioDoMes)).start)
      .lte('data_agendamento', getAppDayRangeUTC(formatAppDateKey(fimDoMes)).end)

    if (profissionalIdFiltro) agendamentosMesQuery.or(`profissional_id.eq.${profissionalIdFiltro},fisioterapeuta_id.eq.${profissionalIdFiltro}`)
    if (shouldFilterByStatus) agendamentosMesQuery.in('status', statusRawValues)

    const { data: agendamentosMes } = await agendamentosMesQuery
    agendamentosMesFiltrados = (agendamentosMes ?? []).filter((agendamento) =>
      matchesStatusFilter(agendamento.status)
    ).filter((agendamento) =>
      !horarioSelecionado || formatAppTime(agendamento.data_agendamento) === horarioSelecionado,
    )
  }

  const diasComAgendamento = new Set(
    agendamentosMesFiltrados.map(a => formatAppDateKey(a.data_agendamento))
  )

  const listaPacientes: Array<{ id: string; nome: string }> = []

  const { data: listaProfissionais } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('ativo', true)
    .neq('role', 'master')
    .order('full_name')

  const todosProfissionaisFormatados = listaProfissionais?.map(p => ({
    id: p.id,
    nome: p.full_name || 'Sem nome',
    cargo: p.role || 'Profissional'
  })) || []

  const [{ data: jornadasMensais }, todasDisponibilidades, planosSaude] = await Promise.all([
    supabase
      .from('jornada_mensal_profissional')
      .select('profissional_id, data, jornada_inicio, jornada_fim, intervalo_inicio, intervalo_fim, ativo')
      .gte('data', formatAppDateKey(inicioDoMes))
      .lte('data', formatAppDateKey(fimDoMes)),
    listarTodasDisponibilidades(),
    listarPlanosSaudeAtivos(),
  ])

  const disponibilidadesMap: Record<string, Record<number, DisponibilidadeDia>> = {}
  for (const d of todasDisponibilidades) {
    if (!disponibilidadesMap[d.profissional_id]) disponibilidadesMap[d.profissional_id] = {}
    disponibilidadesMap[d.profissional_id][d.dia_semana] = normalizarDisponibilidade(d)
  }
  const jornadasMensaisMap = buildMapaMensalPorProfissional((jornadasMensais ?? []) as Array<{
    profissional_id: string
    data: string
    jornada_inicio: string | null
    jornada_fim: string | null
    intervalo_inicio?: string | null
    intervalo_fim?: string | null
    ativo: boolean
  }>)
  const disponibilidadesMensaisMap: Record<string, Record<string, DisponibilidadeDia | null>> = {}
  for (const [profissionalId, porData] of jornadasMensaisMap.entries()) {
    disponibilidadesMensaisMap[profissionalId] = {}
    for (const [data, jornada] of porData.entries()) {
      disponibilidadesMensaisMap[profissionalId][data] = jornada.ativo && jornada.jornada_inicio && jornada.jornada_fim
        ? normalizarDisponibilidade({
            jornada_inicio: jornada.jornada_inicio,
            jornada_fim: jornada.jornada_fim,
            intervalo_inicio: jornada.intervalo_inicio ?? null,
            intervalo_fim: jornada.intervalo_fim ?? null,
          })
        : null
    }
  }

  const profissionaisComJornada = new Set([
    ...todasDisponibilidades.map((d) => d.profissional_id),
    ...Object.keys(disponibilidadesMensaisMap),
  ])
  const profissionaisElegiveisAgenda = listaProfissionais?.filter((p) =>
    podeEntrarNaAgendaOuRelatorio(p, profissionaisComJornada),
  ).map(p => ({
    id: p.id,
    nome: p.full_name || 'Sem nome',
    cargo: p.role || 'Profissional'
  })) || []

  // Disponibilidade do usuário logado (para highlight na semana)
  const dispLogado = disponibilidadesMap[user.id] ?? null
  const dispLogadoMensal = jornadasMensaisMap.get(user.id)

  const agendamentosHoje = agendamentosComEfetivo.filter(a => formatAppDateKey(a.data_agendamento) === dataString)
  const totalAgendamentos = agendamentosHoje.length
  const atendidos = agendamentosHoje.filter(a => isStatusConcluido(a.status)).length
  const pendentes = totalAgendamentos - atendidos

  // Indexa os agendamentos por dia (e por dia+hora, para a view semana) uma única
  // vez, em vez de rodar .filter() sobre a lista inteira dentro do JSX — que antes
  // rodava HORAS_DIA.length × diasDaSemana.length (98x) vezes na view semana, e
  // até 42x na view mês, cada passada varrendo todos os agendamentos do período.
  const agendamentosPorDia = new Map<string, AgendamentoDetalhe[]>()
  const agendamentosPorDiaHora = new Map<string, AgendamentoDetalhe[]>()
  for (const a of agendamentosComEfetivo) {
    const diaKey = formatAppDateKey(a.data_agendamento)

    const listaDia = agendamentosPorDia.get(diaKey)
    if (listaDia) listaDia.push(a)
    else agendamentosPorDia.set(diaKey, [a])

    const horaKey = `${diaKey}T${getAppHour(a.data_agendamento)}`
    const listaHora = agendamentosPorDiaHora.get(horaKey)
    if (listaHora) listaHora.push(a)
    else agendamentosPorDiaHora.set(horaKey, [a])
  }

  // US-003: card de status ao vivo da equipe — só para quem coordena a agenda.
  let cardStatusEquipe: {
    profissionais: { profissionalId: string; nome: string; ativo: boolean }[]
    declaracoesIniciais: StatusEquipeDeclaracaoRow[]
    emAtendimentoIdsIniciais: string[]
    opcoes: { slug: string; label: string; cor: string }[]
    slugsDeSistema: string[]
  } | null = null

  if (podeGerirAgendaEquipe) {
    const idsEquipeCard = profissionaisElegiveisAgenda.map((p) => p.id)
    const hojeRangeUTC = getAppDayRangeUTC(hojeString)

    const [{ data: statusRows }, statusOpcoesEquipe, { data: atendimentosEmCursoRows }] = await Promise.all([
      idsEquipeCard.length > 0
        ? supabase
            .from('status_disponibilidade')
            .select('profissional_id, status, observacao, atualizado_em')
            .in('profissional_id', idsEquipeCard)
        : Promise.resolve({ data: [] as StatusEquipeDeclaracaoRow[] }),
      listarStatusOpcoesParaExibicao(),
      supabase
        .from('atendimentos')
        .select('profissional_id, fisioterapeuta_id')
        .gte('data_agendamento', hojeRangeUTC.start)
        .lte('data_agendamento', hojeRangeUTC.end)
        .in('status', getStatusRawValuesForKeys(['em_atendimento'])),
    ])

    const emAtendimentoIdsSet = new Set<string>()
    for (const row of atendimentosEmCursoRows ?? []) {
      if (row.profissional_id) emAtendimentoIdsSet.add(row.profissional_id)
      if (row.fisioterapeuta_id) emAtendimentoIdsSet.add(row.fisioterapeuta_id)
    }

    cardStatusEquipe = {
      profissionais: profissionaisElegiveisAgenda.map((p) => ({
        profissionalId: p.id,
        nome: p.nome,
        ativo: true,
      })),
      declaracoesIniciais: (statusRows ?? []) as StatusEquipeDeclaracaoRow[],
      emAtendimentoIdsIniciais: [...emAtendimentoIdsSet],
      opcoes: statusOpcoesEquipe.map((o) => ({ slug: o.slug, label: o.label, cor: o.cor })),
      slugsDeSistema: statusOpcoesEquipe.filter((o) => !ehStatusPersonalizado(o)).map((o) => o.slug),
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-3 lg:gap-4 p-2.5 sm:p-3 lg:p-4" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>

      <h2 className="font-bold text-xl lg:text-2xl text-[#171d1c] flex-shrink-0 px-1">Agenda de Atendimento</h2>

      {/* GRID PRINCIPAL (DUAS COLUNAS) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-6 overflow-hidden">

        {/* COLUNA ESQUERDA (CALENDÁRIO PRINCIPAL) */}
        <div className="order-2 lg:order-1 col-span-1 lg:col-span-8 flex flex-col gap-3 lg:gap-4 min-h-0 overflow-hidden">

          {/* Barra de navegação */}
          <div className="flex-shrink-0 bg-[#f0f5f4] rounded-2xl lg:rounded-3xl px-3 lg:px-5 py-2.5 lg:py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 lg:gap-2 min-w-0">
              <Link href={prevUrl} className="w-7 h-7 lg:w-9 lg:h-9 rounded-full flex items-center justify-center hover:bg-[#dee3e3] transition-colors text-[#171d1c] shrink-0">
                <ChevronLeft size={18} />
              </Link>
              <h3 className="font-extrabold text-sm lg:text-xl text-[#006b5a] tracking-tight capitalize w-24 lg:w-44 text-center truncate">
                {mesAnoAtual}
              </h3>
              <Link href={nextUrl} className="w-7 h-7 lg:w-9 lg:h-9 rounded-full flex items-center justify-center hover:bg-[#dee3e3] transition-colors text-[#171d1c] shrink-0">
                <ChevronRight size={18} />
              </Link>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex bg-[#dee3e3] p-1 rounded-full">
                <Link
                  href={buildAgendaUrl(baseQuery, { view: 'dia' })}
                  className={`px-2.5 lg:px-5 py-1.5 rounded-full text-[10px] lg:text-xs font-bold uppercase tracking-wider transition-all ${view === 'dia' ? 'bg-white shadow-sm text-[#006b5a]' : 'text-[#3d4945] hover:text-[#171d1c]'}`}
                >
                  Dia
                </Link>
                <Link
                  href={buildAgendaUrl(baseQuery, { view: 'semana' })}
                  className={`hidden sm:block px-2.5 lg:px-5 py-1.5 rounded-full text-[10px] lg:text-xs font-bold uppercase tracking-wider transition-all ${view === 'semana' ? 'bg-white shadow-sm text-[#006b5a]' : 'text-[#3d4945] hover:text-[#171d1c]'}`}
                >
                  Semana
                </Link>
                <Link
                  href={buildAgendaUrl(baseQuery, { view: 'mes' })}
                  className={`px-2.5 lg:px-5 py-1.5 rounded-full text-[10px] lg:text-xs font-bold uppercase tracking-wider transition-all ${view === 'mes' ? 'bg-white shadow-sm text-[#006b5a]' : 'text-[#3d4945] hover:text-[#171d1c]'}`}
                >
                  Mês
                </Link>
              </div>

              {podeGerirAgendaEquipe && (
                <Link
                  href={buildAgendaUrl(baseQuery, { meus: !myAppointmentsOnly, profissional: profissionalSelecionado || null })}
                  title="Meus agendamentos"
                  className={`w-8 h-8 lg:w-auto lg:h-auto lg:px-4 lg:py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center lg:gap-1.5 ${
                    myAppointmentsOnly
                      ? 'bg-[#006b5a] text-white shadow-md shadow-[#006b5a]/20'
                      : 'bg-white text-[#006b5a] border border-[#bcc9c4]/50 hover:border-[#006b5a]'
                  }`}
                >
                  <User size={14} />
                  <span className="hidden lg:inline">Meus</span>
                </Link>
              )}
            </div>
          </div>

          <div className="flex-shrink-0 bg-white rounded-2xl border border-[#bcc9c4]/30 px-3 py-3 shadow-sm">
              <form method="get" className="flex flex-col gap-3">
                <AgendaFiltrosAutoSubmit
                  initialStatuses={statusSelecionados}
                  allStatuses={ALL_STATUS_FILTER_VALUES}
                  initialProfessional={profissionalSelecionado}
                  clearPersistedStatuses={clearPersistedStatuses}
                />
                <input type="hidden" name="view" value={view} />
                <input type="hidden" name="data" value={dataString} />
                {myAppointmentsOnly && <input type="hidden" name="meus" value="true" />}

                <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
                  {!shouldFilterByProfissional && (
                    <label className="flex-1 min-w-0">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-[#6d7a75] mb-1">Profissional</span>
                      <select
                        name="profissional"
                        defaultValue={profissionalSelecionado}
                        className="w-full bg-white border border-[#bcc9c4] rounded-xl px-3 py-2.5 text-sm text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/40"
                      >
                        <option value="">Todos os profissionais</option>
                        {profissionaisElegiveisAgenda.map((profissional) => (
                          <option key={profissional.id} value={profissional.id}>
                            {profissional.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <label className="w-full lg:w-48">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-[#6d7a75] mb-1">Horário</span>
                    <input
                      type="time"
                      name="horario"
                      defaultValue={horarioSelecionado}
                      className="w-full bg-white border border-[#bcc9c4] rounded-xl px-3 py-2.5 text-sm text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/40"
                    />
                  </label>
                </div>

                <fieldset>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <legend className="text-[11px] font-bold uppercase tracking-wider text-[#6d7a75]">
                      Status
                    </legend>
                    <span className="text-[11px] text-[#6d7a75]">
                      {shouldFilterByStatus ? `${statusSelecionados.length} selecionado(s)` : 'Todos visíveis'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {STATUS_FILTER_OPTIONS.map((status) => {
                      const isChecked = !shouldFilterByStatus || statusSelecionadosSet.has(status.value)
                      return (
                        <label
                          key={status.value}
                          className={`inline-flex w-full min-h-10 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                            isChecked
                              ? 'border-[#006b5a]/30 bg-[#e8f3f0] text-[#006b5a]'
                              : 'border-[#bcc9c4] bg-white text-[#3d4945]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            name="status"
                            value={status.value}
                            defaultChecked={isChecked}
                            className="sr-only"
                          />
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${status.badgeBg}`}></span>
                          <span className="truncate text-center leading-tight">{status.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>

                <div className="flex gap-2 lg:justify-end lg:pb-0.5">
                  <Link
                    href={buildAgendaUrl(baseQuery, {
                      profissional: null,
                      horario: null,
                      statuses: null,
                      clearPersistedStatuses: true,
                    })}
                    className="px-4 py-2.5 rounded-xl border border-[#bcc9c4] text-sm font-bold text-[#3d4945] hover:bg-[#f0f5f4] transition-colors"
                  >
                    Limpar
                  </Link>
                </div>
              </form>
            </div>

          {/* Área do calendário — ocupa o espaço restante */}
          <div className="flex-1 min-h-0 bg-white rounded-3xl p-3 sm:p-4 shadow-sm border border-[#bcc9c4]/30 overflow-hidden flex flex-col">

            {view === 'dia' && (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {/* Cabeçalho dos dias da semana */}
                <div className="flex-shrink-0 grid grid-cols-7 border-b border-[#bcc9c4]/30 mb-3 pb-3">
                  {diasDaSemana.map((dia) => {
                    const diaNome = format(dia, 'eee', { locale: ptBR })
                    const diaNumero = format(dia, 'd')
                    const isSelecionado = isSameDay(dia, dataSelecionada)
                    return (
                      <Link href={buildAgendaUrl(baseQuery, { view: 'dia', data: format(dia, 'yyyy-MM-dd') })} key={dia.toString()} className="text-center group cursor-pointer block">
                        <p className="text-[9px] lg:text-[10px] font-bold text-[#3d4945] uppercase tracking-tighter mb-1">{diaNome.replace('.', '').slice(0, 3)}</p>
                        <div className={`w-7 h-7 lg:w-9 lg:h-9 flex items-center justify-center mx-auto rounded-xl text-sm lg:text-base font-bold transition-colors ${
                          isSelecionado ? 'bg-[#006b5a] text-white shadow-lg shadow-[#006b5a]/30' : 'text-[#bcc9c4] group-hover:bg-[#f0f5f4] group-hover:text-[#171d1c]'
                        }`}>
                          {diaNumero}
                        </div>
                      </Link>
                    )
                  })}
                </div>

                {/* Lista de agendamentos — scroll interno */}
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-2 space-y-3 scrollbar-thin scrollbar-thumb-slate-200 md:flex-none md:max-h-[calc(100dvh-280px)]">
                  {agendamentosHoje.length > 0 ? (
                    agendamentosHoje.map((agendamento) => (
                      <AgendamentoItemDia key={agendamento.id} agendamento={agendamento} pacientes={listaPacientes || []} profissionais={todosProfissionaisFormatados} planos={planosSaude} podeVerComercial={podeVerComercial} />
                    ))
                  ) : (
                    <div className="py-8 text-center text-[#3d4945]/50 text-sm font-medium">Nenhum agendamento para este dia.</div>
                  )}
                </div>
              </div>
            )}

            {view === 'semana' && (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {/* Header fixo — scroll horizontal sincronizado via overflow-x-auto no pai */}
                <div className="flex-shrink-0 overflow-x-auto scrollbar-none">
                  <div className="min-w-[800px] grid grid-cols-[60px_repeat(7,1fr)] gap-2 mb-3 border-b border-[#bcc9c4]/30 pb-3">
                    <div></div>
                    {diasDaSemana.map((dia) => {
                       const isSelecionado = isSameDay(dia, dataSelecionada)
                       return (
                        <div key={dia.toString()} className="text-center">
                          <p className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${isSelecionado ? 'text-[#006b5a]' : 'text-[#3d4945]'}`}>
                            {format(dia, 'eee', { locale: ptBR }).replace('.', '')}
                          </p>
                          <p className={`text-xl font-extrabold ${isSelecionado ? 'text-[#006b5a]' : 'text-[#171d1c]'}`}>
                            {format(dia, 'd')}
                          </p>
                        </div>
                       )
                    })}
                  </div>
                </div>

                {/* Grade de horas — scroll interno vertical */}
                <div className="flex-1 min-h-0 overflow-auto pb-2 md:flex-none md:max-h-[calc(100dvh-280px)]">
                  <div className="min-w-[800px] space-y-0">
                    {HORAS_DIA.map((horaStr) => {
                      const horaNum = parseInt(horaStr.split(':')[0])
                      return (
                        <div key={horaStr} className="grid grid-cols-[60px_repeat(7,1fr)] gap-2 group min-h-[70px]">
                          <div className="text-xs font-bold text-[#3d4945]/50 text-right pr-2 pt-2 border-t border-dashed border-[#bcc9c4]/30">
                            {horaStr}
                          </div>
                          {diasDaSemana.map((dia) => {
                            const agendamentosNestaHora = agendamentosPorDiaHora.get(`${formatAppDateKey(dia)}T${horaNum}`) ?? []

                            const diaDisp = dispLogado
                              ? resolverJornadaDoDia(
                                  dia,
                                  new Map(Object.entries(dispLogado).map(([diaSemana, disp]) => [Number(diaSemana), disp])),
                                  dispLogadoMensal,
                                )
                              : null
                            const foraDisponibilidade = diaDisp
                              ? horaNum < parseInt(diaDisp.jornada_inicio) || horaNum >= parseInt(diaDisp.jornada_fim)
                              : false

                            return (
                              <div key={dia.toString()} className={`border-t border-l border-dashed border-[#bcc9c4]/30 p-1 relative transition-colors ${foraDisponibilidade ? 'bg-slate-100/70' : 'bg-[#f9fbfb]/50 group-hover:bg-[#f0f5f4]/50'}`}>
                                {agendamentosNestaHora.map(agendamento => (
                                  <AgendamentoItemSemana key={agendamento.id} agendamento={agendamento} pacientes={listaPacientes || []} profissionais={todosProfissionaisFormatados} planos={planosSaude} podeVerComercial={podeVerComercial} />
                                ))}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {view === 'mes' && (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="flex-shrink-0 grid grid-cols-7 mb-2">
                  {[
                    { full: 'Domingo', short: 'Dom' },
                    { full: 'Segunda', short: 'Seg' },
                    { full: 'Terça', short: 'Ter' },
                    { full: 'Quarta', short: 'Qua' },
                    { full: 'Quinta', short: 'Qui' },
                    { full: 'Sexta', short: 'Sex' },
                    { full: 'Sábado', short: 'Sáb' },
                  ].map(dia => (
                    <div key={dia.full} className="text-center text-[10px] lg:text-xs font-bold text-[#3d4945] uppercase tracking-wider py-2">
                      <span className="hidden sm:inline">{dia.full}</span>
                      <span className="sm:hidden">{dia.short}</span>
                    </div>
                  ))}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-7 gap-2 content-start">
                  {todosDiasMes.map((dia, idx) => {
                    const isMesmoMes = isSameMonth(dia, dataSelecionada)
                    const isSelecionado = isSameDay(dia, dataSelecionada)
                    const isHoje = formatAppDateKey(dia) === hojeString

                    const agendamentosDoDia = agendamentosPorDia.get(formatAppDateKey(dia)) ?? []
                    const qtdAgendamentos = agendamentosDoDia.length

                    if (!isMesmoMes) {
                      return (
                        <div key={`vazio-${idx}`} className="min-h-[48px] lg:min-h-[80px] bg-[#f0f5f4]/50 rounded-xl lg:rounded-2xl p-1 lg:p-2 opacity-40">
                          <span className="text-xs lg:text-sm font-bold text-[#3d4945]">{format(dia, 'd')}</span>
                        </div>
                      )
                    }

                    return (
                      <Link
                        href={buildAgendaUrl(baseQuery, { view: 'dia', data: formatAppDateKey(dia) })}
                        key={`dia-${idx}`}
                        className={`min-h-[48px] lg:min-h-[80px] border border-[#bcc9c4]/30 rounded-xl lg:rounded-2xl p-1 lg:p-2 flex flex-col transition-all hover:border-[#006b5a] hover:shadow-md cursor-pointer ${
                          isSelecionado ? 'bg-[#cce2da] border-[#006b5a]/50' : 'bg-white'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-sm font-bold ${isHoje ? 'bg-[#006b5a] text-white w-6 h-6 flex items-center justify-center rounded-full' : 'text-[#171d1c]'}`}>
                            {format(dia, 'd')}
                          </span>
                          {qtdAgendamentos > 0 && (
                            <span className="text-[10px] font-bold bg-[#f0f5f4] text-[#006b5a] px-1.5 py-0.5 rounded-full">
                              {qtdAgendamentos}
                            </span>
                          )}
                        </div>

                        <div className="flex-1 space-y-1 overflow-hidden mt-1">
                          {agendamentosDoDia.slice(0, 3).map(agendamento => {
                             const config = getStatusConfig(agendamento.status)
                             return (
                               <div key={agendamento.id} className={`w-full h-1.5 rounded-full ${config.badgeBg} opacity-80`}></div>
                             )
                          })}
                          {qtdAgendamentos > 3 && (
                            <div className="text-[9px] font-bold text-[#3d4945]/60 pt-1">+ {qtdAgendamentos - 3} mais</div>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* COLUNA DIREITA (RESUMO E MINI CALENDÁRIO) */}
        <div className="order-1 lg:order-2 col-span-1 lg:col-span-4 flex flex-col gap-3 lg:gap-4 min-h-0 overflow-hidden overflow-y-auto lg:overflow-hidden">

          {/* Card de resumo */}
          <div className="flex-shrink-0 bg-gradient-to-br from-[#006b5a] to-[#33a68f] p-4 sm:p-5 rounded-3xl text-white">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                  {view === 'mes' ? mesAnoAtual : diaFormatadoSelecionado}
                </p>
                <h4 className="text-2xl font-extrabold mt-0.5">{totalAgendamentos.toString().padStart(2, '0')} <span className="text-base">Agendamentos</span></h4>
              </div>
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                <CalendarCheck size={22} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-white/10 p-3 rounded-2xl">
                <p className="text-xs opacity-70">Atendidos</p>
                <p className="text-xl font-bold">{atendidos.toString().padStart(2, '0')}</p>
              </div>
              <div className="bg-white/10 p-3 rounded-2xl">
                <p className="text-xs opacity-70">Pendentes</p>
                <p className="text-xl font-bold">{pendentes.toString().padStart(2, '0')}</p>
              </div>
            </div>

            <SlideNovoAgendamento
              profissionais={profissionaisElegiveisAgenda}
              disponibilidades={disponibilidadesMap}
              disponibilidadesMensais={disponibilidadesMensaisMap}
              planos={planosSaude}
            />
          </div>

          {/* Status ao vivo da equipe (US-003) */}
          {cardStatusEquipe && (
            <CardStatusEquipe
              profissionais={cardStatusEquipe.profissionais}
              declaracoesIniciais={cardStatusEquipe.declaracoesIniciais}
              emAtendimentoIdsIniciais={cardStatusEquipe.emAtendimentoIdsIniciais}
              opcoes={cardStatusEquipe.opcoes}
              slugsDeSistema={cardStatusEquipe.slugsDeSistema}
            />
          )}

          {/* Mini calendário — ocupa o espaço restante */}
          <div className="flex-1 min-h-0 bg-[#f0f5f4] rounded-3xl p-3 sm:p-4 overflow-hidden flex flex-col">
            <div className="flex-shrink-0 flex items-center justify-between mb-3">
              <AgendaDatePicker key={dataString} dataAtual={dataString} baseParams={baseParamsDatePicker} />
              <div className="flex gap-1 text-[#3d4945]">
                <Link href={buildAgendaUrl(baseQuery, { data: format(subMonths(dataSelecionada, 1), 'yyyy-MM-dd') })}>
                  <ChevronLeft size={18} className="cursor-pointer hover:text-[#006b5a]" />
                </Link>
                <Link href={buildAgendaUrl(baseQuery, { data: format(addMonths(dataSelecionada, 1), 'yyyy-MM-dd') })}>
                  <ChevronRight size={18} className="cursor-pointer hover:text-[#006b5a]" />
                </Link>
              </div>
            </div>
            <div className="flex-shrink-0 grid grid-cols-7 gap-1 text-center mb-1">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((dia, i) => (
                <span key={`header-${i}`} className="text-[10px] font-bold text-[#3d4945]/60 py-1 uppercase">{dia}</span>
              ))}
            </div>
            <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-7 gap-1 text-center content-start">
              {todosDiasMes.map((dia, i) => {
                const isMesmoMes = isSameMonth(dia, dataSelecionada)
                const isSelecionado = isSameDay(dia, dataSelecionada)
                const diaNumero = format(dia, 'd')

                if (!isMesmoMes) {
                  return <span key={`vazio-${i}`} className="text-xs font-medium py-1.5 text-[#3d4945]/40">{diaNumero}</span>
                }

                const temAgendamento = diasComAgendamento.has(formatAppDateKey(dia))
                const linkUrlComFiltro = buildAgendaUrl(baseQuery, { data: formatAppDateKey(dia) })

                return (
                  <Link
                    key={`dia-${i}`}
                    href={linkUrlComFiltro}
                    className={`text-xs font-medium py-1.5 rounded-lg cursor-pointer flex flex-col items-center gap-0.5 transition-colors ${
                      isSelecionado
                        ? 'bg-[#006b5a] text-white font-bold shadow-md shadow-[#006b5a]/20'
                        : 'hover:bg-white text-[#171d1c]'
                    }`}
                  >
                    {diaNumero}
                    <span className={`w-1 h-1 rounded-full ${temAgendamento ? (isSelecionado ? 'bg-white/70' : 'bg-[#006b5a]') : 'bg-transparent'}`} />
                  </Link>
                )
              })}
            </div>

            <Link
              href={buildAgendaUrl(baseQuery, { data: hojeString })}
              className="flex-shrink-0 mt-1 w-full text-center text-xs font-bold py-2 rounded-xl bg-[#006b5a]/10 text-[#006b5a] hover:bg-[#006b5a]/20 transition-colors"
            >
              Hoje
            </Link>
          </div>

        </div>
      </div>

      {/* LEGENDA DE STATUS (RODAPÉ) */}
      <div className="flex-shrink-0 bg-white border border-[#bcc9c4]/30 rounded-3xl px-4 sm:px-6 py-3 shadow-sm w-full">
        <ul className="flex flex-wrap gap-x-6 sm:gap-x-10 gap-y-2 items-center">
          {[
            { cor: 'bg-green-600',  label: 'Confirmado' },
            { cor: 'bg-amber-500',  label: 'Aguardando' },
            { cor: 'bg-teal-500',   label: 'Ag. Consulta' },
            { cor: 'bg-blue-600',   label: 'Em Atendimento' },
            { cor: 'bg-violet-600', label: 'Concluído' },
            { cor: 'bg-red-600',    label: 'Cancelado' },
            { cor: 'bg-gray-500',   label: 'Falta' },
            { cor: 'bg-orange-500', label: 'Reagendado' },
          ].map((item, i) => (
            <li key={`legenda-${i}`} className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${item.cor} shadow-sm`}></span>
              <span className="text-sm font-semibold text-[#3d4945]">{item.label}</span>
            </li>
          ))}
        </ul>
      </div>

    </div>
  )
}
