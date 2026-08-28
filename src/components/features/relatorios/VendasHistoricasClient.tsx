'use client'

import { useState, Fragment } from 'react'
import { ChevronDown, ChevronUp, FileDown, Sheet } from 'lucide-react'
import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import type { CardsExecutivos, LinhaTabelaHistorico } from '@/lib/relatorios/vendas-historicas'
import { buscarDrillDownMes, type DrillDownMes } from '@/actions/vendas-historicas'

type Metrica = 'faturamento' | 'ticket_medio' | 'volume' | 'misto'

type Filtros = {
  profissional_id?: string
  medico_id?: string
  origem?: string
  categoria?: string
  data_inicio: string
  data_fim: string
}

interface Props {
  linhas: LinhaTabelaHistorico[]
  filtros: Filtros
  cards: CardsExecutivos
  periodoLabel: string
  filtrosLabel: string
}

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

function labelMes(mes: string) {
  return new Date(mes + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase()
}

function badgeVariacao(v: { percentual: number | null; direcao: 'alta' | 'queda' | 'estavel' | null }) {
  if (v.percentual === null) return <span className="text-text-secondary">—</span>
  const cor = v.direcao === 'alta' ? 'text-emerald-600' : v.direcao === 'queda' ? 'text-red-600' : 'text-text-secondary'
  const seta = v.direcao === 'alta' ? '▲' : v.direcao === 'queda' ? '▼' : '•'
  return <span className={cor}>{seta} {Math.abs(v.percentual).toFixed(1)}%</span>
}

export function VendasHistoricasClient({ linhas, filtros, cards, periodoLabel, filtrosLabel }: Props) {
  const [metrica, setMetrica] = useState<Metrica>('faturamento')
  const [mesExpandido, setMesExpandido] = useState<string | null>(null)
  const [drillDown, setDrillDown] = useState<Record<string, DrillDownMes | 'carregando' | 'erro'>>({})
  const [exportando, setExportando] = useState<'pdf' | 'xlsx' | null>(null)

  async function exportarPdf() {
    setExportando('pdf')
    try {
      const { gerarPdfVendasHistoricas } = await import('@/lib/relatorios/pdf-vendas-historicas')
      await gerarPdfVendasHistoricas({ periodoLabel, filtrosLabel, cards, linhas })
    } finally {
      setExportando(null)
    }
  }

  async function exportarXlsx() {
    setExportando('xlsx')
    try {
      const { gerarXlsxVendasHistoricas } = await import('@/lib/relatorios/xlsx-vendas-historicas')
      await gerarXlsxVendasHistoricas({ periodoLabel, linhas })
    } finally {
      setExportando(null)
    }
  }

  const dadosGrafico = [...linhas].reverse().map((l) => ({
    mes: labelMes(l.mes),
    faturamento: l.faturamento,
    ticket_medio: l.ticket_medio,
    volume: l.qtd_vendas,
  }))

  async function toggleExpandir(mes: string) {
    if (mesExpandido === mes) {
      setMesExpandido(null)
      return
    }
    setMesExpandido(mes)
    if (!drillDown[mes]) {
      setDrillDown((prev) => ({ ...prev, [mes]: 'carregando' }))
      try {
        const resultado = await buscarDrillDownMes(mes, filtros)
        setDrillDown((prev) => ({ ...prev, [mes]: resultado }))
      } catch {
        setDrillDown((prev) => ({ ...prev, [mes]: 'erro' }))
      }
    }
  }

  if (linhas.length === 0) {
    return (
      <div className="bg-surface rounded-lg border border-border p-12 text-center">
        <p className="text-text-secondary">Nenhum dado disponível para o período selecionado.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Exportação (AC-084) */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={exportarPdf}
          disabled={exportando !== null}
          className="flex items-center gap-2 px-4 py-2 bg-[#006b5a] text-white rounded-md text-sm font-medium hover:bg-[#005548] transition-colors disabled:opacity-60"
        >
          <FileDown size={16} />
          {exportando === 'pdf' ? 'Gerando PDF...' : 'Exportar PDF'}
        </button>
        <button
          type="button"
          onClick={exportarXlsx}
          disabled={exportando !== null}
          className="flex items-center gap-2 px-4 py-2 bg-page border border-border text-text-primary rounded-md text-sm font-medium hover:bg-border transition-colors disabled:opacity-60"
        >
          <Sheet size={16} />
          {exportando === 'xlsx' ? 'Gerando planilha...' : 'Exportar Excel'}
        </button>
      </div>

      {/* Gráfico com alternância de métrica (AC-079) */}
      <div className="bg-surface rounded-lg border border-border p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-text-primary">Evolução Temporal</h2>
          <div className="flex gap-1 bg-page rounded-md p-1">
            {([
              ['faturamento', 'Faturamento'],
              ['ticket_medio', 'Ticket Médio'],
              ['volume', 'Volume'],
              ['misto', 'Faturamento + Ticket'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMetrica(value)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  metrica === value ? 'bg-primary-500 text-white' : 'text-text-secondary hover:bg-border'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {/* Scroll horizontal em telas estreitas — nunca quebra o layout (AC-083) */}
        <div className="w-full h-80 overflow-x-auto">
          <div style={{ minWidth: Math.max(dadosGrafico.length * 60, 320) }} className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dadosGrafico}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} interval={dadosGrafico.length > 18 ? 1 : 0} />
                {(metrica === 'faturamento' || metrica === 'misto') && (
                  <YAxis
                    yAxisId="esquerda"
                    tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11 }}
                  />
                )}
                {metrica === 'ticket_medio' && (
                  <YAxis tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                )}
                {metrica === 'volume' && <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />}
                {metrica === 'misto' && (
                  <YAxis
                    yAxisId="direita"
                    orientation="right"
                    tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11 }}
                  />
                )}
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, name: any) => (name === 'Volume' ? [String(v), name] : [fmt(Number(v ?? 0)), name])}
                />
                <Legend />
                {metrica === 'faturamento' && (
                  <Bar yAxisId="esquerda" dataKey="faturamento" fill="#0A4D68" name="Faturamento" radius={[4, 4, 0, 0]} />
                )}
                {metrica === 'ticket_medio' && (
                  <Line type="monotone" dataKey="ticket_medio" stroke="#F18F01" strokeWidth={2} name="Ticket Médio" />
                )}
                {metrica === 'volume' && (
                  <Bar dataKey="volume" fill="#6A994E" name="Volume" radius={[4, 4, 0, 0]} />
                )}
                {metrica === 'misto' && (
                  <>
                    <Bar yAxisId="esquerda" dataKey="faturamento" fill="#0A4D68" name="Faturamento" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="direita" type="monotone" dataKey="ticket_medio" stroke="#F18F01" strokeWidth={2} name="Ticket Médio" />
                  </>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tabela mês a mês com MoM e drill-down (AC-080, AC-081) */}
      <div className="bg-surface rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Detalhamento Mês a Mês</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-xs font-semibold text-text-secondary uppercase">Mês</th>
                <th className="px-3 py-2 text-xs font-semibold text-text-secondary uppercase text-right">Faturamento</th>
                <th className="px-3 py-2 text-xs font-semibold text-text-secondary uppercase text-right">Var. MoM</th>
                <th className="px-3 py-2 text-xs font-semibold text-text-secondary uppercase text-right">Qtd.</th>
                <th className="px-3 py-2 text-xs font-semibold text-text-secondary uppercase text-right">Ticket Médio</th>
                <th className="px-3 py-2 text-xs font-semibold text-text-secondary uppercase text-right">Var. Ticket</th>
                <th className="px-3 py-2 text-xs font-semibold text-text-secondary uppercase">Consultório / Fisio</th>
                <th className="px-3 py-2 text-xs font-semibold text-text-secondary uppercase">Top Produto</th>
                <th className="px-3 py-2 text-xs font-semibold text-text-secondary uppercase">Top Profissional</th>
                <th className="px-3 py-2 text-xs font-semibold text-text-secondary uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {linhas.map((linha) => {
                const expandido = mesExpandido === linha.mes
                const detalhe = drillDown[linha.mes]
                return (
                  <Fragment key={linha.mes}>
                    <tr
                      className="hover:bg-page/50 cursor-pointer"
                      onClick={() => toggleExpandir(linha.mes)}
                    >
                      <td className="px-3 py-3 text-sm font-medium text-text-primary whitespace-nowrap">{labelMes(linha.mes)}</td>
                      <td className="px-3 py-3 text-sm text-text-primary text-right whitespace-nowrap">{fmt(linha.faturamento)}</td>
                      <td className="px-3 py-3 text-sm text-right whitespace-nowrap">{badgeVariacao(linha.variacaoFaturamentoMoM)}</td>
                      <td className="px-3 py-3 text-sm text-text-primary text-right">{linha.qtd_vendas}</td>
                      <td className="px-3 py-3 text-sm text-text-primary text-right whitespace-nowrap">{fmt(linha.ticket_medio)}</td>
                      <td className="px-3 py-3 text-sm text-right whitespace-nowrap">{badgeVariacao(linha.variacaoTicketMedioMoM)}</td>
                      <td className="px-3 py-3 text-xs text-text-secondary whitespace-nowrap">
                        {fmt(linha.faturamento_consultorio)} / {fmt(linha.faturamento_fisio)}
                      </td>
                      <td className="px-3 py-3 text-sm text-text-secondary">{linha.top_produto || '—'}</td>
                      <td className="px-3 py-3 text-sm text-text-secondary">{linha.top_profissional || '—'}</td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleExpandir(linha.mes) }}
                          className="p-1 rounded hover:bg-border text-text-secondary"
                          aria-label={expandido ? 'Recolher detalhes' : 'Ver detalhes'}
                        >
                          {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </td>
                    </tr>
                    {expandido && (
                      <tr>
                        <td colSpan={10} className="bg-page/50 px-4 py-4">
                          {detalhe === 'carregando' && (
                            <p className="text-sm text-text-secondary">Carregando detalhamento do mês…</p>
                          )}
                          {detalhe === 'erro' && (
                            <p className="text-sm text-red-600">Não foi possível carregar o detalhamento deste mês.</p>
                          )}
                          {detalhe && detalhe !== 'carregando' && detalhe !== 'erro' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                <h3 className="text-xs font-semibold text-text-secondary uppercase mb-2">Quebra por Origem</h3>
                                {detalhe.quebra_origem.length === 0 ? (
                                  <p className="text-sm text-text-secondary">Sem dados.</p>
                                ) : (
                                  <ul className="space-y-1">
                                    {detalhe.quebra_origem.map((o) => (
                                      <li key={o.origem} className="flex justify-between text-sm">
                                        <span className="text-text-primary capitalize">{o.origem}</span>
                                        <span className="text-text-secondary">{fmt(o.faturamento)} · {o.qtd_vendas} venda{o.qtd_vendas !== 1 ? 's' : ''}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                              <div>
                                <h3 className="text-xs font-semibold text-text-secondary uppercase mb-2">Quebra por Categoria</h3>
                                {detalhe.quebra_categoria.length === 0 ? (
                                  <p className="text-sm text-text-secondary">Sem dados.</p>
                                ) : (
                                  <ul className="space-y-1">
                                    {detalhe.quebra_categoria.map((c) => (
                                      <li key={c.categoria} className="flex justify-between text-sm">
                                        <span className="text-text-primary capitalize">{c.categoria}</span>
                                        <span className="text-text-secondary">{fmt(c.faturamento)} · {c.qtd_vendas} venda{c.qtd_vendas !== 1 ? 's' : ''}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                              <div>
                                <h3 className="text-xs font-semibold text-text-secondary uppercase mb-2">Ranking de Médicos Referenciadores</h3>
                                {detalhe.ranking_medicos.length === 0 ? (
                                  <p className="text-sm text-text-secondary">Sem dados.</p>
                                ) : (
                                  <ul className="space-y-1">
                                    {detalhe.ranking_medicos.map((m) => (
                                      <li key={m.medico_id} className="flex justify-between text-sm">
                                        <span className="text-text-primary">{m.medico_nome || 'Desconhecido'}</span>
                                        <span className="text-text-secondary">{fmt(m.faturamento)} · {m.qtd_vendas} venda{m.qtd_vendas !== 1 ? 's' : ''}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                              <div>
                                <h3 className="text-xs font-semibold text-text-secondary uppercase mb-2">Ranking de Fisioterapeutas (Conversão)</h3>
                                {detalhe.ranking_fisios.length === 0 ? (
                                  <p className="text-sm text-text-secondary">Sem dados.</p>
                                ) : (
                                  <ul className="space-y-1">
                                    {detalhe.ranking_fisios.map((f) => (
                                      <li key={f.profissional_id} className="flex justify-between text-sm">
                                        <span className="text-text-primary">{f.profissional_nome || 'Desconhecido'}</span>
                                        <span className="text-text-secondary">{fmt(f.faturamento)} · {f.qtd_vendas} venda{f.qtd_vendas !== 1 ? 's' : ''}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
