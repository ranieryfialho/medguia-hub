import type { jsPDF } from 'jspdf'
import type { DadosRelatorioFollowUps } from './follow-ups-relatorio-dados'

export type GerarPdfFollowUpsInput = DadosRelatorioFollowUps

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

const fmtPct = (parte: number, total: number) => (total > 0 ? `${((parte / total) * 100).toFixed(1)}%` : '0.0%')

export async function gerarPdfFollowUps(input: GerarPdfFollowUpsInput) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  desenharPaginaResumo(doc, input)

  if (input.contagemPorTipo.length > 0 || input.porResponsavel.length > 0) {
    doc.addPage()
    desenharPaginaDistribuicao(doc, input)
  }

  if (input.pendentesAntigos.length > 0) {
    doc.addPage()
    desenharPaginaPendentesAntigos(doc, input)
  }

  aplicarRodape(doc, input.periodoLabel)
  doc.save('relatorio-follow-ups.pdf')
}

function desenharPaginaResumo(doc: jsPDF, input: GerarPdfFollowUpsInput) {
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, PAGE_WIDTH, 48, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(255, 255, 255)
  doc.text('Relatório de Follow-ups', MARGIN_X, 22)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(input.filtrosLabel, MARGIN_X, 30)
  doc.text(input.periodoLabel, MARGIN_X, 38)

  let y = 58
  y = desenharGradeCards(doc, y, [
    ['Total no filtro', String(input.total)],
    ['Pendentes', String(input.totalPendentes)],
    ['Concluídos', String(input.totalConcluidos)],
    ['Taxa de conclusão', `${input.taxaConclusao}%`],
    ['Tempo médio de conclusão', input.tempoMedioConclusaoDias !== null ? `${input.tempoMedioConclusaoDias} dia(s)` : '—'],
    ['Pendentes há 7+ dias (backlog)', String(input.totalPendentesAntigos)],
  ])

  y += 10
  y = desenharTituloSecao(doc, y, 'Destaques')
  desenharBlocosTexto(doc, y, montarDestaques(input))
}

function desenharPaginaDistribuicao(doc: jsPDF, input: GerarPdfFollowUpsInput) {
  let y = desenharCabecalhoInterno(doc, 'Distribuição', input.periodoLabel)
  y += 4

  if (input.contagemPorTipo.length > 0) {
    y = desenharTituloSecao(doc, y, 'Por Tipo')
    const headers = ['Tipo', 'Total', '%']
    const widths = [110, 30, 38]
    y = desenharLinhaTabela(doc, y, headers, widths, true)
    const ordenados = [...input.contagemPorTipo].sort((a, b) => b.total - a.total)
    for (const tipo of ordenados) {
      if (y > PAGE_HEIGHT - 22) {
        doc.addPage()
        y = desenharCabecalhoInterno(doc, 'Distribuição por Tipo', 'Continuação')
        y = desenharLinhaTabela(doc, y + 4, headers, widths, true)
      }
      y = desenharLinhaTabela(doc, y, [tipo.nome, String(tipo.total), fmtPct(tipo.total, input.total)], widths)
    }
    y += 12
  }

  if (input.porResponsavel.length > 0) {
    if (y > PAGE_HEIGHT - 60) {
      doc.addPage()
      y = desenharCabecalhoInterno(doc, 'Distribuição por Responsável', input.periodoLabel)
    } else {
      y = desenharTituloSecao(doc, y, 'Por Responsável')
    }
    const headers = ['Responsável', 'Total', 'Pendentes', 'Concluídos', 'Taxa Conclusão']
    const widths = [66, 24, 28, 28, 34]
    y = desenharLinhaTabela(doc, y, headers, widths, true)
    const ordenados = [...input.porResponsavel].sort((a, b) => b.total - a.total)
    for (const resp of ordenados) {
      if (y > PAGE_HEIGHT - 22) {
        doc.addPage()
        y = desenharCabecalhoInterno(doc, 'Distribuição por Responsável', 'Continuação')
        y = desenharLinhaTabela(doc, y + 4, headers, widths, true)
      }
      y = desenharLinhaTabela(doc, y, [
        resp.nome,
        String(resp.total),
        String(resp.pendentes),
        String(resp.concluidos),
        `${resp.taxaConclusao}%`,
      ], widths)
    }
  }
}

function desenharPaginaPendentesAntigos(doc: jsPDF, input: GerarPdfFollowUpsInput) {
  const titulo = 'Backlog — Pendentes há 7+ dias'
  let y = desenharCabecalhoInterno(doc, titulo, `${input.totalPendentesAntigos} follow-up(s) pendente(s) há mais de 7 dias`)
  y += 4

  const headers = ['Paciente', 'Tipo', 'Responsável', 'Dias']
  const widths = [56, 44, 44, 20]
  y = desenharLinhaTabela(doc, y, headers, widths, true)

  const ordenados = [...input.pendentesAntigos].sort((a, b) => b.dias_pendente - a.dias_pendente)
  for (const p of ordenados) {
    if (y > PAGE_HEIGHT - 22) {
      doc.addPage()
      y = desenharCabecalhoInterno(doc, titulo, 'Continuação')
      y = desenharLinhaTabela(doc, y + 4, headers, widths, true)
    }
    y = desenharLinhaTabela(doc, y, [
      p.paciente_nome,
      p.tipo_nome,
      p.responsavel_nome ?? 'Sem responsável',
      String(p.dias_pendente),
    ], widths)
  }
}

function montarDestaques(input: GerarPdfFollowUpsInput): string[] {
  const destaques: string[] = []

  destaques.push(
    `${input.total} follow-up(s) no conjunto filtrado, com taxa de conclusão de ${input.taxaConclusao}%.`,
  )

  if (input.tempoMedioConclusaoDias !== null) {
    destaques.push(`O tempo médio entre a criação e a conclusão de um follow-up é de ${input.tempoMedioConclusaoDias} dia(s).`)
  }

  const topTipo = [...input.contagemPorTipo].sort((a, b) => b.total - a.total)[0]
  if (topTipo) {
    destaques.push(`"${topTipo.nome}" é o tipo mais frequente, com ${topTipo.total} follow-up(s) (${fmtPct(topTipo.total, input.total)}).`)
  }

  const topResponsavel = [...input.porResponsavel].sort((a, b) => b.total - a.total)[0]
  if (topResponsavel) {
    destaques.push(`${topResponsavel.nome} concentra o maior volume, com ${topResponsavel.total} follow-up(s) e ${topResponsavel.taxaConclusao}% de conclusão.`)
  }

  if (input.totalPendentesAntigos > 0) {
    destaques.push(`${input.totalPendentesAntigos} follow-up(s) estão pendentes há mais de 7 dias e merecem atenção.`)
  } else {
    destaques.push('Nenhum follow-up pendente há mais de 7 dias — backlog em dia.')
  }

  return destaques
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
  const columns = 3
  const cardWidth = (CONTENT_WIDTH - gap * (columns - 1)) / columns
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
    doc.setFontSize(6.5)
    doc.setTextColor(...MUTED)
    doc.text(titulo.toUpperCase(), x + 4, cardY + 5, { maxWidth: cardWidth - 8 })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...TEXT)
    doc.text(valor, x + 4, cardY + 13)
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
