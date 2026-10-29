import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { LineChart } from 'lucide-react'
import { requireModulo } from '@/lib/guard'
import { listarOrigensVenda } from '@/actions/origens-venda'
import { origensParaOpcoes } from '@/lib/origens-venda'
import { derivarCardsExecutivos, montarTabelaHistorico, type LinhaMensal } from '@/lib/relatorios/vendas-historicas'
import { VendasHistoricasClient, FiltroPeriodoVendasHistoricas } from '@/components/features/relatorios'


const CATEGORIAS = [
  { value: 'tratamento', label: 'Tratamento' },
  { value: 'consulta', label: 'Consulta' },
]

function primeiroDiaDoMes(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-01`
}

function ultimoDiaDoMes(data: Date) {
  const ultimoDia = new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate()
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
}

function subtrairMeses(data: Date, meses: number) {
  return new Date(data.getFullYear(), data.getMonth() - meses, 1)
}

export default async function RelatorioVendasHistoricasPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  // Mesmo guard de /relatorios/vendas — nunca mais permissivo (AC-086).
  await requireModulo('comercial:relatorio_vendas')

  const supabase = await createClient()
  const resolvedParams = await searchParams

  const hoje = new Date()
  const periodo = (resolvedParams.periodo as string) || '12m'

  let data_inicio: string
  let data_fim: string

  if (periodo === 'personalizado' && resolvedParams.data_inicio && resolvedParams.data_fim) {
    data_inicio = resolvedParams.data_inicio as string
    data_fim = resolvedParams.data_fim as string
  } else if (periodo === 'ytd') {
    data_inicio = `${hoje.getFullYear()}-01-01`
    data_fim = ultimoDiaDoMes(hoje)
  } else if (periodo === '24m') {
    data_inicio = primeiroDiaDoMes(subtrairMeses(hoje, 23))
    data_fim = ultimoDiaDoMes(hoje)
  } else if (periodo === '6m') {
    data_inicio = primeiroDiaDoMes(subtrairMeses(hoje, 5))
    data_fim = ultimoDiaDoMes(hoje)
  } else {
    data_inicio = primeiroDiaDoMes(subtrairMeses(hoje, 11))
    data_fim = ultimoDiaDoMes(hoje)
  }

  const profissional_id = (resolvedParams.profissional_id as string) || ''
  const origem = (resolvedParams.origem as string) || ''
  const categoria = (resolvedParams.categoria as string) || ''

  // Filtro por médico: aceita medico_id (novo) e medico_nome (compatibilidade
  // com URLs salvas antes da migração para filtro por id, AC-082).
  let medico_id = (resolvedParams.medico_id as string) || ''
  const medico_nome = (resolvedParams.medico_nome as string) || ''

  const [
    { data: profissionaisRaw },
    { data: medicosRaw },
    medicoResolvido,
    origensCatalogo,
  ] = await Promise.all([
    supabase.from('profiles').select('id, full_name').in('role', ['fisioterapeuta', 'gestor']).order('full_name'),
    supabase.from('profiles').select('id, full_name').eq('role', 'medico').eq('ativo', true).order('full_name'),
    !medico_id && medico_nome
      ? supabase.from('profiles').select('id').eq('role', 'medico').eq('full_name', medico_nome).maybeSingle()
      : Promise.resolve({ data: null }),
    listarOrigensVenda(),
  ])
  const ORIGENS = origensParaOpcoes(origensCatalogo)

  if (!medico_id && medicoResolvido?.data?.id) {
    medico_id = medicoResolvido.data.id
  }

  const profissionaisFiltro = (profissionaisRaw || []).map((p: { id: string; full_name: string | null }) => ({
    id: p.id,
    nome: p.full_name || 'Sem nome',
  }))
  const medicosFiltro = (medicosRaw || []).map((m: { id: string; full_name: string | null }) => ({
    id: m.id,
    nome: m.full_name || '',
  })).filter((m) => m.nome)

  const { data: resumoRaw, error: erroResumo } = await supabase.rpc('fn_vendas_resumo_mensal', {
    p_data_inicio: data_inicio,
    p_data_fim: data_fim,
    p_profissional_id: profissional_id || null,
    p_medico_id: medico_id || null,
    p_origem: origem || null,
    p_categoria: categoria || null,
  })

  if (erroResumo) {
    console.error('[relatorios/vendas-historicas] erro ao chamar fn_vendas_resumo_mensal:', erroResumo.message)
  }

  const linhas = (resumoRaw ?? []) as unknown as LinhaMensal[]
  const cards = derivarCardsExecutivos(linhas)
  const tabela = montarTabelaHistorico(linhas)

  function buildFiltroUrl(overrides: Record<string, string | undefined>) {
    const sp = new URLSearchParams()
    const params = { periodo, data_inicio: resolvedParams.data_inicio as string | undefined, data_fim: resolvedParams.data_fim as string | undefined, profissional_id, origem, categoria, medico_id, ...overrides }
    if (params.periodo && params.periodo !== '12m') sp.set('periodo', params.periodo)
    if (params.periodo === 'personalizado') {
      if (params.data_inicio) sp.set('data_inicio', params.data_inicio)
      if (params.data_fim) sp.set('data_fim', params.data_fim)
    }
    if (params.profissional_id) sp.set('profissional_id', params.profissional_id)
    if (params.origem) sp.set('origem', params.origem)
    if (params.categoria) sp.set('categoria', params.categoria)
    if (params.medico_id) sp.set('medico_id', params.medico_id)
    const qs = sp.toString()
    return qs ? `/relatorios/vendas-historicas?${qs}` : '/relatorios/vendas-historicas'
  }

  const temFiltro = !!(profissional_id || origem || categoria || medico_id || periodo !== '12m')

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div>
        <div className="text-xs text-text-secondary mb-2 flex items-center gap-2">
          <Link href="/dashboard" className="hover:text-primary-500 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/relatorios/vendas" className="hover:text-primary-500 transition-colors">Relatório de Vendas</Link>
          <span>/</span>
          <span className="text-text-primary font-medium">Vendas Históricas</span>
        </div>
        <h1 className="text-2xl font-semibold text-text-primary flex items-center gap-2">
          <LineChart size={28} className="text-primary-500" />
          Vendas Históricas
        </h1>
      </div>

      {/* Filtros */}
      <form method="get" className="bg-surface rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold text-text-primary mb-3">Filtros</h2>
        <div className="flex items-end gap-4 flex-wrap">
          <FiltroPeriodoVendasHistoricas
            defaultPeriodo={periodo}
            defaultDataInicio={data_inicio}
            defaultDataFim={data_fim}
          />
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
          <div>
            <label className="block text-xs text-text-secondary uppercase mb-1">Médico Referenciador</label>
            <select
              name="medico_id"
              defaultValue={medico_id}
              className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
            >
              <option value="">Todos os médicos</option>
              {medicosFiltro.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
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
            <label className="block text-xs text-text-secondary uppercase mb-1">Categoria</label>
            <select
              name="categoria"
              defaultValue={categoria}
              className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
            >
              <option value="">Todas as categorias</option>
              {CATEGORIAS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-md text-sm font-medium transition-colors"
          >
            Filtrar
          </button>
          {temFiltro && (
            <Link
              href="/relatorios/vendas-historicas"
              className="px-4 py-2 bg-page hover:bg-page/80 border border-border text-text-secondary rounded-md text-sm transition-colors"
            >
              Limpar
            </Link>
          )}
        </div>
      </form>

      {/* Cards executivos (AC-078) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-surface rounded-lg border border-border p-4">
          <p className="text-xs text-text-secondary uppercase font-medium mb-2">Faturamento Histórico Total</p>
          <p className="text-2xl font-bold text-text-primary">
            R$ {cards.faturamentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <p className="text-xs text-text-secondary uppercase font-medium mb-2">Volume Total de Vendas</p>
          <p className="text-2xl font-bold text-text-primary">{cards.volumeTotal}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <p className="text-xs text-text-secondary uppercase font-medium mb-2">Ticket Médio Consolidado</p>
          <p className="text-2xl font-bold text-text-primary">
            R$ {cards.ticketMedioConsolidado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <p className="text-xs text-text-secondary uppercase font-medium mb-2">Melhor Mês</p>
          {cards.melhorMes ? (
            <>
              <p className="text-lg font-bold text-text-primary">
                {new Date(cards.melhorMes.mes + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase()}
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                R$ {cards.melhorMes.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </>
          ) : (
            <p className="text-lg font-bold text-text-secondary">—</p>
          )}
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <p className="text-xs text-text-secondary uppercase font-medium mb-2">Crescimento Médio MoM</p>
          <p className="text-2xl font-bold text-text-primary">
            {cards.crescimentoMedioMoM !== null ? `${cards.crescimentoMedioMoM >= 0 ? '▲' : '▼'} ${Math.abs(cards.crescimentoMedioMoM).toFixed(1)}%` : '—'}
          </p>
        </div>
      </div>

      {/* Gráfico + Tabela + Drill-down (cliente) */}
      <VendasHistoricasClient
        linhas={tabela}
        filtros={{ profissional_id, medico_id, origem, categoria, data_inicio, data_fim }}
        cards={cards}
        periodoLabel={`${data_inicio} até ${data_fim}`}
        filtrosLabel={[
          profissional_id && `Profissional: ${profissionaisFiltro.find((p) => p.id === profissional_id)?.nome || profissional_id}`,
          medico_id && `Médico: ${medicosFiltro.find((m) => m.id === medico_id)?.nome || medico_id}`,
          origem && `Origem: ${ORIGENS.find((o) => o.value === origem)?.label || origem}`,
          categoria && `Categoria: ${CATEGORIAS.find((c) => c.value === categoria)?.label || categoria}`,
        ].filter(Boolean).join(' · ')}
      />
    </div>
  )
}
