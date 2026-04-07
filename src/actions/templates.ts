'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function listarTemplates() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  // Retorna templates globais (criado_por IS NULL) + os do próprio usuário
  const { data, error } = await supabase
    .from('templates_mensagem')
    .select('id, nome, conteudo, criado_em, criado_por')
    .or(`criado_por.is.null,criado_por.eq.${user.id}`)
    .order('criado_em', { ascending: true })

  if (error) {
    console.error('Erro ao listar templates:', error)
    return []
  }

  return data ?? []
}

export async function salvarTemplate(nome: string, conteudo: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Não autenticado' }

  const { data, error } = await supabase
    .from('templates_mensagem')
    .insert({ nome, conteudo, criado_por: user.id })
    .select('id')
    .single()

  if (error) {
    console.error('Erro ao salvar template:', error)
    return { error: error.message }
  }

  revalidatePath('/confirmacoes/mensagens')
  return { success: true, id: data?.id }
}

export async function atualizarTemplate(id: string, nome: string, conteudo: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Não autenticado' }

  // Só permite editar templates do próprio usuário
  const { error } = await supabase
    .from('templates_mensagem')
    .update({ nome, conteudo })
    .eq('id', id)
    .eq('criado_por', user.id)

  if (error) {
    console.error('Erro ao atualizar template:', error)
    return { error: error.message }
  }

  revalidatePath('/confirmacoes/mensagens')
  return { success: true }
}

export async function deletarTemplate(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Não autenticado' }

  // Só permite deletar templates do próprio usuário
  const { error } = await supabase
    .from('templates_mensagem')
    .delete()
    .eq('id', id)
    .eq('criado_por', user.id)

  if (error) {
    console.error('Erro ao deletar template:', error)
    return { error: error.message }
  }

  revalidatePath('/confirmacoes/mensagens')
  return { success: true }
}