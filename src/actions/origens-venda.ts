'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireModulo } from '@/lib/guard'
import { slugOrigem, ORIGEM_MEDICO, type OrigemVenda } from '@/lib/origens-venda'

const COLUNAS = 'id, valor, nome, ativo, ordem, sistema'

export async function listarOrigensVenda(): Promise<OrigemVenda[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('origens_venda')
    .select(COLUNAS)
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true })

  return data ?? []
}

export async function listarOrigensVendaAtivas(): Promise<OrigemVenda[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('origens_venda')
    .select(COLUNAS)
    .eq('ativo', true)
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true })

  return data ?? []
}

// Origens usadas no formulário de edição: as ativas mais a origem atual da venda,
// mesmo que já tenha sido desativada (senão a edição trocaria a origem sem querer).
export async function listarOrigensVendaParaEdicao(origemAtual: string | null | undefined): Promise<OrigemVenda[]> {
  const todas = await listarOrigensVenda()
  return todas.filter((o) => o.ativo || o.valor === origemAtual)
}

export async function origemVendaExiste(valor: string, somenteAtiva: boolean): Promise<boolean> {
  const supabase = await createClient()
  let query = supabase.from('origens_venda').select('id').eq('valor', valor)
  if (somenteAtiva) query = query.eq('ativo', true)
  const { data } = await query.maybeSingle()
  return !!data
}

function revalidarRotasRelacionadas() {
  revalidatePath('/vendas/origens')
  revalidatePath('/vendas')
  revalidatePath('/vendas/nova')
}

export async function criarOrigemVenda(nome: string): Promise<{ error?: string }> {
  await requireModulo('comercial:vendas')
  const nomeNormalizado = nome.trim()
  if (!nomeNormalizado) return { error: 'Nome é obrigatório' }

  const base = slugOrigem(nomeNormalizado)
  if (!base) return { error: 'Informe um nome com letras ou números.' }

  const supabase = await createClient()

  const { data: existente } = await supabase
    .from('origens_venda')
    .select('id')
    .ilike('nome', nomeNormalizado)
    .maybeSingle()

  if (existente) return { error: 'Já existe uma origem com este nome.' }

  // Identificador estável: o slug do nome, com sufixo se já estiver em uso.
  const { data: valores } = await supabase.from('origens_venda').select('valor')
  const emUso = new Set((valores ?? []).map((v) => v.valor))
  let valor = base
  for (let i = 2; emUso.has(valor); i++) valor = `${base}_${i}`

  const { data: ultima } = await supabase
    .from('origens_venda')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase
    .from('origens_venda')
    .insert({ valor, nome: nomeNormalizado, ativo: true, ordem: (ultima?.ordem ?? 0) + 1, sistema: false })

  if (error) return { error: error.message }

  revalidarRotasRelacionadas()
  return {}
}

// Renomear altera só o rótulo; `valor` fica intacto e as vendas antigas continuam ligadas.
export async function atualizarOrigemVenda(id: string, nome: string): Promise<{ error?: string }> {
  await requireModulo('comercial:vendas')
  const nomeNormalizado = nome.trim()
  if (!nomeNormalizado) return { error: 'Nome é obrigatório' }

  const supabase = await createClient()

  const { data: existente } = await supabase
    .from('origens_venda')
    .select('id')
    .ilike('nome', nomeNormalizado)
    .neq('id', id)
    .maybeSingle()

  if (existente) return { error: 'Já existe outra origem com este nome.' }

  const { error } = await supabase
    .from('origens_venda')
    .update({ nome: nomeNormalizado })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidarRotasRelacionadas()
  return {}
}

export async function toggleAtivoOrigemVenda(id: string, ativo: boolean): Promise<{ error?: string }> {
  await requireModulo('comercial:vendas')
  const supabase = await createClient()

  if (!ativo) {
    const { data: origem } = await supabase.from('origens_venda').select('sistema').eq('id', id).maybeSingle()
    if (origem?.sistema) return { error: 'Esta origem é padrão do sistema e não pode ser desativada.' }
  }

  const { error } = await supabase
    .from('origens_venda')
    .update({ ativo })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidarRotasRelacionadas()
  return {}
}

export async function excluirOrigemVenda(id: string): Promise<{ error?: string }> {
  await requireModulo('comercial:vendas')
  const supabase = await createClient()

  const { data: origem } = await supabase
    .from('origens_venda')
    .select('valor, sistema')
    .eq('id', id)
    .maybeSingle()

  if (!origem) return { error: 'Origem não encontrada.' }
  if (origem.sistema || origem.valor === ORIGEM_MEDICO) {
    return { error: 'Esta origem é padrão do sistema e não pode ser excluída.' }
  }

  const { data: vendasComOrigem } = await supabase
    .from('vendas')
    .select('id')
    .eq('origem', origem.valor)
    .limit(1)

  if (vendasComOrigem && vendasComOrigem.length > 0) {
    return { error: 'Não é possível excluir uma origem que está em uso em vendas. Desative-a ao invés disso.' }
  }

  const { error } = await supabase
    .from('origens_venda')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidarRotasRelacionadas()
  return {}
}
