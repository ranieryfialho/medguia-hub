'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type TipoConsulta = {
  id: string
  nome: string
  ativo: boolean
  ordem: number
}

export async function listarTiposConsulta(): Promise<TipoConsulta[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tipos_consulta')
    .select('id, nome, ativo, ordem')
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true })

  return data ?? []
}

export async function listarTiposConsultaAtivos(): Promise<TipoConsulta[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tipos_consulta')
    .select('id, nome, ativo, ordem')
    .eq('ativo', true)
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true })

  return data ?? []
}

function revalidarRotasRelacionadas() {
  revalidatePath('/pacientes/tipos-consulta')
  revalidatePath('/agenda')
  revalidatePath('/dashboard')
  revalidatePath('/pacientes')
  revalidatePath('/prontuarios')
  revalidatePath('/confirmacoes')
}

export async function criarTipoConsulta(nome: string): Promise<{ error?: string }> {
  const nomeNormalizado = nome.trim()
  if (!nomeNormalizado) return { error: 'Nome é obrigatório' }

  const supabase = await createClient()

  const { data: ultima } = await supabase
    .from('tipos_consulta')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const proximaOrdem = (ultima?.ordem ?? 0) + 1

  const { error } = await supabase
    .from('tipos_consulta')
    .insert({
      nome: nomeNormalizado,
      ativo: true,
      ordem: proximaOrdem,
    })

  if (error) return { error: error.message }

  revalidarRotasRelacionadas()
  return {}
}

export async function atualizarTipoConsulta(id: string, nome: string): Promise<{ error?: string }> {
  const nomeNormalizado = nome.trim()
  if (!nomeNormalizado) return { error: 'Nome é obrigatório' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('tipos_consulta')
    .update({
      nome: nomeNormalizado,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidarRotasRelacionadas()
  return {}
}

export async function toggleAtivoTipoConsulta(id: string, ativo: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('tipos_consulta')
    .update({
      ativo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidarRotasRelacionadas()
  return {}
}

export async function excluirTipoConsulta(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('tipos_consulta')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidarRotasRelacionadas()
  return {}
}
