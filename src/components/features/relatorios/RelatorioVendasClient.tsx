'use client'

import {
  PieChart, Pie, Cell,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { FORMA_PAGAMENTO_LABEL } from '@/lib/vendas'

interface AgregacaoNome {
  nome: string
  quantidade: number
  faturamento: number
}

interface RelatorioVendasClientProps {
  porOrigem: Record<string, { quantidade: number; faturamento: number }>
  porFormaPagamento: Record<string, { quantidade: number; faturamento: number }>
  porProfissional: AgregacaoNome[]
  porProduto: AgregacaoNome[]
  totalFaturado: number
}

const CORES = ['#0A4D68', '#F18F01', '#C73E1D', '#6A994E', '#BC4749']

const TRADUCAO_ORIGEM: Record<string, string> = {
  medico: 'Médico',
  leads: 'Leads',
  indicacao: 'Indicação',
  renovacao: 'Renovação',
  campanha: 'Campanha',
}

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtMisto = (v: any, name: string | number | undefined): [string, string] =>
  name === 'Vendas' ? [String(Number(v ?? 0)), String(name)] : [fmt(Number(v ?? 0)), String(name ?? '')]

export function RelatorioVendasClient({
  porOrigem,
  porFormaPagamento,
  porProfissional,
  porProduto,
}: RelatorioVendasClientProps) {
  const dadosPizza = Object.entries(porOrigem).map(([origem, d]) => ({
    name: TRADUCAO_ORIGEM[origem] || origem,
    value: d.faturamento,
  }))

  const dadosProfissional = [...porProfissional]
    .sort((a, b) => b.faturamento - a.faturamento)
    .slice(0, 10)
    .map((p) => ({ name: p.nome.split(' ')[0], faturamento: p.faturamento, vendas: p.quantidade }))

  const dadosProduto = [...porProduto]
    .sort((a, b) => b.faturamento - a.faturamento)
    .map((p) => ({ name: p.nome, faturamento: p.faturamento, quantidade: p.quantidade }))

  const dadosFormaPagamento = Object.entries(porFormaPagamento)
    .map(([forma, d]) => ({
      name: FORMA_PAGAMENTO_LABEL[forma] || forma,
      faturamento: d.faturamento,
      quantidade: d.quantidade,
    }))
    .sort((a, b) => b.faturamento - a.faturamento)

  const vazio = dadosPizza.length === 0

  if (vazio) {
    return (
      <div className="bg-surface rounded-lg border border-border p-12 text-center">
        <p className="text-text-secondary">Nenhum dado disponível para o período selecionado.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Por origem (pizza) */}
        {dadosPizza.length > 0 && (
          <div className="bg-surface rounded-lg border border-border p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Faturamento por Origem</h2>
            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dadosPizza}
                    cx="50%" cy="50%"
                    labelLine={false}
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${(((percent ?? 0) * 100).toFixed(0))}%`}
                    outerRadius={90}
                    dataKey="value"
                  >
                    {dadosPizza.map((_, i) => (
                      <Cell key={i} fill={CORES[i % CORES.length]} />
                    ))}
                  </Pie>
                  <Tooltip // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => fmt(Number(v ?? 0))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Por produto */}
        {dadosProduto.length > 0 && (
          <div className="bg-surface rounded-lg border border-border p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Faturamento por Produto</h2>
            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosProduto} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => fmt(Number(v ?? 0))} />
                  <Bar dataKey="faturamento" fill="#F18F01" name="Faturamento" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {dadosFormaPagamento.length > 0 && (
        <div className="bg-surface rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Faturamento por Forma de Pagamento</h2>
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosFormaPagamento}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={fmtMisto} />
                <Legend />
                <Bar dataKey="faturamento" fill="#C73E1D" name="Faturamento" radius={[4, 4, 0, 0]} />
                <Bar dataKey="quantidade" fill="#6A994E" name="Vendas" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Por profissional */}
      {dadosProfissional.length > 0 && (
        <div className="bg-surface rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Faturamento por Profissional</h2>
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosProfissional}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={fmtMisto} />
                <Legend />
                <Bar dataKey="faturamento" fill="#0A4D68" name="Faturamento" radius={[4, 4, 0, 0]} />
                <Bar dataKey="vendas" fill="#6A994E" name="Vendas" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
