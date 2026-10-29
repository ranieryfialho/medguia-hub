import type { jsPDF } from 'jspdf'
import { TIPO_VENDA_LABEL } from '@/lib/vendas'

export type AgregacaoNome = { nome: string; quantidade: number; faturamento: number }

export type ItemDetalheVenda = {
  produto_nome: string
  categoria: string | null
  quantidade: number
  subtotal: number
}

export type VendaDetalhe = {
  id: string
  data_venda: string
  paciente_nome: string
  paciente_origem?: string | null
  profissional_nome: string
  medico_referenciador_nome?: string | null
  nome?: string | null
  status: string
  tipo_venda?: string | null
  motivo_recusa?: string | null
  objecao_motivo_nome?: string | null
  objecao_observacao?: string | null
  itens: ItemDetalheVenda[]
  total: number
  origem?: string
  venda_em_consultorio?: boolean | null
}

export type GerarPdfVendasInput = {
  periodoLabel: string
  rotulosOrigem?: Record<string, string>
  totalFaturado: number
  totalVendas: number
  vendaMedia: number
  porOrigem: Record<string, { quantidade: number; faturamento: number }>
  porProfissional: AgregacaoNome[]
  porProduto: AgregacaoNome[]
  porReferenciador?: AgregacaoNome[]
  vendasPorReferenciador?: Record<string, VendaDetalhe[]>
  porCategoria?: Record<string, { quantidade: number; faturamento: number }>
  vendasDetalhadas?: VendaDetalhe[]
  resumoMedico?: {
    faturamentoConsultorio: number
    qtdConsultorio: number
    faturamentoFisio: number
    qtdFisio: number
    taxaConversaoEquipe: number | null
  }
  detalhamentoPorProfissional?: {
    nome: string
    total: number
    origens: [string, number][]
    vendas: { paciente_nome: string; origem_label: string; data_venda: string; total: number }[]
  }[]
}

type RGB = readonly [number, number, number]

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const MARGIN_X = 16
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2
const BRAND: RGB = [0, 107, 90]
const TEXT: RGB = [24, 29, 28]
const MUTED: RGB = [102, 112, 108]
const LINE: RGB = [220, 226, 223]
const SOFT: RGB = [246, 248, 247]

// Rótulos das origens (cadastro em /vendas/origens), definidos no início de cada
// geração do PDF a partir de `input.rotulosOrigem`.
let TRADUCAO_ORIGEM: Record<string, string> = {}

const fmt = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// ── Desmembramento Orçamento x Venda Confirmada ──────────────────────
// Todo o PDF distingue os três status possíveis de uma venda: já convertida
// (venda_confirmada) ou ainda em orçamento (pendente de decisão, ou recusado).
// As funções abaixo agrupam e agregam `vendasDetalhadas` (que contém TODAS as
// vendas do período, de qualquer status) para alimentar essa separação em
// cada tabela do relatório.

type StatusKey = 'venda_confirmada' | 'orcamento_pendente' | 'orcamento_recusado'

const STATUS_ORDER: StatusKey[] = ['venda_confirmada', 'orcamento_pendente', 'orcamento_recusado']

const STATUS_SUBTITULO: Record<StatusKey, string> = {
  venda_confirmada: 'Vendas Confirmadas',
  orcamento_pendente: 'Orçamentos Pendentes',
  orcamento_recusado: 'Orçamentos Recusados',
}

function agruparPorStatus(vendas: VendaDetalhe[]): Record<StatusKey, VendaDetalhe[]> {
  const grupos: Record<StatusKey, VendaDetalhe[]> = {
    venda_confirmada: [],
    orcamento_pendente: [],
    orcamento_recusado: [],
  }
  for (const venda of vendas) {
    const key: StatusKey = venda.status in grupos ? (venda.status as StatusKey) : 'venda_confirmada'
    grupos[key].push(venda)
  }
  return grupos
}

function agregarPorNome(
  vendas: VendaDetalhe[],
  chave: (v: VendaDetalhe) => string | null | undefined,
): AgregacaoNome[] {
  const mapa = new Map<string, AgregacaoNome>()
  for (const venda of vendas) {
    const nome = chave(venda)
    if (!nome) continue
    if (!mapa.has(nome)) mapa.set(nome, { nome, quantidade: 0, faturamento: 0 })
    const entry = mapa.get(nome)!
    entry.quantidade += 1
    entry.faturamento += venda.total
  }
  return [...mapa.values()].sort((a, b) => b.faturamento - a.faturamento)
}

function agregarPorChaveVenda(
  vendas: VendaDetalhe[],
  chave: (v: VendaDetalhe) => string,
  traducao: Record<string, string>,
): AgregacaoNome[] {
  const mapa = new Map<string, AgregacaoNome>()
  for (const venda of vendas) {
    const key = chave(venda)
    const nome = traducao[key] || key
    if (!mapa.has(nome)) mapa.set(nome, { nome, quantidade: 0, faturamento: 0 })
    const entry = mapa.get(nome)!
    entry.quantidade += 1
    entry.faturamento += venda.total
  }
  return [...mapa.values()].sort((a, b) => b.faturamento - a.faturamento)
}

function agregarPorItem(
  vendas: VendaDetalhe[],
  chave: (item: ItemDetalheVenda) => string,
  traducao?: Record<string, string>,
): AgregacaoNome[] {
  const mapa = new Map<string, AgregacaoNome>()
  for (const venda of vendas) {
    for (const item of venda.itens) {
      const key = chave(item)
      const nome = traducao ? traducao[key] || key : key
      if (!mapa.has(nome)) mapa.set(nome, { nome, quantidade: 0, faturamento: 0 })
      const entry = mapa.get(nome)!
      entry.quantidade += item.quantidade
      entry.faturamento += item.subtotal
    }
  }
  return [...mapa.values()].sort((a, b) => b.faturamento - a.faturamento)
}

export async function gerarPdfVendas(input: GerarPdfVendasInput) {
  TRADUCAO_ORIGEM = input.rotulosOrigem ?? {}
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const profOrdenados = [...input.porProfissional].sort((a, b) => b.faturamento - a.faturamento)
  const vendasDetalhadas = input.vendasDetalhadas ?? []
  const temVendas = vendasDetalhadas.length > 0

  desenharPaginaResumo(doc, input, profOrdenados, vendasDetalhadas)

  if (temVendas) {
    doc.addPage()
    desenharPaginaProfissionais(doc, vendasDetalhadas)

    doc.addPage()
    desenharPaginaProdutos(doc, vendasDetalhadas)

    doc.addPage()
    desenharPaginaDetalheOrigens(doc, vendasDetalhadas)

    if (vendasDetalhadas.some(v => v.medico_referenciador_nome)) {
      doc.addPage()
      let y = desenharPaginaReferenciadores(doc, vendasDetalhadas)

      if (input.resumoMedico && (input.resumoMedico.qtdConsultorio > 0 || input.resumoMedico.qtdFisio > 0)) {
        y += 10
        y = desenharBlocoResumoMedico(doc, y, input.resumoMedico)
      }

      if (input.detalhamentoPorProfissional && input.detalhamentoPorProfissional.length > 0) {
        y += 10
        desenharBlocoDetalhamentoPorProfissional(doc, y, input.detalhamentoPorProfissional)
      }

      doc.addPage()
      desenharPaginaDetalheReferenciadores(doc, vendasDetalhadas)
    }

    if (input.detalhamentoPorProfissional && input.detalhamentoPorProfissional.length > 0) {
      doc.addPage()
      desenharPaginaDetalheConversoesPorProfissional(doc, input.detalhamentoPorProfissional)
    }

    doc.addPage()
    desenharPaginaCategorias(doc, vendasDetalhadas)

    doc.addPage()
    desenharPaginaVendasDetalhadas(doc, vendasDetalhadas)
  }

  aplicarRodape(doc, input.periodoLabel)
  doc.save('relatorio-vendas.pdf')
}

function desenharPaginaResumo(
  doc: jsPDF,
  input: GerarPdfVendasInput,
  profOrdenados: AgregacaoNome[],
  vendasDetalhadas: VendaDetalhe[],
) {
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, PAGE_WIDTH, 48, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(255, 255, 255)
  doc.text('Relatório de Vendas', MARGIN_X, 22)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Resumo executivo do período', MARGIN_X, 30)
  doc.text(input.periodoLabel, MARGIN_X, 38)

  let y = 58
  y = desenharGradeCards(doc, y, [
    ['Total faturado (confirmado)', fmt(input.totalFaturado)],
    ['Vendas confirmadas', String(input.totalVendas)],
    ['Ticket médio', fmt(input.vendaMedia)],
    ['Profissionais ativos', String(input.porProfissional.length)],
  ])

  y += 10
  y = desenharTituloSecao(doc, y, 'Destaques')
  y = desenharBlocosTexto(doc, y, montarDestaques(profOrdenados, input, vendasDetalhadas))

  if (vendasDetalhadas.length > 0) {
    y += 8
    if (y > PAGE_HEIGHT - 60) {
      doc.addPage()
      y = desenharCabecalhoInterno(doc, 'Funil de Orçamentos', '')
    } else {
      y = desenharTituloSecao(doc, y, 'Funil de Orçamentos: Confirmado x Orçamento')
    }
    y = desenharFunilOrcamentos(doc, y, vendasDetalhadas)

    const objecoes = agregarPorNome(
      agruparPorStatus(vendasDetalhadas).orcamento_pendente,
      v => v.objecao_motivo_nome,
    )
    if (objecoes.length > 0) {
      y += 8
      y = desenharBlocoAgregado(
        doc,
        y,
        'Resumo',
        'Objeções mais comuns (orçamentos pendentes)',
        objecoes,
        ['Objeção', 'Qtd.', 'Valor em orçamento', '% Total'],
        [78, 18, 46, 34],
      )
    }
  }

  y += 8
  if (y > PAGE_HEIGHT - 60) {
    doc.addPage()
    y = desenharCabecalhoInterno(doc, 'Ranking por profissional', '')
  } else {
    y = desenharTituloSecao(doc, y, 'Ranking por profissional (vendas confirmadas)')
  }
  desenharTabelaRankingProf(doc, y, profOrdenados.slice(0, 6), input.totalFaturado)
}

function desenharFunilOrcamentos(doc: jsPDF, y: number, vendasDetalhadas: VendaDetalhe[]): number {
  const porStatus = agruparPorStatus(vendasDetalhadas)
  const confirmadas = porStatus.venda_confirmada
  const pendentes = porStatus.orcamento_pendente
  const recusadas = porStatus.orcamento_recusado

  const somaTotal = (lista: VendaDetalhe[]) => lista.reduce((s, v) => s + v.total, 0)
  const totalOrcamentos = confirmadas.length + pendentes.length + recusadas.length
  const taxaConversao = totalOrcamentos > 0 ? (confirmadas.length / totalOrcamentos) * 100 : null

  return desenharGradeCards(doc, y, [
    ['Orçamentos pendentes', `${pendentes.length} · ${fmt(somaTotal(pendentes))}`],
    ['Convertidos em venda', `${confirmadas.length} · ${fmt(somaTotal(confirmadas))}`],
    ['Orçamentos recusados', `${recusadas.length} · ${fmt(somaTotal(recusadas))}`],
    ['Taxa de conversão', taxaConversao !== null ? `${taxaConversao.toFixed(1)}%` : '—'],
  ])
}

function desenharBlocoAgregado(
  doc: jsPDF,
  y: number,
  paginaTitulo: string,
  subtitulo: string,
  itens: AgregacaoNome[],
  headers: string[],
  widths: number[],
): number {
  if (itens.length === 0) return y

  if (y > PAGE_HEIGHT - 40) {
    doc.addPage()
    y = desenharCabecalhoInterno(doc, paginaTitulo, 'Continuação')
  }
  y = desenharTituloSecao(doc, y, subtitulo)
  y = desenharLinhaTabela(doc, y, headers, widths, true)

  const totalFaturamento = itens.reduce((s, i) => s + i.faturamento, 0)
  const totalQuantidade = itens.reduce((s, i) => s + i.quantidade, 0)

  for (const item of itens) {
    if (y > PAGE_HEIGHT - 22) {
      doc.addPage()
      y = desenharCabecalhoInterno(doc, paginaTitulo, `${subtitulo} — Continuação`)
      y = desenharLinhaTabela(doc, y + 4, headers, widths, true)
    }
    const pct = totalFaturamento > 0 ? ((item.faturamento / totalFaturamento) * 100).toFixed(1) : '0.0'
    y = desenharLinhaTabela(doc, y, [item.nome, String(item.quantidade), fmt(item.faturamento), `${pct}%`], widths)
  }

  y = desenharLinhaTabela(
    doc,
    y,
    ['Subtotal', String(totalQuantidade), fmt(totalFaturamento), '100%'],
    widths,
    true,
  )
  return y + 10
}

function desenharBlocosPorStatus(
  doc: jsPDF,
  y: number,
  paginaTitulo: string,
  prefixo: string,
  porStatus: Record<StatusKey, VendaDetalhe[]>,
  agregarFn: (vendas: VendaDetalhe[]) => AgregacaoNome[],
  headers: string[],
  widths: number[],
): number {
  for (const statusKey of STATUS_ORDER) {
    const itens = agregarFn(porStatus[statusKey])
    const subtitulo = prefixo ? `${prefixo} — ${STATUS_SUBTITULO[statusKey]}` : STATUS_SUBTITULO[statusKey]
    y = desenharBlocoAgregado(doc, y, paginaTitulo, subtitulo, itens, headers, widths)
  }
  return y
}

function desenharPaginaProfissionais(doc: jsPDF, vendasDetalhadas: VendaDetalhe[]) {
  const titulo = 'Desempenho por Profissional'
  const y = desenharCabecalhoInterno(doc, titulo, 'Consolidado por status')
  const porStatus = agruparPorStatus(vendasDetalhadas)
  const headers = ['Profissional', 'Vendas', 'Faturamento', '% Total']
  const widths = [74, 18, 52, 34]

  desenharBlocosPorStatus(doc, y, titulo, '', porStatus, vs => agregarPorNome(vs, v => v.profissional_nome), headers, widths)
}

function desenharPaginaProdutos(doc: jsPDF, vendasDetalhadas: VendaDetalhe[]) {
  const titulo = 'Desempenho por Produto'
  let y = desenharCabecalhoInterno(doc, titulo, 'Consolidado por status')
  const porStatus = agruparPorStatus(vendasDetalhadas)
  const headProd = ['Produto', 'Qtd.', 'Faturamento', '% Total']
  const widthsProd = [80, 14, 52, 32]

  y = desenharBlocosPorStatus(doc, y, titulo, '', porStatus, vs => agregarPorItem(vs, i => i.produto_nome), headProd, widthsProd)

  y += 4
  if (y > PAGE_HEIGHT - 60) {
    doc.addPage()
    y = desenharCabecalhoInterno(doc, 'Análise por Origem', '')
  } else {
    y = desenharTituloSecao(doc, y, 'Análise por Origem')
  }

  const headOrig = ['Origem', 'Quantidade', 'Faturamento', '% Total']
  const widthsOrig = [44, 30, 52, 32]
  desenharBlocosPorStatus(
    doc,
    y,
    'Análise por Origem',
    '',
    porStatus,
    vs => agregarPorChaveVenda(vs, v => v.origem || 'desconhecida', TRADUCAO_ORIGEM),
    headOrig,
    widthsOrig,
  )
}

function desenharPaginaReferenciadores(doc: jsPDF, vendasDetalhadas: VendaDetalhe[]): number {
  const titulo = 'Desempenho por Médico Referenciador'
  let y = desenharCabecalhoInterno(doc, titulo, 'Consolidado por status')
  const porStatus = agruparPorStatus(vendasDetalhadas)
  const headers = ['Médico Referenciador', 'Vendas', 'Faturamento', '% Total']
  const widths = [80, 18, 52, 28]

  y = desenharBlocosPorStatus(doc, y, titulo, '', porStatus, vs => agregarPorNome(vs, v => v.medico_referenciador_nome), headers, widths)

  return y
}

function desenharBlocoResumoMedico(
  doc: jsPDF,
  y: number,
  resumo: { faturamentoConsultorio: number; qtdConsultorio: number; faturamentoFisio: number; qtdFisio: number; taxaConversaoEquipe: number | null },
) {
  if (y > PAGE_HEIGHT - 60) {
    doc.addPage()
    y = desenharCabecalhoInterno(doc, 'Origem Médica: Consultório vs. Conversão Fisio', '')
  } else {
    y = desenharTituloSecao(doc, y, 'Origem Médica: Consultório vs. Conversão Fisio')
  }

  y = desenharGradeCards(doc, y, [
    ['Fechado em consultório', `${fmt(resumo.faturamentoConsultorio)} (${resumo.qtdConsultorio})`],
    ['Convertido pelo fisio', `${fmt(resumo.faturamentoFisio)} (${resumo.qtdFisio})`],
    ['Taxa de conversão da equipe', resumo.taxaConversaoEquipe !== null ? `${resumo.taxaConversaoEquipe.toFixed(1)}%` : '—'],
  ])

  return y
}

function desenharBlocoDetalhamentoPorProfissional(
  doc: jsPDF,
  y: number,
  detalhamento: { nome: string; total: number; origens: [string, number][] }[],
) {
  // Nota: bloco-resumo (sem detalhe de paciente); ver desenharPaginaDetalheConversoesPorProfissional
  // para a listagem individual por paciente. Este bloco cobre só o funil médico
  // de consultório x conversão fisio (sempre vendas confirmadas, por definição).
  if (y > PAGE_HEIGHT - 40) {
    doc.addPage()
    y = desenharCabecalhoInterno(doc, 'Conversões por Profissional e Origem', '')
  } else {
    y = desenharTituloSecao(doc, y, 'Conversões por Profissional e Origem')
  }

  for (const p of detalhamento) {
    const origensTexto = p.origens.map(([label, qtd]) => `${qtd} ${label}`).join(', ')
    const texto = `${p.nome} — ${p.total} ${p.total !== 1 ? 'conversões' : 'conversão'}${origensTexto ? ` (${origensTexto})` : ''}`
    const linhas = doc.splitTextToSize(texto, CONTENT_WIDTH - 8)
    const height = linhas.length * 4.4 + 6

    if (y + height > PAGE_HEIGHT - 22) {
      doc.addPage()
      y = desenharCabecalhoInterno(doc, 'Conversões por Profissional e Origem', 'Continuação')
    }

    doc.setFillColor(...SOFT)
    doc.setDrawColor(...LINE)
    doc.roundedRect(MARGIN_X, y, CONTENT_WIDTH, height, 2, 2, 'FD')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT)
    doc.text(linhas, MARGIN_X + 4, y + 5)

    y += height + 3
  }

  return y
}

function desenharPaginaDetalheConversoesPorProfissional(
  doc: jsPDF,
  detalhamento: {
    nome: string
    total: number
    origens: [string, number][]
    vendas: { paciente_nome: string; origem_label: string; data_venda: string; total: number }[]
  }[],
) {
  const headers = ['Data', 'Paciente', 'Origem', 'Total']
  const widths = [24, 80, 46, 24]

  let y = desenharCabecalhoInterno(doc, 'Detalhamento de Conversões por Profissional', 'Vendas confirmadas individuais por paciente')
  let primeiroProfissional = true

  for (const p of detalhamento) {
    if (!primeiroProfissional && y > PAGE_HEIGHT - 40) {
      doc.addPage()
      y = desenharCabecalhoInterno(doc, 'Detalhamento de Conversões por Profissional', 'Continuação')
    }
    primeiroProfissional = false

    // Cabeçalho do profissional
    y += 4
    doc.setFillColor(...SOFT)
    doc.setDrawColor(...LINE)
    doc.roundedRect(MARGIN_X, y, CONTENT_WIDTH, 10, 2, 2, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...TEXT)
    doc.text(p.nome, MARGIN_X + 3, y + 6.5)

    const larguraNome = doc.getTextWidth(p.nome)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(`${p.total} ${p.total !== 1 ? 'conversões' : 'conversão'}`, MARGIN_X + 3 + larguraNome + 3, y + 6.5)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...BRAND)
    const origensTexto = p.origens.map(([label, qtd]) => `${qtd} ${label}`).join(', ')
    doc.text(origensTexto, PAGE_WIDTH - MARGIN_X - 2, y + 6.5, { align: 'right', maxWidth: 90 })

    y += 12
    y = desenharLinhaTabela(doc, y, headers, widths, true)

    for (const venda of p.vendas) {
      const rowH = 8

      if (y + rowH > PAGE_HEIGHT - 22) {
        doc.addPage()
        y = desenharCabecalhoInterno(
          doc,
          'Detalhamento de Conversões por Profissional',
          `Continuação — ${p.nome}`,
        )
        y = desenharLinhaTabela(doc, y + 4, headers, widths, true)
      }

      const data = new Date(venda.data_venda).toLocaleDateString('pt-BR')
      y = desenharLinhaTabela(doc, y, [
        data,
        venda.paciente_nome,
        venda.origem_label,
        fmt(venda.total),
      ], widths)
    }

    y += 6
  }
}

function desenharCabecalhoInterno(doc: jsPDF, titulo: string, subtitulo: string) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...TEXT)
  doc.text(titulo, MARGIN_X, 22)

  if (subtitulo) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...MUTED)
    doc.text(subtitulo, MARGIN_X, 29)
  }

  doc.setDrawColor(...LINE)
  doc.line(MARGIN_X, 36, PAGE_WIDTH - MARGIN_X, 36)
  return 40
}

function desenharTituloSecao(doc: jsPDF, y: number, titulo: string) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...BRAND)
  doc.text(titulo, MARGIN_X, y)
  doc.setDrawColor(...LINE)
  doc.line(MARGIN_X, y + 3, PAGE_WIDTH - MARGIN_X, y + 3)
  return y + 8
}

function desenharGradeCards(doc: jsPDF, y: number, cards: [string, string][]) {
  const gap = 4
  const columns = 2
  const cardWidth = (CONTENT_WIDTH - gap) / columns
  const cardHeight = 18

  cards.forEach(([titulo, valor], index) => {
    const col = index % columns
    const row = Math.floor(index / columns)
    const x = MARGIN_X + col * (cardWidth + gap)
    const cardY = y + row * (cardHeight + gap)

    doc.setFillColor(...SOFT)
    doc.setDrawColor(...LINE)
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(titulo.toUpperCase(), x + 4, cardY + 5)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...TEXT)
    doc.text(valor, x + 4, cardY + 12)
  })

  return y + Math.ceil(cards.length / columns) * (cardHeight + gap) - gap
}

function desenharBlocosTexto(doc: jsPDF, y: number, textos: string[]) {
  let cursor = y

  for (const texto of textos) {
    const linhas = doc.splitTextToSize(texto, CONTENT_WIDTH - 8)
    const height = linhas.length * 4.4 + 8

    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(...LINE)
    doc.roundedRect(MARGIN_X, cursor, CONTENT_WIDTH, height, 2, 2, 'FD')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT)
    doc.text(linhas, MARGIN_X + 4, cursor + 5.5)

    cursor += height + 4
  }

  return cursor - 4
}

function desenharTabelaRankingProf(doc: jsPDF, y: number, ranking: AgregacaoNome[], totalFaturado: number) {
  const headers = ['#', 'Profissional', 'Vendas', 'Faturamento', '% Total']
  const widths = [10, 82, 16, 46, 24]
  let cursor = desenharLinhaTabela(doc, y, headers, widths, true)

  ranking.forEach((item, index) => {
    const pct = totalFaturado > 0 ? ((item.faturamento / totalFaturado) * 100).toFixed(1) : '0.0'
    cursor = desenharLinhaTabela(doc, cursor, [
      String(index + 1),
      item.nome,
      String(item.quantidade),
      fmt(item.faturamento),
      `${pct}%`,
    ], widths)
  })

  return cursor
}

function desenharLinhaTabela(
  doc: jsPDF,
  y: number,
  values: string[],
  widths: number[],
  isHeader = false,
) {
  let x = MARGIN_X
  const rowHeight = 8

  values.forEach((value, index) => {
    doc.setDrawColor(...LINE)
    doc.setFillColor(...(isHeader ? BRAND : ([255, 255, 255] as const)))
    doc.rect(x, y, widths[index], rowHeight, 'FD')

    doc.setFont('helvetica', isHeader ? 'bold' : 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...(isHeader ? ([255, 255, 255] as const) : TEXT))

    const alignRight = index > 0
    doc.text(value, alignRight ? x + widths[index] - 2 : x + 2, y + 5.2, {
      align: alignRight ? 'right' : 'left',
      maxWidth: widths[index] - 4,
    })

    x += widths[index]
  })

  return y + rowHeight
}

function aplicarRodape(doc: jsPDF, periodoLabel: string) {
  const pages = doc.getNumberOfPages()

  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.setDrawColor(...LINE)
    doc.line(MARGIN_X, PAGE_HEIGHT - 12, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 12)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(periodoLabel, MARGIN_X, PAGE_HEIGHT - 7)
    doc.text(`Página ${page} de ${pages}`, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 7, { align: 'right' })
  }
}

const CATEGORIA_LABEL: Record<string, string> = {
  tratamento: 'Tratamento',
  consulta: 'Consulta',
  sem_categoria: 'Sem categoria',
}

function desenharPaginaCategorias(doc: jsPDF, vendasDetalhadas: VendaDetalhe[]) {
  const titulo = 'Faturamento por Categoria'
  const y = desenharCabecalhoInterno(doc, titulo, 'Breakdown por status e tipo de produto')
  const porStatus = agruparPorStatus(vendasDetalhadas)
  const headers = ['Categoria', 'Itens vendidos', 'Faturamento', '% do Total']
  const widths = [60, 30, 52, 36]

  desenharBlocosPorStatus(
    doc,
    y,
    titulo,
    '',
    porStatus,
    vs => agregarPorItem(vs, i => i.categoria || 'sem_categoria', CATEGORIA_LABEL),
    headers,
    widths,
  )
}

function desenharCabecalhoGrupo(doc: jsPDF, y: number, nomeGrupo: string, vendas: VendaDetalhe[]): number {
  const boxH = 14
  const porStatus = agruparPorStatus(vendas)

  doc.setFillColor(...SOFT)
  doc.setDrawColor(...LINE)
  doc.roundedRect(MARGIN_X, y, CONTENT_WIDTH, boxH, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...TEXT)
  doc.text(nomeGrupo, MARGIN_X + 3, y + 6)

  const larguraNome = doc.getTextWidth(nomeGrupo)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  doc.text(
    `${vendas.length} venda${vendas.length !== 1 ? 's' : ''} no total`,
    MARGIN_X + 3 + larguraNome + 3,
    y + 6,
  )

  // Nota: sem soma monetária aqui — misturaria faturamento já confirmado com
  // valor apenas orçado (ainda não realizado). O valor de cada status aparece
  // no "Subtotal" da tabela correspondente, logo abaixo.
  const resumoStatus = STATUS_ORDER
    .filter(key => porStatus[key].length > 0)
    .map(key => `${porStatus[key].length} ${STATUS_SUBTITULO[key].toLowerCase()}`)
    .join(' · ')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  doc.text(resumoStatus, PAGE_WIDTH - MARGIN_X - 2, y + 9, { align: 'right', maxWidth: 100 })

  return y + boxH + 6
}

// ── Tabelas de detalhe (vendas individuais) ──────────────────────────
// Helper compartilhado por Vendas Detalhadas, Detalhamento por Origem e
// Detalhamento por Médico Referenciador: desenha um grupo de vendas com
// cabeçalho, linhas com quebra de texto automática e uma linha de subtotal.

function desenharTabelaVendas(
  doc: jsPDF,
  y: number,
  paginaTitulo: string,
  tituloContinuacao: string,
  vendas: VendaDetalhe[],
  headers: string[],
  widths: number[],
  totalColIdx: number,
  colsFn: (venda: VendaDetalhe) => string[],
  sublinhasFn?: (venda: VendaDetalhe) => { colIdx: number; texto: string }[],
): number {
  if (vendas.length === 0) return y

  if (y > PAGE_HEIGHT - 40) {
    doc.addPage()
    y = desenharCabecalhoInterno(doc, paginaTitulo, 'Continuação')
  }

  y = desenharLinhaTabela(doc, y, headers, widths, true)

  const totalGrupo = vendas.reduce((s, v) => s + v.total, 0)
  const vendasOrdenadas = [...vendas].sort((a, b) => a.data_venda.localeCompare(b.data_venda))

  for (const venda of vendasOrdenadas) {
    const cols = colsFn(venda)
    const sublinhas = sublinhasFn ? sublinhasFn(venda) : []
    const subPorCol = new Map<number, string[]>()
    for (const s of sublinhas) {
      if (!subPorCol.has(s.colIdx)) subPorCol.set(s.colIdx, [])
      subPorCol.get(s.colIdx)!.push(s.texto)
    }

    const rowH = Math.max(
      9,
      ...cols.map((val, idx) => {
        const baseAltura = doc.splitTextToSize(val, widths[idx] - 4).length * 4.5 + 5
        const subLinhas = subPorCol.get(idx)
        const subAltura = subLinhas
          ? 4 + subLinhas.reduce((sum, t) => sum + doc.splitTextToSize(t, widths[idx] - 4).length * 4.5, 0)
          : 0
        return baseAltura + subAltura
      }),
    )

    if (y + rowH > PAGE_HEIGHT - 22) {
      doc.addPage()
      y = desenharCabecalhoInterno(doc, paginaTitulo, tituloContinuacao)
      y = desenharLinhaTabela(doc, y + 4, headers, widths, true)
    }

    let x = MARGIN_X
    cols.forEach((val, idx) => {
      doc.setDrawColor(...LINE)
      doc.setFillColor(255, 255, 255)
      doc.rect(x, y, widths[idx], rowH, 'FD')

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...TEXT)

      const alignRight = idx === totalColIdx
      const linhas = doc.splitTextToSize(val, widths[idx] - 4)
      doc.text(linhas, alignRight ? x + widths[idx] - 2 : x + 2, y + 4.5, {
        align: alignRight ? 'right' : 'left',
        maxWidth: widths[idx] - 4,
      })

      const subLinhas = subPorCol.get(idx)
      if (subLinhas) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(7.5)
        doc.setTextColor(...MUTED)
        let linhaY = y + 4.5 + (linhas.length - 1) * 4.5 + 4
        for (const texto of subLinhas) {
          const linhasTexto = doc.splitTextToSize(texto, widths[idx] - 4)
          doc.text(linhasTexto, x + 2, linhaY, { maxWidth: widths[idx] - 4 })
          linhaY += linhasTexto.length * 4.5
        }
      }

      x += widths[idx]
    })

    y += rowH
  }

  const linhaSubtotal = headers.map((_, idx) => {
    if (idx === 0) return `Subtotal (${vendas.length})`
    if (idx === totalColIdx) return fmt(totalGrupo)
    return ''
  })
  y = desenharLinhaTabela(doc, y, linhaSubtotal, widths, true)

  return y + 6
}

function desenharPaginaVendasDetalhadas(doc: jsPDF, vendasDetalhadas: VendaDetalhe[]) {
  const titulo = 'Vendas Detalhadas'
  let y = desenharCabecalhoInterno(
    doc,
    titulo,
    `${vendasDetalhadas.length} venda${vendasDetalhadas.length !== 1 ? 's' : ''} no período, por status`,
  )

  const porStatus = agruparPorStatus(vendasDetalhadas)
  const headers = ['Data', 'Paciente', 'Itens', 'Total']
  const widths = [22, 46, 78, 32]

  for (const statusKey of STATUS_ORDER) {
    const vendas = porStatus[statusKey]
    if (vendas.length === 0) continue

    y += 4
    if (y > PAGE_HEIGHT - 40) {
      doc.addPage()
      y = desenharCabecalhoInterno(doc, titulo, 'Continuação')
    }
    y = desenharTituloSecao(doc, y, STATUS_SUBTITULO[statusKey])

    y = desenharTabelaVendas(
      doc,
      y,
      titulo,
      `${STATUS_SUBTITULO[statusKey]} — Continuação`,
      vendas,
      headers,
      widths,
      3,
      venda => {
        const data = new Date(venda.data_venda).toLocaleDateString('pt-BR')
        const itensTexto = venda.itens
          .map(i => `${i.quantidade > 1 ? `${i.quantidade}x ` : ''}${i.produto_nome}`)
          .join(', ')
        return [data, venda.paciente_nome, itensTexto, fmt(venda.total)]
      },
      venda => {
        const subs: { colIdx: number; texto: string }[] = []
        if (venda.paciente_origem) subs.push({ colIdx: 1, texto: `Origem: ${venda.paciente_origem}` })
        if (venda.tipo_venda) subs.push({ colIdx: 1, texto: `Tipo: ${TIPO_VENDA_LABEL[venda.tipo_venda] ?? venda.tipo_venda}` })
        if (venda.nome) subs.push({ colIdx: 1, texto: venda.nome })
        if (venda.motivo_recusa) subs.push({ colIdx: 2, texto: `Motivo: ${venda.motivo_recusa}` })
        if (venda.objecao_motivo_nome) {
          const observacao = venda.objecao_observacao ? ` — ${venda.objecao_observacao}` : ''
          subs.push({ colIdx: 2, texto: `Objeção: ${venda.objecao_motivo_nome}${observacao}` })
        }
        return subs
      },
    )
  }
}

function desenharPaginaDetalheReferenciadores(doc: jsPDF, vendasDetalhadas: VendaDetalhe[]) {
  const titulo = 'Detalhamento por Médico Referenciador'
  const headers = ['Data', 'Paciente', 'Itens', 'Origem', 'Total']
  const widths = [20, 40, 60, 30, 28]

  const porMedico = new Map<string, VendaDetalhe[]>()
  for (const venda of vendasDetalhadas) {
    if (!venda.medico_referenciador_nome) continue
    if (!porMedico.has(venda.medico_referenciador_nome)) porMedico.set(venda.medico_referenciador_nome, [])
    porMedico.get(venda.medico_referenciador_nome)!.push(venda)
  }

  const medicos = [...porMedico.entries()].sort(
    ([, a], [, b]) => b.reduce((s, v) => s + v.total, 0) - a.reduce((s, v) => s + v.total, 0),
  )

  let y = desenharCabecalhoInterno(doc, titulo, 'Vendas individuais por médico e status')
  let primeiroMedico = true

  for (const [medico, vendas] of medicos) {
    if (!primeiroMedico && y > PAGE_HEIGHT - 40) {
      doc.addPage()
      y = desenharCabecalhoInterno(doc, titulo, 'Continuação')
    }
    primeiroMedico = false

    y += 4
    y = desenharCabecalhoGrupo(doc, y, medico, vendas)

    const porStatus = agruparPorStatus(vendas)
    for (const statusKey of STATUS_ORDER) {
      const vendasStatus = porStatus[statusKey]
      if (vendasStatus.length === 0) continue

      if (y > PAGE_HEIGHT - 40) {
        doc.addPage()
        y = desenharCabecalhoInterno(doc, titulo, `Continuação — ${medico}`)
      }
      y = desenharTituloSecao(doc, y, `${medico} — ${STATUS_SUBTITULO[statusKey]}`)

      y = desenharTabelaVendas(
        doc,
        y,
        titulo,
        `Continuação — ${medico} (${STATUS_SUBTITULO[statusKey]})`,
        vendasStatus,
        headers,
        widths,
        4,
        venda => {
          const data = new Date(venda.data_venda).toLocaleDateString('pt-BR')
          const itensTexto = venda.itens
            .map(i => `${i.quantidade > 1 ? `${i.quantidade}x ` : ''}${i.produto_nome}`)
            .join(', ')
          return [data, venda.paciente_nome, itensTexto, venda.paciente_origem || '-', fmt(venda.total)]
        },
        venda => (venda.nome ? [{ colIdx: 1, texto: venda.nome }] : []),
      )
    }

    y += 6
  }
}

function desenharPaginaDetalheOrigens(doc: jsPDF, vendasDetalhadas: VendaDetalhe[]) {
  const titulo = 'Detalhamento por Origem'
  const headers = ['Data', 'Paciente', 'Profissional', 'Médico Referenciador', 'Itens', 'Total']
  const widths = [22, 28, 20, 40, 46, 22]

  const vendasPorOrigem = new Map<string, VendaDetalhe[]>()
  for (const venda of vendasDetalhadas) {
    const label = TRADUCAO_ORIGEM[venda.origem || ''] || venda.origem || 'Sem origem'
    if (!vendasPorOrigem.has(label)) vendasPorOrigem.set(label, [])
    vendasPorOrigem.get(label)!.push(venda)
  }

  const origens = [...vendasPorOrigem.entries()].sort(
    ([, a], [, b]) => b.reduce((s, v) => s + v.total, 0) - a.reduce((s, v) => s + v.total, 0),
  )

  let y = desenharCabecalhoInterno(doc, titulo, 'Vendas individuais por origem de fechamento e status')
  let primeiraOrigem = true

  for (const [origem, vendas] of origens) {
    if (!primeiraOrigem && y > PAGE_HEIGHT - 40) {
      doc.addPage()
      y = desenharCabecalhoInterno(doc, titulo, 'Continuação')
    }
    primeiraOrigem = false

    y += 4
    y = desenharCabecalhoGrupo(doc, y, origem, vendas)

    const porStatus = agruparPorStatus(vendas)
    for (const statusKey of STATUS_ORDER) {
      const vendasStatus = porStatus[statusKey]
      if (vendasStatus.length === 0) continue

      if (y > PAGE_HEIGHT - 40) {
        doc.addPage()
        y = desenharCabecalhoInterno(doc, titulo, `Continuação — ${origem}`)
      }
      y = desenharTituloSecao(doc, y, `${origem} — ${STATUS_SUBTITULO[statusKey]}`)

      y = desenharTabelaVendas(
        doc,
        y,
        titulo,
        `Continuação — ${origem} (${STATUS_SUBTITULO[statusKey]})`,
        vendasStatus,
        headers,
        widths,
        5,
        venda => {
          const data = new Date(venda.data_venda).toLocaleDateString('pt-BR')
          const itensTexto = venda.itens
            .map(i => `${i.quantidade > 1 ? `${i.quantidade}x ` : ''}${i.produto_nome}`)
            .join(', ')
          return [data, venda.paciente_nome, venda.profissional_nome, venda.medico_referenciador_nome || '-', itensTexto, fmt(venda.total)]
        },
      )
    }

    y += 6
  }
}

function montarDestaques(
  profOrdenados: AgregacaoNome[],
  input: GerarPdfVendasInput,
  vendasDetalhadas: VendaDetalhe[],
): string[] {
  if (input.totalVendas === 0) return ['Não há vendas confirmadas para o período selecionado.']

  const destaques: string[] = []

  if (profOrdenados.length > 0) {
    const top = profOrdenados[0]
    destaques.push(
      `${top.nome} liderou o faturamento confirmado do período com ${fmt(top.faturamento)} em ${top.quantidade} venda(s).`,
    )
  }

  const prodTop = [...input.porProduto].sort((a, b) => b.faturamento - a.faturamento)[0]
  if (prodTop) {
    destaques.push(
      `O produto mais vendido foi "${prodTop.nome}", gerando ${fmt(prodTop.faturamento)} em ${prodTop.quantidade} unidade(s) (vendas confirmadas).`,
    )
  }

  const origensOrdenadas = Object.entries(input.porOrigem).sort(([, a], [, b]) => b.faturamento - a.faturamento)
  if (origensOrdenadas.length > 0) {
    const [origemKey, origemData] = origensOrdenadas[0]
    const label = TRADUCAO_ORIGEM[origemKey] || origemKey
    destaques.push(
      `A principal origem de vendas confirmadas foi "${label}", responsável por ${fmt(origemData.faturamento)} (${((origemData.faturamento / input.totalFaturado) * 100).toFixed(1)}% do total).`,
    )
  }

  const porStatus = agruparPorStatus(vendasDetalhadas)
  const pendentes = porStatus.orcamento_pendente
  if (pendentes.length > 0) {
    const valorPendente = pendentes.reduce((s, v) => s + v.total, 0)
    destaques.push(
      `Há ${pendentes.length} orçamento${pendentes.length !== 1 ? 's' : ''} pendente${pendentes.length !== 1 ? 's' : ''} de decisão, somando ${fmt(valorPendente)}.`,
    )
  }

  return destaques
}
