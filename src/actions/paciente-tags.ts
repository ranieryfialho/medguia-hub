'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type PacienteTag = {
  id: string
  nome: string
  cor: string
  ordem: number
  ativo: boolean
}

function revalidarRotasRelacionadas() {
  revalidatePath('/pacientes')
  revalidatePath('/pacientes/tags')
  revalidatePath('/pacientes/[id]', 'page')
}

async function assertGestor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, nivel_acesso')
    .eq('id', user.id)
    .single()
  const ok =
    ['gestor', 'master'].includes(profile?.role ?? '') ||
    ['gestor', 'master'].includes(profile?.nivel_acesso ?? '')
  if (!ok) throw new Error('Sem permissão')
  return supabase
}

// ─── Catálogo ──────────────────────────────────────────────────────────────

export async function listarTagsPaciente(): Promise<PacienteTag[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('paciente_tags')
    .select('id, nome, cor, ordem, ativo')
    .order('ativo', { ascending: false })
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true })

  return data ?? []
}

export async function listarTagsPacienteAtivas(): Promise<PacienteTag[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('paciente_tags')
    .select('id, nome, cor, ordem, ativo')
    .eq('ativo', true)
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true })

  return data ?? []
}

export async function criarTagPaciente(nome: string, cor: string): Promise<{ error?: string; tag?: PacienteTag }> {
  const nomeNormalizado = nome.trim()
  if (!nomeNormalizado) return { error: 'Nome é obrigatório' }

  let supabase
  try { supabase = await assertGestor() } catch (e: unknown) { return { error: (e as Error).message } }

  const { data: existente } = await supabase
    .from('paciente_tags')
    .select('id')
    .eq('ativo', true)
    .ilike('nome', nomeNormalizado)
    .maybeSingle()
  if (existente) return { error: 'Já existe uma tag com esse nome' }

  const { data: ultima } = await supabase
    .from('paciente_tags')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('paciente_tags')
    .insert({
      nome: nomeNormalizado,
      cor,
      ordem: (ultima?.ordem ?? 0) + 1,
      ativo: true,
    })
    .select('id, nome, cor, ordem, ativo')
    .single()

  if (error) return { error: error.message }

  revalidarRotasRelacionadas()
  return { tag: data }
}

export async function atualizarTagPaciente(id: string, nome: string, cor: string): Promise<{ error?: string }> {
  const nomeNormalizado = nome.trim()
  if (!nomeNormalizado) return { error: 'Nome é obrigatório' }

  let supabase
  try { supabase = await assertGestor() } catch (e: unknown) { return { error: (e as Error).message } }

  const { error } = await supabase
    .from('paciente_tags')
    .update({ nome: nomeNormalizado, cor, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidarRotasRelacionadas()
  return {}
}

export async function excluirTagPaciente(id: string): Promise<{ error?: string }> {
  let supabase
  try { supabase = await assertGestor() } catch (e: unknown) { return { error: (e as Error).message } }

  const { error } = await supabase
    .from('paciente_tags')
    .update({ ativo: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidarRotasRelacionadas()
  return {}
}

// ─── Vínculos paciente <-> tag ───────────────────────────────────────────────

export async function listarTagsDoPaciente(pacienteId: string): Promise<PacienteTag[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('paciente_tags_vinculos')
    .select('tag:paciente_tags(id, nome, cor, ordem, ativo)')
    .eq('paciente_id', pacienteId)

  return ((data ?? [])
    .map((v) => v.tag as unknown as PacienteTag | null)
    .filter((t): t is PacienteTag => !!t && t.ativo)
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome)))
}

export async function listarTagsPorPacientes(pacienteIds: string[]): Promise<Record<string, PacienteTag[]>> {
  if (pacienteIds.length === 0) return {}

  const supabase = await createClient()
  const { data } = await supabase
    .from('paciente_tags_vinculos')
    .select('paciente_id, tag:paciente_tags(id, nome, cor, ordem, ativo)')
    .in('paciente_id', pacienteIds)

  const mapa: Record<string, PacienteTag[]> = {}
  for (const linha of data ?? []) {
    const tag = linha.tag as unknown as PacienteTag | null
    if (!tag || !tag.ativo) continue
    if (!mapa[linha.paciente_id]) mapa[linha.paciente_id] = []
    mapa[linha.paciente_id].push(tag)
  }
  for (const id of Object.keys(mapa)) {
    mapa[id].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))
  }
  return mapa
}

export async function adicionarTagAoPaciente(pacienteId: string, tagId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase
    .from('paciente_tags_vinculos')
    .insert({ paciente_id: pacienteId, tag_id: tagId, criado_por: user.id })

  // Vínculo já existe (PK duplicada) — não é erro do ponto de vista do usuário
  if (error && error.code !== '23505') return { error: error.message }

  revalidarRotasRelacionadas()
  return {}
}

export async function removerTagDoPaciente(pacienteId: string, tagId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('paciente_tags_vinculos')
    .delete()
    .eq('paciente_id', pacienteId)
    .eq('tag_id', tagId)

  if (error) return { error: error.message }

  revalidarRotasRelacionadas()
  return {}
}
