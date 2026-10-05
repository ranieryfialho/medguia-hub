'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { STATUS_VENDA, TIPO_VENDA } from '@/lib/vendas'
import {
  MAX_COMPROVANTES_VENDA,
  extensaoDoNome,
  parseComprovantesJson,
  parseComprovantesVenda,
  serializarComprovantes,
  type ComprovanteVenda,
} from '@/lib/comprovantes-venda'
import {
  parsePagamentosJson,
  resumoFormaPagamento,
  serializarPagamentos,
  validarPagamentos,
} from '@/lib/pagamentos-venda'
import { sincronizarTagContratoVenda } from '@/lib/venda-tags-sistema'
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

function statusValido(value: string) {
  return STATUS_VENDA.some((s) => s.value === value)
}

function tipoVendaValido(value: string) {
  return TIPO_VENDA.some((t) => t.value === value)
}

// Lê a lista de comprovantes do formulário. `comprovantes_pagamento_json` é o
// formato atual (múltiplos arquivos); os campos únicos continuam sendo aceitos
// para não quebrar formulários que ainda não foram atualizados.
function lerComprovantesDoFormData(formData: FormData): ComprovanteVenda[] {
  const lista = parseComprovantesJson(formData.get('comprovantes_pagamento_json') as string | null)
  if (lista.length > 0) return lista

  const fileId = ((formData.get('comprovante_pagamento_file_id') as string) || '').trim()
  if (!fileId) return []

  const nome = ((formData.get('comprovante_pagamento_nome') as string) || '').trim() || 'Comprovante'

  return [{
    fileId,
    fileUrl: ((formData.get('comprovante_pagamento_url') as string) || '').trim() || null,
    nome,
    extensao: extensaoDoNome(nome),
  }]
}

const COLUNAS_COMPROVANTE = [
  'comprovantes_pagamento',
  'comprovante_pagamento_google_drive_file_id',
  'comprovante_pagamento_google_drive_file_url',
  'comprovante_pagamento_nome',
]

const COLUNAS_COMPROVANTE_LEGADO = COLUNAS_COMPROVANTE.slice(1)

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

// Lê os comprovantes já anexados à venda, com fallback nas colunas escalares
// para ambientes onde a migração do JSONB ainda não rodou.
async function lerComprovantesAtuais(supabase: SupabaseServerClient, id: string): Promise<ComprovanteVenda[]> {
  const comLista = await supabase
    .from('vendas')
    .select(COLUNAS_COMPROVANTE.join(', '))
    .eq('id', id)
    .maybeSingle()

  if (!comLista.error) {
    return parseComprovantesVenda(comLista.data as VendaComprovantesRow | null)
  }

  const legado = await supabase
    .from('vendas')
    .select(COLUNAS_COMPROVANTE_LEGADO.join(', '))
    .eq('id', id)
    .maybeSingle()

  return parseComprovantesVenda(legado.data as VendaComprovantesRow | null)
}

interface VendaComprovantesRow {
  comprovantes_pagamento?: unknown
  comprovante_pagamento_google_drive_file_id?: string | null
  comprovante_pagamento_google_drive_file_url?: string | null
  comprovante_pagamento_nome?: string | null
}

// As colunas escalares espelham o primeiro comprovante — é delas que a listagem
// e os relatórios ainda leem.
function camposComprovantes(comprovantes: ComprovanteVenda[]) {
  const primeiro = comprovantes[0] ?? null
  return {
    comprovantes_pagamento: comprovantes.length > 0 ? serializarComprovantes(comprovantes) : null,
    comprovante_pagamento_google_drive_file_id: primeiro?.fileId ?? null,
    comprovante_pagamento_google_drive_file_url: primeiro?.fileUrl ?? null,
    comprovante_pagamento_nome: primeiro?.nome ?? null,
  }
}

function isMissingColumnError(message: string | undefined, columns: string[]) {
  const normalized = (message || '').toLowerCase()
  return columns.some((column) => normalized.includes(column.toLowerCase()))
}

function normalizeVendaDate(value: string | null | undefined) {
  const dateKey = value?.trim() ? value.split('T')[0] : formatAppDateKey(new Date())
  return parseAppDate(dateKey).toISOString()
}

// @spec:AC-063 @spec:AC-064 — defesa em profundidade: origem diferente de
// 'medico' sempre grava NULL, mesmo que o formulário envie outro valor.
// O CHECK do banco (vendas_consultorio_apenas_origem_medico) é a garantia real.
export async function resolverVendaEmConsultorio(origem: string, formData: FormData): Promise<boolean | null> {
  if (origem !== 'medico') {
    return null
  }

  const raw = formData.get('venda_em_consultorio')
  if (raw === 'true') return true
  if (raw === 'false') return false
  return null
}

export async function isCheckConstraintError(message: string | undefined): Promise<boolean> {
  const normalized = (message || '').toLowerCase()
  return normalized.includes('vendas_consultorio_apenas_origem_medico')
}

export async function criarVenda(_prevState: unknown, formData: FormData) {
  const supabase = await createClient()

  const paciente_id = formData.get('paciente_id') as string
  const profissional_id = formData.get('profissional_id') as string
  const origem = formData.get('origem') as string
  const pagamentosJson = formData.get('pagamentos_venda_json') as string
  const medico_referenciador_id = origem === 'medico' ? (formData.get('medico_referenciador_id') as string) : null
  const data_venda = formData.get('data_venda') as string
  const observacoes = formData.get('observacoes') as string
  const nome = ((formData.get('nome') as string) || '').trim() || null
  const protocolo_id = ((formData.get('protocolo_id') as string) || '').trim() || null
  const protocolo_nome = ((formData.get('protocolo_nome') as string) || '').trim() || null
  const itensJson = formData.get('itens_venda_json') as string
  const statusRaw = (formData.get('status') as string) || 'venda_confirmada'
  const status = statusValido(statusRaw) ? statusRaw : 'venda_confirmada'
  const objecao_motivo_id = ((formData.get('objecao_motivo_id') as string) || '').trim() || null
  const objecao_motivo_nome = ((formData.get('objecao_motivo_nome') as string) || '').trim() || null
  const objecao_observacao = ((formData.get('objecao_observacao') as string) || '').trim() || null
  const tipo_venda = ((formData.get('tipo_venda') as string) || '').trim() || null
  const comprovantes = lerComprovantesDoFormData(formData)
  const pagamentos = parsePagamentosJson(pagamentosJson)

  if (!paciente_id || !origem || pagamentos.length === 0) {
    return { error: 'Paciente, origem e forma de pagamento são obrigatórios.' }
  }

  if (!tipo_venda || !tipoVendaValido(tipo_venda)) {
    return { error: 'Tipo de venda (Fisioterápica ou Médica) é obrigatório.' }
  }

  if (status === 'venda_confirmada' && comprovantes.length === 0) {
    return { error: 'Comprovante de pagamento é obrigatório para vendas confirmadas.' }
  }

  if (comprovantes.length > MAX_COMPROVANTES_VENDA) {
    return { error: `Máximo de ${MAX_COMPROVANTES_VENDA} comprovantes por venda.` }
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

  const erroPagamentos = validarPagamentos(pagamentos, total, {
    exigirSoma: status === 'venda_confirmada' && total > 0,
    exigirValorPositivo: total > 0,
  })
  if (erroPagamentos) {
    return { error: erroPagamentos }
  }
  const forma_pagamento = resumoFormaPagamento(pagamentos)

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

  const venda_em_consultorio = await resolverVendaEmConsultorio(origem, formData)

  // Defesa em profundidade: objeção só faz sentido para orçamento pendente,
  // mesmo que o client tenha mandado algo (ex.: usuário trocou o tipo de
  // registro depois de passar pelo modal de objeção).
  const dadosVenda = {
    paciente_id,
    profissional_id: profissional_id || null,
    origem,
    forma_pagamento,
    medico_referenciador_nome,
    venda_em_consultorio,
    data_venda: normalizeVendaDate(data_venda),
    observacoes: observacoes || null,
    nome,
    protocolo_id,
    protocolo_nome,
    status,
    objecao_motivo_id: status === 'orcamento_pendente' ? objecao_motivo_id : null,
    objecao_motivo_nome: status === 'orcamento_pendente' ? objecao_motivo_nome : null,
    objecao_observacao: status === 'orcamento_pendente' ? objecao_observacao : null,
    tipo_venda,
    ...camposComprovantes(comprovantes),
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

  if (erroVenda && isMissingColumnError(erroVenda.message, ['objecao_motivo_id', 'objecao_motivo_nome', 'objecao_observacao'])) {
    const { objecao_motivo_id, objecao_motivo_nome, objecao_observacao, ...dadosSemObjecao } = dadosVenda
    void objecao_motivo_id
    void objecao_motivo_nome
    void objecao_observacao
    const tentativaSemObjecao = await supabase
      .from('vendas')
      .insert(dadosSemObjecao)
      .select('id')
      .single()

    vendaInserida = tentativaSemObjecao.data
    erroVenda = tentativaSemObjecao.error
  }

  // Ambiente sem a migração de múltiplos comprovantes: grava só o primeiro,
  // nas colunas escalares antigas.
  if (erroVenda && isMissingColumnError(erroVenda.message, ['comprovantes_pagamento'])) {
    const { comprovantes_pagamento, ...dadosSemLista } = dadosVenda
    void comprovantes_pagamento
    const tentativaSemLista = await supabase
      .from('vendas')
      .insert(dadosSemLista)
      .select('id')
      .single()

    vendaInserida = tentativaSemLista.data
    erroVenda = tentativaSemLista.error
  }

  if (erroVenda && isMissingColumnError(erroVenda.message, ['tipo_venda', ...COLUNAS_COMPROVANTE])) {
    const {
      tipo_venda, comprovantes_pagamento, comprovante_pagamento_google_drive_file_id,
      comprovante_pagamento_google_drive_file_url, comprovante_pagamento_nome,
      ...dadosSemComprovante
    } = dadosVenda
    void tipo_venda
    void comprovantes_pagamento
    void comprovante_pagamento_google_drive_file_id
    void comprovante_pagamento_google_drive_file_url
    void comprovante_pagamento_nome
    const tentativaSemComprovante = await supabase
      .from('vendas')
      .insert(dadosSemComprovante)
      .select('id')
      .single()

    vendaInserida = tentativaSemComprovante.data
    erroVenda = tentativaSemComprovante.error
  }

  if (erroVenda && (await isCheckConstraintError(erroVenda.message))) {
    return { error: 'Venda em consultório só pode ser marcada para origem "Médico".' }
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

  const pagamentosComVendaId = serializarPagamentos(pagamentos).map((pagamento) => ({
    venda_id: vendaInserida.id,
    ...pagamento,
  }))

  const { error: erroPagamentosInsert } = await supabase
    .from('pagamentos_venda')
    .insert(pagamentosComVendaId)

  if (erroPagamentosInsert) {
    // Deletar venda se falhar inserir pagamentos (cascata remove os itens já inseridos)
    await supabase.from('vendas').delete().eq('id', vendaInserida.id)
    return { error: `Erro ao adicionar pagamentos: ${erroPagamentosInsert.message}` }
  }

  const { data: { user: usuarioCriador } } = await supabase.auth.getUser()
  await sincronizarTagContratoVenda(supabase, vendaInserida.id, usuarioCriador?.id)

  revalidatePath('/vendas')
  redirect(`/vendas/${vendaInserida.id}`)
}

export async function editarVenda(_prevState: unknown, formData: FormData) {
  const supabase = await createClient()

  const id = formData.get('id') as string
  const paciente_id = formData.get('paciente_id') as string
  const origem = formData.get('origem') as string
  const pagamentosJson = formData.get('pagamentos_venda_json') as string
  const medico_referenciador_id = origem === 'medico' ? (formData.get('medico_referenciador_id') as string) : null
  const data_venda = formData.get('data_venda') as string
  const observacoes = formData.get('observacoes') as string
  const nome = ((formData.get('nome') as string) || '').trim() || null
  const protocolo_id = ((formData.get('protocolo_id') as string) || '').trim() || null
  const protocolo_nome = ((formData.get('protocolo_nome') as string) || '').trim() || null
  const itensJson = formData.get('itens_venda_json') as string
  const statusRaw = (formData.get('status') as string) || 'venda_confirmada'
  const status = statusValido(statusRaw) ? statusRaw : 'venda_confirmada'
  const tipo_venda = ((formData.get('tipo_venda') as string) || '').trim() || null
  const comprovantes = lerComprovantesDoFormData(formData)
  const pagamentos = parsePagamentosJson(pagamentosJson)

  if (!paciente_id || !origem || pagamentos.length === 0) {
    return { error: 'Paciente, origem e forma de pagamento são obrigatórios.' }
  }

  if (!tipo_venda || !tipoVendaValido(tipo_venda)) {
    return { error: 'Tipo de venda (Fisioterápica ou Médica) é obrigatório.' }
  }

  if (status === 'venda_confirmada' && comprovantes.length === 0) {
    return { error: 'Comprovante de pagamento é obrigatório para vendas confirmadas.' }
  }

  if (comprovantes.length > MAX_COMPROVANTES_VENDA) {
    return { error: `Máximo de ${MAX_COMPROVANTES_VENDA} comprovantes por venda.` }
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

  const erroPagamentos = validarPagamentos(pagamentos, total, {
    exigirSoma: status === 'venda_confirmada' && total > 0,
    exigirValorPositivo: total > 0,
  })
  if (erroPagamentos) {
    return { error: erroPagamentos }
  }
  const forma_pagamento = resumoFormaPagamento(pagamentos)

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

  const venda_em_consultorio = await resolverVendaEmConsultorio(origem, formData)

  const dadosVenda = {
    paciente_id,
    origem,
    forma_pagamento,
    medico_referenciador_nome,
    venda_em_consultorio,
    data_venda: normalizeVendaDate(data_venda),
    observacoes: observacoes || null,
    nome,
    protocolo_id,
    protocolo_nome,
    status,
    tipo_venda,
    ...camposComprovantes(comprovantes),
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

  // Ambiente sem a migração de múltiplos comprovantes: grava só o primeiro,
  // nas colunas escalares antigas.
  if (erroVenda && isMissingColumnError(erroVenda.message, ['comprovantes_pagamento'])) {
    const { comprovantes_pagamento, ...dadosSemLista } = dadosVenda
    void comprovantes_pagamento
    const tentativaSemLista = await supabase
      .from('vendas')
      .update(dadosSemLista)
      .eq('id', id)

    erroVenda = tentativaSemLista.error
  }

  if (erroVenda && isMissingColumnError(erroVenda.message, ['tipo_venda', ...COLUNAS_COMPROVANTE])) {
    const {
      tipo_venda, comprovantes_pagamento, comprovante_pagamento_google_drive_file_id,
      comprovante_pagamento_google_drive_file_url, comprovante_pagamento_nome,
      ...dadosSemComprovante
    } = dadosVenda
    void tipo_venda
    void comprovantes_pagamento
    void comprovante_pagamento_google_drive_file_id
    void comprovante_pagamento_google_drive_file_url
    void comprovante_pagamento_nome
    const tentativaSemComprovante = await supabase
      .from('vendas')
      .update(dadosSemComprovante)
      .eq('id', id)

    erroVenda = tentativaSemComprovante.error
  }

  if (erroVenda && (await isCheckConstraintError(erroVenda.message))) {
    return { error: 'Venda em consultório só pode ser marcada para origem "Médico".' }
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

  // Deletar pagamentos antigos e inserir os novos
  await supabase.from('pagamentos_venda').delete().eq('venda_id', id)

  const pagamentosComVendaId = serializarPagamentos(pagamentos).map((pagamento) => ({
    venda_id: id,
    ...pagamento,
  }))

  const { error: erroPagamentosUpdate } = await supabase
    .from('pagamentos_venda')
    .insert(pagamentosComVendaId)

  if (erroPagamentosUpdate) {
    return { error: `Erro ao atualizar pagamentos: ${erroPagamentosUpdate.message}` }
  }

  // O status pode ter mudado (ex.: orçamento virou venda na edição).
  await sincronizarTagContratoVenda(supabase, id)

  revalidatePath('/vendas')
  redirect(`/vendas/${id}`)
}

export async function deletarVenda(id: string) {
  const supabase = await createClient()

  // Deletar venda (cascata: itens_venda e pagamentos_venda também serão deletados)
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

  // Uma venda híbrida com uma perna em "pix" precisa aparecer no filtro
  // "pix" mesmo com resumo 'hibrido' em vendas.forma_pagamento — por isso o
  // filtro passa por pagamentos_venda em vez de um .eq() direto em vendas.
  let vendaIdsComFormaPagamento: string[] | null = null
  if (forma_pagamento) {
    const { data: pagamentosComForma } = await supabase
      .from('pagamentos_venda')
      .select('venda_id')
      .eq('forma_pagamento', forma_pagamento)

    vendaIdsComFormaPagamento = [...new Set((pagamentosComForma || []).map((p) => p.venda_id))]
  }

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

  if (vendaIdsComFormaPagamento !== null) {
    query = vendaIdsComFormaPagamento.length > 0
      ? query.in('id', vendaIdsComFormaPagamento)
      : query.in('id', ['00000000-0000-0000-0000-000000000000'])
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

interface ComprovanteVendaInput {
  fileId: string
  fileUrl: string | null
  nome: string | null
}

export async function atualizarStatusVenda(
  id: string,
  novoStatus: string,
  motivoRecusa?: string,
  novosComprovantes?: ComprovanteVendaInput[],
) {
  if (!statusValido(novoStatus)) {
    return { error: 'Status inválido.' }
  }

  const supabase = await createClient()

  // Confirmar um orçamento vira uma venda_confirmada, e essa transição não
  // passa pelo formulário de edição — então a soma dos pagamentos (que um
  // orçamento pode ter deixado incompleta, de propósito) precisa ser
  // validada aqui antes de aceitar a confirmação.
  if (novoStatus === 'venda_confirmada') {
    const [{ data: itens }, { data: pagamentos }] = await Promise.all([
      supabase.from('itens_venda').select('quantidade, preco_unitario').eq('venda_id', id),
      supabase.from('pagamentos_venda').select('valor').eq('venda_id', id),
    ])

    const total = (itens || []).reduce((sum, item) => sum + item.quantidade * item.preco_unitario, 0)
    const somaPagamentos = (pagamentos || []).reduce((sum, p) => sum + p.valor, 0)

    if (total > 0 && Math.abs(somaPagamentos - total) > 0.01) {
      return {
        error: `A soma dos pagamentos (R$ ${somaPagamentos.toFixed(2)}) não bate com o total da venda (R$ ${total.toFixed(2)}). Edite a venda para ajustar a forma de pagamento antes de confirmar.`,
      }
    }
  }

  const anexados: ComprovanteVenda[] = (novosComprovantes ?? [])
    .filter((c) => c?.fileId?.trim())
    .map((c) => {
      const nome = c.nome?.trim() || 'Comprovante'
      return {
        fileId: c.fileId.trim(),
        fileUrl: c.fileUrl?.trim() || null,
        nome,
        extensao: extensaoDoNome(nome),
      }
    })

  if (anexados.length > MAX_COMPROVANTES_VENDA) {
    return { error: `Máximo de ${MAX_COMPROVANTES_VENDA} comprovantes por venda.` }
  }

  const campos: Record<string, unknown> = {
    status: novoStatus,
    atualizado_em: new Date().toISOString(),
    motivo_recusa: novoStatus === 'orcamento_recusado' ? (motivoRecusa?.trim() || null) : null,
  }

  // Os novos comprovantes são acrescentados aos que a venda já tem, nunca
  // substituem — por isso a leitura do estado atual antes do update.
  if (anexados.length > 0 || novoStatus === 'venda_confirmada') {
    const atuais = await lerComprovantesAtuais(supabase, id)

    const idsAtuais = new Set(atuais.map((c) => c.fileId))
    const lista = [...atuais, ...anexados.filter((c) => !idsAtuais.has(c.fileId))]
      .slice(0, MAX_COMPROVANTES_VENDA)

    if (novoStatus === 'venda_confirmada' && lista.length === 0) {
      return {
        error: 'Comprovante de pagamento é obrigatório para confirmar a venda.',
        needsComprovante: true,
      }
    }

    if (anexados.length > 0) {
      Object.assign(campos, camposComprovantes(lista))
    }
  }

  let { error } = await supabase
    .from('vendas')
    .update(campos)
    .eq('id', id)

  if (error && isMissingColumnError(error.message, ['comprovantes_pagamento'])) {
    const { comprovantes_pagamento, ...camposSemLista } = campos
    void comprovantes_pagamento
    error = (await supabase.from('vendas').update(camposSemLista).eq('id', id)).error
  }

  if (error) {
    return { error: `Erro ao atualizar status: ${error.message}` }
  }

  await sincronizarTagContratoVenda(supabase, id)

  revalidatePath('/vendas')
  revalidatePath(`/vendas/${id}`)
  return { success: true }
}

// Baixa um pagamento pendente (sinal + resto combinado para depois): marca
// como recebido e registra quando. Não mexe no total da venda — o valor já
// contava para o total desde que a venda foi criada, só a situação muda.
export async function marcarPagamentoRecebido(pagamentoId: string, vendaId: string) {
  const supabase = await createClient()

  const { data: pagamento, error: erroBusca } = await supabase
    .from('pagamentos_venda')
    .select('id, status')
    .eq('id', pagamentoId)
    .maybeSingle()

  if (erroBusca || !pagamento) {
    return { error: 'Pagamento não encontrado.' }
  }

  if (pagamento.status !== 'pendente') {
    return { error: 'Este pagamento já está marcado como recebido.' }
  }

  const { error } = await supabase
    .from('pagamentos_venda')
    .update({ status: 'pago', pago_em: new Date().toISOString() })
    .eq('id', pagamentoId)

  if (error) {
    return { error: `Erro ao marcar pagamento como recebido: ${error.message}` }
  }

  revalidatePath(`/vendas/${vendaId}`)
  revalidatePath('/vendas')
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

  // Uma venda híbrida com uma perna em "pix" precisa aparecer no filtro
  // "pix" mesmo com resumo 'hibrido' em vendas.forma_pagamento — por isso o
  // filtro passa por pagamentos_venda em vez de um .eq() direto em vendas.
  let vendaIdsComFormaPagamento: string[] | null = null
  if (forma_pagamento) {
    const { data: pagamentosComForma } = await supabase
      .from('pagamentos_venda')
      .select('venda_id')
      .eq('forma_pagamento', forma_pagamento)

    vendaIdsComFormaPagamento = [...new Set((pagamentosComForma || []).map((p) => p.venda_id))]
  }

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

  if (vendaIdsComFormaPagamento !== null) {
    query = vendaIdsComFormaPagamento.length > 0
      ? query.in('id', vendaIdsComFormaPagamento)
      : query.in('id', ['00000000-0000-0000-0000-000000000000'])
  }

  const { data: vendas, error } = await query

  if (error) {
    return { error: `Erro ao gerar relatório: ${error.message}`, relatorio: null }
  }

  const idsVendas = (vendas || []).map((venda) => venda.id)
  let totaisPorVenda: Record<string, number> = {}
  let pagamentosPorVenda: Record<string, { forma_pagamento: string; valor: number }[]> = {}

  if (idsVendas.length > 0) {
    const [{ data: itens, error: itensError }, { data: pagamentos, error: pagamentosError }] = await Promise.all([
      supabase
        .from('itens_venda')
        .select('venda_id, quantidade, preco_unitario')
        .in('venda_id', idsVendas),
      supabase
        .from('pagamentos_venda')
        .select('venda_id, forma_pagamento, valor')
        .in('venda_id', idsVendas),
    ])

    if (itensError) {
      return { error: `Erro ao gerar relatório: ${itensError.message}`, relatorio: null }
    }
    if (pagamentosError) {
      return { error: `Erro ao gerar relatório: ${pagamentosError.message}`, relatorio: null }
    }

    totaisPorVenda = somarTotaisPorVenda(itens || [])
    pagamentosPorVenda = (pagamentos || []).reduce<Record<string, { forma_pagamento: string; valor: number }[]>>(
      (acc, p) => {
        (acc[p.venda_id] ||= []).push({ forma_pagamento: p.forma_pagamento, valor: p.valor })
        return acc
      },
      {}
    )
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
  vendasComTotais.forEach((venda) => {
    if (!porOrigem[venda.origem]) {
      porOrigem[venda.origem] = { quantidade: 0, faturamento: 0 }
    }
    porOrigem[venda.origem].quantidade += 1
    porOrigem[venda.origem].faturamento += venda.total
  })

  // Por forma de pagamento — uma venda híbrida contribui uma fração para
  // cada forma usada, em vez do total inteiro só para o resumo 'hibrido'.
  const porFormaPagamento: Record<string, { quantidade: number; faturamento: number }> = {}
  vendasComTotais.forEach((venda) => {
    const pagamentos = pagamentosPorVenda[venda.id] || []
    pagamentos.forEach((pagamento) => {
      if (!porFormaPagamento[pagamento.forma_pagamento]) {
        porFormaPagamento[pagamento.forma_pagamento] = { quantidade: 0, faturamento: 0 }
      }
      porFormaPagamento[pagamento.forma_pagamento].quantidade += 1
      porFormaPagamento[pagamento.forma_pagamento].faturamento += pagamento.valor
    })
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
