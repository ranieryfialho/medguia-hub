'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ─── Types ────────────────────────────────────────────────────────────────────

export type FollowUpTipo = {
  id: string
  nome: string
  cor: string | null
  ativo: boolean
  ordem: number
  created_at: string
  updated_at: string
}

export type FollowUpTemplate = {
  id: string
  tipo_id: string
  titulo: string
  conteudo: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export type FollowUp = {
  id: string
  paciente_id: string
  atendimento_id: string | null
  tipo_id: string
  descricao: string | null
  responsavel_id: string | null
  criado_por: string | null
  status: 'pendente' | 'concluido'
  created_at: string
  updated_at: string
  tipo: Pick<FollowUpTipo, 'id' | 'nome' | 'cor'>
  responsavel: { id: string; full_name: string } | null
  autor: { id: string; full_name: string } | null
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export async function listarTipos(): Promise<FollowUpTipo[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('follow_up_tipos')
    .select('*')
    .eq('ativo', true)
    .order('ordem')
    .order('nome')
  return data ?? []
}

export async function listarTodosTipos(): Promise<FollowUpTipo[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('follow_up_tipos')
    .select('*')
    .order('ordem')
    .order('nome')
  return data ?? []
}

export async function criarTipo(input: {
  nome: string
  cor?: string
  ordem?: number
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('follow_up_tipos').insert({
    nome: input.nome.trim(),
    cor: input.cor ?? null,
    ordem: input.ordem ?? 0,
  })
  if (error) return { error: error.message }
  revalidatePath('/follow-ups')
  return {}
}

export async function editarTipo(
  id: string,
  input: { nome?: string; cor?: string | null; ordem?: number }
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('follow_up_tipos')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/follow-ups')
  return {}
}

export async function toggleTipo(id: string, ativo: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('follow_up_tipos')
    .update({ ativo, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/follow-ups')
  return {}
}

// ─── Templates ────────────────────────────────────────────────────────────────

export async function listarTemplatesPorTipo(tipoId: string): Promise<FollowUpTemplate[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('follow_up_templates')
    .select('*')
    .eq('tipo_id', tipoId)
    .eq('ativo', true)
    .order('titulo')
  return data ?? []
}

export async function listarTodosTemplates(): Promise<FollowUpTemplate[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('follow_up_templates')
    .select('*')
    .order('titulo')
  return data ?? []
}

export async function criarTemplate(input: {
  tipo_id: string
  titulo: string
  conteudo: string
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('follow_up_templates').insert({
    tipo_id: input.tipo_id,
    titulo: input.titulo.trim(),
    conteudo: input.conteudo.trim(),
  })
  if (error) return { error: error.message }
  revalidatePath('/follow-ups/templates')
  return {}
}

export async function editarTemplate(
  id: string,
  input: { titulo?: string; conteudo?: string; tipo_id?: string }
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('follow_up_templates')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/follow-ups/templates')
  return {}
}

export async function toggleTemplate(id: string, ativo: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('follow_up_templates')
    .update({ ativo, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/follow-ups/templates')
  return {}
}

export async function deletarTemplate(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('follow_up_templates').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/follow-ups/templates')
  return {}
}

// ─── Follow-ups ───────────────────────────────────────────────────────────────

export async function listarFollowUpsPaciente(pacienteId: string): Promise<FollowUp[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('follow_ups')
    .select(`
      *,
      tipo:follow_up_tipos(id, nome, cor),
      responsavel:profiles!responsavel_id(id, full_name),
      autor:profiles!criado_por(id, full_name)
    `)
    .eq('paciente_id', pacienteId)
    .order('created_at', { ascending: false })
  return (data ?? []) as FollowUp[]
}

export async function listarFollowUps(params?: {
  paciente_id?: string
  responsavel_id?: string
  tipo_id?: string
  limit?: number
}): Promise<FollowUp[]> {
  const supabase = await createClient()
  let query = supabase
    .from('follow_ups')
    .select(`
      *,
      tipo:follow_up_tipos(id, nome, cor),
      responsavel:profiles!responsavel_id(id, full_name),
      autor:profiles!criado_por(id, full_name)
    `)
    .order('created_at', { ascending: false })

  if (params?.paciente_id) query = query.eq('paciente_id', params.paciente_id)
  if (params?.responsavel_id) query = query.eq('responsavel_id', params.responsavel_id)
  if (params?.tipo_id) query = query.eq('tipo_id', params.tipo_id)
  if (params?.limit) query = query.limit(params.limit)

  const { data } = await query
  return (data ?? []) as FollowUp[]
}

// Responsavel sugerido ao abrir o formulario: quem esta logado
export async function buscarResponsavelPadrao(): Promise<{ id: string; full_name: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('id', user.id)
    .single()

  if (!data) return null
  return { id: data.id, full_name: data.full_name || 'Você' }
}

export async function criarFollowUp(input: {
  paciente_id: string
  atendimento_id?: string | null
  tipo_id: string
  descricao?: string
  responsavel_id?: string | null
}): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado' }

  const { data, error } = await supabase
    .from('follow_ups')
    .insert({
      paciente_id: input.paciente_id,
      atendimento_id: input.atendimento_id ?? null,
      tipo_id: input.tipo_id,
      descricao: input.descricao?.trim() || null,
      // Sem escolha explicita, o follow-up fica com quem o registrou
      responsavel_id: input.responsavel_id || user.id,
      criado_por: user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/follow-ups')
  revalidatePath(`/pacientes/${input.paciente_id}`)
  if (input.atendimento_id) revalidatePath(`/prontuarios/${input.atendimento_id}`)

  return { id: data.id }
}

export async function deletarFollowUp(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('follow_ups').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/follow-ups')
  return {}
}

export async function concluirFollowUp(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('follow_ups')
    .update({ status: 'concluido', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  revalidatePath('/follow-ups')
  return {}
}

export async function contarFollowUpsPendentes(): Promise<number> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0
  const { count } = await supabase
    .from('follow_ups')
    .select('id', { count: 'exact', head: true })
    .eq('responsavel_id', user.id)
    .eq('status', 'pendente')
  return count ?? 0
}