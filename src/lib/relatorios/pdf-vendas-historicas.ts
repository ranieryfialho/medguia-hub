import type { jsPDF } from 'jspdf'
import type { CardsExecutivos } from './vendas-historicas'
import type { LinhaTabelaHistorico } from './vendas-historicas'

export type GerarPdfVendasHistoricasInput = {
  periodoLabel: string
  filtrosLabel: string
  cards: CardsExecutivos
  linhas: LinhaTabelaHistorico[]
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

const fmt = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtMes = (mes: string) =>
  new Date(mes + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase()

export async function gerarPdfVendasHistoricas(input: GerarPdfVendasHistoricasInput) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  desenharPaginaResumo(doc, input)
  doc.addPage()
  desenharPaginaTabela(doc, input.linhas)

  aplicarRodape(doc, input.periodoLabel)
  doc.save('relatorio-vendas-historicas.pdf')
}

function desenharPaginaResumo(doc: jsPDF, input: GerarPdfVendasHistoricasInput) {
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, PAGE_WIDTH, 48, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(255, 255, 255)
  doc.text('Vendas Históricas', MARGIN_X, 22)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Evolução mensal de faturamento e ticket médio', MARGIN_X, 30)
  doc.text(input.periodoLabel, MARGIN_X, 38)

  let y = 58
  if (input.filtrosLabel) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(input.filtrosLabel, MARGIN_X, y)
    y += 6
  }

  y = desenharGradeCards(doc, y, [
    ['Faturamento histórico total', fmt(input.cards.faturamentoTotal)],
    ['Volume total de vendas', String(input.cards.volumeTotal)],
    ['Ticket médio consolidado', fmt(input.cards.ticketMedioConsolidado)],
    ['Melhor mês', input.cards.melhorMes ? `${fmtMes(input.cards.melhorMes.mes)} — ${fmt(input.cards.melhorMes.faturamento)}` : '—'],
    ['Crescimento médio MoM', input.cards.crescimentoMedioMoM !== null ? `${input.cards.crescimentoMedioMoM.toFixed(1)}%` : '—'],
  ])

  return y
}

function desenharPaginaTabela(doc: jsPDF, linhas: LinhaTabelaHistorico[]) {
  let y = desenharCabecalhoInterno(doc, 'Detalhamento Mês a Mês', 'Ordem cronológica decrescente')

  y += 4
  const headers = ['Mês', 'Faturamento', 'Var. MoM', 'Qtd.', 'Ticket Médio', 'Top Produto']
  const widths = [22, 40, 24, 16, 40, 36]
  y = desenharLinhaTabela(doc, y, headers, widths, true)

  for (const linha of linhas) {
    if (y > PAGE_HEIGHT - 22) {
      doc.addPage()
      y = desenharCabecalhoInterno(doc, 'Detalhamento Mês a Mês', 'Continuação')
      y = desenharLinhaTabela(doc, y + 4, headers, widths, true)
    }
    const variacao = linha.variacaoFaturamentoMoM.percentual !== null
      ? `${linha.variacaoFaturamentoMoM.direcao === 'alta' ? '+' : ''}${linha.variacaoFaturamentoMoM.percentual.toFixed(1)}%`
      : '—'
    y = desenharLinhaTabela(doc, y, [
      fmtMes(linha.mes),
      fmt(linha.faturamento),
      variacao,
      String(linha.qtd_vendas),
      fmt(linha.ticket_medio),
      linha.top_produto || '—',
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
    doc.setFontSize(10)
    doc.setTextColor(...TEXT)
    doc.text(valor, x + 4, cardY + 12, { maxWidth: cardWidth - 8 })
  })

  return y + Math.ceil(cards.length / columns) * (cardHeight + gap) - gap
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

    const alignRight = index > 0 && index < 5
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
