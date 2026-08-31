'use client'

import { useState } from 'react'
import { Users, ChevronDown } from 'lucide-react'

export type ConversaoDetalhe = {
  paciente_nome: string
  origem_label: string
  data_venda: string
  total: number
}

export type DetalhamentoProfissional = {
  nome: string
  total: number
  origens: [string, number][]
  vendas: ConversaoDetalhe[]
}

interface ConversoesPorProfissionalProps {
  detalhamento: DetalhamentoProfissional[]
}

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

export function ConversoesPorProfissional({ detalhamento }: ConversoesPorProfissionalProps) {
  const [aberto, setAberto] = useState<string | null>(null)

  if (detalhamento.length === 0) return null

  return (
    <div className="bg-surface rounded-lg border border-border p-6">
      <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
        <Users size={20} className="text-primary-500" />
        Conversões por Profissional e Origem
      </h2>
      <div className="space-y-2">
        {detalhamento.map((p) => {
          const expandido = aberto === p.nome
          return (
            <div key={p.nome} className="bg-page rounded-lg border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setAberto(expandido ? null : p.nome)}
                className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-border/20 transition-colors"
              >
                <p className="text-sm text-text-primary">
                  <span className="font-semibold">{p.nome}</span>
                  {' — '}
                  <span className="font-semibold">{p.total}</span> {p.total !== 1 ? 'conversões' : 'conversão'}
                  {p.origens.length > 0 && (
                    <span className="text-text-secondary">
                      {' ('}
                      {p.origens.map(([label, qtd], idx) => (
                        <span key={label}>
                          {idx > 0 && (idx === p.origens.length - 1 ? ' e ' : ', ')}
                          {qtd} {label}
                        </span>
                      ))}
                      {')'}
                    </span>
                  )}
                </p>
                <ChevronDown
                  size={18}
                  className={`shrink-0 text-text-secondary transition-transform ${expandido ? 'rotate-180' : ''}`}
                />
              </button>

              {expandido && (
                <div className="border-t border-border overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-3 py-2 text-xs font-semibold text-text-secondary uppercase">Data</th>
                        <th className="px-3 py-2 text-xs font-semibold text-text-secondary uppercase">Paciente</th>
                        <th className="px-3 py-2 text-xs font-semibold text-text-secondary uppercase">Origem</th>
                        <th className="px-3 py-2 text-xs font-semibold text-text-secondary uppercase text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {p.vendas.map((v, idx) => (
                        <tr key={`${v.paciente_nome}-${v.data_venda}-${idx}`}>
                          <td className="px-3 py-2 text-sm text-text-primary whitespace-nowrap">
                            {new Date(v.data_venda).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-3 py-2 text-sm text-text-primary">{v.paciente_nome}</td>
                          <td className="px-3 py-2 text-sm text-text-secondary">{v.origem_label}</td>
                          <td className="px-3 py-2 text-sm text-text-primary text-right font-medium">{fmt(v.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
