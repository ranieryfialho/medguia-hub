import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { BarChart3, TrendingUp, Users, Package } from 'lucide-react'
import { RelatorioVendasClient } from '@/components/features/relatorios'
import { BtnGerarPdfVendas } from '@/components/features/shared'
import { FiltroProdutosMultiSelect } from '@/components/features/produtos'
import { requireModulo } from '@/lib/guard'
import { FORMAS_PAGAMENTO } from '@/lib/vendas'
import { formatAppDateKey, getAppDayRangeUTC } from '@/lib/datetime'

const ORIGENS = [
  { value: 'medico', label: 'Médico' },
  { value: 'leads', label: 'Leads' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'renovacao', label: 'Renovação' },
  { value: 'campanha', label: 'Campanha' },
]

export default async function RelatorioVendasPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  await requireModulo('comercial:relatorio_vendas')

  const supabase = await createClient()
  const resolvedParams = await searchParams

  const data_inicio = (resolvedParams.data_inicio as string) || ''
  const data_fim = (resolvedParams.data_fim as string) || ''
  const origem = (resolvedParams.origem as string) || ''
  const forma_pagamento = (resolvedParams.forma_pagamento as string) || ''
  const profissional_id = (resolvedParams.profissional_id as string) || ''
  const produtoIds = Array.isArray(resolvedParams.produto_id)
    ? resolvedParams.produto_id.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : typeof resolvedParams.produto_id === 'string' && resolvedParams.produto_id
      ? [resolvedParams.produto_id]
      : []

  // Query única com join em profissional e itens+produto
  let query = supabase
    .from('vendas')
    .select(`
      id, origem, forma_pagamento, data_venda, profissional_id,
      profiles:profissional_id ( full_name, role ),
      itens_venda ( quantidade, preco_unitario, produtos:produto_id ( id, nome ) )
    `)

  if (data_inicio) query = query.gte('data_venda', getAppDayRangeUTC(data_inicio).start)
  if (data_fim) query = query.lte('data_venda', getAppDayRangeUTC(data_fim).end)
  if (origem) query = query.eq('origem', origem)
  if (forma_pagamento) query = query.eq('forma_pagamento', forma_pagamento)
  if (profissional_id) query = query.eq('profissional_id', profissional_id)

  const { data: vendas } = await query

  // Buscar profissionais para o filtro
  const { data: profissionaisRaw } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .in('role', ['fisioterapeuta', 'gestor'])
    .order('full_name')

  const { data: produtosRaw } = await supabase
    .from('produtos')
    .select('id, nome')
    .eq('ativo', true)
    .order('nome')

  const profissionaisFiltro = (profissionaisRaw || []).map((p: any) => ({
    id: p.id,
    nome: p.full_name || 'Sem nome',
    role: p.role,
  }))
  const produtosFiltro = (produtosRaw || []).map((produto: { id: string; nome: string }) => ({
    id: produto.id,
    nome: produto.nome,
  }))

  // ── Agregações ──────────────────────────────────────────────

  type AgregacaoNome = { nome: string; quantidade: number; faturamento: number }

  const porOrigem: Record<string, { quantidade: number; faturamento: number }> = {}
  const porFormaPagamento: Record<string, { quantidade: number; faturamento: number }> = {}
  const porProfissional: Record<string, AgregacaoNome> = {}
  const porProduto: Record<string, AgregacaoNome> = {}
  const porPeriodo: Record<string, number> = {}

  const agora = new Date()
  const dias90 = new Date(agora.getTime() - 90 * 24 * 60 * 60 * 1000)

  for (const venda of vendas || []) {
    const itensOriginais: any[] = (venda as any).itens_venda || []
    const itens = produtoIds.length > 0
      ? itensOriginais.filter((item) => produtoIds.includes(item.produtos?.id ?? ''))
      : itensOriginais

    if (itens.length === 0) continue

    const perfil: any = (venda as any).profiles

    const totalVenda = itens.reduce(
      (s: number, i: any) => s + i.quantidade * i.preco_unitario,
      0
    )

    // Por origem
    if (!porOrigem[venda.origem]) porOrigem[venda.origem] = { quantidade: 0, faturamento: 0 }
    porOrigem[venda.origem].quantidade += 1
    porOrigem[venda.origem].faturamento += totalVenda

    if (!porFormaPagamento[venda.forma_pagamento]) porFormaPagamento[venda.forma_pagamento] = { quantidade: 0, faturamento: 0 }
    porFormaPagamento[venda.forma_pagamento].quantidade += 1
    porFormaPagamento[venda.forma_pagamento].faturamento += totalVenda

    // Por profissional
    const profNome = perfil?.full_name || 'Desconhecido'
    if (!porProfissional[venda.profissional_id]) {
      porProfissional[venda.profissional_id] = { nome: profNome, quantidade: 0, faturamento: 0 }
    }
    porProfissional[venda.profissional_id].quantidade += 1
    porProfissional[venda.profissional_id].faturamento += totalVenda

    // Por produto
    for (const item of itens) {
      const prodNome = (item.produtos as any)?.nome || 'Produto removido'
      const prodKey = prodNome
      if (!porProduto[prodKey]) porProduto[prodKey] = { nome: prodNome, quantidade: 0, faturamento: 0 }
      porProduto[prodKey].quantidade += item.quantidade
      porProduto[prodKey].faturamento += item.quantidade * item.preco_unitario
    }

    // Por período (últimos 90 dias)
    if (new Date(venda.data_venda) >= dias90) {
      const dia = formatAppDateKey(venda.data_venda)
      if (!porPeriodo[dia]) porPeriodo[dia] = 0
      porPeriodo[dia] += totalVenda
    }
  }

  const totalFaturado = Object.values(porOrigem).reduce((s, o) => s + o.faturamento, 0)
  const totalVendas = (vendas || []).length
  const vendaMedia = totalVendas > 0 ? totalFaturado / totalVendas : 0

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div>
        <div className="text-xs text-text-secondary mb-2 flex items-center gap-2">
          <Link href="/dashboard" className="hover:text-primary-500 transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-text-primary font-medium">Relatório de Vendas</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-text-primary flex items-center gap-2">
            <BarChart3 size={28} className="text-primary-500" />
            Relatório de Vendas
          </h1>
          {totalVendas > 0 && (
            <BtnGerarPdfVendas
              periodoLabel={
                data_inicio && data_fim
                  ? `${data_inicio} até ${data_fim}`
                  : data_inicio
                    ? `A partir de ${data_inicio}`
                    : data_fim
                      ? `Até ${data_fim}`
                      : 'Todo o período'
              }
              totalFaturado={totalFaturado}
              totalVendas={totalVendas}
              vendaMedia={vendaMedia}
              porOrigem={porOrigem}
              porProfissional={Object.values(porProfissional)}
              porProduto={Object.values(porProduto)}
            />
          )}
        </div>
      </div>

      {/* Filtros */}
      <form method="get" className="bg-surface rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold text-text-primary mb-3">Filtros</h2>
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="block text-xs text-text-secondary uppercase mb-1">Data Início</label>
            <input
              type="date"
              name="data_inicio"
              defaultValue={data_inicio}
              className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary uppercase mb-1">Data Fim</label>
            <input
              type="date"
              name="data_fim"
              defaultValue={data_fim}
              className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary uppercase mb-1">Origem</label>
            <select
              name="origem"
              defaultValue={origem}
              className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
            >
              <option value="">Todas as origens</option>
              {ORIGENS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-secondary uppercase mb-1">Pagamento</label>
            <select
              name="forma_pagamento"
              defaultValue={forma_pagamento}
              className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
            >
              <option value="">Todas as formas</option>
              {FORMAS_PAGAMENTO.map((forma) => (
                <option key={forma.value} value={forma.value}>{forma.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-secondary uppercase mb-1">Profissional</label>
            <select
              name="profissional_id"
              defaultValue={profissional_id}
              className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
            >
              <option value="">Todos os profissionais</option>
              {profissionaisFiltro.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[260px] flex-1">
            <FiltroProdutosMultiSelect
              name="produto_id"
              label="Produtos"
              options={produtosFiltro}
              defaultSelected={produtoIds}
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-md text-sm font-medium transition-colors"
          >
            Filtrar
          </button>
          {(data_inicio || data_fim || origem || forma_pagamento || profissional_id || produtoIds.length > 0) && (
            <Link
              href="/relatorios/vendas"
              className="px-4 py-2 bg-page hover:bg-page/80 border border-border text-text-secondary rounded-md text-sm transition-colors"
            >
              Limpar
            </Link>
          )}
        </div>
      </form>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface rounded-lg border border-border p-4">
          <p className="text-xs text-text-secondary uppercase font-medium mb-2">Total Faturado</p>
          <p className="text-2xl font-bold text-text-primary">
            R$ {totalFaturado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <p className="text-xs text-text-secondary uppercase font-medium mb-2">Total de Vendas</p>
          <p className="text-2xl font-bold text-text-primary">{totalVendas}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <p className="text-xs text-text-secondary uppercase font-medium mb-2">Ticket Médio</p>
          <p className="text-2xl font-bold text-text-primary">
            R$ {vendaMedia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <p className="text-xs text-text-secondary uppercase font-medium mb-2">Profissionais Ativos</p>
          <p className="text-2xl font-bold text-text-primary">
            {Object.keys(porProfissional).length}
          </p>
        </div>
      </div>

      {/* Gráficos (cliente) */}
      <RelatorioVendasClient
        porOrigem={porOrigem}
        porFormaPagamento={porFormaPagamento}
        porPeriodo={porPeriodo}
        porProfissional={Object.values(porProfissional)}
        porProduto={Object.values(porProduto)}
        totalFaturado={totalFaturado}
      />

      {/* Tabela por Profissional */}
      {Object.keys(porProfissional).length > 0 && (
        <div className="bg-surface rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Users size={20} className="text-primary-500" />
            Desempenho por Profissional
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase">Profissional</th>
                  <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase text-right">Vendas</th>
                  <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase text-right">Faturamento</th>
                  <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase text-right">% Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Object.values(porProfissional)
                  .sort((a, b) => b.faturamento - a.faturamento)
                  .map((prof) => {
                    const pct = totalFaturado > 0 ? (prof.faturamento / totalFaturado) * 100 : 0
                    return (
                      <tr key={prof.nome} className="hover:bg-page/50">
                        <td className="px-4 py-3 text-sm text-text-primary font-medium">{prof.nome}</td>
                        <td className="px-4 py-3 text-sm text-text-primary text-right">{prof.quantidade}</td>
                        <td className="px-4 py-3 text-sm text-text-primary text-right font-medium">
                          R$ {prof.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-20 bg-border rounded-full h-1.5">
                              <div
                                className="bg-primary-500 h-1.5 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-sm text-text-primary font-medium w-12 text-right">
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabela por Produto */}
      {Object.keys(porProduto).length > 0 && (
        <div className="bg-surface rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Package size={20} className="text-primary-500" />
            Desempenho por Produto
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase">Produto</th>
                  <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase text-right">Qtd. Vendida</th>
                  <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase text-right">Faturamento</th>
                  <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase text-right">% Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Object.values(porProduto)
                  .sort((a, b) => b.faturamento - a.faturamento)
                  .map((prod) => {
                    const pct = totalFaturado > 0 ? (prod.faturamento / totalFaturado) * 100 : 0
                    return (
                      <tr key={prod.nome} className="hover:bg-page/50">
                        <td className="px-4 py-3 text-sm text-text-primary font-medium">{prod.nome}</td>
                        <td className="px-4 py-3 text-sm text-text-primary text-right">{prod.quantidade}</td>
                        <td className="px-4 py-3 text-sm text-text-primary text-right font-medium">
                          R$ {prod.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-20 bg-border rounded-full h-1.5">
                              <div
                                className="bg-amber-500 h-1.5 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-sm text-text-primary font-medium w-12 text-right">
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabela por Origem */}
      {Object.keys(porOrigem).length > 0 && (
        <div className="bg-surface rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-primary-500" />
            Análise por Origem
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase">Origem</th>
                  <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase text-right">Quantidade</th>
                  <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase text-right">Faturamento</th>
                  <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase text-right">% Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Object.entries(porOrigem)
                  .sort(([, a], [, b]) => b.faturamento - a.faturamento)
                  .map(([origemKey, data]) => {
                    const pct = totalFaturado > 0 ? (data.faturamento / totalFaturado) * 100 : 0
                    const label = ORIGENS.find((o) => o.value === origemKey)?.label || origemKey
                    return (
                      <tr key={origemKey} className="hover:bg-page/50">
                        <td className="px-4 py-3 text-sm text-text-primary capitalize">{label}</td>
                        <td className="px-4 py-3 text-sm text-text-primary text-right">{data.quantidade}</td>
                        <td className="px-4 py-3 text-sm text-text-primary text-right font-medium">
                          R$ {data.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-primary text-right font-medium">
                          {pct.toFixed(1)}%
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalVendas === 0 && (
        <div className="bg-surface rounded-lg border border-border p-12 text-center">
          <p className="text-text-secondary">Nenhuma venda encontrada para os filtros selecionados.</p>
        </div>
      )}
    </div>
  )
}
