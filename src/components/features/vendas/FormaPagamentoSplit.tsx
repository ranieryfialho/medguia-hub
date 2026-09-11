'use client'

import { Plus, Trash2 } from 'lucide-react'
import { FORMAS_PAGAMENTO } from '@/lib/vendas'

export interface PagamentoVendaForm {
  formaPagamento: string
  valor: number
  parcelas: number
  /** Valor efetivamente cobrado do cliente com juros do parcelamento — informativo, nunca soma no faturamento. */
  valorComJuros: number | null
}

export function pagamentosValidosParaEnvio(
  pagamentos: PagamentoVendaForm[],
  total: number,
  exigirSoma: boolean,
): boolean {
  if (pagamentos.length === 0) return false
  if (pagamentos.some((p) => !p.formaPagamento || !(p.valor > 0))) return false
  if (pagamentos.some((p) => p.valorComJuros !== null && p.valorComJuros < p.valor)) return false
  if (!exigirSoma) return true
  const soma = pagamentos.reduce((acc, p) => acc + p.valor, 0)
  return Math.abs(soma - total) < 0.01
}

interface FormaPagamentoSplitProps {
  pagamentos: PagamentoVendaForm[]
  onChange: (pagamentos: PagamentoVendaForm[]) => void
  total: number
}

function formatarValor(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function FormaPagamentoSplit({ pagamentos, onChange, total }: FormaPagamentoSplitProps) {
  const totalAlocado = pagamentos.reduce((acc, p) => acc + (p.valor || 0), 0)
  const restante = parseFloat((total - totalAlocado).toFixed(2))
  const bateCerto = Math.abs(restante) < 0.01
  const isHibrido = pagamentos.length > 1

  const atualizarLinha = (idx: number, changes: Partial<PagamentoVendaForm>) => {
    onChange(pagamentos.map((p, i) => (i === idx ? { ...p, ...changes } : p)))
  }

  const adicionarLinha = () => {
    onChange([...pagamentos, { formaPagamento: '', valor: Math.max(restante, 0), parcelas: 1, valorComJuros: null }])
  }

  const removerLinha = (idx: number) => {
    if (pagamentos.length <= 1) return
    onChange(pagamentos.filter((_, i) => i !== idx))
  }

  const completarRestante = (idx: number) => {
    atualizarLinha(idx, { valor: parseFloat((pagamentos[idx].valor + restante).toFixed(2)) })
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {pagamentos.map((pagamento, idx) => (
          <div key={idx} className="p-3 rounded-lg border border-border bg-page space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-secondary uppercase">
                {isHibrido ? `Pagamento ${idx + 1}` : 'Forma de pagamento'}
              </span>
              {pagamentos.length > 1 && (
                <button
                  type="button"
                  onClick={() => removerLinha(idx)}
                  className="p-1 text-text-secondary hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  title="Remover este pagamento"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className={pagamento.formaPagamento === 'cartao_credito' ? '' : 'sm:col-span-2'}>
                <label className="block text-xs font-medium text-text-secondary mb-1">Meio de pagamento</label>
                <select
                  value={pagamento.formaPagamento}
                  onChange={(e) => atualizarLinha(idx, {
                    formaPagamento: e.target.value,
                    parcelas: e.target.value === 'cartao_credito' ? pagamento.parcelas : 1,
                    valorComJuros: e.target.value === 'cartao_credito' ? pagamento.valorComJuros : null,
                  })}
                  className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
                >
                  <option value="">Selecione...</option>
                  {FORMAS_PAGAMENTO.map((forma) => (
                    <option key={forma.value} value={forma.value}>
                      {forma.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Valor (R$)</label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={pagamento.valor || ''}
                    onChange={(e) => atualizarLinha(idx, { valor: parseFloat(e.target.value) || 0 })}
                    placeholder="0,00"
                    className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
                  />
                  {!bateCerto && (
                    <button
                      type="button"
                      onClick={() => completarRestante(idx)}
                      title="Preencher com o valor restante"
                      className="px-2 rounded-md border border-primary-200 text-primary-600 hover:bg-primary-50 text-[11px] font-medium whitespace-nowrap shrink-0"
                    >
                      Completar
                    </button>
                  )}
                </div>
              </div>

              {pagamento.formaPagamento === 'cartao_credito' && (
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Parcelas</label>
                  <select
                    value={pagamento.parcelas}
                    onChange={(e) => {
                      const parcelas = parseInt(e.target.value) || 1
                      atualizarLinha(idx, { parcelas, valorComJuros: parcelas === 1 ? null : pagamento.valorComJuros })
                    }}
                    className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n === 1 ? 'À vista (1x)' : `${n}x de ${formatarValor((pagamento.valor || 0) / n)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {pagamento.formaPagamento === 'cartao_credito' && pagamento.parcelas > 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-border">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Juros do parcelamento (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={
                      pagamento.valorComJuros && pagamento.valor > 0
                        ? parseFloat((((pagamento.valorComJuros / pagamento.valor) - 1) * 100).toFixed(2))
                        : ''
                    }
                    onChange={(e) => {
                      const pct = parseFloat(e.target.value)
                      atualizarLinha(idx, {
                        valorComJuros: Number.isFinite(pct) && pct > 0
                          ? parseFloat((pagamento.valor * (1 + pct / 100)).toFixed(2))
                          : null,
                      })
                    }}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
                  />
                </div>
                <div className="sm:col-span-2 flex items-end">
                  <p className="text-xs text-text-secondary">
                    {pagamento.valorComJuros ? (
                      <>
                        Cliente paga <strong className="text-text-primary">{formatarValor(pagamento.valorComJuros)}</strong> no total
                        ({pagamento.parcelas}x de {formatarValor(pagamento.valorComJuros / pagamento.parcelas)}). Só informativo — não entra no faturamento.
                      </>
                    ) : (
                      'Opcional — informe se a operadora cobra juros do cliente no parcelamento. Não afeta o faturamento da venda.'
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={adicionarLinha}
        className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700"
      >
        <Plus size={14} />
        Dividir em outro meio de pagamento
      </button>

      <div className={`p-3 rounded-md border text-xs flex flex-wrap items-center gap-x-4 gap-y-1 justify-between ${
        bateCerto ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'
      }`}>
        <span>Total da venda: <strong>{formatarValor(total)}</strong></span>
        <span>Alocado: <strong>{formatarValor(totalAlocado)}</strong></span>
        <span className="font-medium">
          {bateCerto
            ? '✓ Valores conferem'
            : restante > 0
              ? `Faltam ${formatarValor(restante)} alocar`
              : `Excedeu em ${formatarValor(Math.abs(restante))}`}
        </span>
      </div>
    </div>
  )
}
