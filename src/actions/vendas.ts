'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { FORMAS_PAGAMENTO, STATUS_VENDA } from '@/lib/vendas'
import { formatAppDateKey, getAppDayRangeUTC, parseAppDate } from '@/lib/datetime'

const USUARIO_AUTORIZADO_VENDA_ZERADA = '46581234-19dd-4e7d-904d-db0357fa2219'

interface ItemVendaForm {
  produto_id: string
  quantidade: number
  preco_unitario: number
  numero_atendimentos: number | null
}

function parseItensVenda(itensJson: string): { itens: ItemVendaForm[]; error: null } | { itens: null; error: string } {
  let parsed: unknown

  try {
    parsed = itensJson ? JSON.parse(itensJson) : []
  } catch {
    return { itens: null, error: 'Erro ao processar itens de venda.' }
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { itens: null, error: 'Adicione pelo menos um produto à venda.' }
  }

  const itens: ItemVendaForm[] = []

  for (const item of parsed) {
    if (!item || typeof item !== 'object') {
      return { itens: null, error: 'Todos os itens devem ter produto, quantidade e preço válidos.' }
    }

    const record = item as Record<string, unknown>
    const produtoId = typeof record.produto_id === 'string' ? record.produto_id : ''
    const quantidade = Number(record.quantidade)
    const precoUnitario = Number(record.preco_unitario)
    const numeroAtendimentosRaw = record.numero_atendimentos
    const numeroAtendimentos =
      numeroAtendimentosRaw === null ||
      numeroAtendimentosRaw === undefined ||
      numeroAtendimentosRaw === ''
        ? null
        : Number(numeroAtendimentosRaw)

    if (
      !produtoId ||
      !Number.isFinite(quantidade) ||
      quantidade < 1 ||
      !Number.isInteger(quantidade) ||
      !Number.isFinite(precoUnitario) ||
      precoUnitario < 0 ||
      (
        numeroAtendimentos !== null &&
        (
          !Number.isFinite(numeroAtendimentos) ||
          numeroAtendimentos < 1 ||
          !Number.isInteger(numeroAtendimentos)
        )
      )
    ) {
      return { itens: null, error: 'Todos os itens devem ter produto, quantidade e preço válidos.' }
    }

    itens.push({
      produto_id: produtoId,
      quantidade,
      preco_unitario: precoUnitario,
      numero_atendimentos: numeroAtendimentos,
    })
  }

  return { itens, error: null }
}

function somarTotaisPorVenda(
  itens: Array<{ venda_id: string; quantidade: number; preco_unitario: number }>
) {
  return itens.reduce<Record<string, number>>((acc, item) => {
    const subtotal = item.quantidade * item.preco_unitario
    acc[item.venda_id] = (acc[item.venda_id] || 0) + subtotal
    return acc
  }, {})
}

function formaPagamentoValida(value: string) {
  return FORMAS_PAGAMENTO.some((forma) => forma.value === value)
}

function statusValido(value: string) {
  return STATUS_VENDA.some((s) => s.value === value)
}

function isMissingColumnError(message: string | undefined, columns: string[]) {
  const normalized = (message || '').toLowerCase()
  return columns.some((column) => normalized.includes(column.toLowerCase()))
}

function normalizeVendaDate(value: string | null | undefined) {
  const dateKey = value?.trim() ? value.split('T')[0] : formatAppDateKey(new Date())
  return parseAppDate(dateKey).toISOString()
}

export async function criarVenda(_prevState: unknown, formData: FormData) {
  const supabase = await createClient()

  const paciente_id = formData.get('paciente_id') as string
  const profissional_id = formData.get('profissional_id') as string
  const origem = formData.get('origem') as string
  const forma_pagamento = formData.get('forma_pagamento') as string
  const medico_referenciador_id = origem === 'medico' ? (formData.get('medico_referenciador_id') as string) : null
  const data_venda = formData.get('data_venda') as string
  const observacoes = formData.get('observacoes') as string
  const nome = ((formData.get('nome') as string) || '').trim() || null
  const protocolo_id = ((formData.get('protocolo_id') as string) || '').trim() || null
  const protocolo_nome = ((formData.get('protocolo_nome') as string) || '').trim() || null
  const itensJson = formData.get('itens_venda_json') as string
  const statusRaw = (formData.get('status') as string) || 'venda_confirmada'
  const status = statusValido(statusRaw) ? statusRaw : 'venda_confirmada'

  if (!paciente_id || !profissional_id || !origem || !forma_pagamento) {
    return { error: 'Paciente, profissional, origem e forma de pagamento são obrigatórios.' }
  }

  if (!formaPagamentoValida(forma_pagamento)) {
    return { error: 'Forma de pagamento inválida.' }
  }

  if (origem === 'medico' && !medico_referenciador_id?.trim()) {
    return { error: 'Médico referenciador é obrigatório para origem "Médico".' }
  }

  let medico_referenciador_nome = null
  if (origem === 'medico' && medico_referenciador_id) {
    const { data: medico } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', medico_referenciador_id)
      .eq('role', 'medico')
      .single()

    if (!medico) {
      return { error: 'Médico referenciador não encontrado.' }
    }
    medico_referenciador_nome = medico.full_name
  }

  const itensResult = parseItensVenda(itensJson)
  if (!itensResult.itens) {
    return { error: itensResult.error }
  }
  const itens = itensResult.itens

  const total = itens.reduce((sum, item) => sum + item.quantidade * item.preco_unitario, 0)

  if (total >= 999999.99) {
    return { error: 'O valor da venda não pode ser maior ou igual a R$ 999.999,99.' }
  }

  if (total === 0 && status === 'venda_confirmada') {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (!user || userError) {
      return { error: 'Usuário não autenticado.' }
    }

    if (user.id !== USUARIO_AUTORIZADO_VENDA_ZERADA) {
      return { error: 'Apenas o usuário autorizado pode confirmar venda com valor zero.' }
    }

    const senhaConfirmacao = formData.get('senha_confirmacao') as string
    if (!senhaConfirmacao) {
      return { needsPasswordConfirmation: true }
    }

    const { error: senhaError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: senhaConfirmacao,
    })

    if (senhaError) {
      return { error: 'Senha incorreta.' }
    }
  }

  const dadosVenda = {
    paciente_id,
    profissional_id,
    origem,
    forma_pagamento,
    medico_referenciador_nome,
    data_venda: normalizeVendaDate(data_venda),
    observacoes: observacoes || null,
    nome,
    protocolo_id,
    protocolo_nome,
    status,
  }

  // Inserir venda
  let vendaInserida: { id: string } | null = null
  let erroVenda: { message?: string } | null = null

  const tentativaComProtocolo = await supabase
    .from('vendas')
    .insert(dadosVenda)
    .select('id')
    .single()

  vendaInserida = tentativaComProtocolo.data
  erroVenda = tentativaComProtocolo.error

  if (erroVenda && isMissingColumnError(erroVenda.message, ['protocolo_id', 'protocolo_nome'])) {
    const { protocolo_id, protocolo_nome, ...dadosSemProtocolo } = dadosVenda
    void protocolo_id
    void protocolo_nome
    const tentativaSemProtocolo = await supabase
      .from('vendas')
      .insert(dadosSemProtocolo)
      .select('id')
      .single()

    vendaInserida = tentativaSemProtocolo.data
    erroVenda = tentativaSemProtocolo.error
  }

  if (erroVenda || !vendaInserida) {
    return { error: `Erro ao criar venda: ${erroVenda?.message || 'desconhecido'}` }
  }

  // Inserir itens de venda
  const itensComVendaId = itens.map((item) => ({
    venda_id: vendaInserida.id,
    produto_id: item.produto_id,
    quantidade: item.quantidade || 1,
    preco_unitario: item.preco_unitario,
    numero_atendimentos: item.numero_atendimentos,
  }))

  const { error: erroItens } = await supabase
    .from('itens_venda')
    .insert(itensComVendaId)

  if (erroItens) {
    // Deletar venda se falhar inserir itens
    await supabase.from('vendas').delete().eq('id', vendaInserida.id)
    return { error: `Erro ao adicionar itens: ${erroItens.message}` }
  }

  revalidatePath('/vendas')
  redirect(`/vendas/${vendaInserida.id}`)
}

export async function editarVenda(_prevState: unknown, formData: FormData) {
  const supabase = await createClient()

  const id = formData.get('id') as string
  const paciente_id = formData.get('paciente_id') as string
  const origem = formData.get('origem') as string
  const forma_pagamento = formData.get('forma_pagamento') as string
  const medico_referenciador_id = origem === 'medico' ? (formData.get('medico_referenciador_id') as string) : null
  const data_venda = formData.get('data_venda') as string
  const observacoes = formData.get('observacoes') as string
  const nome = ((formData.get('nome') as string) || '').trim() || null
  const protocolo_id = ((formData.get('protocolo_id') as string) || '').trim() || null
  const protocolo_nome = ((formData.get('protocolo_nome') as string) || '').trim() || null
  const itensJson = formData.get('itens_venda_json') as string
  const statusRaw = (formData.get('status') as string) || 'venda_confirmada'
  const status = statusValido(statusRaw) ? statusRaw : 'venda_confirmada'

  if (!paciente_id || !origem || !forma_pagamento) {
    return { error: 'Paciente, origem e forma de pagamento são obrigatórios.' }
  }

  if (!formaPagamentoValida(forma_pagamento)) {
    return { error: 'Forma de pagamento inválida.' }
  }

  if (origem === 'medico' && !medico_referenciador_id?.trim()) {
    return { error: 'Médico referenciador é obrigatório para origem "Médico".' }
  }

  let medico_referenciador_nome = null
  if (origem === 'medico' && medico_referenciador_id) {
    const { data: medico } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', medico_referenciador_id)
      .eq('role', 'medico')
      .single()

    if (!medico) {
      return { error: 'Médico referenciador não encontrado.' }
    }
    medico_referenciador_nome = medico.full_name
  }

  const itensResult = parseItensVenda(itensJson)
  if (!itensResult.itens) {
    return { error: itensResult.error }
  }
  const itens = itensResult.itens

  const total = itens.reduce((sum, item) => sum + item.quantidade * item.preco_unitario, 0)

  if (total >= 999999.99) {
    return { error: 'O valor da venda não pode ser maior ou igual a R$ 999.999,99.' }
  }

  if (total === 0 && status === 'venda_confirmada') {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (!user || userError) {
      return { error: 'Usuário não autenticado.' }
    }

    if (user.id !== USUARIO_AUTORIZADO_VENDA_ZERADA) {
      return { error: 'Apenas o usuário autorizado pode confirmar venda com valor zero.' }
    }

    const senhaConfirmacao = formData.get('senha_confirmacao') as string
    if (!senhaConfirmacao) {
      return { needsPasswordConfirmation: true }
    }

    const { error: senhaError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: senhaConfirmacao,
    })

    if (senhaError) {
      return { error: 'Senha incorreta.' }
    }
  }

  const dadosVenda = {
    paciente_id,
    origem,
    forma_pagamento,
    medico_referenciador_nome,
    data_venda: normalizeVendaDate(data_venda),
    observacoes: observacoes || null,
    nome,
    protocolo_id,
    protocolo_nome,
    status,
    atualizado_em: new Date().toISOString(),
  }

  // Atualizar venda
  let erroVenda: { message?: string } | null = null

  const tentativaComProtocolo = await supabase
    .from('vendas')
    .update(dadosVenda)
    .eq('id', id)

  erroVenda = tentativaComProtocolo.error

  if (erroVenda && isMissingColumnError(erroVenda.message, ['protocolo_id', 'protocolo_nome'])) {
    const { protocolo_id, protocolo_nome, ...dadosSemProtocolo } = dadosVenda
    void protocolo_id
    void protocolo_nome
    const tentativaSemProtocolo = await supabase
      .from('vendas')
      .update(dadosSemProtocolo)
      .eq('id', id)

    erroVenda = tentativaSemProtocolo.error
  }

  if (erroVenda) {
    return { error: `Erro ao editar venda: ${erroVenda.message}` }
  }

  // Deletar itens antigos
  await supabase.from('itens_venda').delete().eq('venda_id', id)

  // Inserir novos itens
  const itensComVendaId = itens.map((item) => ({
    venda_id: id,
    produto_id: item.produto_id,
    quantidade: item.quantidade || 1,
    preco_unitario: item.preco_unitario,
    numero_atendimentos: item.numero_atendimentos,
  }))

  const { error: erroItens } = await supabase
    .from('itens_venda')
    .insert(itensComVendaId)

  if (erroItens) {
    return { error: `Erro ao atualizar itens: ${erroItens.message}` }
  }

  revalidatePath('/vendas')
  redirect(`/vendas/${id}`)
}

export async function deletarVenda(id: string) {
  const supabase = await createClient()

  // Deletar venda (cascata: itens_venda também serão deletados)
  const { error } = await supabase
    .from('vendas')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: `Erro ao deletar venda: ${error.message}` }
  }

  revalidatePath('/vendas')
  return { success: true }
}

interface FiltrosVendas {
  origem?: string
  forma_pagamento?: string
  paciente_id?: string
  profissional_id?: string
  data_inicio?: string
  data_fim?: string
  status?: string
  offset?: number
  limit?: number
}

export async function listarVendas(filtros: FiltrosVendas = {}) {
  const supabase = await createClient()

  const {
    origem,
    forma_pagamento,
    paciente_id,
    profissional_id,
    data_inicio,
    data_fim,
    status,
    offset = 0,
    limit = 20,
  } = filtros

  let query = supabase
    .from('vendas')
    .select(
      `
      id,
      paciente_id,
      pacientes(nome),
      profissional_id,
      profiles(nome),
      origem,
      forma_pagamento,
      medico_referenciador_nome,
      data_venda,
      observacoes,
      status,
      criado_em,
      atualizado_em
    `,
      { count: 'exact' }
    )
    .order('data_venda', { ascending: false })
    .range(offset, offset + limit - 1)

  if (origem) {
    query = query.eq('origem', origem)
  }

  if (forma_pagamento) {
    query = query.eq('forma_pagamento', forma_pagamento)
  }

  if (paciente_id) {
    query = query.eq('paciente_id', paciente_id)
  }

  if (profissional_id) {
    query = query.eq('profissional_id', profissional_id)
  }

  if (data_inicio) {
    query = query.gte('data_venda', getAppDayRangeUTC(data_inicio).start)
  }

  if (data_fim) {
    query = query.lte('data_venda', getAppDayRangeUTC(data_fim).end)
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error, count } = await query

  if (error) {
    return { error: `Erro ao listar vendas: ${error.message}`, vendas: [], total: 0 }
  }

  const idsVendas = (data || []).map((venda) => venda.id)
  let totaisPorVenda: Record<string, number> = {}

  if (idsVendas.length > 0) {
    const { data: itens, error: itensError } = await supabase
      .from('itens_venda')
      .select('venda_id, quantidade, preco_unitario')
      .in('venda_id', idsVendas)

    if (itensError) {
      return { error: `Erro ao listar itens das vendas: ${itensError.message}`, vendas: [], total: 0 }
    }

    totaisPorVenda = somarTotaisPorVenda(itens || [])
  }

  const vendas = (data || []).map((venda) => ({
    ...venda,
    total: totaisPorVenda[venda.id] || 0,
  }))

  return { vendas, total: count || 0, error: null }
}

export async function atualizarStatusVenda(id: string, novoStatus: string) {
  if (!statusValido(novoStatus)) {
    return { error: 'Status inválido.' }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('vendas')
    .update({ status: novoStatus, atualizado_em: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return { error: `Erro ao atualizar status: ${error.message}` }
  }

  revalidatePath('/vendas')
  revalidatePath(`/vendas/${id}`)
  return { success: true }
}

interface FiltrosRelatorio {
  data_inicio?: string
  data_fim?: string
  origem?: string
  forma_pagamento?: string
}

export async function gerarRelatorioVendas(filtros: FiltrosRelatorio = {}) {
  const supabase = await createClient()

  const { data_inicio, data_fim, origem, forma_pagamento } = filtros

  let query = supabase
    .from('vendas')
    .select('id, origem, forma_pagamento, data_venda')

  if (data_inicio) {
    query = query.gte('data_venda', getAppDayRangeUTC(data_inicio).start)
  }

  if (data_fim) {
    query = query.lte('data_venda', getAppDayRangeUTC(data_fim).end)
  }

  if (origem) {
    query = query.eq('origem', origem)
  }

  if (forma_pagamento) {
    query = query.eq('forma_pagamento', forma_pagamento)
  }

  const { data: vendas, error } = await query

  if (error) {
    return { error: `Erro ao gerar relatório: ${error.message}`, relatorio: null }
  }

  const idsVendas = (vendas || []).map((venda) => venda.id)
  let totaisPorVenda: Record<string, number> = {}

  if (idsVendas.length > 0) {
    const { data: itens, error: itensError } = await supabase
      .from('itens_venda')
      .select('venda_id, quantidade, preco_unitario')
      .in('venda_id', idsVendas)

    if (itensError) {
      return { error: `Erro ao gerar relatório: ${itensError.message}`, relatorio: null }
    }

    totaisPorVenda = somarTotaisPorVenda(itens || [])
  }

  const vendasComTotais = (vendas || []).map((venda) => ({
    id: venda.id,
    origem: venda.origem,
    forma_pagamento: venda.forma_pagamento,
    data_venda: venda.data_venda,
    total: totaisPorVenda[venda.id] || 0,
  }))

  // Agregações
  const totalFaturado = vendasComTotais.reduce((sum, v) => sum + v.total, 0)
  const totalVendas = vendasComTotais.length
  const vendaMedia = totalVendas > 0 ? totalFaturado / totalVendas : 0

  // Por origem
  const porOrigem: Record<string, { quantidade: number; faturamento: number }> = {}
  const porFormaPagamento: Record<string, { quantidade: number; faturamento: number }> = {}
  vendasComTotais.forEach((venda) => {
    if (!porOrigem[venda.origem]) {
      porOrigem[venda.origem] = { quantidade: 0, faturamento: 0 }
    }
    porOrigem[venda.origem].quantidade += 1
    porOrigem[venda.origem].faturamento += venda.total

    if (!porFormaPagamento[venda.forma_pagamento]) {
      porFormaPagamento[venda.forma_pagamento] = { quantidade: 0, faturamento: 0 }
    }
    porFormaPagamento[venda.forma_pagamento].quantidade += 1
    porFormaPagamento[venda.forma_pagamento].faturamento += venda.total
  })

  // Por período (últimos 90 dias)
  const agora = new Date()
  const dias90 = new Date(agora.getTime() - 90 * 24 * 60 * 60 * 1000)

  const porPeriodo: Record<string, number> = {}
  vendasComTotais.forEach((venda) => {
    if (new Date(venda.data_venda) >= dias90) {
      const data = formatAppDateKey(venda.data_venda)
      if (!porPeriodo[data]) {
        porPeriodo[data] = 0
      }
      porPeriodo[data] += venda.total
    }
  })

  return {
    relatorio: {
      kpis: {
        totalFaturado,
        totalVendas,
        vendaMedia,
      },
      porOrigem,
      porFormaPagamento,
      porPeriodo,
    },
    error: null,
  }
}
