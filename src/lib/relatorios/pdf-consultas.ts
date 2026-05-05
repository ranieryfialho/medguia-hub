import type { jsPDF } from 'jspdf'

export type PdfLinhaTipoConsulta = {
  tipo: string
  agendamentos: number
  atendimentos: number
  concluidos: number
  pendentes: number
}

export type PdfLinhaProfissionalConsulta = {
  profissionalNome: string
  agendamentos: number
  recorrentes: number
  atendimentos: number
  concluidos: number
  pendentes: number
  canceladosOuFalta: number
}

export type GerarPdfConsultasInput = {
  periodoLabel: string
  totalAgendamentos: number
  totalAtendimentos: number
  totalConcluidos: number
  totalRecorrentes: number
  totalPendentes: number
  totalCanceladosOuFalta: number
  porTipo: PdfLinhaTipoConsulta[]
  porProfissional: PdfLinhaProfissionalConsulta[]
  porStatus: Record<string, number>
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

export async function gerarPdfConsultas(input: GerarPdfConsultasInput) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const tiposOrdenados = [...input.porTipo].sort((a, b) => b.atendimentos - a.atendimentos || b.agendamentos - a.agendamentos)
  const profissionaisOrdenados = [...input.porProfissional].sort((a, b) => b.atendimentos - a.atendimentos || b.agendamentos - a.agendamentos)
  const statusOrdenados = Object.entries(input.porStatus).sort((a, b) => b[1] - a[1])

  desenharPaginaResumo(doc, input, tiposOrdenados)
  doc.addPage()
  desenharPaginaTipos(doc, tiposOrdenados)
  doc.addPage()
  desenharPaginaProfissionais(doc, profissionaisOrdenados)
  doc.addPage()
  desenharPaginaStatus(doc, statusOrdenados)

  aplicarRodape(doc, input.periodoLabel)
  doc.save('relatorio-consultas.pdf')
}

function desenharPaginaResumo(doc: jsPDF, input: GerarPdfConsultasInput, tiposOrdenados: PdfLinhaTipoConsulta[]) {
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, PAGE_WIDTH, 48, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(255, 255, 255)
  doc.text('Relatório de Consultas', MARGIN_X, 22)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Resumo executivo do período', MARGIN_X, 30)
  doc.text(input.periodoLabel, MARGIN_X, 38)

  let y = 58
  y = desenharGradeCards(doc, y, [
    ['Agendamentos', String(input.totalAgendamentos)],
    ['Atendimentos', String(input.totalAtendimentos)],
    ['Concluídos', String(input.totalConcluidos)],
    ['Recorrentes', String(input.totalRecorrentes)],
    ['Pendentes', String(input.totalPendentes)],
    ['Cancelado/Falta', String(input.totalCanceladosOuFalta)],
  ])

  y += 10
  y = desenharTituloSecao(doc, y, 'Destaques')
  y = desenharBlocosTexto(doc, y, montarDestaques(input, tiposOrdenados))

  y += 8
  y = desenharTituloSecao(doc, y, 'Principais tipos')
  desenharTabelaTipos(doc, y, tiposOrdenados.slice(0, 8))
}

function desenharPaginaTipos(doc: jsPDF, tipos: PdfLinhaTipoConsulta[]) {
  let y = desenharCabecalhoInterno(doc, 'Tipos de Consulta', 'Detalhamento por tipo')
  const headers = ['Tipo', 'Agend.', 'Atend.', 'Concl.', 'Pend.']
  const widths = [88, 20, 20, 20, 20]
  y = desenharLinhaTabela(doc, y + 4, headers, widths, true)

  for (const tipo of tipos) {
    if (y > PAGE_HEIGHT - 20) {
      doc.addPage()
      y = desenharCabecalhoInterno(doc, 'Tipos de Consulta', 'Continuação')
      y = desenharLinhaTabela(doc, y + 4, headers, widths, true)
    }

    y = desenharLinhaTabela(doc, y, [
      tipo.tipo,
      String(tipo.agendamentos),
      String(tipo.atendimentos),
      String(tipo.concluidos),
      String(tipo.pendentes),
    ], widths)
  }
}

function desenharPaginaProfissionais(doc: jsPDF, profissionais: PdfLinhaProfissionalConsulta[]) {
  let y = desenharCabecalhoInterno(doc, 'Visão por Fisioterapeuta', 'Agendamentos e atendimentos por responsável')
  const headers = ['Fisioterapeuta', 'Agend.', 'Recorr.', 'Atend.', 'Concl.', 'Pend.', 'Canc.']
  const widths = [58, 16, 18, 16, 16, 16, 16]
  y = desenharLinhaTabela(doc, y + 4, headers, widths, true)

  for (const profissional of profissionais) {
    if (y > PAGE_HEIGHT - 20) {
      doc.addPage()
      y = desenharCabecalhoInterno(doc, 'Visão por Fisioterapeuta', 'Continuação')
      y = desenharLinhaTabela(doc, y + 4, headers, widths, true)
    }

    y = desenharLinhaTabela(doc, y, [
      profissional.profissionalNome,
      String(profissional.agendamentos),
      String(profissional.recorrentes),
      String(profissional.atendimentos),
      String(profissional.concluidos),
      String(profissional.pendentes),
      String(profissional.canceladosOuFalta),
    ], widths)
  }
}

function desenharPaginaStatus(doc: jsPDF, status: [string, number][]) {
  let y = desenharCabecalhoInterno(doc, 'Distribuição de Status', 'Resumo dos atendimentos por status')
  const headers = ['Status', 'Quantidade']
  const widths = [120, 40]
  y = desenharLinhaTabela(doc, y + 4, headers, widths, true)

  for (const [nome, quantidade] of status) {
    y = desenharLinhaTabela(doc, y, [nome, String(quantidade)], widths)
  }
}

function desenharCabecalhoInterno(doc: jsPDF, titulo: string, subtitulo: string) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...TEXT)
  doc.text(titulo, MARGIN_X, 22)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  doc.text(subtitulo, MARGIN_X, 29)

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
    doc.setFontSize(12)
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

function desenharTabelaTipos(doc: jsPDF, y: number, tipos: PdfLinhaTipoConsulta[]) {
  const headers = ['Tipo', 'Agend.', 'Atend.', 'Concl.', 'Pend.']
  const widths = [88, 20, 20, 20, 20]
  let cursor = desenharLinhaTabela(doc, y, headers, widths, true)

  tipos.forEach((tipo) => {
    cursor = desenharLinhaTabela(doc, cursor, [
      tipo.tipo,
      String(tipo.agendamentos),
      String(tipo.atendimentos),
      String(tipo.concluidos),
      String(tipo.pendentes),
    ], widths)
  })

  return cursor
}

function desenharLinhaTabela(
  doc: jsPDF,
  y: number,
  cols: string[],
  widths: number[],
  header = false,
) {
  const height = 8
  let x = MARGIN_X

  doc.setDrawColor(...LINE)
  doc.setFillColor(...(header ? BRAND : SOFT))
  doc.setTextColor(...(header ? ([255, 255, 255] as RGB) : TEXT))
  doc.setFont('helvetica', header ? 'bold' : 'normal')
  doc.setFontSize(header ? 8 : 8)

  cols.forEach((col, index) => {
    const width = widths[index]
    doc.rect(x, y, width, height, header ? 'FD' : 'S')
    doc.text(String(col), x + 2, y + 5.2, { maxWidth: width - 4 })
    x += width
  })

  return y + height
}

function aplicarRodape(doc: jsPDF, periodoLabel: string) {
  const total = doc.getNumberOfPages()

  for (let page = 1; page <= total; page++) {
    doc.setPage(page)
    doc.setDrawColor(...LINE)
    doc.line(MARGIN_X, PAGE_HEIGHT - 12, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 12)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(periodoLabel, MARGIN_X, PAGE_HEIGHT - 7)
    doc.text(`Página ${page}/${total}`, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 7, { align: 'right' })
  }
}

function montarDestaques(input: GerarPdfConsultasInput, tipos: PdfLinhaTipoConsulta[]) {
  const principalTipo = tipos[0]
  const taxaConclusao = input.totalAtendimentos > 0
    ? ((input.totalConcluidos / input.totalAtendimentos) * 100).toFixed(1)
    : '0.0'

  return [
    `Foram registrados ${input.totalAgendamentos} agendamentos e ${input.totalAtendimentos} atendimentos no período, com ${input.totalConcluidos} concluídos.`,
    `A taxa de conclusão dos atendimentos ficou em ${taxaConclusao}% e o volume de recorrentes foi de ${input.totalRecorrentes}.`,
    principalTipo
      ? `O tipo com maior volume foi "${principalTipo.tipo}", com ${principalTipo.atendimentos} atendimentos e ${principalTipo.agendamentos} agendamentos.`
      : 'Não houve tipos de consulta com volume registrado no período.',
  ]
}
