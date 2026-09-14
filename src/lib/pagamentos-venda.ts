/**
 * Pagamentos de uma venda.
 *
 * O detalhamento completo fica em `pagamentos_venda` (1 linha por forma de
 * pagamento usada). `vendas.forma_pagamento` continua existindo como resumo
 * derivado: a própria forma quando há só 1 pagamento, ou 'hibrido' quando há
 * 2 ou mais — é dele que a listagem e os filtros legados ainda leem.
 */

import { FORMAS_PAGAMENTO } from '@/lib/vendas'

const TOLERANCIA_SOMA = 0.01

export interface PagamentoVenda {
  formaPagamento: string
  valor: number
  parcelas: number
  /** Valor efetivamente cobrado do cliente com juros do parcelamento — informativo, nunca entra no faturamento. */
  valorComJuros: number | null
  /** 'pago' (padrão) ou 'pendente' — combinado com o paciente mas ainda não recebido. */
  status: 'pago' | 'pendente'
  /** Data combinada para o recebimento. Só existe (e é obrigatória) quando status é 'pendente'. */
  dataVencimento: string | null
}

/** Formato persistido em `pagamentos_venda`. */
export interface PagamentoVendaRow {
  forma_pagamento: string
  valor: number
  parcelas: number
  valor_com_juros: number | null
  status: 'pago' | 'pendente'
  data_vencimento: string | null
}

function formaPagamentoValida(value: string) {
  return FORMAS_PAGAMENTO.some((forma) => forma.value === value)
}

function normalizarItem(valor: unknown): PagamentoVenda | null {
  if (!valor || typeof valor !== 'object') return null

  const record = valor as Record<string, unknown>
  const formaPagamento = typeof record.forma_pagamento === 'string'
    ? record.forma_pagamento
    : typeof record.formaPagamento === 'string'
      ? record.formaPagamento
      : ''

  if (!formaPagamento.trim()) return null

  const valorNumerico = Number(record.valor)
  const parcelasNumerico = Number(record.parcelas)
  const valorComJurosRaw = record.valor_com_juros ?? record.valorComJuros
  const valorComJurosNumerico = Number(valorComJurosRaw)

  const statusRaw = typeof record.status === 'string' ? record.status : 'pago'
  const status = statusRaw === 'pendente' ? 'pendente' : 'pago'

  const dataVencimentoRaw = record.data_vencimento ?? record.dataVencimento
  const dataVencimento = typeof dataVencimentoRaw === 'string' && dataVencimentoRaw.trim()
    ? dataVencimentoRaw.trim()
    : null

  return {
    formaPagamento: formaPagamento.trim(),
    valor: Number.isFinite(valorNumerico) ? valorNumerico : 0,
    parcelas: Number.isFinite(parcelasNumerico) && parcelasNumerico >= 1
      ? Math.floor(parcelasNumerico)
      : 1,
    valorComJuros: valorComJurosRaw != null && Number.isFinite(valorComJurosNumerico) && valorComJurosNumerico > 0
      ? valorComJurosNumerico
      : null,
    status,
    dataVencimento: status === 'pendente' ? dataVencimento : null,
  }
}

/** Lê a lista de pagamentos enviada pelo formulário (JSON). */
export function parsePagamentosJson(json: string | null | undefined): PagamentoVenda[] {
  if (!json?.trim()) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return []
  }

  if (!Array.isArray(parsed)) return []

  return parsed
    .map(normalizarItem)
    .filter((p): p is PagamentoVenda => p !== null)
}

/** Converte para o formato de linha do banco. */
export function serializarPagamentos(pagamentos: PagamentoVenda[]): PagamentoVendaRow[] {
  return pagamentos.map((p) => ({
    forma_pagamento: p.formaPagamento,
    valor: p.valor,
    parcelas: p.parcelas,
    valor_com_juros: p.formaPagamento === 'cartao_credito' ? p.valorComJuros : null,
    status: p.status,
    data_vencimento: p.status === 'pendente' ? p.dataVencimento : null,
  }))
}

/** Forma de pagamento resumida para gravar em `vendas.forma_pagamento`. */
export function resumoFormaPagamento(pagamentos: PagamentoVenda[]): string {
  if (pagamentos.length === 1) return pagamentos[0].formaPagamento
  return 'hibrido'
}

/**
 * Valida a lista de pagamentos. Retorna a mensagem de erro, ou `null` se
 * estiver tudo certo. `exigirSoma` bate a soma dos valores contra `total`
 * (usado para venda confirmada com valor > 0 — orçamento pendente e venda
 * zerada ficam fora dessa exigência).
 */
export function validarPagamentos(
  pagamentos: PagamentoVenda[],
  total: number,
  { exigirSoma, exigirValorPositivo = true }: { exigirSoma: boolean; exigirValorPositivo?: boolean },
): string | null {
  if (pagamentos.length === 0) {
    return 'Informe ao menos uma forma de pagamento.'
  }

  for (const pagamento of pagamentos) {
    if (!formaPagamentoValida(pagamento.formaPagamento)) {
      return 'Forma de pagamento inválida.'
    }
    if (exigirValorPositivo && !(pagamento.valor > 0)) {
      return 'Todo pagamento precisa ter um valor maior que zero.'
    }
    if (pagamento.valorComJuros !== null && pagamento.valorComJuros < pagamento.valor) {
      return 'O valor com juros não pode ser menor que o valor do pagamento.'
    }
    if (pagamento.status === 'pendente' && !pagamento.dataVencimento) {
      return 'Todo pagamento pendente precisa de uma data combinada para o recebimento.'
    }
  }

  if (exigirSoma) {
    const soma = pagamentos.reduce((acc, p) => acc + p.valor, 0)
    if (Math.abs(soma - total) > TOLERANCIA_SOMA) {
      return `A soma dos pagamentos (R$ ${soma.toFixed(2)}) precisa ser igual ao total da venda (R$ ${total.toFixed(2)}).`
    }
  }

  return null
}
