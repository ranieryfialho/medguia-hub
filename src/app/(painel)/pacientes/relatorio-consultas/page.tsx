import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { requireModulo } from '@/lib/guard'
import { formatAppDate, formatAppTime, getAppDayRangeUTC } from '@/lib/datetime'
import {
  getAtendimentoStatusKey,
  isStatusFabril,
  normalizeAtendimentoStatus,
} from '@/lib/atendimento-status'
import {
  BarChart3,
  CalendarCheck2,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  RotateCcw,
  Stethoscope,
  TrendingUp,
  Undo2,
} from 'lucide-react'
import { BtnGerarPdfConsultas } from '@/components/features/shared'
import { FiltrosConsultas } from '@/components/features/shared'
import { isGestorSistema } from '@/lib/permissoes'
import { podeEntrarNoWidgetDisponibilidade } from '@/lib/profissionais'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

type AgendamentoResumo = {
  id: string
  profissional_id: string | null
  tipo: string | null
  plano_saude: string | null
  data_inicio: string | null
  is_recorrente: boolean | null
  gerou_venda: boolean | null
  marcou_retorno: boolean | null
}

type AtendimentoResumo = {
  id: string
  agendamento_id: string | null
  profissional_id: string | null
  fisioterapeuta_id: string | null
  tipo: string | null
  status: string | null
  data_agendamento: string
  marcou_retorno?: boolean | null
  profissional?: { full_name: string | null } | Array<{ full_name: string | null }> | null
  pacientes?: { nome: string | null; telefone: string | null; email: string | null; origem: string | null; indicado_por: string | null } | Array<{ nome: string | null; telefone: string | null; email: string | null; origem: string | null; indicado_por: string | null }> | null
}

type MetricaTipo = {
  tipo: string
  agendamentos: number
  atendimentos: number
  produtivos: number
  pendentes: number
}

type LinhaPlanoSaudePorMedico = {
  profissionalId: string
  profissionalNome: string
  planos: Record<string, number>
  total: number
}

type PlanoSaudeColuna = {
  nome: string
  agendamentos: number
}

type LinhaProfissional = {
  profissionalId: string
  profissionalNome: string
  agendamentos: number
  recorrentes: number
  atendimentos: number
  produtivos: number
  pendentes: number
  canceladosOuFalta: number
}

const STATUS_CONFIRMADOS = new Set(['confirmado', 'concluido'])
const STATUS_PENDENTES = new Set(['aguardando'])
const STATUS_CANCELADOS = new Set(['cancelado', 'falta', 'reagendado'])

function lowerSafe(value: string | null | undefined) {
  const key = getAtendimentoStatusKey(value)
  if (key === 'em_atendimento') return 'concluido'
  if (key === 'desconhecido') {
    return (value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
  }
  return key.replace('_', ' ')
}

function normalizarTipo(tipo: string | null | undefined) {
  const texto = (tipo ?? '').trim()
  return texto || 'Sem tipo'
}

function normalizarPlanoSaude(plano: string | null | undefined) {
  const texto = (plano ?? '').trim()
  return texto || 'Não informado'
}

function ehOrigemMedico(origem: string) {
  const n = origem.toLowerCase()
  return n.includes('médico') || n.includes('medico')
}

function normalizarNomeMedico(nome: string | null | undefined): string {
  if (!nome?.trim()) return ''
  const semPrefixo = nome.trim().replace(/^(Dra?\.?\s+)/i, '').trim()
  return semPrefixo.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase())
}

function medicoParceiroDetalhamento(origem: string, indicadoPor: string | null | undefined): string | null {
  const nome = normalizarNomeMedico(indicadoPor)
  if (nome && ehOrigemMedico(origem)) return `Dr(a). ${nome}`
  return null
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function buildRelatorioConsultasUrl({
  visao,
  data_inicio,
  data_fim,
  tipos_filtro,
  status_filtro,
  origens_filtro,
}: {
  visao: 'fisioterapia' | 'medicos'
  data_inicio: string
  data_fim: string
  tipos_filtro: string[]
  status_filtro: string
  origens_filtro: string[]
}) {
  const query = new URLSearchParams()
  query.set('visao', visao)
  query.set('data_inicio', data_inicio)
  query.set('data_fim', data_fim)
  if (status_filtro) query.set('status', status_filtro)
  for (const origem of origens_filtro) query.append('origem', origem)
  for (const tipo of tipos_filtro) query.append('tipo', tipo)
  return `/pacientes/relatorio-consultas?${query.toString()}`
}

function buildDetalhamentoUrl(
  params: { [key: string]: string | string[] | undefined },
  overrides: {
    detalhe_pagina?: number
    detalhe_limite?: number
    detalhe_ordem?: string
    detalhe_realizados?: boolean
  } = {},
) {
  const query = new URLSearchParams()

  for (const [key, rawValue] of Object.entries(params)) {
    if (
      key === 'detalhe_pagina' ||
      key === 'detalhe_limite' ||
      key === 'detalhe_ordem' ||
      key === 'detalhe_realizados'
    ) continue
    if (Array.isArray(rawValue)) {
      for (const value of rawValue) query.append(key, value)
      continue
    }
    if (typeof rawValue === 'string' && rawValue.length > 0) {
      query.set(key, rawValue)
    }
  }

  const pagina = overrides.detalhe_pagina ?? 1
  const limite = overrides.detalhe_limite ?? 10
  const ordem = overrides.detalhe_ordem ?? 'data_desc'
  const realizados = overrides.detalhe_realizados ?? params.detalhe_realizados === '1'

  if (pagina > 1) query.set('detalhe_pagina', String(pagina))
  if (limite !== 10) query.set('detalhe_limite', String(limite))
  if (ordem !== 'data_desc') query.set('detalhe_ordem', ordem)
  if (realizados) query.set('detalhe_realizados', '1')

  return `/pacientes/relatorio-consultas?${query.toString()}`
}

export default async function RelatorioConsultasPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { user, profile } = await requireModulo('pacientes')

  const supabase = await createClient()
  const params = await searchParams

  const isGestorOuMaster = isGestorSistema(profile?.nivel_acesso)
  const roleUsuario = profile?.role ?? null

  const hoje = new Date()
  const dataInicioPadrao = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10)
  const dataFimPadrao = hoje.toISOString().slice(0, 10)

  const data_inicio = (params.data_inicio as string) || dataInicioPadrao
  const data_fim = (params.data_fim as string) || dataFimPadrao
  const visaoParam = params.visao === 'medicos' ? 'medicos' : 'fisioterapia'
  const visao = isGestorOuMaster ? visaoParam : roleUsuario === 'medico' ? 'medicos' : 'fisioterapia'
  const profissional_id = (params.profissional_id as string) || ''
  const medico_id = (params.medico_id as string) || ''
  const tipos_filtro = Array.isArray(params.tipo) ? params.tipo : params.tipo ? [params.tipo] : []
  const status_filtro = (params.status as string) || ''
  const origens_filtro = Array.isArray(params.origem) ? params.origem : params.origem ? [params.origem] : []
  const detalheLimiteRaw = Number(params.detalhe_limite)
  const detalheLimite = [10, 25, 50, 100].includes(detalheLimiteRaw) ? detalheLimiteRaw : 10
  const detalhePaginaRaw = Number(params.detalhe_pagina)
  const detalhePaginaBase = Number.isFinite(detalhePaginaRaw) && detalhePaginaRaw > 0 ? Math.floor(detalhePaginaRaw) : 1
  const detalheOrdem = typeof params.detalhe_ordem === 'string' && params.detalhe_ordem.length > 0
    ? params.detalhe_ordem
    : 'data_desc'
  const detalheRealizados = params.detalhe_realizados === '1'

  const dataInicioIso = getAppDayRangeUTC(data_inicio).start
  const dataFimIso = getAppDayRangeUTC(data_fim).end

  const [{ data: perfisProfissionaisRaw }, { data: disponibilidadeRaw }, { data: origensRaw }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['fisioterapeuta', 'gestor', 'medico'])
      .eq('ativo', true)
      .order('full_name'),
    supabase
      .from('disponibilidade_profissional')
      .select('profissional_id')
      .eq('ativo', true),
    supabase
      .from('origens_paciente')
      .select('nome')
      .eq('ativo', true)
      .order('ordem'),
  ])

  const profissionaisComJornada = new Set(
    (disponibilidadeRaw ?? []).map((item: { profissional_id: string }) => item.profissional_id)
  )

  const perfisProfissionais = (perfisProfissionaisRaw ?? []) as Array<{
    id: string
    full_name: string | null
    role: string | null
  }>

  // Para o dropdown, filtramos por podeEntrarNoWidgetDisponibilidade (padrão do widget de agenda).
  const profissionais = perfisProfissionais
    .filter((item) => item.role !== 'medico')
    .filter((item: { id: string; full_name: string | null; role: string | null }) =>
      podeEntrarNoWidgetDisponibilidade(item, profissionaisComJornada),
    )
    .map((item: { id: string; full_name: string | null; role: string | null }) => ({
      id: item.id,
      nome: item.full_name || 'Sem nome',
    }))

  const medicos = perfisProfissionais
    .filter((item) => item.role === 'medico')
    .map((item: { id: string; full_name: string | null; role: string | null }) => ({
      id: item.id,
      nome: item.full_name || 'Sem nome',
    }))

  // Para o filtro da query, usamos TODOS os profissionais do tipo correto (sem restrição de
  // disponibilidade_profissional), para que o relatório reflita todos os atendimentos da visão.
  const todosFisios = perfisProfissionais
    .filter((item) => item.role !== 'medico')
    .map((item) => item.id)
  const todosMedicos = perfisProfissionais
    .filter((item) => item.role === 'medico')
    .map((item) => item.id)

  const responsavelSelecionadoId = visao === 'medicos' ? medico_id : profissional_id
  const opcoesResponsaveis = visao === 'medicos' ? medicos : profissionais
  const profissionaisFiltroEfetivos = isGestorOuMaster
    ? (responsavelSelecionadoId
        ? [responsavelSelecionadoId]
        : visao === 'medicos' ? todosMedicos : todosFisios)
    : [user.id]

  // Inclui todos os perfis ativos no map de nomes (não apenas os com disponibilidade configurada)
  // para que profissionais sem jornada também apareçam corretamente nos relatórios.
  const profissionaisMap = new Map(
    perfisProfissionais.map((item) => [item.id, item.full_name || 'Sem nome'])
  )

  let atendimentosQuery = supabase
    .from('atendimentos')
    .select(`
      id,
      agendamento_id,
      profissional_id,
      fisioterapeuta_id,
      tipo,
      status,
      data_agendamento,
      marcou_retorno,
      profissional:profiles!profissional_id(full_name),
      pacientes(nome, telefone, email, origem, indicado_por)
    `)
    .gte('data_agendamento', dataInicioIso)
    .lte('data_agendamento', dataFimIso)

  // Na visão de fisioterapia, um atendimento também conta para quem o executou
  // (fisioterapeuta_id), não só para quem consta como responsável — mesma regra
  // já usada no Tempo Fábril. Evita que a sessão "suma" do relatório de quem
  // efetivamente atendeu.
  if (profissionaisFiltroEfetivos.length === 1 && visao === 'fisioterapia') {
    const id = profissionaisFiltroEfetivos[0]
    atendimentosQuery = atendimentosQuery.or(`profissional_id.eq.${id},fisioterapeuta_id.eq.${id}`)
  } else if (profissionaisFiltroEfetivos.length > 1 && visao === 'fisioterapia') {
    const ids = profissionaisFiltroEfetivos.join(',')
    atendimentosQuery = atendimentosQuery.or(`profissional_id.in.(${ids}),fisioterapeuta_id.in.(${ids})`)
  } else if (profissionaisFiltroEfetivos.length === 1) {
    atendimentosQuery = atendimentosQuery.eq('profissional_id', profissionaisFiltroEfetivos[0])
  } else if (profissionaisFiltroEfetivos.length > 1) {
    atendimentosQuery = atendimentosQuery.in('profissional_id', profissionaisFiltroEfetivos)
  }
  if (tipos_filtro.length > 0) {
    atendimentosQuery = atendimentosQuery.in('tipo', tipos_filtro)
  }
  if (status_filtro) {
    atendimentosQuery = atendimentosQuery.eq('status', status_filtro)
  }

  const [{ data: atendimentosRaw }, { data: tiposConsultaRaw }] = await Promise.all([
    atendimentosQuery.order('data_agendamento', { ascending: false }),
    supabase
      .from('tipos_consulta')
      .select('nome')
      .eq('ativo', true)
      .order('ordem'),
  ])

  const atendimentosTodos = (atendimentosRaw ?? []) as AtendimentoResumo[]
  const SEM_ORIGEM = 'Sem origem'
  const origemNomesAtivos = new Set((origensRaw ?? []).map((o: { nome: string }) => o.nome))
  const opcoesOrigensComputadas = [
    ...(origensRaw ?? []).map((item: { nome: string }) => item.nome),
    SEM_ORIGEM,
  ]
  const totalOrigensDisponiveis = opcoesOrigensComputadas.length
  const atendimentos = origens_filtro.length > 0 && origens_filtro.length < totalOrigensDisponiveis
    ? atendimentosTodos.filter((a) => {
        const origem = firstRelation(a.pacientes)?.origem ?? ''
        const origemBase = origem.split('::')[0]
        const origemConhecida = !!origem && origemNomesAtivos.has(origemBase)
        if (!origemConhecida) return origens_filtro.includes(SEM_ORIGEM)
        return origens_filtro.some((o) => o !== SEM_ORIGEM && (origem === o || origem.startsWith(o + '::')))
      })
    : atendimentosTodos
  const agendamentoIds = [...new Set(
    atendimentos
      .map((atendimento) => atendimento.agendamento_id)
      .filter((agendamentoId): agendamentoId is string => !!agendamentoId),
  )]
  const { data: agendamentosRaw } = agendamentoIds.length > 0
    ? await supabase
        .from('agendamentos')
        .select('id, profissional_id, tipo, plano_saude, data_inicio, is_recorrente, gerou_venda, marcou_retorno')
        .in('id', agendamentoIds)
    : { data: [] }
  const agendamentos = (agendamentosRaw ?? []) as AgendamentoResumo[]
  const agendamentosMap = new Map(agendamentos.map((agendamento) => [agendamento.id, agendamento]))

  const tiposMap = new Map<string, MetricaTipo>()
  const linhasProfissional = new Map<string, LinhaProfissional>()
  const linhasPlanoSaude = new Map<string, LinhaPlanoSaudePorMedico>()
  const colunasPlanoSaude = new Map<string, PlanoSaudeColuna>()
  const statusMap: Record<string, number> = {}

  function garantirLinhaProfissional(profissionalId: string | null) {
    const id = profissionalId ?? 'sem_profissional'
    if (!linhasProfissional.has(id)) {
      linhasProfissional.set(id, {
        profissionalId: id,
        profissionalNome: profissionaisMap.get(id) ?? 'Sem responsável',
        agendamentos: 0,
        recorrentes: 0,
        atendimentos: 0,
        produtivos: 0,
        pendentes: 0,
        canceladosOuFalta: 0,
      })
    }
    return linhasProfissional.get(id)!
  }

  function garantirTipo(tipoBruto: string | null | undefined) {
    const tipo = normalizarTipo(tipoBruto)
    if (!tiposMap.has(tipo)) {
      tiposMap.set(tipo, {
        tipo,
        agendamentos: 0,
        atendimentos: 0,
        produtivos: 0,
        pendentes: 0,
      })
    }
    return tiposMap.get(tipo)!
  }

  function garantirPlanoSaude(profissionalId: string | null, planoBruto: string | null | undefined) {
    const id = profissionalId ?? 'sem_profissional'
    const profissionalNome = profissionaisMap.get(id) ?? 'Sem responsável'
    const planoSaude = normalizarPlanoSaude(planoBruto)

    if (!linhasPlanoSaude.has(id)) {
      linhasPlanoSaude.set(id, {
        profissionalId: id,
        profissionalNome,
        planos: {},
        total: 0,
      })
    }

    if (!colunasPlanoSaude.has(planoSaude)) {
      colunasPlanoSaude.set(planoSaude, {
        nome: planoSaude,
        agendamentos: 0,
      })
    }

    const linha = linhasPlanoSaude.get(id)!
    linha.planos[planoSaude] = linha.planos[planoSaude] ?? 0

    return {
      linha,
      coluna: colunasPlanoSaude.get(planoSaude)!,
      planoSaude,
    }
  }

  function isRetorno(atendimento: AtendimentoResumo): boolean {
    if (!!atendimento.marcou_retorno) return true
    if (atendimento.agendamento_id) {
      return !!agendamentosMap.get(atendimento.agendamento_id)?.marcou_retorno
    }
    return false
  }

  // Quem "conta" o atendimento na tabela Por Equipe: na visão de fisioterapia,
  // crédito vai para quem executou (fisioterapeuta_id) quando esse papel foi
  // atribuído a outra pessoa — mesmo critério do Tempo Fábril. Sem isso, um
  // atendimento executado por A mas com profissional_id de B some do relatório
  // de A e é creditado erroneamente a B, que não atendeu.
  function profissionalEfetivoId(atendimento: AtendimentoResumo): string | null {
    if (visao === 'fisioterapia' && atendimento.fisioterapeuta_id) {
      return atendimento.fisioterapeuta_id
    }
    return atendimento.profissional_id
  }

  const atendimentosDoPeriodo = atendimentos
  const detalhamentoConsultas = atendimentosDoPeriodo.map((atendimento) => {
    const paciente = firstRelation(atendimento.pacientes)
    const profissional = firstRelation(atendimento.profissional)
    const telefone = paciente?.telefone?.trim() ?? ''
    const email = paciente?.email?.trim() ?? ''
    const contato = telefone || email || 'Não informado'

    return {
      id: atendimento.id,
      pacienteNome: paciente?.nome?.trim() || 'Sem paciente',
      tipo: normalizarTipo(atendimento.tipo),
      profissionalNome: profissional?.full_name?.trim()
        || profissionaisMap.get(atendimento.profissional_id ?? '')
        || 'Sem responsável',
      dataAvaliacao: atendimento.data_agendamento,
      contato,
      origem: paciente?.origem?.trim() || 'Sem origem',
      medicoParceiroNome: medicoParceiroDetalhamento(paciente?.origem?.trim() || 'Sem origem', paciente?.indicado_por),
      marcouRetorno: isRetorno(atendimento),
      realizado: isStatusFabril(atendimento.status),
    }
  })
  const detalhamentoConsultasOrdenado = [...detalhamentoConsultas].sort((a, b) => {
    switch (detalheOrdem) {
      case 'data_asc':
        return new Date(a.dataAvaliacao).getTime() - new Date(b.dataAvaliacao).getTime()
      case 'paciente_asc':
        return a.pacienteNome.localeCompare(b.pacienteNome)
      case 'paciente_desc':
        return b.pacienteNome.localeCompare(a.pacienteNome)
      case 'tipo_asc':
        return a.tipo.localeCompare(b.tipo) || a.pacienteNome.localeCompare(b.pacienteNome)
      case 'responsavel_asc':
        return a.profissionalNome.localeCompare(b.profissionalNome) || a.pacienteNome.localeCompare(b.pacienteNome)
      case 'contato_asc':
        return a.contato.localeCompare(b.contato) || a.pacienteNome.localeCompare(b.pacienteNome)
      case 'data_desc':
      default:
        return new Date(b.dataAvaliacao).getTime() - new Date(a.dataAvaliacao).getTime()
    }
  })

  const detalhamentoConsultasFiltrado = detalheRealizados
    ? detalhamentoConsultasOrdenado.filter((consulta) => consulta.realizado)
    : detalhamentoConsultasOrdenado

  const totalDetalhamento = detalhamentoConsultasFiltrado.length
  const totalPaginasDetalhamento = Math.max(1, Math.ceil(totalDetalhamento / detalheLimite))
  const detalhePagina = Math.min(detalhePaginaBase, totalPaginasDetalhamento)
  const detalheOffset = (detalhePagina - 1) * detalheLimite
  const detalheAte = Math.min(detalheOffset + detalheLimite, totalDetalhamento)
  const detalhamentoConsultasPaginado = detalhamentoConsultasFiltrado.slice(detalheOffset, detalheOffset + detalheLimite)
  const paginasDetalhamento: Array<number | '...'> = []

  if (totalPaginasDetalhamento <= 7) {
    for (let p = 1; p <= totalPaginasDetalhamento; p++) paginasDetalhamento.push(p)
  } else {
    paginasDetalhamento.push(1)
    if (detalhePagina > 4) paginasDetalhamento.push('...')
    for (let p = Math.max(2, detalhePagina - 1); p <= Math.min(totalPaginasDetalhamento - 1, detalhePagina + 1); p++) {
      paginasDetalhamento.push(p)
    }
    if (detalhePagina < totalPaginasDetalhamento - 3) paginasDetalhamento.push('...')
    paginasDetalhamento.push(totalPaginasDetalhamento)
  }

  for (const atendimento of atendimentosDoPeriodo) {
    const agendamentoPai = atendimento.agendamento_id
      ? agendamentosMap.get(atendimento.agendamento_id) ?? null
      : null
    const tipo = garantirTipo(atendimento.tipo)
    tipo.agendamentos++

    const statusNormalizado = lowerSafe(atendimento.status)
    const statusLabel = normalizeAtendimentoStatus(atendimento.status || 'Sem status')
    statusMap[statusLabel] = (statusMap[statusLabel] || 0) + 1

    const linhaProf = garantirLinhaProfissional(profissionalEfetivoId(atendimento))
    linhaProf.agendamentos++
    if (agendamentoPai?.is_recorrente) linhaProf.recorrentes++

    const { linha: linhaPlano, coluna: colunaPlano, planoSaude } = garantirPlanoSaude(
      atendimento.profissional_id,
      agendamentoPai?.plano_saude,
    )
    linhaPlano.planos[planoSaude]++
    linhaPlano.total++
    colunaPlano.agendamentos++

    if (STATUS_CONFIRMADOS.has(statusNormalizado)) {
      tipo.atendimentos++
      linhaProf.atendimentos++
    }

    if (statusNormalizado === 'concluido' || statusNormalizado === 'concluído') {
      tipo.produtivos++
      linhaProf.produtivos++
    } else if (STATUS_CANCELADOS.has(statusNormalizado)) {
      linhaProf.canceladosOuFalta++
    } else if (STATUS_PENDENTES.has(statusNormalizado)) {
      tipo.pendentes++
      linhaProf.pendentes++
    }
  }

  const linhasTipo = Array.from(tiposMap.values())
    .sort((a, b) => b.atendimentos - a.atendimentos || b.agendamentos - a.agendamentos)

  const linhasProfissionalOrdenadas = Array.from(linhasProfissional.values())
    .sort((a, b) => b.atendimentos - a.atendimentos || b.agendamentos - a.agendamentos)
  const colunasPlanoSaudeOrdenadas = Array.from(colunasPlanoSaude.values())
    .sort((a, b) => b.agendamentos - a.agendamentos || a.nome.localeCompare(b.nome))
  const linhasPlanoSaudeOrdenadas = Array.from(linhasPlanoSaude.values())
    .sort((a, b) => b.total - a.total || a.profissionalNome.localeCompare(b.profissionalNome))

  const mostrarPctProfissional = linhasProfissionalOrdenadas.length > 1

  const totalAgendamentos = atendimentosDoPeriodo.length
  const totalAtendimentos = atendimentosDoPeriodo.filter((item) => STATUS_CONFIRMADOS.has(lowerSafe(item.status))).length
  const totalRecorrentes = atendimentosDoPeriodo.filter((item) => {
    if (!item.agendamento_id) return false
    return agendamentosMap.get(item.agendamento_id)?.is_recorrente === true
  }).length
  const totalConcluidos = atendimentosDoPeriodo.filter((item) => {
    const status = lowerSafe(item.status)
    return status === 'concluido' || status === 'concluído'
  }).length
  const totalPendentes = atendimentosDoPeriodo.filter((item) => STATUS_PENDENTES.has(lowerSafe(item.status))).length
  const totalCanceladosOuFalta = atendimentosDoPeriodo.filter((item) => STATUS_CANCELADOS.has(lowerSafe(item.status))).length
  const totalRetornos = atendimentosDoPeriodo.filter((item) => isRetorno(item)).length

  function pct(n: number, total: number) {
    return total > 0 ? `${Math.round((n / total) * 100)}%` : '—'
  }

  const opcoesTipos = (tiposConsultaRaw ?? [])
    .map((item: { nome: string }) => item.nome)
    .sort((a, b) => a.localeCompare(b))

  const opcoesOrigens = opcoesOrigensComputadas

  const opcoesStatus = ['Confirmado', 'Aguardando', 'Em Atendimento', 'Concluído', 'Cancelado', 'Falta']
  const periodoLabel = data_inicio === data_fim
    ? data_inicio
    : `${data_inicio} até ${data_fim}`
  const ordemPorColuna: Record<string, { asc: string; desc: string }> = {
    paciente: { asc: 'paciente_asc', desc: 'paciente_desc' },
    tipo: { asc: 'tipo_asc', desc: 'tipo_asc' },
    responsavel: { asc: 'responsavel_asc', desc: 'responsavel_asc' },
    data: { asc: 'data_asc', desc: 'data_desc' },
    contato: { asc: 'contato_asc', desc: 'contato_asc' },
  }

  function buildOrdenacaoColunaUrl(coluna: keyof typeof ordemPorColuna) {
    const opcoes = ordemPorColuna[coluna]
    const proximaOrdem = opcoes.asc === opcoes.desc
      ? opcoes.asc
      : detalheOrdem === opcoes.asc
        ? opcoes.desc
        : opcoes.asc

    return buildDetalhamentoUrl(params, {
      detalhe_limite: detalheLimite,
      detalhe_pagina: 1,
      detalhe_ordem: proximaOrdem,
    })
  }

  function renderOrdenacaoColuna(coluna: keyof typeof ordemPorColuna, label: string) {
    const opcoes = ordemPorColuna[coluna]
    const ativaAsc = detalheOrdem === opcoes.asc
    const ativaDesc = opcoes.asc !== opcoes.desc && detalheOrdem === opcoes.desc
    const ativa = ativaAsc || ativaDesc

    return (
      <Link
        href={buildOrdenacaoColunaUrl(coluna)}
        className={`inline-flex items-center gap-1 transition-colors ${
          ativa ? 'text-[#006b5a]' : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        <span>{label}</span>
        {ativa ? (
          ativaDesc ? <ChevronDown size={14} /> : <ChevronUp size={14} />
        ) : null}
      </Link>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-text-secondary mb-2 flex items-center gap-2">
          <Link href="/dashboard" className="hover:text-primary-500 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/pacientes" className="hover:text-primary-500 transition-colors">Pacientes</Link>
          <span>/</span>
          <span className="text-text-primary font-medium">Relatório de Consultas</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary flex items-center gap-2">
              <BarChart3 size={28} className="text-primary-500" />
              Relatório de Agendamentos e Atendimentos
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Baseado apenas nas tabelas `agendamentos` e `atendimentos`, com foco em volume, status, recorrência e responsáveis.
            </p>
          </div>
          {(totalAgendamentos > 0 || totalAtendimentos > 0) && (
            <BtnGerarPdfConsultas
              visao={visao}
              periodoLabel={periodoLabel}
              origemFiltro={origens_filtro.length > 0 ? origens_filtro.join(', ') : undefined}
              totalAgendamentos={totalAgendamentos}
              totalAtendimentos={totalAtendimentos}
              totalConcluidos={totalConcluidos}
              totalRecorrentes={totalRecorrentes}
              totalPendentes={totalPendentes}
              totalCanceladosOuFalta={totalCanceladosOuFalta}
              porTipo={linhasTipo.map((linha) => ({
                tipo: linha.tipo,
                agendamentos: linha.agendamentos,
                atendimentos: linha.atendimentos,
                concluidos: linha.produtivos,
                pendentes: linha.pendentes,
              }))}
              porProfissional={linhasProfissionalOrdenadas.map((linha) => ({
                profissionalNome: linha.profissionalNome,
                agendamentos: linha.agendamentos,
                recorrentes: linha.recorrentes,
                atendimentos: linha.atendimentos,
                concluidos: linha.produtivos,
                pendentes: linha.pendentes,
                canceladosOuFalta: linha.canceladosOuFalta,
              }))}
              porStatus={statusMap}
              totalRetornos={totalRetornos}
              retornos={detalhamentoConsultasOrdenado
                .filter((c) => c.marcouRetorno)
                .map((consulta) => ({
                  pacienteNome: consulta.pacienteNome,
                  tipo: consulta.tipo,
                  profissionalNome: consulta.profissionalNome,
                  dataAvaliacao: `${formatAppDate(consulta.dataAvaliacao)} ${formatAppTime(consulta.dataAvaliacao)}`,
                }))}
              porPlanoSaude={visao === 'medicos'
                ? linhasPlanoSaudeOrdenadas.map((linha) => ({
                    profissionalNome: linha.profissionalNome,
                    total: linha.total,
                    planos: colunasPlanoSaudeOrdenadas
                      .map((coluna) => ({
                        nome: coluna.nome,
                        quantidade: linha.planos[coluna.nome] ?? 0,
                      }))
                      .filter((plano) => plano.quantidade > 0),
                  }))
                : []}
              detalhamentoConsultas={detalhamentoConsultasOrdenado.map((consulta) => ({
                pacienteNome: consulta.pacienteNome,
                tipo: consulta.tipo,
                profissionalNome: consulta.profissionalNome,
                dataAvaliacao: `${formatAppDate(consulta.dataAvaliacao)} ${formatAppTime(consulta.dataAvaliacao)}`,
                contato: consulta.contato,
                origem: consulta.origem,
                medicoParceiroNome: consulta.medicoParceiroNome,
              }))}
            />
          )}
        </div>
      </div>

      {isGestorOuMaster && (
        <div className="inline-flex rounded-2xl bg-[#dee3e3] p-1">
          <Link
            href={buildRelatorioConsultasUrl({
              visao: 'fisioterapia',
              data_inicio,
              data_fim,
              tipos_filtro,
              status_filtro,
              origens_filtro,
            })}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              visao === 'fisioterapia'
                ? 'bg-white text-[#006b5a] shadow-sm'
                : 'text-[#3d4945] hover:text-[#171d1c]'
            }`}
          >
            Equipe de fisioterapia
          </Link>
          <Link
            href={buildRelatorioConsultasUrl({
              visao: 'medicos',
              data_inicio,
              data_fim,
              tipos_filtro,
              status_filtro,
              origens_filtro,
            })}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              visao === 'medicos'
                ? 'bg-white text-[#006b5a] shadow-sm'
                : 'text-[#3d4945] hover:text-[#171d1c]'
            }`}
          >
            Médicos
          </Link>
        </div>
      )}

      <FiltrosConsultas
        visao={visao}
        dataInicio={data_inicio}
        dataFim={data_fim}
        dataInicioPadrao={dataInicioPadrao}
        dataFimPadrao={dataFimPadrao}
        responsavelId={responsavelSelecionadoId}
        tiposFiltro={tipos_filtro}
        statusFiltro={status_filtro}
        origemFiltro={origens_filtro}
        profissionais={opcoesResponsaveis}
        opcoesTipos={opcoesTipos}
        opcoesStatus={opcoesStatus}
        opcoesOrigens={opcoesOrigens}
        isGestorOuMaster={isGestorOuMaster}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <ClipboardList size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">Agendamentos</span>
          </div>
          <p className="text-3xl font-bold text-[#006b5a]">{totalAgendamentos}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Stethoscope size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">Confirmados</span>
          </div>
          <p className="text-3xl font-bold text-[#006b5a]">{totalAtendimentos}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <CalendarCheck2 size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">Produtivos</span>
          </div>
          <p className="text-3xl font-bold text-[#006b5a]">{totalConcluidos}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <RefreshCw size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">Recorrentes</span>
          </div>
          <p className="text-3xl font-bold text-[#006b5a]">{totalRecorrentes}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <TrendingUp size={15} />
            <span className="text-xs font-semibold uppercase tracking-wide">Pendentes</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{totalPendentes}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Undo2 size={15} />
            <span className="text-xs font-semibold uppercase tracking-wide">Cancelado/Falta</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{totalCanceladosOuFalta}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-[#c7d2fe] p-4">
          <div className="flex items-center gap-2 mb-2" style={{ color: '#3730a3' }}>
            <RotateCcw size={15} />
            <span className="text-xs font-semibold uppercase tracking-wide">Retornos</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: '#3730a3' }}>{totalRetornos}</p>
          {totalAgendamentos > 0 && (
            <p className="text-xs text-slate-400 mt-1">{pct(totalRetornos, totalAgendamentos)} do total</p>
          )}
        </div>
      </div>

      {totalRetornos > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-[#c7d2fe] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#e0e7ff] flex items-center gap-2">
            <RotateCcw size={16} style={{ color: '#3730a3' }} />
            <h2 className="font-semibold" style={{ color: '#3730a3' }}>
              Retornos no período
            </h2>
            <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-[#e0e7ff] text-[#3730a3]">
              {totalRetornos}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f5f3ff] text-[#4c1d95] uppercase text-xs">
                <tr>
                  <th className="text-left px-4 py-3">Paciente</th>
                  <th className="text-left px-4 py-3">Tipo</th>
                  <th className="text-left px-4 py-3">Responsável</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ede9fe]">
                {detalhamentoConsultasOrdenado
                  .filter((c) => c.marcouRetorno)
                  .map((consulta) => (
                    <tr key={consulta.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{consulta.pacienteNome}</td>
                      <td className="px-4 py-3 text-slate-700">{consulta.tipo}</td>
                      <td className="px-4 py-3 text-slate-700">{consulta.profissionalNome}</td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                        {`${formatAppDate(consulta.dataAvaliacao)} ${formatAppTime(consulta.dataAvaliacao)}`}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Tipos de Consulta</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-right px-4 py-3">Agendamentos</th>
                <th className="text-right px-4 py-3">Confirmados</th>
                <th className="text-right px-4 py-3">Produtivos</th>
                <th className="text-right px-4 py-3">Pendentes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {linhasTipo.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Nenhum dado encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
              {linhasTipo.map((linha) => (
                <tr key={linha.tipo}>
                  <td className="px-4 py-3 font-medium text-slate-900">{linha.tipo}</td>
                  <td className="px-4 py-3 text-right text-base font-medium">
                    {linha.agendamentos}
                    <span className="block text-sm text-slate-400">{pct(linha.agendamentos, totalAgendamentos)}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-base font-medium">
                    {linha.atendimentos}
                    <span className="block text-sm text-slate-400">{pct(linha.atendimentos, totalAtendimentos)}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-base font-medium">
                    {linha.produtivos}
                    <span className="block text-sm text-slate-400">{pct(linha.produtivos, totalConcluidos)}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-base font-medium">
                    {linha.pendentes}
                    <span className="block text-sm text-slate-400">{pct(linha.pendentes, totalPendentes)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">
            {visao === 'medicos' ? 'Por Médico' : 'Por Equipe de Fisioterapia'}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr>
                <th className="text-left px-4 py-3">
                  {visao === 'medicos' ? 'Médico' : 'Responsável'}
                </th>
                <th className="text-right px-4 py-3">Agend.</th>
                <th className="text-right px-4 py-3">Recorr.</th>
                <th className="text-right px-4 py-3">Conf.</th>
                <th className="text-right px-4 py-3">Produt.</th>
                <th className="text-right px-4 py-3">Pend.</th>
                <th className="text-right px-4 py-3">Canc./Falta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {linhasProfissionalOrdenadas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    {visao === 'medicos'
                      ? 'Nenhum médico com dados no período.'
                      : 'Nenhum responsável com dados no período.'}
                  </td>
                </tr>
              )}
              {linhasProfissionalOrdenadas.map((linha) => (
                <tr key={linha.profissionalId}>
                  <td className="px-4 py-3 font-medium text-slate-900">{linha.profissionalNome}</td>
                  <td className="px-4 py-3 text-right text-base font-medium">
                    {linha.agendamentos}
                    {mostrarPctProfissional && <span className="block text-sm text-slate-400">{pct(linha.agendamentos, totalAgendamentos)}</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-base font-medium">
                    {linha.recorrentes}
                    {mostrarPctProfissional && <span className="block text-sm text-slate-400">{pct(linha.recorrentes, totalRecorrentes)}</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-base font-medium">
                    {linha.atendimentos}
                    {mostrarPctProfissional && <span className="block text-sm text-slate-400">{pct(linha.atendimentos, totalAtendimentos)}</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-base font-medium">
                    {linha.produtivos}
                    {mostrarPctProfissional && <span className="block text-sm text-slate-400">{pct(linha.produtivos, totalConcluidos)}</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-base font-medium">
                    {linha.pendentes}
                    {mostrarPctProfissional && <span className="block text-sm text-slate-400">{pct(linha.pendentes, totalPendentes)}</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-base font-medium">
                    {linha.canceladosOuFalta}
                    {mostrarPctProfissional && <span className="block text-sm text-slate-400">{pct(linha.canceladosOuFalta, totalCanceladosOuFalta)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {visao === 'medicos' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Planos de Saúde</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="text-left px-4 py-3">Médico</th>
                  {colunasPlanoSaudeOrdenadas.map((coluna) => (
                    <th key={coluna.nome} className="text-right px-4 py-3 whitespace-nowrap">{coluna.nome}</th>
                  ))}
                  <th className="text-right px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linhasPlanoSaudeOrdenadas.length === 0 && (
                  <tr>
                    <td colSpan={colunasPlanoSaudeOrdenadas.length + 2} className="px-4 py-8 text-center text-slate-500">
                      Nenhum plano de saúde registrado no período.
                    </td>
                  </tr>
                )}
                {linhasPlanoSaudeOrdenadas.map((linha) => (
                  <tr key={linha.profissionalId}>
                    <td className="px-4 py-3 font-medium text-slate-900">{linha.profissionalNome}</td>
                    {colunasPlanoSaudeOrdenadas.map((coluna) => {
                      const quantidade = linha.planos[coluna.nome] ?? 0
                      return (
                        <td key={`${linha.profissionalId}-${coluna.nome}`} className="px-4 py-3 text-right text-base font-medium">
                          {quantidade > 0 ? quantidade : '—'}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 text-right text-base font-medium">
                      {linha.total}
                      <span className="block text-sm text-slate-400">{pct(linha.total, totalAgendamentos)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Distribuição de Status dos Atendimentos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Quantidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.keys(statusMap).length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-slate-500">
                    Nenhum atendimento encontrado no período.
                  </td>
                </tr>
              )}
              {Object.entries(statusMap)
                .sort((a, b) => b[1] - a[1])
                .map(([status, quantidade]) => (
                  <tr key={status}>
                    <td className="px-4 py-3 font-medium text-slate-900">{status}</td>
                    <td className="px-4 py-3 text-right text-base font-medium">
                      {quantidade}
                      <span className="block text-sm text-slate-400">{pct(quantidade, totalAgendamentos)}</span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-slate-900">Detalhamento das Consultas</h2>
            <p className="mt-1 text-sm text-slate-500">
              Nome do paciente, tipo de atendimento, responsável, data da avaliação e contato.
            </p>
          </div>
          <Link
            href={buildDetalhamentoUrl(params, {
              detalhe_realizados: !detalheRealizados,
              detalhe_pagina: 1,
              detalhe_limite: detalheLimite,
              detalhe_ordem: detalheOrdem,
            })}
            className="flex items-center gap-2 shrink-0 pt-0.5"
          >
            <span className="text-sm font-medium text-slate-600 whitespace-nowrap">
              Somente realizados
            </span>
            <span
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                detalheRealizados ? 'bg-[#006b5a]' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  detalheRealizados ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </span>
          </Link>
        </div>
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            Mostrando <span className="font-semibold text-slate-700">{totalDetalhamento === 0 ? 0 : detalheOffset + 1}–{detalheAte}</span> de{' '}
            <span className="font-semibold text-slate-700">{totalDetalhamento}</span> consulta{totalDetalhamento !== 1 ? 's' : ''}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Por página</span>
            {[10, 25, 50, 100].map((limite) => (
              <Link
                key={limite}
                href={buildDetalhamentoUrl(params, {
                  detalhe_limite: limite,
                  detalhe_pagina: 1,
                  detalhe_ordem: detalheOrdem,
                  detalhe_realizados: detalheRealizados,
                })}
                className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                  detalheLimite === limite
                    ? 'bg-[#006b5a] text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {limite}
              </Link>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr>
                <th className="text-left px-4 py-3">{renderOrdenacaoColuna('paciente', 'Paciente')}</th>
                <th className="text-left px-4 py-3">{renderOrdenacaoColuna('tipo', 'Tipo')}</th>
                <th className="text-left px-4 py-3">{renderOrdenacaoColuna('responsavel', 'Responsável')}</th>
                <th className="text-left px-4 py-3">{renderOrdenacaoColuna('data', 'Data da avaliação')}</th>
                <th className="text-left px-4 py-3">{renderOrdenacaoColuna('contato', 'Contato')}</th>
                <th className="text-left px-4 py-3 text-slate-500 uppercase text-xs font-semibold">Origem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {detalhamentoConsultasFiltrado.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    {detalheRealizados
                      ? 'Nenhum atendimento realizado encontrado no período.'
                      : 'Nenhuma consulta encontrada no período.'}
                  </td>
                </tr>
              )}
              {detalhamentoConsultasPaginado.map((consulta) => (
                <tr key={consulta.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{consulta.pacienteNome}</td>
                  <td className="px-4 py-3 text-slate-700">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{consulta.tipo}</span>
                      {consulta.marcouRetorno && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-[#c7d2fe] bg-[#e0e7ff] text-[#3730a3] whitespace-nowrap">
                          Retorno
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{consulta.profissionalNome}</td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                    {`${formatAppDate(consulta.dataAvaliacao)} ${formatAppTime(consulta.dataAvaliacao)}`}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{consulta.contato}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {consulta.origem}
                    {consulta.medicoParceiroNome && (
                      <span className="block text-xs text-slate-400">{consulta.medicoParceiroNome}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPaginasDetalhamento > 1 && (
          <div className="px-5 py-4 border-t border-slate-100 flex flex-wrap items-center justify-end gap-1">
            <Link
              href={buildDetalhamentoUrl(params, {
                detalhe_pagina: detalhePagina - 1,
                detalhe_limite: detalheLimite,
                detalhe_ordem: detalheOrdem,
              })}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                detalhePagina === 1
                  ? 'pointer-events-none bg-slate-100 text-slate-300'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Anterior
            </Link>
            {paginasDetalhamento.map((pagina, index) =>
              pagina === '...'
                ? <span key={`ellipsis-${index}`} className="px-2 text-sm text-slate-400">…</span>
                : (
                  <Link
                    key={pagina}
                    href={buildDetalhamentoUrl(params, {
                      detalhe_pagina: pagina,
                      detalhe_limite: detalheLimite,
                      detalhe_ordem: detalheOrdem,
                    })}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      pagina === detalhePagina
                        ? 'bg-[#006b5a] text-white'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {pagina}
                  </Link>
                ),
            )}
            <Link
              href={buildDetalhamentoUrl(params, {
                detalhe_pagina: detalhePagina + 1,
                detalhe_limite: detalheLimite,
                detalhe_ordem: detalheOrdem,
              })}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                detalhePagina === totalPaginasDetalhamento
                  ? 'pointer-events-none bg-slate-100 text-slate-300'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Próxima
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
