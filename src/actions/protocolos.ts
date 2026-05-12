'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface ProtocoloItem {
  id: string
  produto_id: string
  produto_nome: string
  quantidade: number
}

export interface Protocolo {
  id: string
  nome: string
  ativo: boolean
  ordem: number
  itens: ProtocoloItem[]
}

function mapRow(row: {
  id: string
  nome: string
  ativo: boolean
  ordem: number
  protocolo_itens: Array<{
    id: string
    produto_id: string
    quantidade: number
    produtos: { nome: string } | null
  }>
}): Protocolo {
  return {
    id: row.id,
    nome: row.nome,
    ativo: row.ativo,
    ordem: row.ordem,
    itens: row.protocolo_itens.map((item) => ({
      id: item.id,
      produto_id: item.produto_id,
      produto_nome: item.produtos?.nome ?? '—',
      quantidade: item.quantidade,
    })),
  }
}

export async function listarProtocolos(): Promise<Protocolo[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('protocolos')
    .select('id, nome, ativo, ordem, protocolo_itens(id, produto_id, quantidade, produtos(nome))')
    .order('ordem')
    .order('nome')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => mapRow(row))
}

export async function listarProtocolosAtivos(): Promise<Protocolo[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('protocolos')
    .select('id, nome, ativo, ordem, protocolo_itens(id, produto_id, quantidade, produtos(nome))')
    .eq('ativo', true)
    .order('ordem')
    .order('nome')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => mapRow(row))
}

export async function criarProtocolo(nome: string) {
  const supabase = await createClient()

  if (!nome.trim()) {
    return { error: 'Nome é obrigatório.' }
  }

  const { data: last } = await supabase
    .from('protocolos')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const novaOrdem = (last?.ordem ?? 0) + 1

  const { error } = await supabase
    .from('protocolos')
    .insert({ nome: nome.trim(), ativo: true, ordem: novaOrdem })

  if (error) {
    if (error.code === '23505') {
      return { error: 'Já existe um protocolo com este nome.' }
    }
    return { error: error.message }
  }

  revalidatePath('/vendas/protocolos')
  return { error: null }
}

export async function atualizarProtocolo(id: string, nome: string) {
  const supabase = await createClient()

  if (!nome.trim()) {
    return { error: 'Nome é obrigatório.' }
  }

  const { error } = await supabase
    .from('protocolos')
    .update({ nome: nome.trim() })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return { error: 'Já existe um protocolo com este nome.' }
    }
    return { error: error.message }
  }

  revalidatePath('/vendas/protocolos')
  return { error: null }
}

export async function toggleAtivoProtocolo(id: string, ativo: boolean) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('protocolos')
    .update({ ativo })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/vendas/protocolos')
  return { error: null }
}

export async function excluirProtocolo(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('protocolos')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/vendas/protocolos')
  return { error: null }
}

export async function adicionarItemProtocolo(
  protocolo_id: string,
  produto_id: string,
  quantidade: number
) {
  const supabase = await createClient()

  if (!produto_id || quantidade < 1) {
    return { error: 'Produto e quantidade são obrigatórios.' }
  }

  const { error } = await supabase
    .from('protocolo_itens')
    .insert({ protocolo_id, produto_id, quantidade })

  if (error) return { error: error.message }

  revalidatePath('/vendas/protocolos')
  return { error: null }
}

export async function removerItemProtocolo(item_id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('protocolo_itens')
    .delete()
    .eq('id', item_id)

  if (error) return { error: error.message }

  revalidatePath('/vendas/protocolos')
  return { error: null }
}
