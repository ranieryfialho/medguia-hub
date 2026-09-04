import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { BarChart3, TrendingUp, Users, Package, Stethoscope, FileText, CheckCircle, XCircle, Clock, Tag, List } from 'lucide-react'
import { RelatorioVendasClient, FiltroOrigemMedico, GraficoFaturamentoPeriodo, ConversoesPorProfissional } from '@/components/features/relatorios'
import { BtnGerarPdfVendas } from '@/components/features/shared'
import { FiltroProdutosMultiSelect } from '@/components/features/produtos'
import { requireModulo } from '@/lib/guard'
import { FORMAS_PAGAMENTO, TIPO_VENDA_LABEL } from '@/lib/vendas'
import type { VendaDetalhe, ItemDetalheVenda } from '@/lib/relatorios/pdf-vendas'
import { formatAppDateKey, getAppDayRangeUTC } from '@/lib/datetime'

const ORIGENS = [
  { value: 'medico', label: 'Médico' },
  { value: 'leads', label: 'Leads' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'renovacao', label: 'Renovação' },
  { value: 'campanha', label: 'Campanha' },
]

type PerfilVenda = {
  full_name: string | null
  role: string | null
}

type PacienteVenda = {
  nome: string | null
  origem: string | null
}

type ProdutoVenda = {
  id: string
  nome: string | null
  categoria: string | null
}

type ItemVendaRow = {
  quantidade: number
  preco_unitario: number
  produtos: ProdutoVenda | null
}

type VendaRow = {
  id: string
  origem: string
  forma_pagamento: string
  data_venda: string
  profissional_id: string
  paciente_id: string
  medico_referenciador_nome: string | null
  venda_em_consultorio: boolean | null
  status: string | null
  tipo_venda: string | null
  nome: string | null
  motivo_recusa: string | null
  objecao_motivo_nome: string | null
  objecao_observacao: string | null
  pacientes: PacienteVenda | PacienteVenda[] | null
  profiles: PerfilVenda | PerfilVenda[] | null
  itens_venda: ItemVendaRow[] | null
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function parsearOrigemPaciente(origem: string | null | undefined): string {
  if (!origem?.trim()) return 'Não informada'
  const base = origem.split('::')[0].trim()
  if (!base) return 'Não informada'
  const baseNorm = base.charAt(0).toUpperCase() + base.slice(1).toLowerCase()
  if (baseNorm === 'Facebook') return 'Facebook'
  if (baseNorm === 'Meta') return 'Meta'
  return baseNorm
}

export default async function RelatorioVendasPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  await requireModulo('comercial:relatorio_vendas')

  const supabase = await createClient()
  const resolvedParams = await searchParams

  const hoje = new Date()
  const primeiroDiaMesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
  const ultimoDiaMesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()).padStart(2, '0')}`

  const data_inicio = (resolvedParams.data_inicio as string | undefined) ?? primeiroDiaMesAtual
  const data_fim = (resolvedParams.data_fim as string | undefined) ?? ultimoDiaMesAtual
  const origem = (resolvedParams.origem as string) || ''
  const modalidade = origem === 'medico' ? ((resolvedParams.modalidade as string) || '') : ''
  const forma_pagamento = (resolvedParams.forma_pagamento as string) || ''
  const profissional_id = (resolvedParams.profissional_id as string) || ''
  const nome_protocolo = (resolvedParams.nome_protocolo as string) || ''
  const status_filter = (resolvedParams.status as string) || ''
  const produtoIds = Array.isArray(resolvedParams.produto_id)
    ? resolvedParams.produto_id.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : typeof resolvedParams.produto_id === 'string' && resolvedParams.produto_id
      ? [resolvedParams.produto_id]
      : []

  const medicoNomes = Array.isArray(resolvedParams.medico_nome)
    ? resolvedParams.medico_nome.filter((v): v is string => typeof v === 'string' && v.length > 0)
    : typeof resolvedParams.medico_nome === 'string' && resolvedParams.medico_nome
      ? [resolvedParams.medico_nome]
      : []

  const LIMITE_DETALHE = 10
  const paginaVendas = Math.max(1, parseInt((resolvedParams.pagina_vendas as string) || '1'))

  function buildPaginaUrl(p: number) {
    const sp = new URLSearchParams()
    if (data_inicio) sp.set('data_inicio', data_inicio)
    if (data_fim) sp.set('data_fim', data_fim)
    if (origem) sp.set('origem', origem)
    if (modalidade) sp.set('modalidade', modalidade)
    if (forma_pagamento) sp.set('forma_pagamento', forma_pagamento)
    if (profissional_id) sp.set('profissional_id', profissional_id)
    if (nome_protocolo) sp.set('nome_protocolo', nome_protocolo)
    if (status_filter) sp.set('status', status_filter)
    produtoIds.forEach(id => sp.append('produto_id', id))
    medicoNomes.forEach(nome => sp.append('medico_nome', nome))
    if (p > 1) sp.set('pagina_vendas', String(p))
    const qs = sp.toString()
    return qs ? `/relatorios/vendas?${qs}` : '/relatorios/vendas'
  }

  // Query única com join em profissional e itens+produto. count: 'exact'
  // sustenta a checagem de truncamento abaixo (AC-077).
  let query = supabase
    .from('vendas')
    .select(`
      id, origem, forma_pagamento, data_venda, profissional_id, paciente_id, medico_referenciador_nome, venda_em_consultorio, status, tipo_venda, nome, motivo_recusa, objecao_motivo_nome, objecao_observacao,
      pacientes:paciente_id ( nome, origem ),
      profiles:profissional_id ( full_name, role ),
      itens_venda ( quantidade, preco_unitario, produtos:produto_id ( id, nome, categoria ) )
    `, { count: 'exact' })

  if (data_inicio) query = query.gte('data_venda', getAppDayRangeUTC(data_inicio).start)
  if (data_fim) query = query.lte('data_venda', getAppDayRangeUTC(data_fim).end)
  if (origem) query = query.eq('origem', origem)
  if (forma_pagamento) query = query.eq('forma_pagamento', forma_pagamento)
  if (profissional_id) query = query.eq('profissional_id', profissional_id)
  if (nome_protocolo === '__sem_protocolo__') {
    query = query.is('nome', null)
  } else if (nome_protocolo) {
    query = query.eq('nome', nome_protocolo)
  }
  if (status_filter) query = query.eq('status', status_filter)
  if (origem === 'medico' && medicoNomes.length > 0) query = query.in('medico_referenciador_nome', medicoNomes)
  if (modalidade === 'consultorio') query = query.eq('venda_em_consultorio', true)
  if (modalidade === 'fisio') query = query.eq('venda_em_consultorio', false)

  // Buscar vendas e dados auxiliares em paralelo. A listagem detalhada usa
  // .range() explícito (AC-077) — fecha o truncamento silencioso do
  // PostgREST sem limite. fn_vendas_resumo_mensal roda em paralelo só para
  // validação lado a lado dos KPIs (T-011); não filtra por status_filter,
  // forma_pagamento, nome_protocolo ou produto_id pois esses parâmetros não
  // existem na função canônica — a comparação só é válida quando nenhum
  // desses filtros extras está ativo.
  const [
    { data: vendasRaw, count: vendasCount },
    { data: profissionaisRaw },
    { data: produtosRaw },
    { data: protocolosRaw },
    { data: medicosRaw },
    resumoCanonico,
  ] = await Promise.all([
    query.range(0, 9999),
    supabase.from('profiles').select('id, full_name, role').in('role', ['fisioterapeuta', 'gestor']).order('full_name'),
    supabase.from('produtos').select('id, nome').eq('ativo', true).order('nome'),
    supabase.from('protocolos').select('nome').eq('ativo', true).order('nome'),
    supabase.from('profiles').select('id, full_name').eq('role', 'medico').eq('ativo', true).order('full_name'),
    data_inicio && data_fim
      ? supabase.rpc('fn_vendas_resumo_mensal', {
          p_data_inicio: data_inicio,
          p_data_fim: data_fim,
          p_profissional_id: profissional_id || null,
          p_origem: origem || null,
          p_modalidade: modalidade || null,
        })
      : Promise.resolve({ data: null, error: null }),
  ])
  const vendas = (vendasRaw ?? []) as unknown as VendaRow[]

  if (vendasCount !== null && vendasCount > vendas.length) {
    console.error(
      `[relatorios/vendas] truncamento: ${vendasCount} vendas no período, apenas ${vendas.length} carregadas — aumentar o range().`
    )
  }

  const profissionaisFiltro = (profissionaisRaw || []).map((p: { id: string; full_name: string | null; role: string | null }) => ({
    id: p.id,
    nome: p.full_name || 'Sem nome',
    role: p.role,
  }))
  const produtosFiltro = (produtosRaw || []).map((produto: { id: string; nome: string }) => ({
    id: produto.id,
    nome: produto.nome,
  }))
  const protocolosFiltro = (protocolosRaw || []).map((p: { nome: string }) => p.nome)
  const medicosFiltro = (medicosRaw || []).map((m: { id: string; full_name: string | null }) => ({
    id: m.id,
    full_name: m.full_name || '',
  })).filter((m) => m.full_name)

  // ── Agregações ──────────────────────────────────────────────

  type AgregacaoNome = { nome: string; quantidade: number; faturamento: number }

  const porOrigem: Record<string, { quantidade: number; faturamento: number }> = {}
  const porFormaPagamento: Record<string, { quantidade: number; faturamento: number }> = {}
  const porProfissional: Record<string, AgregacaoNome> = {}
  const porProduto: Record<string, AgregacaoNome> = {}
  const porReferenciador: Record<string, AgregacaoNome & { qtdConsultorio: number; faturamentoConsultorio: number; qtdFisio: number; faturamentoFisio: number }> = {}
  const vendasPorReferenciador: Record<string, VendaDetalhe[]> = {}
  const porPeriodo: Record<string, number> = {}
  const porCategoria: Record<string, { quantidade: number; faturamento: number }> = {}
  const vendasDetalhadas: VendaDetalhe[] = []

  // Segmentação consultório vs. conversão fisio (T-009) — só populada para
  // vendas de origem médica confirmadas.
  let faturamentoConsultorio = 0
  let qtdConsultorio = 0
  let faturamentoFisio = 0
  let qtdFisio = 0
  let qtdEncaminhamentosMedicos = 0
  const porProfissionalModalidade: Record<string, { conversoesFisio: number; atendimentosConsultorio: number }> = {}

  // Detalhamento de conversões por profissional e origem (ex.: "6 consultórios,
  // 3 Leads e 1 renovação") — só vendas confirmadas.
  type ConversaoDetalhe = { paciente_nome: string; origem_label: string; data_venda: string; total: number }
  const porProfissionalOrigem: Record<string, { nome: string; total: number; origens: Record<string, number>; vendas: ConversaoDetalhe[] }> = {}

  // Agregações de orçamentos
  let orcamentoPendenteCount = 0
  let orcamentoPendenteValor = 0
  let orcamentoRecusadoCount = 0
  let orcamentoRecusadoValor = 0
  let orcamentoConvertidoCount = 0

  const produtoIdsSet = produtoIds.length > 0 ? new Set(produtoIds) : null

  for (const venda of vendas) {
    const itensOriginais = venda.itens_venda ?? []
    const itens = produtoIdsSet
      ? itensOriginais.filter((item) => {
          const produtoId = item.produtos?.id
          return produtoId ? produtoIdsSet.has(produtoId) : false
        })
      : itensOriginais

    if (itens.length === 0) continue

    const perfil = firstRelation(venda.profiles)
    const paciente = firstRelation(venda.pacientes)
    const statusVenda = venda.status ?? 'venda_confirmada'

    const totalVenda = itens.reduce(
      (s, item) => s + item.quantidade * item.preco_unitario,
      0
    )

    // Registro de detalhe para todas as vendas (todos os status)
    vendasDetalhadas.push({
      id: venda.id,
      data_venda: venda.data_venda,
      paciente_nome: paciente?.nome || '—',
      paciente_origem: parsearOrigemPaciente(paciente?.origem),
      profissional_nome: perfil?.full_name || 'Desconhecido',
      medico_referenciador_nome: venda.medico_referenciador_nome || null,
      nome: venda.nome || null,
      status: statusVenda,
      tipo_venda: venda.tipo_venda || null,
      motivo_recusa: venda.motivo_recusa || null,
      objecao_motivo_nome: venda.objecao_motivo_nome || null,
      objecao_observacao: venda.objecao_observacao || null,
      origem: venda.origem,
      venda_em_consultorio: venda.venda_em_consultorio,
      itens: itens.map((item): ItemDetalheVenda => ({
        produto_nome: item.produtos?.nome || 'Produto removido',
        categoria: item.produtos?.categoria || null,
        quantidade: item.quantidade,
        subtotal: item.quantidade * item.preco_unitario,
      })),
      total: totalVenda,
    })

    // Taxa de conversão da equipe (AC-072): denominador é todo encaminhamento
    // médico com registro (venda confirmada + orçamento recusado), incluído
    // aqui antes do `continue` de orçamentos. Vendas com venda_em_consultorio
    // NULL (não classificadas) ficam fora dos dois lados da conta.
    if (venda.origem === 'medico' && (statusVenda === 'venda_confirmada' || statusVenda === 'orcamento_recusado') && venda.venda_em_consultorio !== null) {
      qtdEncaminhamentosMedicos += 1
    }

    // Acumular orçamentos separadamente (não entram nos KPIs principais)
    if (statusVenda === 'orcamento_pendente') {
      orcamentoPendenteCount += 1
      orcamentoPendenteValor += totalVenda
      continue
    }
    if (statusVenda === 'orcamento_recusado') {
      orcamentoRecusadoCount += 1
      orcamentoRecusadoValor += totalVenda
      continue
    }

    // A partir daqui, apenas vendas confirmadas
    orcamentoConvertidoCount += 1

    // Por origem
    if (!porOrigem[venda.origem]) porOrigem[venda.origem] = { quantidade: 0, faturamento: 0 }
    porOrigem[venda.origem].quantidade += 1
    porOrigem[venda.origem].faturamento += totalVenda

    // Segmentação consultório vs. conversão fisio (T-009) — só vendas médicas
    // confirmadas e classificadas (venda_em_consultorio não-nulo) entram.
    if (venda.origem === 'medico' && venda.venda_em_consultorio !== null) {
      if (!porProfissionalModalidade[venda.profissional_id]) {
        porProfissionalModalidade[venda.profissional_id] = { conversoesFisio: 0, atendimentosConsultorio: 0 }
      }
      if (venda.venda_em_consultorio) {
        faturamentoConsultorio += totalVenda
        qtdConsultorio += 1
        porProfissionalModalidade[venda.profissional_id].atendimentosConsultorio += 1
      } else {
        faturamentoFisio += totalVenda
        qtdFisio += 1
        porProfissionalModalidade[venda.profissional_id].conversoesFisio += 1
      }
    }

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

    // Detalhamento por profissional e origem (ex.: consultório, leads, renovação)
    if (!porProfissionalOrigem[venda.profissional_id]) {
      porProfissionalOrigem[venda.profissional_id] = { nome: profNome, total: 0, origens: {}, vendas: [] }
    }
    const origemLabel =
      venda.origem === 'medico'
        ? venda.venda_em_consultorio === true
          ? 'Consultório'
          : venda.venda_em_consultorio === false
            ? 'Conversão Fisio'
            : 'Médico'
        : ORIGENS.find((o) => o.value === venda.origem)?.label || venda.origem
    porProfissionalOrigem[venda.profissional_id].total += 1
    porProfissionalOrigem[venda.profissional_id].origens[origemLabel] =
      (porProfissionalOrigem[venda.profissional_id].origens[origemLabel] || 0) + 1
    porProfissionalOrigem[venda.profissional_id].vendas.push({
      paciente_nome: paciente?.nome || '—',
      origem_label: origemLabel,
      data_venda: venda.data_venda,
      total: totalVenda,
    })

    // Por referenciador
    const refNome = venda.medico_referenciador_nome
    if (refNome) {
      if (!porReferenciador[refNome]) {
        porReferenciador[refNome] = { nome: refNome, quantidade: 0, faturamento: 0, qtdConsultorio: 0, faturamentoConsultorio: 0, qtdFisio: 0, faturamentoFisio: 0 }
      }
      porReferenciador[refNome].quantidade += 1
      porReferenciador[refNome].faturamento += totalVenda
      if (venda.venda_em_consultorio === true) {
        porReferenciador[refNome].qtdConsultorio += 1
        porReferenciador[refNome].faturamentoConsultorio += totalVenda
      } else if (venda.venda_em_consultorio === false) {
        porReferenciador[refNome].qtdFisio += 1
        porReferenciador[refNome].faturamentoFisio += totalVenda
      }

      if (!vendasPorReferenciador[refNome]) vendasPorReferenciador[refNome] = []
      vendasPorReferenciador[refNome].push({
        id: venda.id,
        data_venda: venda.data_venda,
        paciente_nome: firstRelation(venda.pacientes)?.nome || '—',
        paciente_origem: parsearOrigemPaciente(paciente?.origem),
        profissional_nome: perfil?.full_name || 'Desconhecido',
        nome: venda.nome || null,
        status: statusVenda,
        motivo_recusa: venda.motivo_recusa || null,
        objecao_motivo_nome: venda.objecao_motivo_nome || null,
        objecao_observacao: venda.objecao_observacao || null,
        itens: itens.map((item): ItemDetalheVenda => ({
          produto_nome: item.produtos?.nome || 'Produto removido',
          categoria: item.produtos?.categoria || null,
          quantidade: item.quantidade,
          subtotal: item.quantidade * item.preco_unitario,
        })),
        total: totalVenda,
      })
    }

    // Por produto e por categoria
    for (const item of itens) {
      const prodNome = item.produtos?.nome || 'Produto removido'
      const prodKey = prodNome
      if (!porProduto[prodKey]) porProduto[prodKey] = { nome: prodNome, quantidade: 0, faturamento: 0 }
      porProduto[prodKey].quantidade += item.quantidade
      porProduto[prodKey].faturamento += item.quantidade * item.preco_unitario

      const cat = item.produtos?.categoria || 'sem_categoria'
      if (!porCategoria[cat]) porCategoria[cat] = { quantidade: 0, faturamento: 0 }
      porCategoria[cat].quantidade += item.quantidade
      porCategoria[cat].faturamento += item.quantidade * item.preco_unitario
    }

    // Por período — respeita o range do filtro ativo
    const diaKey = formatAppDateKey(venda.data_venda)
    if ((!data_inicio || diaKey >= data_inicio) && (!data_fim || diaKey <= data_fim)) {
      if (!porPeriodo[diaKey]) porPeriodo[diaKey] = 0
      porPeriodo[diaKey] += totalVenda
    }
  }

  const totalFaturado = Object.values(porOrigem).reduce((s, o) => s + o.faturamento, 0)
  const totalVendas = orcamentoConvertidoCount
  const vendaMedia = totalVendas > 0 ? totalFaturado / totalVendas : 0

  // Validação lado a lado (T-011, protocolo do TDD): compara os KPIs do
  // laço em memória com fn_vendas_resumo_mensal somada sobre o mesmo
  // intervalo. Só é válida quando nenhum filtro extra (não suportado pela
  // função) está ativo — nesses casos a comparação é pulada silenciosamente.
  // Divergência aqui não bloqueia a página: fica só como log para
  // acompanhamento antes do corte (fase 5 do TDD, "remover o caminho antigo
  // só depois da comparação bater").
  if (resumoCanonico?.data && !forma_pagamento && !nome_protocolo && !status_filter && produtoIds.length === 0 && medicoNomes.length === 0) {
    const linhas = resumoCanonico.data as Array<{ faturamento: number; qtd_vendas: number }>
    const faturamentoCanonico = linhas.reduce((s, l) => s + Number(l.faturamento), 0)
    const qtdCanonica = linhas.reduce((s, l) => s + l.qtd_vendas, 0)
    if (Math.abs(faturamentoCanonico - totalFaturado) > 0.01 || qtdCanonica !== totalVendas) {
      console.warn(
        `[relatorios/vendas] divergência KPIs vs. fn_vendas_resumo_mensal — ` +
        `faturamento: ${totalFaturado} (atual) vs. ${faturamentoCanonico} (canônico); ` +
        `qtd_vendas: ${totalVendas} (atual) vs. ${qtdCanonica} (canônico). ` +
        `período: ${data_inicio}..${data_fim}, origem: ${origem || 'todas'}, profissional: ${profissional_id || 'todos'}, modalidade: ${modalidade || 'todas'}`
      )
    }
  }

  const totalOrcamentos = orcamentoPendenteCount + orcamentoRecusadoCount + orcamentoConvertidoCount
  const taxaConversao = totalOrcamentos > 0 ? (orcamentoConvertidoCount / totalOrcamentos) * 100 : null

  const objecoesMaisComuns = (() => {
    const mapa = new Map<string, { nome: string; quantidade: number; valor: number }>()
    for (const venda of vendasDetalhadas) {
      if (venda.status !== 'orcamento_pendente' || !venda.objecao_motivo_nome) continue
      const entry = mapa.get(venda.objecao_motivo_nome) ?? { nome: venda.objecao_motivo_nome, quantidade: 0, valor: 0 }
      entry.quantidade += 1
      entry.valor += venda.total
      mapa.set(venda.objecao_motivo_nome, entry)
    }
    return [...mapa.values()].sort((a, b) => b.quantidade - a.quantidade)
  })()

  const profissionaisResumo = Object.values(porProfissional)
  const produtosResumo = Object.values(porProduto)

  // Taxa de conversão da equipe (AC-072): convertidas pelo fisio ÷ total de
  // encaminhamentos médicos com registro (confirmadas + orçamento recusado).
  const taxaConversaoEquipe = qtdEncaminhamentosMedicos > 0 ? (qtdFisio / qtdEncaminhamentosMedicos) * 100 : null

  const detalhamentoPorProfissional = Object.values(porProfissionalOrigem)
    .map((p) => ({
      nome: p.nome,
      total: p.total,
      origens: Object.entries(p.origens).sort(([, a], [, b]) => b - a),
      vendas: [...p.vendas].sort((a, b) => a.data_venda.localeCompare(b.data_venda)),
    }))
    .sort((a, b) => b.total - a.total)

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
          {vendasDetalhadas.length > 0 && (
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
              porProfissional={profissionaisResumo}
              porProduto={produtosResumo}
              porReferenciador={Object.values(porReferenciador)}
              vendasPorReferenciador={vendasPorReferenciador}
              porCategoria={porCategoria}
              vendasDetalhadas={vendasDetalhadas}
              resumoMedico={{
                faturamentoConsultorio,
                qtdConsultorio,
                faturamentoFisio,
                qtdFisio,
                taxaConversaoEquipe,
              }}
              detalhamentoPorProfissional={detalhamentoPorProfissional}
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
          <FiltroOrigemMedico
            defaultOrigem={origem}
            defaultMedicoNomes={medicoNomes}
            medicos={medicosFiltro}
            defaultModalidade={modalidade}
          />
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
          <div>
            <label className="block text-xs text-text-secondary uppercase mb-1">Status</label>
            <select
              name="status"
              defaultValue={status_filter}
              className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
            >
              <option value="">Todos os status</option>
              <option value="venda_confirmada">Venda Confirmada</option>
              <option value="orcamento_pendente">Orçamento Pendente</option>
              <option value="orcamento_recusado">Orçamento Recusado</option>
            </select>
          </div>
          {protocolosFiltro.length > 0 && (
            <div>
              <label className="block text-xs text-text-secondary uppercase mb-1">Protocolo</label>
              <select
                name="nome_protocolo"
                defaultValue={nome_protocolo}
                className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
              >
                <option value="">Todos</option>
                <option value="__sem_protocolo__">Sem protocolo</option>
                {protocolosFiltro.map((nome) => (
                  <option key={nome} value={nome}>{nome}</option>
                ))}
              </select>
            </div>
          )}
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
          {(data_inicio || data_fim || origem || modalidade || forma_pagamento || profissional_id || nome_protocolo || status_filter || produtoIds.length > 0 || medicoNomes.length > 0) && (
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
            {profissionaisResumo.length}
          </p>
        </div>
      </div>

      {/* Faturamento ao Longo do Tempo */}
      <GraficoFaturamentoPeriodo porPeriodo={porPeriodo} />

      {/* Funil de Orçamentos */}
      {(orcamentoPendenteCount > 0 || orcamentoRecusadoCount > 0 || orcamentoConvertidoCount > 0) && (
        <div className="bg-surface rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <FileText size={20} className="text-primary-500" />
            Funil de Orçamentos
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock size={16} className="text-amber-600" />
                <p className="text-xs text-amber-700 font-semibold uppercase">Pendentes</p>
              </div>
              <p className="text-2xl font-bold text-amber-800">{orcamentoPendenteCount}</p>
              <p className="text-sm text-amber-600 mt-0.5">
                R$ {orcamentoPendenteValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle size={16} className="text-emerald-600" />
                <p className="text-xs text-emerald-700 font-semibold uppercase">Convertidos</p>
              </div>
              <p className="text-2xl font-bold text-emerald-800">{orcamentoConvertidoCount}</p>
              <p className="text-sm text-emerald-600 mt-0.5">Vendas confirmadas</p>
            </div>
            <div className="bg-red-50 rounded-lg border border-red-200 p-4">
              <div className="flex items-center gap-2 mb-1">
                <XCircle size={16} className="text-red-600" />
                <p className="text-xs text-red-700 font-semibold uppercase">Recusados</p>
              </div>
              <p className="text-2xl font-bold text-red-800">{orcamentoRecusadoCount}</p>
              <p className="text-sm text-red-600 mt-0.5">
                R$ {orcamentoRecusadoValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-page rounded-lg border border-border p-4">
              <p className="text-xs text-text-secondary font-semibold uppercase mb-1">Taxa de Conversão</p>
              <p className="text-2xl font-bold text-text-primary">
                {taxaConversao !== null ? `${taxaConversao.toFixed(1)}%` : '—'}
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                {totalOrcamentos} orçamento{totalOrcamentos !== 1 ? 's' : ''} no período
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Objeções mais comuns nos orçamentos pendentes */}
      {objecoesMaisComuns.length > 0 && (
        <div className="bg-surface rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <FileText size={20} className="text-primary-500" />
            Objeções mais comuns
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[420px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 text-xs font-semibold text-text-secondary uppercase">Objeção</th>
                  <th className="py-2 pr-4 text-xs font-semibold text-text-secondary uppercase text-right">Qtd.</th>
                  <th className="py-2 text-xs font-semibold text-text-secondary uppercase text-right">Valor em orçamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {objecoesMaisComuns.map((objecao) => (
                  <tr key={objecao.nome}>
                    <td className="py-2 pr-4 text-sm text-text-primary">{objecao.nome}</td>
                    <td className="py-2 pr-4 text-sm text-text-primary text-right">{objecao.quantidade}</td>
                    <td className="py-2 text-sm text-text-primary text-right">
                      R$ {objecao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Segmentação Consultório vs. Conversão Fisio (T-009) */}
      {(qtdConsultorio > 0 || qtdFisio > 0) && (
        <div className="bg-surface rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Stethoscope size={20} className="text-primary-500" />
            Origem Médica: Consultório vs. Conversão Fisio
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-teal-50 rounded-lg border border-teal-200 p-4">
              <p className="text-xs text-teal-700 font-semibold uppercase mb-1">Fechado em Consultório</p>
              <p className="text-2xl font-bold text-teal-800">
                R$ {faturamentoConsultorio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-teal-600 mt-0.5">{qtdConsultorio} venda{qtdConsultorio !== 1 ? 's' : ''}</p>
            </div>
            <div className="bg-indigo-50 rounded-lg border border-indigo-200 p-4">
              <p className="text-xs text-indigo-700 font-semibold uppercase mb-1">Convertido pelo Fisio</p>
              <p className="text-2xl font-bold text-indigo-800">
                R$ {faturamentoFisio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-indigo-600 mt-0.5">{qtdFisio} venda{qtdFisio !== 1 ? 's' : ''}</p>
            </div>
            <div className="bg-page rounded-lg border border-border p-4">
              <p className="text-xs text-text-secondary font-semibold uppercase mb-1">Taxa de Conversão da Equipe</p>
              <p className="text-2xl font-bold text-text-primary">
                {taxaConversaoEquipe !== null ? `${taxaConversaoEquipe.toFixed(1)}%` : '—'}
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                {qtdEncaminhamentosMedicos} encaminhamento{qtdEncaminhamentosMedicos !== 1 ? 's' : ''} classificado{qtdEncaminhamentosMedicos !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Gráficos (cliente) */}
      <RelatorioVendasClient
        porOrigem={porOrigem}
        porFormaPagamento={porFormaPagamento}
        porProfissional={profissionaisResumo}
        porProduto={produtosResumo}
        totalFaturado={totalFaturado}
      />

      {/* Detalhamento de conversões por profissional e origem */}
      <ConversoesPorProfissional detalhamento={detalhamentoPorProfissional} />

      {/* Tabela por Profissional */}
      {profissionaisResumo.length > 0 && (
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
                  <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase text-right">Conversões Ativas</th>
                  <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase text-right">% Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Object.entries(porProfissional)
                  .sort(([, a], [, b]) => b.faturamento - a.faturamento)
                  .map(([profissionalId, prof]) => {
                    const pct = totalFaturado > 0 ? (prof.faturamento / totalFaturado) * 100 : 0
                    const modalidade = porProfissionalModalidade[profissionalId]
                    return (
                      <tr key={profissionalId} className="hover:bg-page/50">
                        <td className="px-4 py-3 text-sm text-text-primary font-medium">{prof.nome}</td>
                        <td className="px-4 py-3 text-sm text-text-primary text-right">{prof.quantidade}</td>
                        <td className="px-4 py-3 text-sm text-text-primary text-right font-medium">
                          R$ {prof.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary text-right">
                          {modalidade
                            ? `${modalidade.conversoesFisio} conversão${modalidade.conversoesFisio !== 1 ? 'ões' : ''} · ${modalidade.atendimentosConsultorio} consultório`
                            : '—'}
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
      {produtosResumo.length > 0 && (
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
                {produtosResumo
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

      {/* Tabela por Referenciador */}
      {Object.keys(porReferenciador).length > 0 && (
        <div className="bg-surface rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Stethoscope size={20} className="text-primary-500" />
            Desempenho por Médico Referenciador
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase">Médico Referenciador</th>
                  <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase text-right">Vendas</th>
                  <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase text-right">Faturamento</th>
                  <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase text-right">Consultório</th>
                  <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase text-right">Conversão Fisio</th>
                  <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase text-right">% Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Object.values(porReferenciador)
                  .sort((a, b) => b.faturamento - a.faturamento)
                  .map((ref) => {
                    const pct = totalFaturado > 0 ? (ref.faturamento / totalFaturado) * 100 : 0
                    return (
                      <tr key={ref.nome} className="hover:bg-page/50">
                        <td className="px-4 py-3 text-sm text-text-primary font-medium">{ref.nome}</td>
                        <td className="px-4 py-3 text-sm text-text-primary text-right">{ref.quantidade}</td>
                        <td className="px-4 py-3 text-sm text-text-primary text-right font-medium">
                          R$ {ref.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary text-right">
                          {ref.qtdConsultorio} · R$ {ref.faturamentoConsultorio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary text-right">
                          {ref.qtdFisio} · R$ {ref.faturamentoFisio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-20 bg-border rounded-full h-1.5">
                              <div
                                className="bg-teal-500 h-1.5 rounded-full"
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

      {/* Detalhamento de Vendas por Médico Referenciador */}
      {Object.keys(vendasPorReferenciador).length > 0 && (() => {
        const statusConfig: Record<string, { label: string; cls: string }> = {
          venda_confirmada: { label: 'Confirmada', cls: 'bg-emerald-100 text-emerald-800' },
          orcamento_pendente: { label: 'Orçamento', cls: 'bg-amber-100 text-amber-800' },
          orcamento_recusado: { label: 'Recusado', cls: 'bg-red-100 text-red-800' },
        }
        return (
          <div className="bg-surface rounded-lg border border-border p-6">
            <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2 mb-6">
              <Stethoscope size={20} className="text-primary-500" />
              Detalhamento por Médico Referenciador
            </h2>
            <div className="space-y-8">
              {Object.entries(vendasPorReferenciador)
                .sort(([, a], [, b]) =>
                  b.reduce((s, v) => s + v.total, 0) - a.reduce((s, v) => s + v.total, 0)
                )
                .map(([medico, vendasMedico]) => {
                  const totalMedico = vendasMedico.reduce((s, v) => s + v.total, 0)
                  return (
                    <div key={medico} className="rounded-lg border border-border overflow-hidden">
                      {/* cabeçalho do médico */}
                      <div className="flex items-center justify-between px-4 py-3 bg-page border-b border-border">
                        <div className="flex items-center gap-2.5">
                          <Stethoscope size={16} className="text-primary-500 shrink-0" />
                          <span className="font-semibold text-text-primary">{medico}</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-border text-text-secondary">
                            {vendasMedico.length} venda{vendasMedico.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <span className="font-bold text-text-primary">
                          R$ {totalMedico.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* tabela de vendas */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left" style={{ minWidth: 640 }}>
                          <colgroup>
                            <col style={{ width: '110px' }} />
                            <col style={{ width: '25%' }} />
                            <col />
                            <col style={{ width: '130px' }} />
                            <col style={{ width: '110px' }} />
                          </colgroup>
                          <thead>
                            <tr className="border-b border-border bg-page/50">
                              <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase">Data</th>
                              <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase">Paciente</th>
                              <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase">Itens</th>
                              <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase text-right">Total</th>
                              <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {vendasMedico
                              .sort((a, b) => a.data_venda.localeCompare(b.data_venda))
                              .map((venda) => {
                                const sc = statusConfig[venda.status] ?? { label: venda.status, cls: 'bg-gray-100 text-gray-800' }
                                return (
                                  <tr key={venda.id} className="hover:bg-page/50">
                                    <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
                                      {new Date(venda.data_venda).toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="px-4 py-3">
                                      <p className="text-sm font-medium text-text-primary">{venda.paciente_nome}</p>
                                      {venda.paciente_origem && (
                                        <p className="text-xs text-text-secondary mt-0.5">Origem: {venda.paciente_origem}</p>
                                      )}
                                      {venda.nome && (
                                        <p className="text-xs text-primary-500 mt-0.5">{venda.nome}</p>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex flex-wrap gap-1.5">
                                        {venda.itens.map((item, idx) => (
                                          <span
                                            key={idx}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-page border border-border text-xs text-text-secondary"
                                          >
                                            {item.quantidade > 1 && (
                                              <span className="font-semibold text-text-primary">{item.quantidade}×</span>
                                            )}
                                            {item.produto_nome}
                                          </span>
                                        ))}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm font-medium text-text-primary text-right whitespace-nowrap">
                                      R$ {venda.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sc.cls}`}>
                                        {sc.label}
                                      </span>
                                    </td>
                                  </tr>
                                )
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )
      })()}

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

      {/* Faturamento por Categoria */}
      {Object.keys(porCategoria).some(k => k !== 'sem_categoria') && (
        <div className="bg-surface rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Tag size={20} className="text-primary-500" />
            Faturamento por Categoria
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(['tratamento', 'consulta'] as const).map((cat) => {
              const d = porCategoria[cat]
              if (!d) return null
              const pct = totalFaturado > 0 ? (d.faturamento / totalFaturado) * 100 : 0
              const label = cat === 'tratamento' ? 'Tratamento' : 'Consulta'
              const colorBg = cat === 'tratamento' ? 'bg-blue-50 border-blue-200' : 'bg-purple-50 border-purple-200'
              const colorText = cat === 'tratamento' ? 'text-blue-800' : 'text-purple-800'
              const colorBar = cat === 'tratamento' ? 'bg-blue-500' : 'bg-purple-500'
              return (
                <div key={cat} className={`rounded-lg border p-4 ${colorBg}`}>
                  <p className={`text-xs font-semibold uppercase mb-1 ${colorText}`}>{label}</p>
                  <p className={`text-2xl font-bold ${colorText}`}>
                    R$ {d.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className={`text-sm mt-0.5 ${colorText} opacity-75`}>{d.quantidade} item{d.quantidade !== 1 ? 's' : ''} vendido{d.quantidade !== 1 ? 's' : ''}</p>
                  <div className="mt-3 w-full bg-white/60 rounded-full h-1.5">
                    <div className={`${colorBar} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className={`text-xs mt-1 ${colorText} opacity-75`}>{pct.toFixed(1)}% do faturamento total</p>
                </div>
              )
            })}
            {porCategoria['sem_categoria'] && (
              <div className="rounded-lg border border-border bg-page p-4">
                <p className="text-xs font-semibold uppercase mb-1 text-text-secondary">Sem Categoria</p>
                <p className="text-2xl font-bold text-text-primary">
                  R$ {porCategoria['sem_categoria'].faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm mt-0.5 text-text-secondary">{porCategoria['sem_categoria'].quantidade} item{porCategoria['sem_categoria'].quantidade !== 1 ? 's' : ''}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vendas Detalhadas */}
      {vendasDetalhadas.length > 0 && (() => {
        const totalPaginasVendas = Math.ceil(vendasDetalhadas.length / LIMITE_DETALHE)
        const paginaAtual = Math.min(paginaVendas, totalPaginasVendas)
        const offsetVendas = (paginaAtual - 1) * LIMITE_DETALHE
        const vendasPaginadas = vendasDetalhadas.slice(offsetVendas, offsetVendas + LIMITE_DETALHE)

        const statusConfig: Record<string, { label: string; cls: string }> = {
          venda_confirmada: { label: 'Confirmada', cls: 'bg-emerald-100 text-emerald-800' },
          orcamento_pendente: { label: 'Orçamento', cls: 'bg-amber-100 text-amber-800' },
          orcamento_recusado: { label: 'Recusado', cls: 'bg-red-100 text-red-800' },
        }

        return (
          <div className="bg-surface rounded-lg border border-border p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <List size={20} className="text-primary-500" />
              Vendas Detalhadas
              <span className="ml-auto text-sm font-normal text-text-secondary">
                {vendasDetalhadas.length} venda{vendasDetalhadas.length !== 1 ? 's' : ''}
              </span>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[700px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase">Data</th>
                    <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase">Paciente</th>
                    <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase">Itens</th>
                    <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase text-right">Total</th>
                    <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase">Profissional</th>
                    <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase">Tipo da Venda</th>
                    <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {vendasPaginadas.map((venda) => {
                    const sc = statusConfig[venda.status] ?? { label: venda.status, cls: 'bg-gray-100 text-gray-800' }
                    return (
                      <tr key={venda.id} className="hover:bg-page/50">
                        <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
                          {new Date(venda.data_venda).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-text-primary font-medium">{venda.paciente_nome}</p>
                          {venda.paciente_origem && (
                            <p className="text-xs text-text-secondary mt-0.5">Origem: {venda.paciente_origem}</p>
                          )}
                          {venda.nome && (
                            <p className="text-xs text-primary-500 font-medium mt-0.5">{venda.nome}</p>
                          )}
                          {venda.origem === 'medico' && (
                            <span className={`inline-flex items-center mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              venda.venda_em_consultorio === true
                                ? 'bg-teal-100 text-teal-700'
                                : venda.venda_em_consultorio === false
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : 'bg-page text-text-secondary border border-border'
                            }`}>
                              {venda.venda_em_consultorio === true
                                ? '[Médico · Consultório]'
                                : venda.venda_em_consultorio === false
                                  ? '[Médico · Conversão Fisio]'
                                  : '[Médico · Não classificada]'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {venda.itens.map((item, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1 text-xs text-text-secondary">
                                {item.quantidade > 1 && <span className="font-semibold text-text-primary">{item.quantidade}×</span>}
                                {item.produto_nome}
                                {item.categoria === 'tratamento' && (
                                  <span className="px-1 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">T</span>
                                )}
                                {item.categoria === 'consulta' && (
                                  <span className="px-1 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">C</span>
                                )}
                                {idx < venda.itens.length - 1 && <span className="text-border">·</span>}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-text-primary text-right font-medium whitespace-nowrap">
                          R$ {venda.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary">{venda.profissional_nome.split(' ')[0]}</td>
                        <td className="px-4 py-3">
                          {venda.tipo_venda ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700">
                              {TIPO_VENDA_LABEL[venda.tipo_venda] ?? venda.tipo_venda}
                            </span>
                          ) : (
                            <span className="text-text-secondary text-sm">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sc.cls}`}>
                            {sc.label}
                          </span>
                          {venda.motivo_recusa && (
                            <p className="text-xs text-text-secondary mt-1 italic">{venda.motivo_recusa}</p>
                          )}
                          {venda.objecao_motivo_nome && (
                            <p className="text-xs text-text-secondary mt-1 italic">
                              Objeção: {venda.objecao_motivo_nome}
                              {venda.objecao_observacao ? ` — ${venda.objecao_observacao}` : ''}
                            </p>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-text-secondary">
                Exibindo {offsetVendas + 1}–{Math.min(offsetVendas + LIMITE_DETALHE, vendasDetalhadas.length)} de {vendasDetalhadas.length} venda{vendasDetalhadas.length !== 1 ? 's' : ''}
              </p>
              {totalPaginasVendas > 1 && (() => {
                const delta = 2
                const pages: (number | '...')[] = []
                for (let p = 1; p <= totalPaginasVendas; p++) {
                  if (p === 1 || p === totalPaginasVendas || (p >= paginaAtual - delta && p <= paginaAtual + delta)) {
                    pages.push(p)
                  } else if (pages[pages.length - 1] !== '...') {
                    pages.push('...')
                  }
                }
                return (
                  <div className="flex items-center gap-1 flex-wrap">
                    <Link
                      href={buildPaginaUrl(paginaAtual - 1)}
                      className={`px-3 py-1 rounded-md text-sm transition-colors ${paginaAtual === 1 ? 'pointer-events-none opacity-30 bg-page text-text-secondary' : 'bg-page text-text-primary hover:bg-border'}`}
                    >
                      ← Anterior
                    </Link>
                    {pages.map((p, i) =>
                      p === '...'
                        ? <span key={`el-${i}`} className="px-2 py-1 text-sm text-text-secondary select-none">…</span>
                        : <Link key={p} href={buildPaginaUrl(p)} className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${p === paginaAtual ? 'bg-primary-500 text-white' : 'bg-page text-text-primary hover:bg-border'}`}>{p}</Link>
                    )}
                    <Link
                      href={buildPaginaUrl(paginaAtual + 1)}
                      className={`px-3 py-1 rounded-md text-sm transition-colors ${paginaAtual === totalPaginasVendas ? 'pointer-events-none opacity-30 bg-page text-text-secondary' : 'bg-page text-text-primary hover:bg-border'}`}
                    >
                      Próxima →
                    </Link>
                  </div>
                )
              })()}
            </div>
          </div>
        )
      })()}

      {totalVendas === 0 && orcamentoPendenteCount === 0 && orcamentoRecusadoCount === 0 && (
        <div className="bg-surface rounded-lg border border-border p-12 text-center">
          <p className="text-text-secondary">Nenhuma venda ou orçamento encontrado para os filtros selecionados.</p>
        </div>
      )}
    </div>
  )
}
