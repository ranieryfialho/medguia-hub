import { createClient } from '@/lib/supabase/server'
import type { StatusContato } from '@/actions/contatos'
import type { KanbanColunaContato } from '@/lib/contatos-kanban'

export type ContatoPaciente = {
  id: string
  nome: string
  telefone: string
  email: string | null
  recuperacao_base: boolean
  status: StatusContato
  kanban_coluna_chave: string
  responsavel_id: string | null
  responsavel_nome: string | null
  ultimo_atendimento_data: string | null
  ultimo_atendimento_tipo: string | null
}

export type ProfileSimples = { id: string; full_name: string }

export type ContatosKanbanBoardData = {
  contatos: ContatoPaciente[]
  columnTotals: Record<string, number>
  columnOffsets: Record<string, number>
  availableBaseTotals: Record<string, number>
  totalFiltered: number
}

export type ContatosKanbanColumnPage = {
  items: ContatoPaciente[]
  total: number
  nextOffset: number
  hasMore: boolean
}

export type ContatosKanbanResponsavelStats = {
  responsavelCounts: Record<string, number>
  semResponsavelCount: number
}

export type ContatosKanbanFilters = {
  busca?: string | null
  responsavelFilter?: string | null
}

export const CONTATOS_KANBAN_PAGE_SIZE = 30

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>

type RpcContatoKanbanRow = {
  id: string
  nome: string
  telefone: string
  email: string | null
  recuperacao_base: boolean
  status: StatusContato
  kanban_coluna_chave: string
  responsavel_id: string | null
  responsavel_nome: string | null
  total_count: number
}

type RpcContagemColunaRow = {
  kanban_coluna_chave: string
  total_count: number
}

type RpcContagemResponsavelRow = {
  responsavel_id: string | null
  total_count: number
}

type RpcDisponiveisBaseRow = {
  kanban_coluna_chave: string
  total_count: number
}

type ContatoBaseRelacionamento = {
  paciente_id: string
  status: StatusContato
  kanban_coluna_chave: string | null
  responsavel_id: string | null
}

const FETCH_ALL_PAGE_SIZE = 1000

function normalizeBusca(busca?: string | null) {
  const normalized = busca?.trim() ?? ''
  return normalized.length > 0 ? normalized : null
}

function normalizeResponsavelFilter(responsavelFilter?: string | null) {
  if (!responsavelFilter) {
    return { responsavelId: null, onlyWithoutResponsavel: false }
  }

  if (responsavelFilter === '__none__') {
    return { responsavelId: null, onlyWithoutResponsavel: true }
  }

  return { responsavelId: responsavelFilter, onlyWithoutResponsavel: false }
}

function isFunctionMissing(error: { message?: string; code?: string } | null) {
  if (!error) return false
  return error.code === 'PGRST202' || error.message?.includes('Could not find the function') === true
}

function mapContato(row: Omit<RpcContatoKanbanRow, 'total_count'>): ContatoPaciente {
  return {
    id: row.id,
    nome: row.nome,
    telefone: row.telefone,
    email: row.email,
    recuperacao_base: row.recuperacao_base,
    status: row.status,
    kanban_coluna_chave: row.kanban_coluna_chave,
    responsavel_id: row.responsavel_id,
    responsavel_nome: row.responsavel_nome,
    ultimo_atendimento_data: null,
    ultimo_atendimento_tipo: null,
  }
}

async function fetchAll<T>(
  fetcher: (from: number, to: number) => PromiseLike<{ data: T[] | null }>
): Promise<T[]> {
  const acc: T[] = []
  let page = 0

  while (true) {
    const { data } = await fetcher(page * FETCH_ALL_PAGE_SIZE, (page + 1) * FETCH_ALL_PAGE_SIZE - 1)
    if (!data?.length) break
    acc.push(...data)
    if (data.length < FETCH_ALL_PAGE_SIZE) break
    page++
  }

  return acc
}

async function listarContatosKanbanPageViaRpc(
  supabase: ServerSupabaseClient,
  params: {
    columnKey: string
    offset: number
    limit: number
  } & ContatosKanbanFilters
): Promise<ContatosKanbanColumnPage | null> {
  const busca = normalizeBusca(params.busca)
  const { responsavelId, onlyWithoutResponsavel } = normalizeResponsavelFilter(params.responsavelFilter)

  const { data, error } = await supabase.rpc('fn_listar_contatos_kanban', {
    p_coluna_chave: params.columnKey,
    p_busca: busca,
    p_responsavel_id: responsavelId,
    p_sem_responsavel: onlyWithoutResponsavel,
    p_limit: params.limit,
    p_offset: params.offset,
  })

  if (error) {
    if (isFunctionMissing(error)) return null
    throw new Error(error.message ?? 'Erro ao listar contatos do kanban.')
  }

  const rows = Array.isArray(data) ? (data as RpcContatoKanbanRow[]) : []
  const total = rows[0]?.total_count ?? 0
  const items = rows.map((row) =>
    mapContato({
      id: row.id,
      nome: row.nome,
      telefone: row.telefone,
      email: row.email,
      recuperacao_base: row.recuperacao_base,
      status: row.status,
      kanban_coluna_chave: row.kanban_coluna_chave,
      responsavel_id: row.responsavel_id,
      responsavel_nome: row.responsavel_nome,
    })
  )
  const nextOffset = params.offset + items.length

  return {
    items,
    total,
    nextOffset,
    hasMore: nextOffset < total,
  }
}

async function contarContatosKanbanViaRpc(
  supabase: ServerSupabaseClient,
  filters?: ContatosKanbanFilters
): Promise<Record<string, number> | null> {
  const busca = normalizeBusca(filters?.busca)
  const { responsavelId, onlyWithoutResponsavel } = normalizeResponsavelFilter(filters?.responsavelFilter)

  const { data, error } = await supabase.rpc('fn_contar_contatos_kanban', {
    p_busca: busca,
    p_responsavel_id: responsavelId,
    p_sem_responsavel: onlyWithoutResponsavel,
  })

  if (error) {
    if (isFunctionMissing(error)) return null
    throw new Error(error.message ?? 'Erro ao contar contatos do kanban.')
  }

  const counts: Record<string, number> = {}
  for (const row of (Array.isArray(data) ? data : []) as RpcContagemColunaRow[]) {
    counts[row.kanban_coluna_chave] = Number(row.total_count) || 0
  }
  return counts
}

async function contarResponsaveisKanbanViaRpc(
  supabase: ServerSupabaseClient
): Promise<ContatosKanbanResponsavelStats | null> {
  const { data, error } = await supabase.rpc('fn_contar_responsaveis_contatos_kanban')

  if (error) {
    if (isFunctionMissing(error)) return null
    throw new Error(error.message ?? 'Erro ao contar responsáveis do kanban.')
  }

  const responsavelCounts: Record<string, number> = {}
  let semResponsavelCount = 0

  for (const row of (Array.isArray(data) ? data : []) as RpcContagemResponsavelRow[]) {
    const count = Number(row.total_count) || 0
    if (!row.responsavel_id) {
      semResponsavelCount += count
      continue
    }
    responsavelCounts[row.responsavel_id] = count
  }

  return {
    responsavelCounts,
    semResponsavelCount,
  }
}

async function contarPacientesDisponiveisBaseViaRpc(
  supabase: ServerSupabaseClient
): Promise<Record<string, number> | null> {
  const { data, error } = await supabase.rpc('fn_contar_pacientes_disponiveis_contatos_base')

  if (error) {
    if (isFunctionMissing(error)) return null
    throw new Error(error.message ?? 'Erro ao contar pacientes disponÃ­veis para o kanban.')
  }

  const counts: Record<string, number> = {}
  for (const row of (Array.isArray(data) ? data : []) as RpcDisponiveisBaseRow[]) {
    counts[row.kanban_coluna_chave] = Number(row.total_count) || 0
  }

  return counts
}

async function listarContatosKanbanFallback(
  supabase: ServerSupabaseClient,
  filters?: ContatosKanbanFilters
) {
  const pacientes = await fetchAll((from, to) =>
    supabase
      .from('pacientes')
      .select(`
        id,
        nome,
        telefone,
        email,
        recuperacao_base,
        contatos_base (
          paciente_id,
          status,
          kanban_coluna_chave,
          responsavel_id
        )
      `)
      .eq('ativo', true)
      .order('nome')
      .range(from, to)
  )

  const responsavelIds = [...new Set(
    pacientes
      .map((paciente) => {
        const contatoRelacao = Array.isArray(paciente.contatos_base) ? paciente.contatos_base[0] : paciente.contatos_base
        return (contatoRelacao as ContatoBaseRelacionamento | null)?.responsavel_id ?? null
      })
      .filter((value): value is string => Boolean(value))
  )]

  const { data: profiles } = responsavelIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', responsavelIds)
    : { data: [] as ProfileSimples[] }

  const profilesMap = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]))
  const busca = normalizeBusca(filters?.busca)?.toLowerCase() ?? null
  const { responsavelId, onlyWithoutResponsavel } = normalizeResponsavelFilter(filters?.responsavelFilter)

  return pacientes
    .map((paciente) => {
      const contatoRelacao = Array.isArray(paciente.contatos_base) ? paciente.contatos_base[0] : paciente.contatos_base
      const contato = (contatoRelacao ?? null) as ContatoBaseRelacionamento | null
      const fallbackStatus = paciente.recuperacao_base ? 'recuperacao_base' : 'a_contactar'
      const status = (contato?.status ?? fallbackStatus) as StatusContato
      const responsavelNome = contato?.responsavel_id ? profilesMap.get(contato.responsavel_id) ?? null : null

      return {
        id: paciente.id,
        nome: paciente.nome,
        telefone: paciente.telefone,
        email: paciente.email,
        recuperacao_base: paciente.recuperacao_base,
        status,
        kanban_coluna_chave: contato?.kanban_coluna_chave ?? contato?.status ?? fallbackStatus,
        responsavel_id: contato?.responsavel_id ?? null,
        responsavel_nome: responsavelNome,
        ultimo_atendimento_data: null,
        ultimo_atendimento_tipo: null,
      } satisfies ContatoPaciente
    })
    .filter((contato) => {
      if (busca && !contato.nome.toLowerCase().includes(busca)) return false
      if (onlyWithoutResponsavel) return contato.responsavel_id === null
      if (responsavelId) return contato.responsavel_id === responsavelId
      return true
    })
}

export async function listarContatosKanbanBoard(
  supabase: ServerSupabaseClient,
  params: {
    columns: KanbanColunaContato[]
    pageSize?: number
  } & ContatosKanbanFilters
): Promise<ContatosKanbanBoardData> {
  const pageSize = params.pageSize ?? CONTATOS_KANBAN_PAGE_SIZE
  const counts = await contarContatosKanbanViaRpc(supabase, params)

  if (counts) {
    const pages = await Promise.all(
      params.columns.map(async (column) => {
        const page = await listarContatosKanbanPageViaRpc(supabase, {
          columnKey: column.chave,
          offset: 0,
          limit: pageSize,
          busca: params.busca,
          responsavelFilter: params.responsavelFilter,
        })

        return [column.chave, page] as const
      })
    )

    const contatos: ContatoPaciente[] = []
    const columnTotals: Record<string, number> = {}
    const columnOffsets: Record<string, number> = {}

    for (const column of params.columns) {
      const page = pages.find(([columnKey]) => columnKey === column.chave)?.[1]
      const total = counts[column.chave] ?? page?.total ?? 0
      const items = page?.items ?? []
      contatos.push(...items)
      columnTotals[column.chave] = total
      columnOffsets[column.chave] = items.length
    }

    return {
      contatos,
      columnTotals,
      columnOffsets,
      availableBaseTotals: await contarPacientesDisponiveisBaseViaRpc(supabase) ?? {},
      totalFiltered: Object.values(columnTotals).reduce((sum, count) => sum + count, 0),
    }
  }

  const contatos = await listarContatosKanbanFallback(supabase, params)
  const contatosPorColuna = new Map<string, ContatoPaciente[]>()

  for (const contato of contatos) {
    const contatosDaColuna = contatosPorColuna.get(contato.kanban_coluna_chave)
    if (contatosDaColuna) {
      contatosDaColuna.push(contato)
    } else {
      contatosPorColuna.set(contato.kanban_coluna_chave, [contato])
    }
  }

  const limitedContatos: ContatoPaciente[] = []
  const columnTotals: Record<string, number> = {}
  const columnOffsets: Record<string, number> = {}

  for (const column of params.columns) {
    const contatosDaColuna = contatosPorColuna.get(column.chave) ?? []
    columnTotals[column.chave] = contatosDaColuna.length
    columnOffsets[column.chave] = Math.min(contatosDaColuna.length, pageSize)
    limitedContatos.push(...contatosDaColuna.slice(0, pageSize))
  }

  return {
    contatos: limitedContatos,
    columnTotals,
    columnOffsets,
    availableBaseTotals: {},
    totalFiltered: contatos.length,
  }
}

export async function listarContatosKanbanColumnPage(
  supabase: ServerSupabaseClient,
  params: {
    columnKey: string
    offset: number
    limit?: number
  } & ContatosKanbanFilters
): Promise<ContatosKanbanColumnPage> {
  const limit = params.limit ?? CONTATOS_KANBAN_PAGE_SIZE
  const page = await listarContatosKanbanPageViaRpc(supabase, {
    columnKey: params.columnKey,
    offset: params.offset,
    limit,
    busca: params.busca,
    responsavelFilter: params.responsavelFilter,
  })

  if (page) {
    return page
  }

  const contatos = await listarContatosKanbanFallback(supabase, params)
  const contatosDaColuna = contatos.filter((contato) => contato.kanban_coluna_chave === params.columnKey)
  const items = contatosDaColuna.slice(params.offset, params.offset + limit)
  const nextOffset = params.offset + items.length

  return {
    items,
    total: contatosDaColuna.length,
    nextOffset,
    hasMore: nextOffset < contatosDaColuna.length,
  }
}

export async function listarResponsavelStatsContatosKanban(
  supabase: ServerSupabaseClient
): Promise<ContatosKanbanResponsavelStats> {
  const rpcStats = await contarResponsaveisKanbanViaRpc(supabase)
  if (rpcStats) {
    return rpcStats
  }

  const pacientesAtivos = await fetchAll<{ paciente_id: string }>((from, to) =>
    supabase.from('contatos_base').select('paciente_id').range(from, to)
  )

  const contatos = await fetchAll<{ responsavel_id: string | null; pacientes: { id: string } | { id: string }[] | null }>(
    (from, to) =>
      supabase
        .from('contatos_base')
        .select('responsavel_id, pacientes!inner(id)')
        .range(from, to)
  )

  const responsavelCounts: Record<string, number> = {}
  let semResponsavelCount = 0

  for (const contato of contatos) {
    if (!contato.responsavel_id) {
      semResponsavelCount += 1
      continue
    }
    responsavelCounts[contato.responsavel_id] = (responsavelCounts[contato.responsavel_id] ?? 0) + 1
  }

  return {
    responsavelCounts,
    semResponsavelCount: Math.min(semResponsavelCount, pacientesAtivos.length),
  }
}
