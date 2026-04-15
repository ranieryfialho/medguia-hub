import type { jsPDF } from 'jspdf'
import { formatarMinutos, type KPIsProfissional } from '@/lib/relatorios/kpis-tempo-fabril'

type GerarPdfTempoFabrilInput = {
  periodoLabel: string
  kpisEquipe: KPIsProfissional[]
  profFiltro: string
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

export async function gerarPdfTempoFabril({
  periodoLabel,
  kpisEquipe,
  profFiltro,
}: GerarPdfTempoFabrilInput) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const kpisOrdenados = [...kpisEquipe].sort((a, b) => b.taxaOcupacao - a.taxaOcupacao)
  const profissionalSelecionado = profFiltro === 'todos'
    ? null
    : kpisEquipe.find((kpi) => kpi.profissionalId === profFiltro) ?? null
  const individuais = profissionalSelecionado ? [profissionalSelecionado] : kpisOrdenados
  const resumo = calcularResumoGeral(kpisEquipe)
  const mediaTaxa = calcularMediaTaxa(kpisEquipe)
  const mediaTempo = calcularMediaTempoFabril(kpisEquipe)

  desenharPaginaResumo(doc, periodoLabel, kpisOrdenados, resumo)

  doc.addPage()
  desenharPaginaEquipe(doc, kpisOrdenados)

  for (const kpi of individuais) {
    doc.addPage()
    desenharPaginaIndividual(doc, {
      periodoLabel,
      kpi,
      mediaTaxa,
      mediaTempo,
      totalProfissionais: kpisOrdenados.length,
      posicao: kpisOrdenados.findIndex((item) => item.profissionalId === kpi.profissionalId) + 1,
    })
  }

  aplicarRodape(doc, periodoLabel)

  const arquivo = profissionalSelecionado
    ? `relatorio-tempo-fabril-${slugify(kpiSafeName(profissionalSelecionado.nome))}.pdf`
    : 'relatorio-tempo-fabril-equipe.pdf'

  doc.save(arquivo)
}

function desenharPaginaResumo(
  doc: jsPDF,
  periodoLabel: string,
  ranking: KPIsProfissional[],
  resumo: ReturnType<typeof calcularResumoGeral>,
) {
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, PAGE_WIDTH, 48, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(255, 255, 255)
  doc.text('Relatório de Tempo Fábril', MARGIN_X, 22)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Resumo executivo do período', MARGIN_X, 30)
  doc.text(periodoLabel, MARGIN_X, 38)

  let y = 58
  y = desenharGradeCards(doc, y, [
    ['Taxa geral', `${resumo.taxaGeral}%`],
    ['Tempo fabril', formatarMinutos(resumo.totalFabrilMin)],
    ['Jornada contratada', formatarMinutos(resumo.totalJornadaMin)],
    ['Atendimentos', String(resumo.totalAtendimentos)],
  ])

  y += 10
  y = desenharTituloSecao(doc, y, 'Destaques')
  y = desenharBlocosTexto(doc, y, montarResumoExecutivo(ranking))

  y += 8
  y = desenharTituloSecao(doc, y, 'Ranking de ocupação')
  desenharTabelaRanking(doc, y, ranking.slice(0, 6))
}

function desenharPaginaEquipe(doc: jsPDF, ranking: KPIsProfissional[]) {
  let y = desenharCabecalhoInterno(doc, 'Visão Geral da Equipe', 'Comparativo consolidado')

  y += 4
  y = desenharTituloSecao(doc, y, 'Comparativo visual')
  y = desenharListaComparativos(doc, y, ranking.slice(0, 8))

  y += 8
  y = desenharTituloSecao(doc, y, 'Tabela consolidada')
  desenharTabelaEquipe(doc, y, ranking)
}

function desenharPaginaIndividual(
  doc: jsPDF,
  {
    periodoLabel,
    kpi,
    mediaTaxa,
    mediaTempo,
    totalProfissionais,
    posicao,
  }: {
    periodoLabel: string
    kpi: KPIsProfissional
    mediaTaxa: number
    mediaTempo: number
    totalProfissionais: number
    posicao: number
  },
) {
  let y = desenharCabecalhoInterno(doc, 'Relatório Individual', kpi.nome)

  y += 4
  y = desenharMetaLinha(doc, y, [
    ['Período', periodoLabel],
    ['Ocupação', `${kpi.taxaOcupacao}%`],
    ['Posição', `${posicao}/${totalProfissionais}`],
  ])

  y += 8
  y = desenharTituloSecao(doc, y, 'Indicadores')
  y = desenharGradeCards(doc, y, [
    ['Tempo fabril', formatarMinutos(kpi.tempoFabrilMin)],
    ['Jornada contratada', formatarMinutos(kpi.jornadaContratadaMin)],
    ['Atendimentos', String(kpi.qtdAtendimentos)],
    ['Tempo médio', formatarMinutos(kpi.tempoMedioMin)],
  ])

  y += 8
  y = desenharTituloSecao(doc, y, 'Análise')
  y = desenharBlocosTexto(doc, y, [
    `Taxa de ocupação de ${kpi.taxaOcupacao}% ${compararComMedia(kpi.taxaOcupacao, mediaTaxa)}.`,
    `Tempo fabril total de ${formatarMinutos(kpi.tempoFabrilMin)} ${compararTempo(kpi.tempoFabrilMin, mediaTempo)}.`,
    kpi.diasSubutilizados > 0
      ? `Foram identificados ${kpi.diasSubutilizados} dias subutilizados no período.`
      : 'Não houve dias subutilizados no período.',
  ])

  y += 8
  y = desenharTituloSecao(doc, y, 'Evolução semanal')
  desenharTabelaSemanal(doc, y, kpi)
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

function desenharMetaLinha(doc: jsPDF, y: number, itens: [string, string][]) {
  const gap = 4
  const itemWidth = (CONTENT_WIDTH - gap * (itens.length - 1)) / itens.length

  itens.forEach(([label, valor], index) => {
    const x = MARGIN_X + index * (itemWidth + gap)
    doc.setFillColor(...SOFT)
    doc.setDrawColor(...LINE)
    doc.roundedRect(x, y, itemWidth, 14, 2, 2, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(label.toUpperCase(), x + 3, y + 5)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...TEXT)
    doc.text(valor, x + 3, y + 10)
  })

  return y + 14
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

function desenharListaComparativos(doc: jsPDF, y: number, itens: KPIsProfissional[]) {
  const maxTempo = Math.max(...itens.map((item) => item.tempoFabrilMin), 1)
  let cursor = y

  for (const item of itens) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT)
    doc.text(item.nome, MARGIN_X, cursor + 4)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(`${item.taxaOcupacao}% de ocupação`, MARGIN_X, cursor + 8.5)

    desenharBarra(doc, MARGIN_X + 48, cursor + 2, 92, item.tempoFabrilMin, maxTempo)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT)
    doc.text(formatarMinutos(item.tempoFabrilMin), PAGE_WIDTH - MARGIN_X, cursor + 5.8, { align: 'right' })

    cursor += 12
  }

  return cursor
}

function desenharTabelaRanking(doc: jsPDF, y: number, ranking: KPIsProfissional[]) {
  const headers = ['#', 'Profissional', 'Taxa', 'Tempo fabril']
  const widths = [12, 90, 24, 46]
  let cursor = desenharLinhaTabela(doc, y, headers, widths, true)

  ranking.forEach((item, index) => {
    cursor = desenharLinhaTabela(doc, cursor, [
      String(index + 1),
      item.nome,
      `${item.taxaOcupacao}%`,
      formatarMinutos(item.tempoFabrilMin),
    ], widths)
  })

  return cursor
}

function desenharTabelaEquipe(doc: jsPDF, y: number, dados: KPIsProfissional[]) {
  const headers = ['Profissional', 'Taxa', 'Tempo fabril', 'Jornada', 'Atend.']
  const widths = [72, 18, 34, 34, 20]
  let cursor = desenharLinhaTabela(doc, y, headers, widths, true)

  for (const item of dados) {
    if (cursor > PAGE_HEIGHT - 22) {
      doc.addPage()
      cursor = desenharCabecalhoInterno(doc, 'Visão Geral da Equipe', 'Continuação')
      cursor = desenharLinhaTabela(doc, cursor + 4, headers, widths, true)
    }

    cursor = desenharLinhaTabela(doc, cursor, [
      item.nome,
      `${item.taxaOcupacao}%`,
      formatarMinutos(item.tempoFabrilMin),
      formatarMinutos(item.jornadaContratadaMin),
      String(item.qtdAtendimentos),
    ], widths)
  }

  return cursor
}

function desenharTabelaSemanal(doc: jsPDF, y: number, kpi: KPIsProfissional) {
  const headers = ['Semana', 'Tempo fabril', 'Jornada', 'Ocupação']
  const widths = [44, 44, 44, 28]
  let cursor = desenharLinhaTabela(doc, y, headers, widths, true)

  for (const semana of kpi.evolucaoPorSemana) {
    if (cursor > PAGE_HEIGHT - 22) {
      doc.addPage()
      cursor = desenharCabecalhoInterno(doc, 'Relatório Individual', `${kpi.nome} · Continuação`)
      cursor = desenharLinhaTabela(doc, cursor + 4, headers, widths, true)
    }

    cursor = desenharLinhaTabela(doc, cursor, [
      semana.label,
      formatarMinutos(semana.fabrilMin),
      formatarMinutos(semana.jornadaMin),
      `${semana.pct}%`,
    ], widths)
  }

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
    doc.setFillColor(...(isHeader ? BRAND : [255, 255, 255] as const))
    doc.rect(x, y, widths[index], rowHeight, 'FD')

    doc.setFont('helvetica', isHeader ? 'bold' : 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...(isHeader ? [255, 255, 255] as const : TEXT))

    const alignRight = index > 0
    doc.text(value, alignRight ? x + widths[index] - 2 : x + 2, y + 5.2, {
      align: alignRight ? 'right' : 'left',
      maxWidth: widths[index] - 4,
    })

    x += widths[index]
  })

  return y + rowHeight
}

function desenharBarra(doc: jsPDF, x: number, y: number, width: number, value: number, max: number) {
  doc.setFillColor(...LINE)
  doc.roundedRect(x, y, width, 4, 2, 2, 'F')

  const fill = Math.max(2, Math.min(width, (value / Math.max(max, 1)) * width))
  doc.setFillColor(...BRAND)
  doc.roundedRect(x, y, fill, 4, 2, 2, 'F')
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

function montarResumoExecutivo(ranking: KPIsProfissional[]) {
  if (ranking.length === 0) {
    return ['Não há dados suficientes para o período selecionado.']
  }

  const melhor = ranking[0]
  const pior = [...ranking].sort((a, b) => a.taxaOcupacao - b.taxaOcupacao)[0]
  const maiorTempo = [...ranking].sort((a, b) => b.tempoFabrilMin - a.tempoFabrilMin)[0]

  return [
    `${melhor.nome} apresentou a maior taxa de ocupação do período, com ${melhor.taxaOcupacao}%.`,
    `${maiorTempo.nome} acumulou o maior tempo fabril, somando ${formatarMinutos(maiorTempo.tempoFabrilMin)}.`,
    `${pior.nome} concentrou o principal ponto de atenção, com ${pior.taxaOcupacao}% de ocupação.`,
  ]
}

function compararComMedia(valor: number, media: number) {
  const delta = valor - media
  if (delta === 0) return 'está em linha com a média da equipe'
  if (delta > 0) return `está ${delta}% acima da média da equipe`
  return `está ${Math.abs(delta)}% abaixo da média da equipe`
}

function compararTempo(valor: number, media: number) {
  const delta = valor - media
  if (delta === 0) return 'em linha com a média da equipe'
  if (delta > 0) return `acima da média da equipe em ${formatarMinutos(delta)}`
  return `abaixo da média da equipe em ${formatarMinutos(Math.abs(delta))}`
}

function calcularResumoGeral(kpisEquipe: KPIsProfissional[]) {
  const totalJornadaMin = kpisEquipe.reduce((acc, kpi) => acc + kpi.jornadaContratadaMin, 0)
  const totalFabrilMin = kpisEquipe.reduce((acc, kpi) => acc + kpi.tempoFabrilMin, 0)
  const totalAtendimentos = kpisEquipe.reduce((acc, kpi) => acc + kpi.qtdAtendimentos, 0)
  const taxaGeral = totalJornadaMin > 0 ? Math.round((totalFabrilMin / totalJornadaMin) * 100) : 0

  return { totalJornadaMin, totalFabrilMin, totalAtendimentos, taxaGeral }
}

function calcularMediaTaxa(kpis: KPIsProfissional[]) {
  if (kpis.length === 0) return 0
  return Math.round(kpis.reduce((acc, kpi) => acc + kpi.taxaOcupacao, 0) / kpis.length)
}

function calcularMediaTempoFabril(kpis: KPIsProfissional[]) {
  if (kpis.length === 0) return 0
  return Math.round(kpis.reduce((acc, kpi) => acc + kpi.tempoFabrilMin, 0) / kpis.length)
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function kpiSafeName(nome: string) {
  return nome || 'profissional'
}
