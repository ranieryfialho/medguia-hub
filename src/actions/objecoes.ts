'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type Objecao = {
  id: string
  nome: string
  ativo: boolean
  ordem: number
}

export async function listarObjecoes(): Promise<Objecao[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('objecoes_orcamento')
    .select('id, nome, ativo, ordem')
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true })

  return data ?? []
}

export async function listarObjecoesAtivas(): Promise<Objecao[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('objecoes_orcamento')
    .select('id, nome, ativo, ordem')
    .eq('ativo', true)
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true })

  return data ?? []
}

function revalidarRotasRelacionadas() {
  revalidatePath('/objecoes')
  revalidatePath('/vendas/nova')
}

export async function criarObjecao(nome: string): Promise<{ error?: string }> {
  const nomeNormalizado = nome.trim()
  if (!nomeNormalizado) return { error: 'Nome é obrigatório' }

  const supabase = await createClient()

  const { data: existente } = await supabase
    .from('objecoes_orcamento')
    .select('id')
    .eq('nome', nomeNormalizado)
    .maybeSingle()

  if (existente) return { error: 'Já existe uma objeção com este nome.' }

  const { data: ultima } = await supabase
    .from('objecoes_orcamento')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const proximaOrdem = (ultima?.ordem ?? 0) + 1

  const { error } = await supabase
    .from('objecoes_orcamento')
    .insert({
      nome: nomeNormalizado,
      ativo: true,
      ordem: proximaOrdem,
    })

  if (error) return { error: error.message }

  revalidarRotasRelacionadas()
  return {}
}

export async function atualizarObjecao(id: string, nome: string): Promise<{ error?: string }> {
  const nomeNormalizado = nome.trim()
  if (!nomeNormalizado) return { error: 'Nome é obrigatório' }

  const supabase = await createClient()

  const { data: existente } = await supabase
    .from('objecoes_orcamento')
    .select('id')
    .eq('nome', nomeNormalizado)
    .neq('id', id)
    .maybeSingle()

  if (existente) return { error: 'Já existe outra objeção com este nome.' }

  const { error } = await supabase
    .from('objecoes_orcamento')
    .update({ nome: nomeNormalizado })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidarRotasRelacionadas()
  return {}
}

export async function toggleAtivoObjecao(id: string, ativo: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('objecoes_orcamento')
    .update({ ativo })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidarRotasRelacionadas()
  return {}
}

export async function excluirObjecao(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: vendasComObjecao } = await supabase
    .from('vendas')
    .select('id')
    .eq('objecao_motivo_id', id)
    .limit(1)

  if (vendasComObjecao && vendasComObjecao.length > 0) {
    return { error: 'Não é possível excluir uma objeção que está em uso em vendas. Desative-a ao invés disso.' }
  }

  const { error } = await supabase
    .from('objecoes_orcamento')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidarRotasRelacionadas()
  return {}
}
