'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface ProtocoloAtendimentoItem {
  id: string
  tipo_consulta_id: string
  tipo_consulta_nome: string
  quantidade: number
}

export interface ProtocoloAtendimento {
  id: string
  nome: string
  ativo: boolean
  ordem: number
  itens: ProtocoloAtendimentoItem[]
}

function mapRow(row: {
  id: string
  nome: string
  ativo: boolean
  ordem: number
  protocolo_atendimento_itens: Array<{
    id: string
    tipo_consulta_id: string
    quantidade: number
    tipos_consulta: { nome: string } | null
  }>
}): ProtocoloAtendimento {
  return {
    id: row.id,
    nome: row.nome,
    ativo: row.ativo,
    ordem: row.ordem,
    itens: row.protocolo_atendimento_itens.map((item) => ({
      id: item.id,
      tipo_consulta_id: item.tipo_consulta_id,
      tipo_consulta_nome: item.tipos_consulta?.nome ?? '—',
      quantidade: item.quantidade,
    })),
  }
}

function revalidarRotasRelacionadas() {
  revalidatePath('/pacientes/tipos-consulta')
  revalidatePath('/agenda')
  revalidatePath('/confirmacoes')
}

export async function listarProtocolosAtendimento(): Promise<ProtocoloAtendimento[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('protocolos_atendimento')
    .select('id, nome, ativo, ordem, protocolo_atendimento_itens(id, tipo_consulta_id, quantidade, tipos_consulta(nome))')
    .order('ordem')
    .order('nome')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => mapRow(row))
}

export async function listarProtocolosAtendimentoAtivos(): Promise<ProtocoloAtendimento[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('protocolos_atendimento')
    .select('id, nome, ativo, ordem, protocolo_atendimento_itens(id, tipo_consulta_id, quantidade, tipos_consulta(nome))')
    .eq('ativo', true)
    .order('ordem')
    .order('nome')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => mapRow(row))
}

export async function criarProtocoloAtendimento(nome: string) {
  const supabase = await createClient()
  const nomeNormalizado = nome.trim()

  if (!nomeNormalizado) {
    return { error: 'Nome é obrigatório.' }
  }

  const { data: last } = await supabase
    .from('protocolos_atendimento')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const novaOrdem = (last?.ordem ?? 0) + 1

  const { error } = await supabase
    .from('protocolos_atendimento')
    .insert({ nome: nomeNormalizado, ativo: true, ordem: novaOrdem })

  if (error) {
    if (error.code === '23505') {
      return { error: 'Já existe um protocolo com este nome.' }
    }
    return { error: error.message }
  }

  revalidarRotasRelacionadas()
  return { error: null }
}

export async function atualizarProtocoloAtendimento(id: string, nome: string) {
  const supabase = await createClient()
  const nomeNormalizado = nome.trim()

  if (!nomeNormalizado) {
    return { error: 'Nome é obrigatório.' }
  }

  const { error } = await supabase
    .from('protocolos_atendimento')
    .update({ nome: nomeNormalizado, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return { error: 'Já existe um protocolo com este nome.' }
    }
    return { error: error.message }
  }

  revalidarRotasRelacionadas()
  return { error: null }
}

export async function toggleAtivoProtocoloAtendimento(id: string, ativo: boolean) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('protocolos_atendimento')
    .update({ ativo, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidarRotasRelacionadas()
  return { error: null }
}

export async function excluirProtocoloAtendimento(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('protocolos_atendimento')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidarRotasRelacionadas()
  return { error: null }
}

export async function adicionarItemProtocoloAtendimento(
  protocolo_atendimento_id: string,
  tipo_consulta_id: string,
  quantidade: number
) {
  const supabase = await createClient()

  if (!tipo_consulta_id || quantidade < 1) {
    return { error: 'Tipo de consulta e quantidade são obrigatórios.' }
  }

  const { error } = await supabase
    .from('protocolo_atendimento_itens')
    .insert({ protocolo_atendimento_id, tipo_consulta_id, quantidade })

  if (error) return { error: error.message }

  revalidarRotasRelacionadas()
  return { error: null }
}

export async function removerItemProtocoloAtendimento(item_id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('protocolo_atendimento_itens')
    .delete()
    .eq('id', item_id)

  if (error) return { error: error.message }

  revalidarRotasRelacionadas()
  return { error: null }
}

export async function atualizarItemProtocoloAtendimento(
  item_id: string,
  tipo_consulta_id: string,
  quantidade: number
) {
  const supabase = await createClient()

  if (!tipo_consulta_id || quantidade < 1) {
    return { error: 'Tipo de consulta e quantidade são obrigatórios.' }
  }

  const { error } = await supabase
    .from('protocolo_atendimento_itens')
    .update({ tipo_consulta_id, quantidade })
    .eq('id', item_id)

  if (error) return { error: error.message }

  revalidarRotasRelacionadas()
  return { error: null }
}
