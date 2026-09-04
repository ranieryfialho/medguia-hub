export const STATUS_VENDA = [
  { value: 'venda_confirmada',   label: 'Venda confirmada' },
  { value: 'orcamento_pendente', label: 'Orçamento pendente' },
  { value: 'orcamento_recusado', label: 'Orçamento recusado' },
] as const

export type StatusVenda = (typeof STATUS_VENDA)[number]['value']

export const STATUS_VENDA_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_VENDA.map((s) => [s.value, s.label]),
)

export const FORMAS_PAGAMENTO = [
  { value: 'pix', label: 'Pix' },
  { value: 'cartao_credito', label: 'Cartão de crédito' },
  { value: 'cartao_debito', label: 'Cartão de débito' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'boleto', label: 'Boleto' },
] as const

export const FORMA_PAGAMENTO_LABEL: Record<string, string> = Object.fromEntries(
  FORMAS_PAGAMENTO.map((forma) => [forma.value, forma.label]),
)

export const TIPO_VENDA = [
  { value: 'fisioterapica', label: 'Fisioterápica' },
  { value: 'medica', label: 'Médica' },
] as const

export type TipoVenda = (typeof TIPO_VENDA)[number]['value']

export const TIPO_VENDA_LABEL: Record<string, string> = Object.fromEntries(
  TIPO_VENDA.map((tipo) => [tipo.value, tipo.label]),
)
