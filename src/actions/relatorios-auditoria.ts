'use server'

import { createClient } from '@/lib/supabase/server'

export const AUDITORIA_EXCLUSOES_PAGE_SIZE = 20

export type FiltrosAuditoriaExclusoes = {
  dataInicio?: string
  dataFim?: string
  profissionalId?: string
  usuarioId?: string
  motivoCategoria?: string
  pagina?: number
}

export type LogAuditoriaExclusao = {
  id: string
  criado_em: string
  acao: string
  motivo_categoria: string
  motivo_categoria_label: string
  motivo_observacao: string | null
  usuario_id: string
  usuario_nome: string | null
  paciente_id: string | null
  paciente_nome: string | null
  profissional_id: string | null
  profissional_nome: string | null
  dados_agendamento: {
    data_agendamento: string | null
    duracao_minutos: number | null
    status: string | null
    tipo: string | null
    numero_sessao: number | null
    total_sessoes: number | null
    observacoes: string | null
  }
}

export type ResultadoAuditoriaExclusoes = {
  logs: LogAuditoriaExclusao[]
  total: number
}

// AC-060: aplica período, profissional, operador e motivo simultaneamente
// (todos os filtros presentes se combinam com AND, nunca OR). Paginação
// server-side sobre os índices de `agendamentos_auditoria` (T-033).
export async function buscarLogsAuditoriaExclusoes(
  filtros: FiltrosAuditoriaExclusoes = {},
): Promise<ResultadoAuditoriaExclusoes> {
  const supabase = await createClient()

  const pagina = Math.max(1, filtros.pagina ?? 1)
  const from = (pagina - 1) * AUDITORIA_EXCLUSOES_PAGE_SIZE
  const to = from + AUDITORIA_EXCLUSOES_PAGE_SIZE - 1

  let query = supabase
    .from('agendamentos_auditoria')
    .select(
      'id, criado_em, acao, motivo_categoria, motivo_observacao, usuario_id, usuario_nome, paciente_id, paciente_nome, profissional_id, profissional_nome, dados_agendamento',
      { count: 'exact' },
    )
    .order('criado_em', { ascending: false })
    .range(from, to)

  if (filtros.dataInicio) query = query.gte('criado_em', filtros.dataInicio)
  if (filtros.dataFim) query = query.lte('criado_em', filtros.dataFim)
  if (filtros.profissionalId) query = query.eq('profissional_id', filtros.profissionalId)
  if (filtros.usuarioId) query = query.eq('usuario_id', filtros.usuarioId)
  if (filtros.motivoCategoria) query = query.eq('motivo_categoria', filtros.motivoCategoria)

  const { data, count } = await query

  if (!data?.length) return { logs: [], total: count ?? 0 }

  const categorias = [...new Set(data.map((log) => log.motivo_categoria))]
  const { data: motivos } = await supabase
    .from('motivos_exclusao_agendamento')
    .select('slug, label')
    .in('slug', categorias)

  const labelPorSlug = new Map((motivos ?? []).map((m) => [m.slug, m.label]))

  const logs = data.map((log) => ({
    ...log,
    motivo_categoria_label: labelPorSlug.get(log.motivo_categoria) ?? log.motivo_categoria,
    dados_agendamento: log.dados_agendamento as LogAuditoriaExclusao['dados_agendamento'],
  }))

  return { logs, total: count ?? logs.length }
}

export type OpcaoFiltroAuditoria = { id: string; nome: string }

// Opções dos filtros de profissional e operador vêm dos próprios logs
// gravados (não do cadastro de profiles) — só aparece quem já foi alvo ou
// autor de alguma exclusão.
export async function listarOpcoesFiltroAuditoria(): Promise<{
  profissionais: OpcaoFiltroAuditoria[]
  operadores: OpcaoFiltroAuditoria[]
  motivos: OpcaoFiltroAuditoria[]
}> {
  const supabase = await createClient()

  const [{ data: logs }, { data: motivosCatalogo }] = await Promise.all([
    supabase
      .from('agendamentos_auditoria')
      .select('profissional_id, profissional_nome, usuario_id, usuario_nome'),
    supabase
      .from('motivos_exclusao_agendamento')
      .select('slug, label')
      .order('ordem', { ascending: true }),
  ])

  const profissionaisMap = new Map<string, string>()
  const operadoresMap = new Map<string, string>()

  for (const log of logs ?? []) {
    if (log.profissional_id) {
      profissionaisMap.set(log.profissional_id, log.profissional_nome ?? 'Sem nome')
    }
    if (log.usuario_id) {
      operadoresMap.set(log.usuario_id, log.usuario_nome ?? 'Sem nome')
    }
  }

  const profissionais = [...profissionaisMap.entries()]
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome))

  const operadores = [...operadoresMap.entries()]
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome))

  const motivos = (motivosCatalogo ?? []).map((m) => ({ id: m.slug, nome: m.label }))

  return { profissionais, operadores, motivos }
}
