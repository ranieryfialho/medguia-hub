'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type PlanoSaude = {
  id: string
  nome: string
  ativo: boolean
  ordem: number
}

export async function listarPlanosSaude(): Promise<PlanoSaude[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('planos_saude')
    .select('id, nome, ativo, ordem')
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true })
  return data ?? []
}

export async function listarPlanosSaudeAtivos(): Promise<PlanoSaude[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('planos_saude')
    .select('id, nome, ativo, ordem')
    .eq('ativo', true)
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true })
  return data ?? []
}

export async function criarPlanoSaude(nome: string): Promise<{ error?: string }> {
  if (!nome.trim()) return { error: 'Nome é obrigatório' }

  const supabase = await createClient()

  const { data: ultimo } = await supabase
    .from('planos_saude')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const proximaOrdem = (ultimo?.ordem ?? 0) + 1

  const { error } = await supabase
    .from('planos_saude')
    .insert({ nome: nome.trim(), ativo: true, ordem: proximaOrdem })

  if (error) return { error: error.message }

  revalidatePath('/pacientes/planos-saude')
  revalidatePath('/pacientes/novo')
  revalidatePath('/pacientes')
  return {}
}

export async function atualizarPlanoSaude(
  id: string,
  nome: string,
): Promise<{ error?: string }> {
  if (!nome.trim()) return { error: 'Nome é obrigatório' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('planos_saude')
    .update({ nome: nome.trim(), updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/pacientes/planos-saude')
  revalidatePath('/pacientes/novo')
  revalidatePath('/pacientes')
  return {}
}

export async function toggleAtivoPlanoSaude(
  id: string,
  ativo: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('planos_saude')
    .update({ ativo, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/pacientes/planos-saude')
  revalidatePath('/pacientes/novo')
  revalidatePath('/pacientes')
  return {}
}

export async function excluirPlanoSaude(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('planos_saude')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/pacientes/planos-saude')
  revalidatePath('/pacientes/novo')
  revalidatePath('/pacientes')
  return {}
}
