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
