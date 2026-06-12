import type { jsPDF } from 'jspdf'

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
  profissional_nome: string
  nome?: string | null
  status: string
  motivo_recusa?: string | null
  itens: ItemDetalheVenda[]
  total: number
}

export type GerarPdfVendasInput = {
  periodoLabel: string
  totalFaturado: number
  totalVendas: number
  vendaMedia: number
  porOrigem: Record<string, { quantidade: number; faturamento: number }>
  porProfissional: AgregacaoNome[]
  porProduto: AgregacaoNome[]
  porReferenciador?: AgregacaoNome[]
  porCategoria?: Record<string, { quantidade: number; faturamento: number }>
  vendasDetalhadas?: VendaDetalhe[]
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

const TRADUCAO_ORIGEM: Record<string, string> = {
  medico: 'Médico',
  leads: 'Leads',
  indicacao: 'Indicação',
  renovacao: 'Renovação',
  campanha: 'Campanha',
}

const fmt = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export async function gerarPdfVendas(input: GerarPdfVendasInput) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const profOrdenados = [...input.porProfissional].sort((a, b) => b.faturamento - a.faturamento)
  const prodOrdenados = [...input.porProduto].sort((a, b) => b.faturamento - a.faturamento)

  desenharPaginaResumo(doc, input, profOrdenados)
  doc.addPage()
  desenharPaginaProfissionais(doc, profOrdenados, input.totalFaturado)
  doc.addPage()
  desenharPaginaProdutos(doc, prodOrdenados, input.totalFaturado, input.porOrigem, input.totalFaturado)

  if (input.porReferenciador && input.porReferenciador.length > 0) {
    doc.addPage()
    desenharPaginaReferenciadores(doc, input.porReferenciador, input.totalFaturado)
  }

  if (input.porCategoria && Object.keys(input.porCategoria).some(k => k !== 'sem_categoria')) {
    doc.addPage()
    desenharPaginaCategorias(doc, input.porCategoria, input.totalFaturado)
  }

  if (input.vendasDetalhadas && input.vendasDetalhadas.length > 0) {
    doc.addPage()
    desenharPaginaVendasDetalhadas(doc, input.vendasDetalhadas)
  }

  aplicarRodape(doc, input.periodoLabel)
  doc.save('relatorio-vendas.pdf')
}

function desenharPaginaResumo(doc: jsPDF, input: GerarPdfVendasInput, profOrdenados: AgregacaoNome[]) {
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
    ['Total faturado', fmt(input.totalFaturado)],
    ['Total de vendas', String(input.totalVendas)],
    ['Ticket médio', fmt(input.vendaMedia)],
    ['Profissionais ativos', String(input.porProfissional.length)],
  ])

  y += 10
  y = desenharTituloSecao(doc, y, 'Destaques')
  y = desenharBlocosTexto(doc, y, montarDestaques(profOrdenados, input))

  y += 8
  y = desenharTituloSecao(doc, y, 'Ranking por profissional')
  desenharTabelaRankingProf(doc, y, profOrdenados.slice(0, 6), input.totalFaturado)
}

function desenharPaginaProfissionais(doc: jsPDF, profOrdenados: AgregacaoNome[], totalFaturado: number) {
  let y = desenharCabecalhoInterno(doc, 'Desempenho por Profissional', 'Consolidado completo')

  y += 4
  const headers = ['Profissional', 'Vendas', 'Faturamento', '% Total']
  const widths = [74, 18, 52, 34]
  y = desenharLinhaTabela(doc, y, headers, widths, true)

  for (const prof of profOrdenados) {
    if (y > PAGE_HEIGHT - 22) {
      doc.addPage()
      y = desenharCabecalhoInterno(doc, 'Desempenho por Profissional', 'Continuação')
      y = desenharLinhaTabela(doc, y + 4, headers, widths, true)
    }
    const pct = totalFaturado > 0 ? ((prof.faturamento / totalFaturado) * 100).toFixed(1) : '0.0'
    y = desenharLinhaTabela(doc, y, [
      prof.nome,
      String(prof.quantidade),
      fmt(prof.faturamento),
      `${pct}%`,
    ], widths)
  }
}

function desenharPaginaProdutos(
  doc: jsPDF,
  prodOrdenados: AgregacaoNome[],
  totalFaturado: number,
  porOrigem: Record<string, { quantidade: number; faturamento: number }>,
  total: number,
) {
  let y = desenharCabecalhoInterno(doc, 'Desempenho por Produto', 'Consolidado completo')

  y += 4
  const headProd = ['Produto', 'Qtd.', 'Faturamento', '% Total']
  const widthsProd = [80, 14, 52, 32]
  y = desenharLinhaTabela(doc, y, headProd, widthsProd, true)

  for (const prod of prodOrdenados) {
    if (y > PAGE_HEIGHT - 50) {
      doc.addPage()
      y = desenharCabecalhoInterno(doc, 'Desempenho por Produto', 'Continuação')
      y = desenharLinhaTabela(doc, y + 4, headProd, widthsProd, true)
    }
    const pct = total > 0 ? ((prod.faturamento / total) * 100).toFixed(1) : '0.0'
    y = desenharLinhaTabela(doc, y, [
      prod.nome,
      String(prod.quantidade),
      fmt(prod.faturamento),
      `${pct}%`,
    ], widthsProd)
  }

  y += 12
  if (y > PAGE_HEIGHT - 60) {
    doc.addPage()
    y = desenharCabecalhoInterno(doc, 'Análise por Origem', '')
  } else {
    y = desenharTituloSecao(doc, y, 'Análise por Origem')
  }

  const origensOrdenadas = Object.entries(porOrigem).sort(([, a], [, b]) => b.faturamento - a.faturamento)
  const headOrig = ['Origem', 'Quantidade', 'Faturamento', '% Total']
  const widthsOrig = [44, 30, 52, 32]
  y = desenharLinhaTabela(doc, y, headOrig, widthsOrig, true)

  for (const [origemKey, data] of origensOrdenadas) {
    const label = TRADUCAO_ORIGEM[origemKey] || origemKey
    const pct = totalFaturado > 0 ? ((data.faturamento / totalFaturado) * 100).toFixed(1) : '0.0'
    y = desenharLinhaTabela(doc, y, [
      label,
      String(data.quantidade),
      fmt(data.faturamento),
      `${pct}%`,
    ], widthsOrig)
  }
}

function desenharPaginaReferenciadores(doc: jsPDF, referenciadores: AgregacaoNome[], totalFaturado: number) {
  let y = desenharCabecalhoInterno(doc, 'Desempenho por Médico Referenciador', 'Consolidado completo')

  y += 4
  const headers = ['Médico Referenciador', 'Vendas', 'Faturamento', '% Total']
  const widths = [80, 18, 52, 28]
  y = desenharLinhaTabela(doc, y, headers, widths, true)

  const ordenados = [...referenciadores].sort((a, b) => b.faturamento - a.faturamento)
  for (const ref of ordenados) {
    if (y > PAGE_HEIGHT - 22) {
      doc.addPage()
      y = desenharCabecalhoInterno(doc, 'Desempenho por Médico Referenciador', 'Continuação')
      y = desenharLinhaTabela(doc, y + 4, headers, widths, true)
    }
    const pct = totalFaturado > 0 ? ((ref.faturamento / totalFaturado) * 100).toFixed(1) : '0.0'
    y = desenharLinhaTabela(doc, y, [
      ref.nome,
      String(ref.quantidade),
      fmt(ref.faturamento),
      `${pct}%`,
    ], widths)
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

const STATUS_LABEL: Record<string, string> = {
  venda_confirmada: 'Confirmada',
  orcamento_pendente: 'Orçamento',
  orcamento_recusado: 'Recusado',
}

function desenharPaginaCategorias(
  doc: jsPDF,
  porCategoria: Record<string, { quantidade: number; faturamento: number }>,
  totalFaturado: number,
) {
  let y = desenharCabecalhoInterno(doc, 'Faturamento por Categoria', 'Breakdown por tipo de produto')

  y += 4
  const headers = ['Categoria', 'Itens vendidos', 'Faturamento', '% do Total']
  const widths = [60, 30, 52, 36]
  y = desenharLinhaTabela(doc, y, headers, widths, true)

  const ordem = ['tratamento', 'consulta', 'sem_categoria']
  const entradas = ordem
    .filter(k => porCategoria[k])
    .map(k => [k, porCategoria[k]] as const)

  for (const [cat, d] of entradas) {
    if (y > PAGE_HEIGHT - 22) {
      doc.addPage()
      y = desenharCabecalhoInterno(doc, 'Faturamento por Categoria', 'Continuação')
      y = desenharLinhaTabela(doc, y + 4, headers, widths, true)
    }
    const pct = totalFaturado > 0 ? ((d.faturamento / totalFaturado) * 100).toFixed(1) : '0.0'
    y = desenharLinhaTabela(doc, y, [
      CATEGORIA_LABEL[cat] || cat,
      String(d.quantidade),
      fmt(d.faturamento),
      `${pct}%`,
    ], widths)
  }

  // Linha de total
  y = desenharLinhaTabela(doc, y, [
    'TOTAL',
    String(Object.values(porCategoria).reduce((s, d) => s + d.quantidade, 0)),
    fmt(totalFaturado),
    '100%',
  ], widths, true)
}

function desenharPaginaVendasDetalhadas(doc: jsPDF, vendas: VendaDetalhe[]) {
  let y = desenharCabecalhoInterno(
    doc,
    'Vendas Detalhadas',
    `${vendas.length} venda${vendas.length !== 1 ? 's' : ''} no período`,
  )

  y += 4
  const headers = ['Data', 'Paciente', 'Itens', 'Total', 'Status']
  const widths = [20, 40, 74, 26, 18]
  y = desenharLinhaTabela(doc, y, headers, widths, true)

  for (const venda of vendas) {
    const itensTexto = venda.itens
      .map(i => `${i.quantidade > 1 ? `${i.quantidade}x ` : ''}${i.produto_nome}`)
      .join(', ')

    const linhasItens = doc.splitTextToSize(itensTexto, widths[2] - 4)
    const temNome = !!venda.nome
    const temMotivo = !!venda.motivo_recusa
    const linhasMotivo = temMotivo ? doc.splitTextToSize(venda.motivo_recusa!, widths[4] - 4) : []
    const rowH = Math.max(
      (temNome ? 12 : 8) + (temMotivo ? linhasMotivo.length * 3.5 : 0),
      linhasItens.length * 4 + 4,
    )

    if (y + rowH > PAGE_HEIGHT - 22) {
      doc.addPage()
      y = desenharCabecalhoInterno(doc, 'Vendas Detalhadas', 'Continuação')
      y = desenharLinhaTabela(doc, y + 4, headers, widths, true)
    }

    const data = new Date(venda.data_venda).toLocaleDateString('pt-BR')
    const status = STATUS_LABEL[venda.status] || venda.status
    const cols = [data, venda.paciente_nome, itensTexto, fmt(venda.total), status]

    let x = MARGIN_X
    cols.forEach((val, idx) => {
      doc.setDrawColor(...LINE)
      doc.setFillColor(255, 255, 255)
      doc.rect(x, y, widths[idx], rowH, 'FD')

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...TEXT)

      const alignRight = idx === 3
      const linhas = doc.splitTextToSize(val, widths[idx] - 4)
      doc.text(linhas, alignRight ? x + widths[idx] - 2 : x + 2, y + 4.5, {
        align: alignRight ? 'right' : 'left',
        maxWidth: widths[idx] - 4,
      })

      // Nome do protocolo/venda abaixo do paciente
      if (idx === 1 && temNome) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(6)
        doc.setTextColor(...MUTED)
        doc.text(venda.nome!, x + 2, y + 9, { maxWidth: widths[idx] - 4 })
      }

      // Motivo de recusa abaixo do status
      if (idx === 4 && temMotivo) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(6)
        doc.setTextColor(...MUTED)
        doc.text(linhasMotivo, x + 2, y + 9, { maxWidth: widths[idx] - 4 })
      }

      x += widths[idx]
    })

    y += rowH
  }
}

function montarDestaques(profOrdenados: AgregacaoNome[], input: GerarPdfVendasInput): string[] {
  if (input.totalVendas === 0) return ['Não há dados de vendas para o período selecionado.']

  const destaques: string[] = []

  if (profOrdenados.length > 0) {
    const top = profOrdenados[0]
    destaques.push(
      `${top.nome} liderou o faturamento do período com ${fmt(top.faturamento)} em ${top.quantidade} venda(s).`,
    )
  }

  const prodTop = [...input.porProduto].sort((a, b) => b.faturamento - a.faturamento)[0]
  if (prodTop) {
    destaques.push(
      `O produto mais vendido foi "${prodTop.nome}", gerando ${fmt(prodTop.faturamento)} em ${prodTop.quantidade} unidade(s).`,
    )
  }

  const origensOrdenadas = Object.entries(input.porOrigem).sort(([, a], [, b]) => b.faturamento - a.faturamento)
  if (origensOrdenadas.length > 0) {
    const [origemKey, origemData] = origensOrdenadas[0]
    const label = TRADUCAO_ORIGEM[origemKey] || origemKey
    destaques.push(
      `A principal origem de vendas foi "${label}", responsável por ${fmt(origemData.faturamento)} (${((origemData.faturamento / input.totalFaturado) * 100).toFixed(1)}% do total).`,
    )
  }

  return destaques
}
