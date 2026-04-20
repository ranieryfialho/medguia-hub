'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function criarProduto(prevState: any, formData: FormData) {
  const supabase = await createClient()

  const nome = formData.get('nome') as string
  const numero_atendimentos = formData.get('numero_atendimentos') as string
  const preco_padrao = formData.get('preco_padrao') as string
  const descricao = formData.get('descricao') as string

  if (!nome?.trim()) {
    return { error: 'Nome do produto é obrigatório.' }
  }

  if (!preco_padrao) {
    return { error: 'Preço padrão é obrigatório.' }
  }

  const dadosProduto = {
    nome: nome.trim(),
    numero_atendimentos: numero_atendimentos ? parseInt(numero_atendimentos) : null,
    preco_padrao: parseFloat(preco_padrao),
    descricao: descricao || null,
    ativo: true,
  }

  // Verificar se produto com mesmo nome já existe
  const { data: produtoExistente } = await supabase
    .from('produtos')
    .select('id')
    .eq('nome', dadosProduto.nome)
    .maybeSingle()

  if (produtoExistente) {
    return { error: 'Já existe um produto com este nome.', fields: dadosProduto }
  }

  const { error } = await supabase
    .from('produtos')
    .insert(dadosProduto)

  if (error) {
    return { error: `Erro ao criar produto: ${error.message}`, fields: dadosProduto }
  }

  revalidatePath('/produtos')
  redirect('/produtos')
}

export async function editarProduto(prevState: any, formData: FormData) {
  const supabase = await createClient()

  const id = formData.get('id') as string
  const nome = formData.get('nome') as string
  const numero_atendimentos = formData.get('numero_atendimentos') as string
  const preco_padrao = formData.get('preco_padrao') as string
  const descricao = formData.get('descricao') as string
  const ativo = formData.get('ativo') === 'true'

  if (!nome?.trim()) {
    return { error: 'Nome do produto é obrigatório.' }
  }

  if (!preco_padrao) {
    return { error: 'Preço padrão é obrigatório.' }
  }

  const dadosProduto = {
    nome: nome.trim(),
    numero_atendimentos: numero_atendimentos ? parseInt(numero_atendimentos) : null,
    preco_padrao: parseFloat(preco_padrao),
    descricao: descricao || null,
    ativo,
    atualizado_em: new Date().toISOString(),
  }

  // Verificar se outro produto com mesmo nome já existe
  const { data: produtoExistente } = await supabase
    .from('produtos')
    .select('id')
    .eq('nome', dadosProduto.nome)
    .neq('id', id)
    .maybeSingle()

  if (produtoExistente) {
    return { error: 'Já existe outro produto com este nome.', fields: dadosProduto }
  }

  const { error } = await supabase
    .from('produtos')
    .update(dadosProduto)
    .eq('id', id)

  if (error) {
    return { error: `Erro ao editar produto: ${error.message}`, fields: dadosProduto }
  }

  revalidatePath('/produtos')
  redirect('/produtos')
}

export async function deletarProduto(id: string) {
  const supabase = await createClient()

  // Validar se produto está em uso em itens de venda
  const { data: itensProduto, error: erroQuery } = await supabase
    .from('itens_venda')
    .select('id', { count: 'exact' })
    .eq('produto_id', id)
    .limit(1)

  if (erroQuery) {
    return { error: 'Erro ao verificar uso do produto.' }
  }

  if (itensProduto && itensProduto.length > 0) {
    return { error: 'Não é possível deletar um produto que está em uso em vendas. Desative-o ao invés disso.' }
  }

  // Deletar produto
  const { error } = await supabase
    .from('produtos')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: `Erro ao deletar produto: ${error.message}` }
  }

  revalidatePath('/produtos')
  return { success: true }
}

export async function inativarProduto(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('produtos')
    .update({ ativo: false, atualizado_em: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return { error: 'Erro ao inativar produto.' }
  }

  revalidatePath('/produtos')
  return { success: true }
}

interface FiltrosProdutos {
  ativo?: boolean
  offset?: number
  limit?: number
  busca?: string
}

export async function listarProdutos(filtros: FiltrosProdutos = {}) {
  const supabase = await createClient()

  const { ativo = true, offset = 0, limit = 20, busca } = filtros

  let query = supabase
    .from('produtos')
    .select('*', { count: 'exact' })
    .eq('ativo', ativo)
    .order('nome')
    .range(offset, offset + limit - 1)

  if (busca?.trim()) {
    query = query.ilike('nome', `%${busca}%`)
  }

  const { data, error, count } = await query

  if (error) {
    return { error: `Erro ao listar produtos: ${error.message}`, produtos: [], total: 0 }
  }

  return { produtos: data || [], total: count || 0, error: null }
}

export async function obterProduto(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    return { error: `Erro ao obter produto: ${error.message}`, produto: null }
  }

  return { produto: data, error: null }
}