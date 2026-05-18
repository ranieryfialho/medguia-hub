'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type OrigemPaciente = {
  id: string
  nome: string
  ativo: boolean
  ordem: number
}

function ordenarOrigens(origens: OrigemPaciente[]): OrigemPaciente[] {
  return [...origens].sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }),
  )
}

export async function listarOrigensPaciente(): Promise<OrigemPaciente[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('origens_paciente')
    .select('id, nome, ativo, ordem')
    .order('nome', { ascending: true })
  return ordenarOrigens(data ?? [])
}

export async function listarOrigensAtivasPaciente(): Promise<OrigemPaciente[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('origens_paciente')
    .select('id, nome, ativo, ordem')
    .eq('ativo', true)
    .order('nome', { ascending: true })
  return ordenarOrigens(data ?? [])
}

export async function criarOrigemPaciente(nome: string): Promise<{ error?: string }> {
  if (!nome.trim()) return { error: 'Nome é obrigatório' }

  const supabase = await createClient()

  const { data: ultima } = await supabase
    .from('origens_paciente')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
    .single()

  const proximaOrdem = (ultima?.ordem ?? 0) + 1

  const { error } = await supabase
    .from('origens_paciente')
    .insert({ nome: nome.trim(), ativo: true, ordem: proximaOrdem })

  if (error) return { error: error.message }

  revalidatePath('/pacientes/origens')
  revalidatePath('/pacientes/novo')
  revalidatePath('/pacientes')
  return {}
}

export async function atualizarOrigemPaciente(
  id: string,
  nome: string,
): Promise<{ error?: string }> {
  if (!nome.trim()) return { error: 'Nome é obrigatório' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('origens_paciente')
    .update({ nome: nome.trim() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/pacientes/origens')
  revalidatePath('/pacientes/novo')
  revalidatePath('/pacientes')
  return {}
}

export async function toggleAtivoOrigemPaciente(
  id: string,
  ativo: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('origens_paciente')
    .update({ ativo })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/pacientes/origens')
  revalidatePath('/pacientes/novo')
  revalidatePath('/pacientes')
  return {}
}

export async function excluirOrigemPaciente(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('origens_paciente')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/pacientes/origens')
  revalidatePath('/pacientes/novo')
  revalidatePath('/pacientes')
  return {}
}
