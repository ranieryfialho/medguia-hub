'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  COLUNAS_SISTEMA_CONTATOS,
  LABEL_POR_STATUS_CONTATO,
  type ColunaCorContato,
  type KanbanColunaContato,
  type StatusContatoPadrao,
} from '@/lib/contatos-kanban'

export type StatusContato = StatusContatoPadrao

type AuthContext = {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  role: string
}

async function getAuthContext(): Promise<AuthContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return {
    supabase,
    userId: user.id,
    role: profile?.role ?? '',
  }
}

async function requireGestorOuMaster() {
  const ctx = await getAuthContext()

  if (!['gestor', 'master'].includes(ctx.role)) {
    throw new Error('Forbidden')
  }

  return ctx
}

async function listarColunasKanbanInterno(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<KanbanColunaContato[]> {
  const { data } = await supabase
    .from('kanban_colunas_contatos')
    .select('chave, nome, tipo, status_base, cor_chave, ordem')
    .order('ordem', { ascending: true })

  if (!data?.length) {
    return COLUNAS_SISTEMA_CONTATOS
  }

  return data as KanbanColunaContato[]
}

function slugifyColumnName(value: string) {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'coluna'
}

function createUniqueColumnKey(nome: string, existingKeys: string[]) {
  const base = slugifyColumnName(nome)

  if (!existingKeys.includes(base)) {
    return base
  }

  let suffix = 2
  while (existingKeys.includes(`${base}-${suffix}`)) {
    suffix++
  }

  return `${base}-${suffix}`
}

function mensagemMudancaEtapa(coluna: KanbanColunaContato) {
  if (coluna.tipo === 'sistema') {
    return `Status alterado para: ${LABEL_POR_STATUS_CONTATO[coluna.status_base]}`
  }

  return `Etapa alterada para: ${coluna.nome}`
}

async function upsertContato(pacienteId: string, updates: Record<string, unknown>) {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('contatos_base')
    .select('id')
    .eq('paciente_id', pacienteId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('contatos_base')
      .update({ ...updates, atualizado_em: new Date().toISOString() })
      .eq('id', existing.id)

    return error ? { error: error.message } : { success: true }
  }

  const { error } = await supabase
    .from('contatos_base')
    .insert({
      paciente_id: pacienteId,
      status: 'a_contactar',
      kanban_coluna_chave: 'a_contactar',
      ...updates,
    })

  return error ? { error: error.message } : { success: true }
}

function revalidarContatos() {
  revalidatePath('/contatos')
  revalidatePath('/contatos/relatorio')
  revalidatePath('/dashboard')
}

export async function atualizarStatusContato(pacienteId: string, status: StatusContato) {
  const { supabase, userId } = await getAuthContext()
  const result = await upsertContato(pacienteId, { status, kanban_coluna_chave: status })

  if (result.success) {
    await supabase
      .from('notas_contato')
      .insert({
        paciente_id: pacienteId,
        texto: `Status alterado para: ${LABEL_POR_STATUS_CONTATO[status]}`,
        autor_id: userId,
      })

    revalidarContatos()
  }

  return result
}

export async function atualizarColunaContato(pacienteId: string, colunaChave: string) {
  const { supabase, userId } = await getAuthContext()
  const colunas = await listarColunasKanbanInterno(supabase)
  const coluna = colunas.find((item) => item.chave === colunaChave)

  if (!coluna) {
    return { error: 'Coluna nao encontrada.' }
  }

  const result = await upsertContato(pacienteId, {
    status: coluna.status_base,
    kanban_coluna_chave: coluna.chave,
  })

  if (result.success) {
    await supabase
      .from('notas_contato')
      .insert({
        paciente_id: pacienteId,
        texto: mensagemMudancaEtapa(coluna),
        autor_id: userId,
      })

    revalidarContatos()
  }

  return result
}

export async function atualizarResponsavelContato(pacienteId: string, responsavelId: string | null) {
  return upsertContato(pacienteId, { responsavel_id: responsavelId })
}

export async function adicionarNota(pacienteId: string, texto: string) {
  const { supabase, userId } = await getAuthContext()

  const { error } = await supabase
    .from('notas_contato')
    .insert({ paciente_id: pacienteId, texto, autor_id: userId })

  return error ? { error: error.message } : { success: true }
}

export async function buscarNotas(pacienteId: string) {
  const supabase = await createClient()

  const { data: notas } = await supabase
    .from('notas_contato')
    .select('id, texto, criado_em, autor_id')
    .eq('paciente_id', pacienteId)
    .order('criado_em', { ascending: true })

  if (!notas?.length) return []

  const autorIds = [...new Set(notas.map((n) => n.autor_id).filter(Boolean))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', autorIds)

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name]))

  return notas.map((n) => ({
    ...n,
    autor_nome: n.autor_id ? profileMap[n.autor_id] : null,
  }))
}

export async function listarColunasKanbanContato() {
  const { supabase } = await getAuthContext()
  return listarColunasKanbanInterno(supabase)
}

export async function criarColunaKanbanContato(input: {
  nome: string
  statusBase: StatusContato
  corChave: ColunaCorContato
}) {
  const { supabase, userId } = await requireGestorOuMaster()
  const nome = input.nome.trim()

  if (!nome) {
    return { error: 'Informe um nome para a coluna.' }
  }

  const colunas = await listarColunasKanbanInterno(supabase)
  const maiorOrdem = colunas.reduce((max, coluna) => Math.max(max, coluna.ordem), 0)
  const chave = createUniqueColumnKey(nome, colunas.map((coluna) => coluna.chave))

  const { error } = await supabase
    .from('kanban_colunas_contatos')
    .insert({
      chave,
      nome,
      tipo: 'custom',
      status_base: input.statusBase,
      cor_chave: input.corChave,
      ordem: maiorOrdem + 1,
      criado_por: userId,
    })

  if (error) {
    return { error: error.message }
  }

  revalidarContatos()
  return { success: true, chave }
}

export async function editarColunaKanbanContato(input: {
  chave: string
  nome: string
  statusBase: StatusContato
  corChave: ColunaCorContato
}) {
  const { supabase } = await requireGestorOuMaster()
  const nome = input.nome.trim()

  if (!nome) {
    return { error: 'Informe um nome para a coluna.' }
  }

  const { data: colunaAtual } = await supabase
    .from('kanban_colunas_contatos')
    .select('chave, tipo')
    .eq('chave', input.chave)
    .maybeSingle()

  if (!colunaAtual) {
    return { error: 'Coluna nao encontrada.' }
  }

  if (colunaAtual.tipo !== 'custom') {
    return { error: 'Colunas padrao nao podem ser editadas.' }
  }

  const { error } = await supabase
    .from('kanban_colunas_contatos')
    .update({
      nome,
      status_base: input.statusBase,
      cor_chave: input.corChave,
      atualizado_em: new Date().toISOString(),
    })
    .eq('chave', input.chave)

  if (error) {
    return { error: error.message }
  }

  await supabase
    .from('contatos_base')
    .update({
      status: input.statusBase,
      atualizado_em: new Date().toISOString(),
    })
    .eq('kanban_coluna_chave', input.chave)

  revalidarContatos()
  return { success: true }
}

export async function removerColunaKanbanContato(chave: string) {
  const { supabase } = await requireGestorOuMaster()

  const { data: coluna } = await supabase
    .from('kanban_colunas_contatos')
    .select('chave, tipo, status_base')
    .eq('chave', chave)
    .maybeSingle()

  if (!coluna) {
    return { error: 'Coluna nao encontrada.' }
  }

  if (coluna.tipo !== 'custom') {
    return { error: 'Colunas padrao nao podem ser removidas.' }
  }

  const { count, error: countError } = await supabase
    .from('contatos_base')
    .select('id', { count: 'exact', head: true })
    .eq('kanban_coluna_chave', coluna.chave)

  if (countError) {
    return { error: countError.message }
  }

  if ((count ?? 0) > 0) {
    return { error: 'Nao e possivel excluir uma coluna que ainda possui cards.' }
  }

  const { error } = await supabase
    .from('kanban_colunas_contatos')
    .delete()
    .eq('chave', chave)

  if (error) {
    return { error: error.message }
  }

  revalidarContatos()
  return { success: true }
}

export async function moverColunaKanbanContato(chave: string, direction: 'left' | 'right') {
  const { supabase } = await requireGestorOuMaster()
  const colunas = await listarColunasKanbanInterno(supabase)
  const currentIndex = colunas.findIndex((coluna) => coluna.chave === chave)

  if (currentIndex === -1) {
    return { error: 'Coluna nao encontrada.' }
  }

  const neighborIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1
  const neighbor = colunas[neighborIndex]
  const current = colunas[currentIndex]

  if (!neighbor || !current) {
    return { success: true }
  }

  const timestamp = new Date().toISOString()

  const { error: updateCurrentError } = await supabase
    .from('kanban_colunas_contatos')
    .update({ ordem: neighbor.ordem, atualizado_em: timestamp })
    .eq('chave', current.chave)

  if (updateCurrentError) {
    return { error: updateCurrentError.message }
  }

  const { error: updateNeighborError } = await supabase
    .from('kanban_colunas_contatos')
    .update({ ordem: current.ordem, atualizado_em: timestamp })
    .eq('chave', neighbor.chave)

  if (updateNeighborError) {
    return { error: updateNeighborError.message }
  }

  revalidatePath('/contatos')
  return { success: true }
}
