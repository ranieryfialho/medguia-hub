import type { jsPDF } from 'jspdf'

export type GerarPdfCadastrosInput = {
  periodoLabel: string
  total: number
  totalMesAtual: number
  totalSemanaAtual: number
  isFiltered: boolean
  meses: Array<{ label: string; qtd: number }>
  semanas: Array<{ label: string; qtd: number }>
  dias: Array<{ label: string; qtd: number }>
  origens: Array<{ origem: string; qtd: number }>
  medicos: Array<{ medico: string; qtd: number }>
  anunciosMeta: Array<{ anuncio: string; qtd: number }>
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

export async function gerarPdfCadastros(input: GerarPdfCadastrosInput) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  desenharPaginaResumo(doc, input)

  if (input.meses.length > 0 || input.medicos.length > 0) {
    doc.addPage()
    desenharPaginaMesesMedicos(doc, input)
  }

  if (input.anunciosMeta.length > 0 || input.semanas.length > 0 || input.dias.length > 0) {
    doc.addPage()
    desenharPaginaAnunciosSemanasDias(doc, input)
  }

  aplicarRodape(doc, input.periodoLabel)
  doc.save('relatorio-cadastros-pacientes.pdf')
}

function desenharPaginaResumo(doc: jsPDF, input: GerarPdfCadastrosInput) {
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, PAGE_WIDTH, 48, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(255, 255, 255)
  doc.text('Relatório de Cadastros', MARGIN_X, 22)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Pacientes cadastrados por origem, período e canal', MARGIN_X, 30)
  doc.text(input.periodoLabel, MARGIN_X, 38)

  let y = 58

  const cards: [string, string][] = input.isFiltered
    ? [['Total no período', String(input.total)]]
    : [
        ['Total (12 meses)', String(input.total)],
        ['Este mês', String(input.totalMesAtual)],
        ['Esta semana', String(input.totalSemanaAtual)],
      ]

  y = desenharGradeCards(doc, y, cards)
  y += 10

  y = desenharTituloSecao(doc, y, 'Destaques')
  y = desenharBlocosTexto(doc, y, montarDestaques(input))
  y += 8

  if (input.origens.length > 0) {
    y = desenharTituloSecao(doc, y, 'Por Origem')
    const headers = ['Origem', 'Cadastros', '%']
    const widths = [110, 30, 38]
    y = desenharLinhaTabela(doc, y, headers, widths, true)

    for (const { origem, qtd } of input.origens) {
      if (y > PAGE_HEIGHT - 22) break
      const pct = input.total > 0 ? ((qtd / input.total) * 100).toFixed(1) : '0.0'
      y = desenharLinhaTabela(doc, y, [origem, String(qtd), `${pct}%`], widths)
    }
  }
}

function desenharPaginaMesesMedicos(doc: jsPDF, input: GerarPdfCadastrosInput) {
  let y = desenharCabecalhoInterno(doc, 'Cadastros por Mês', 'Evolução mensal no período')
  y += 4

  if (input.meses.length > 0) {
    const headers = ['Mês', 'Cadastros', '%']
    const widths = [110, 30, 38]
    y = desenharLinhaTabela(doc, y, headers, widths, true)

    for (const { label, qtd } of input.meses) {
      if (y > PAGE_HEIGHT - 22) {
        doc.addPage()
        y = desenharCabecalhoInterno(doc, 'Cadastros por Mês', 'Continuação')
        y = desenharLinhaTabela(doc, y + 4, headers, widths, true)
      }
      const pct = input.total > 0 ? ((qtd / input.total) * 100).toFixed(1) : '0.0'
      y = desenharLinhaTabela(doc, y, [label, String(qtd), `${pct}%`], widths)
    }
  }

  if (input.medicos.length > 0) {
    y += 12
    if (y > PAGE_HEIGHT - 60) {
      doc.addPage()
      y = desenharCabecalhoInterno(doc, 'Por Médico Parceiro', '')
    } else {
      y = desenharTituloSecao(doc, y, 'Por Médico Parceiro')
    }

    const headers = ['Médico', 'Cadastros', '%']
    const widths = [110, 30, 38]
    y = desenharLinhaTabela(doc, y, headers, widths, true)

    for (const { medico, qtd } of input.medicos) {
      if (y > PAGE_HEIGHT - 22) {
        doc.addPage()
        y = desenharCabecalhoInterno(doc, 'Por Médico Parceiro', 'Continuação')
        y = desenharLinhaTabela(doc, y + 4, headers, widths, true)
      }
      const pct = input.total > 0 ? ((qtd / input.total) * 100).toFixed(1) : '0.0'
      const label = medico === 'Não informado' ? medico : `Dr(a). ${medico}`
      y = desenharLinhaTabela(doc, y, [label, String(qtd), `${pct}%`], widths)
    }
  }
}

function desenharPaginaAnunciosSemanasDias(doc: jsPDF, input: GerarPdfCadastrosInput) {
  let y = desenharCabecalhoInterno(doc, 'Detalhamento por Período', 'Semanas, dias e anúncios Meta')
  y += 4

  if (input.anunciosMeta.length > 0) {
    y = desenharTituloSecao(doc, y, 'Por Anúncio Meta')
    const headers = ['Canal — Anúncio', 'Cadastros', '%']
    const widths = [110, 30, 38]
    y = desenharLinhaTabela(doc, y, headers, widths, true)

    for (const { anuncio, qtd } of input.anunciosMeta) {
      if (y > PAGE_HEIGHT - 22) {
        doc.addPage()
        y = desenharCabecalhoInterno(doc, 'Por Anúncio Meta', 'Continuação')
        y = desenharLinhaTabela(doc, y + 4, headers, widths, true)
      }
      const pct = input.total > 0 ? ((qtd / input.total) * 100).toFixed(1) : '0.0'
      y = desenharLinhaTabela(doc, y, [anuncio, String(qtd), `${pct}%`], widths)
    }

    y += 10
  }

  if (input.semanas.length > 0) {
    if (y > PAGE_HEIGHT - 60) {
      doc.addPage()
      y = desenharCabecalhoInterno(doc, 'Por Semana', '')
    } else {
      y = desenharTituloSecao(doc, y, 'Por Semana')
    }

    const headers = ['Semana', 'Cadastros']
    const widths = [140, 38]
    y = desenharLinhaTabela(doc, y, headers, widths, true)

    for (const { label, qtd } of input.semanas) {
      if (y > PAGE_HEIGHT - 22) {
        doc.addPage()
        y = desenharCabecalhoInterno(doc, 'Por Semana', 'Continuação')
        y = desenharLinhaTabela(doc, y + 4, headers, widths, true)
      }
      y = desenharLinhaTabela(doc, y, [label, String(qtd)], widths)
    }

    y += 10
  }

  if (input.dias.length > 0) {
    if (y > PAGE_HEIGHT - 60) {
      doc.addPage()
      y = desenharCabecalhoInterno(doc, 'Por Dia', '')
    } else {
      y = desenharTituloSecao(doc, y, 'Por Dia')
    }

    const headers = ['Data', 'Cadastros']
    const widths = [140, 38]
    y = desenharLinhaTabela(doc, y, headers, widths, true)

    for (const { label, qtd } of input.dias) {
      if (y > PAGE_HEIGHT - 22) {
        doc.addPage()
        y = desenharCabecalhoInterno(doc, 'Por Dia', 'Continuação')
        y = desenharLinhaTabela(doc, y + 4, headers, widths, true)
      }
      y = desenharLinhaTabela(doc, y, [label, String(qtd)], widths)
    }
  }
}

function montarDestaques(input: GerarPdfCadastrosInput): string[] {
  if (input.total === 0) return ['Não há cadastros de pacientes no período selecionado.']

  const destaques: string[] = []

  destaques.push(`Foram cadastrados ${input.total} paciente(s) no período.`)

  if (input.origens.length > 0) {
    const top = input.origens[0]
    const pct = ((top.qtd / input.total) * 100).toFixed(1)
    destaques.push(`A principal origem foi "${top.origem}", responsável por ${top.qtd} cadastro(s) (${pct}% do total).`)
  }

  if (input.medicos.length > 0) {
    const top = input.medicos[0]
    const label = top.medico === 'Não informado' ? top.medico : `Dr(a). ${top.medico}`
    destaques.push(`O médico parceiro com mais indicações foi ${label}, com ${top.qtd} cadastro(s).`)
  }

  if (input.anunciosMeta.length > 0) {
    const top = input.anunciosMeta[0]
    destaques.push(`O anúncio Meta de maior resultado foi "${top.anuncio}", gerando ${top.qtd} cadastro(s).`)
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
  const columns = cards.length === 1 ? 1 : 2
  const cardWidth = columns === 1 ? CONTENT_WIDTH : (CONTENT_WIDTH - gap) / 2
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
