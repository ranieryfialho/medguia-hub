import type { jsPDF } from 'jspdf'

export type GerarPdfAniversariantesInput = {
  periodoLabel: string
  total: number
  totalHoje: number
  totalProximos7: number
  pacientes: Array<{
    nome: string
    diaMes: string
    idade: number
    diaSemana: string
    telefone: string
    convenio: string
    isHoje: boolean
    isProximos7: boolean
  }>
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
const GREEN_BG: RGB = [220, 252, 231]
const AMBER_BG: RGB = [254, 243, 199]

// Columns: Nome | Aniversário | Completa | Dia da semana | Telefone | Convênio
const COL_WIDTHS = [52, 18, 16, 32, 35, 25] as const
const COL_HEADERS = ['Nome', 'Aniversário', 'Completa', 'Dia da semana', 'Telefone', 'Convênio']

export async function gerarPdfAniversariantes(input: GerarPdfAniversariantesInput) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  let y = desenharCabecalho(doc, input)
  y = desenharCards(doc, y, input)
  y += 8
  y = desenharDestaques(doc, y, input)
  y += 10
  desenharTabelaPacientes(doc, y, input)

  aplicarRodape(doc, input.periodoLabel)
  doc.save('relatorio-aniversariantes.pdf')
}

function desenharCabecalho(doc: jsPDF, input: GerarPdfAniversariantesInput) {
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, PAGE_WIDTH, 48, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(255, 255, 255)
  doc.text('Relatório de Aniversariantes', MARGIN_X, 22)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Pacientes aniversariantes do período selecionado', MARGIN_X, 30)
  doc.text(input.periodoLabel, MARGIN_X, 38)

  return 58
}

function desenharCards(doc: jsPDF, y: number, input: GerarPdfAniversariantesInput) {
  const cards: [string, string][] = [
    ['Total no mês', String(input.total)],
    ['Aniversariam hoje', String(input.totalHoje)],
    ['Próximos 7 dias', String(input.totalProximos7)],
  ]

  const gap = 4
  const cardWidth = (CONTENT_WIDTH - gap * 2) / 3
  const cardHeight = 18

  cards.forEach(([titulo, valor], index) => {
    const x = MARGIN_X + index * (cardWidth + gap)

    doc.setFillColor(...SOFT)
    doc.setDrawColor(...LINE)
    doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(titulo.toUpperCase(), x + 4, y + 5)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...TEXT)
    doc.text(valor, x + 4, y + 13)
  })

  return y + cardHeight
}

function desenharDestaques(doc: jsPDF, y: number, input: GerarPdfAniversariantesInput) {
  const textos: string[] = []

  if (input.total === 0) {
    textos.push('Não há pacientes com aniversário no período selecionado.')
  } else {
    textos.push(`${input.total} paciente(s) fazem aniversário no período.`)
    if (input.totalHoje > 0) {
      textos.push(`${input.totalHoje} paciente(s) celebram aniversário hoje. Aproveite para parabenizá-los!`)
    }
    if (input.totalProximos7 > input.totalHoje) {
      textos.push(`${input.totalProximos7 - input.totalHoje} paciente(s) adicionais têm aniversário nos próximos 7 dias.`)
    }
  }

  let cursor = y

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...BRAND)
  doc.text('Destaques', MARGIN_X, cursor)
  doc.setDrawColor(...LINE)
  doc.line(MARGIN_X, cursor + 3, PAGE_WIDTH - MARGIN_X, cursor + 3)
  cursor += 8

  for (const texto of textos) {
    const linhas = doc.splitTextToSize(texto, CONTENT_WIDTH - 8) as string[]
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

function desenharTabelaPacientes(doc: jsPDF, startY: number, input: GerarPdfAniversariantesInput) {
  let y = startY

  y = desenharTituloSecao(doc, y, 'Lista de Aniversariantes')

  // Legend
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MUTED)

  doc.setFillColor(...GREEN_BG)
  doc.setDrawColor(134, 239, 172)
  doc.rect(MARGIN_X, y, 3, 3, 'FD')
  doc.text('Aniversário hoje', MARGIN_X + 5, y + 2.5)

  doc.setFillColor(...AMBER_BG)
  doc.setDrawColor(252, 211, 77)
  doc.rect(MARGIN_X + 42, y, 3, 3, 'FD')
  doc.text('Próximos 7 dias', MARGIN_X + 47, y + 2.5)

  y += 7

  y = desenharLinhaTabela(doc, y, COL_HEADERS, [...COL_WIDTHS], true)

  for (const p of input.pacientes) {
    if (y > PAGE_HEIGHT - 22) {
      doc.addPage()
      y = desenharCabecalhoInterno(doc, 'Lista de Aniversariantes', 'Continuação')
      y += 4
      y = desenharLinhaTabela(doc, y, COL_HEADERS, [...COL_WIDTHS], true)
    }

    const rowBg: RGB = p.isHoje ? GREEN_BG : p.isProximos7 ? AMBER_BG : [255, 255, 255]
    y = desenharLinhaTabela(
      doc,
      y,
      [
        truncar(p.nome, 30),
        p.diaMes,
        `${p.idade} anos`,
        truncar(p.diaSemana, 18),
        p.telefone,
        truncar(p.convenio, 14),
      ],
      [...COL_WIDTHS],
      false,
      rowBg,
    )
  }

  return y
}

function truncar(texto: string, max: number): string {
  return texto.length > max ? texto.slice(0, max - 1) + '…' : texto
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

function desenharLinhaTabela(
  doc: jsPDF,
  y: number,
  values: string[],
  widths: number[],
  isHeader = false,
  rowBg: RGB = [255, 255, 255],
) {
  let x = MARGIN_X
  const rowHeight = 8

  values.forEach((value, index) => {
    doc.setDrawColor(...LINE)
    doc.setFillColor(...(isHeader ? BRAND : rowBg))
    doc.rect(x, y, widths[index], rowHeight, 'FD')

    doc.setFont('helvetica', isHeader ? 'bold' : 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...(isHeader ? ([255, 255, 255] as const) : TEXT))

    doc.text(value, x + 2, y + 5.2, {
      align: 'left',
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