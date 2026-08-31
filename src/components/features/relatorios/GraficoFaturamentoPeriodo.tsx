'use client'

import {
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface GraficoFaturamentoPeriodoProps {
  porPeriodo: Record<string, number>
}

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

export function GraficoFaturamentoPeriodo({ porPeriodo }: GraficoFaturamentoPeriodoProps) {
  const dadosLinha = Object.entries(porPeriodo)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, faturamento]) => {
      const [y, m, d] = data.split('-').map(Number)
      return {
        data: new Date(y, m - 1, d).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }),
        faturamento,
      }
    })

  if (dadosLinha.length === 0) return null

  return (
    <div className="bg-surface rounded-lg border border-border p-6">
      <h2 className="text-lg font-semibold text-text-primary mb-4">Faturamento ao Longo do Tempo</h2>
      <div className="w-full h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dadosLinha}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="data" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
            <Tooltip // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => fmt(Number(v ?? 0))} />
            <Line type="monotone" dataKey="faturamento" stroke="#0A4D68" strokeWidth={2} dot={false} name="Faturamento" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
