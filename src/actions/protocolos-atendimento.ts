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
  total_sessoes: number
  itens: ProtocoloAtendimentoItem[]
}

function mapRow(row: {
  id: string
  nome: string
  ativo: boolean
  ordem: number
  total_sessoes: number
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
    total_sessoes: row.total_sessoes,
    itens: row.protocolo_atendimento_itens.map((item) => ({
      id: item.id,
      tipo_consulta_id: item.tipo_consulta_id,
      tipo_consulta_nome: item.tipos_consulta?.nome ?? '-',
      quantidade: item.quantidade,
    })),
  }
}

function revalidarRotasRelacionadas() {
  revalidatePath('/pacientes/tipos-consulta')
  revalidatePath('/agenda')
  revalidatePath('/confirmacoes')
}

function normalizarTotalSessoes(totalSessoes: number) {
  return Math.max(1, Math.min(365, Math.trunc(totalSessoes) || 1))
}

async function buscarProtocoloAtendimento(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
) {
  const { data, error } = await supabase
    .from('protocolos_atendimento')
    .select('id, total_sessoes')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return { error: error.message, data: null }
  }

  if (!data) {
    return { error: 'Protocolo nao encontrado.', data: null }
  }

  return { error: null, data }
}

async function validarQuantidadeItemNoProtocolo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  protocoloAtendimentoId: string,
  quantidade: number,
) {
  const protocolo = await buscarProtocoloAtendimento(supabase, protocoloAtendimentoId)
  if (protocolo.error || !protocolo.data) {
    return { error: protocolo.error ?? 'Protocolo nao encontrado.' }
  }

  if (quantidade > protocolo.data.total_sessoes) {
    return {
      error: `A quantidade do item nao pode ser maior que o total de sessoes do protocolo (${protocolo.data.total_sessoes}).`,
    }
  }

  return { error: null, protocolo: protocolo.data }
}

export async function listarProtocolosAtendimento(): Promise<ProtocoloAtendimento[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('protocolos_atendimento')
    .select('id, nome, ativo, ordem, total_sessoes, protocolo_atendimento_itens(id, tipo_consulta_id, quantidade, tipos_consulta(nome))')
    .order('ordem')
    .order('nome')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => mapRow(row))
}

export async function listarProtocolosAtendimentoAtivos(): Promise<ProtocoloAtendimento[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('protocolos_atendimento')
    .select('id, nome, ativo, ordem, total_sessoes, protocolo_atendimento_itens(id, tipo_consulta_id, quantidade, tipos_consulta(nome))')
    .eq('ativo', true)
    .order('ordem')
    .order('nome')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => mapRow(row))
}

export async function criarProtocoloAtendimento(nome: string, totalSessoes: number) {
  const supabase = await createClient()
  const nomeNormalizado = nome.trim()
  const totalSessoesNormalizado = normalizarTotalSessoes(totalSessoes)

  if (!nomeNormalizado) {
    return { error: 'Nome e obrigatorio.' }
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
    .insert({
      nome: nomeNormalizado,
      ativo: true,
      ordem: novaOrdem,
      total_sessoes: totalSessoesNormalizado,
    })

  if (error) {
    if (error.code === '23505') {
      return { error: 'Ja existe um protocolo com este nome.' }
    }
    return { error: error.message }
  }

  revalidarRotasRelacionadas()
  return { error: null }
}

export async function atualizarProtocoloAtendimento(id: string, nome: string, totalSessoes: number) {
  const supabase = await createClient()
  const nomeNormalizado = nome.trim()
  const totalSessoesNormalizado = normalizarTotalSessoes(totalSessoes)

  if (!nomeNormalizado) {
    return { error: 'Nome e obrigatorio.' }
  }

  const { data: itens, error: itensError } = await supabase
    .from('protocolo_atendimento_itens')
    .select('quantidade')
    .eq('protocolo_atendimento_id', id)

  if (itensError) {
    return { error: itensError.message }
  }

  const maiorQuantidade = Math.max(0, ...(itens ?? []).map((item) => item.quantidade))
  if (maiorQuantidade > totalSessoesNormalizado) {
    return {
      error: `O total de sessoes nao pode ser menor que a maior quantidade configurada nos itens (${maiorQuantidade}).`,
    }
  }

  const { error } = await supabase
    .from('protocolos_atendimento')
    .update({
      nome: nomeNormalizado,
      total_sessoes: totalSessoesNormalizado,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return { error: 'Ja existe um protocolo com este nome.' }
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
    return { error: 'Tipo de consulta e quantidade sao obrigatorios.' }
  }

  const validacao = await validarQuantidadeItemNoProtocolo(supabase, protocolo_atendimento_id, quantidade)
  if (validacao.error) {
    return { error: validacao.error }
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
    return { error: 'Tipo de consulta e quantidade sao obrigatorios.' }
  }

  const { data: itemAtual, error: itemAtualError } = await supabase
    .from('protocolo_atendimento_itens')
    .select('protocolo_atendimento_id')
    .eq('id', item_id)
    .maybeSingle()

  if (itemAtualError) {
    return { error: itemAtualError.message }
  }

  if (!itemAtual?.protocolo_atendimento_id) {
    return { error: 'Item do protocolo nao encontrado.' }
  }

  const validacao = await validarQuantidadeItemNoProtocolo(supabase, itemAtual.protocolo_atendimento_id, quantidade)
  if (validacao.error) {
    return { error: validacao.error }
  }

  const { error } = await supabase
    .from('protocolo_atendimento_itens')
    .update({ tipo_consulta_id, quantidade })
    .eq('id', item_id)

  if (error) return { error: error.message }

  revalidarRotasRelacionadas()
  return { error: null }
}
