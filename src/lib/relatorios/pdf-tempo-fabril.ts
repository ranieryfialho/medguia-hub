import type { jsPDF } from 'jspdf'
import { formatarMinutos, type KPIsProfissional } from '@/lib/relatorios/kpis-tempo-fabril'
import { formatAppDate, formatAppTime } from '@/lib/datetime'
import type { OpcaoStatus } from '@/lib/status-disponibilidade-cores'
import { classificarBloco } from '@/lib/status-disponibilidade-regras'

type GerarPdfTempoFabrilInput = {
  periodoLabel: string
  kpisEquipe: KPIsProfissional[]
  profFiltro: string
  statusOpcoes: OpcaoStatus[]
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
  statusOpcoes,
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
  // Só entram no relatório os status não-sistema (ex.: "Em reunião", "Ocupado" e
  // status customizados criados em /configuracoes/status-disponibilidade) que
  // acumularam tempo para algum profissional no período — mesmo critério da tabela web.
  const statusComTempo = statusOpcoes
    .filter((op) => !op.sistema && kpisEquipe.some((k) => (k.tempoStatusMin[op.slug] ?? 0) > 0))
    .sort((a, b) => a.ordem - b.ordem)

  desenharPaginaResumo(doc, periodoLabel, kpisOrdenados, resumo)

  doc.addPage()
  desenharPaginaEquipe(doc, kpisOrdenados, statusComTempo)

  for (const kpi of individuais) {
    doc.addPage()
    desenharPaginaIndividual(doc, {
      periodoLabel,
      kpi,
      mediaTaxa,
      mediaTempo,
      totalProfissionais: kpisOrdenados.length,
      posicao: kpisOrdenados.findIndex((item) => item.profissionalId === kpi.profissionalId) + 1,
      statusComTempo,
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

function desenharPaginaEquipe(doc: jsPDF, ranking: KPIsProfissional[], statusComTempo: OpcaoStatus[]) {
  let y = desenharCabecalhoInterno(doc, 'Visão Geral da Equipe', 'Comparativo consolidado')

  y += 4
  y = desenharTituloSecao(doc, y, 'Comparativo visual')
  y = desenharListaComparativos(doc, y, ranking.slice(0, 8))

  y += 8
  y = desenharTituloSecao(doc, y, 'Tabela consolidada')
  desenharTabelaEquipe(doc, y, ranking, statusComTempo)
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
    statusComTempo,
  }: {
    periodoLabel: string
    kpi: KPIsProfissional
    mediaTaxa: number
    mediaTempo: number
    totalProfissionais: number
    posicao: number
    statusComTempo: OpcaoStatus[]
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
  const statusCards = statusComTempo
    .filter((op) => (kpi.tempoStatusMin[op.slug] ?? 0) > 0)
    .map((op): [string, string] => [op.label, formatarMinutos(kpi.tempoStatusMin[op.slug] ?? 0)])
  y = desenharGradeCards(doc, y, [
    ['Tempo fabril', formatarMinutos(kpi.tempoFabrilMin)],
    ['Horas de agendamento', formatarMinutos(kpi.horasAgendamentoMin)],
    ['Jornada contratada', formatarMinutos(kpi.jornadaContratadaMin)],
    ['Atendimentos', String(kpi.qtdAtendimentos)],
    ['Tempo médio', formatarMinutos(kpi.tempoMedioMin)],
    ...statusCards,
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

  doc.addPage()
  let yDetalhe = desenharCabecalhoInterno(doc, 'Atendimentos do Período', kpi.nome)
  yDetalhe += 4
  desenharTabelaAtendimentos(doc, yDetalhe, kpi)

  if (kpi.detalheStatus.length > 0) {
    doc.addPage()
    let yStatus = desenharCabecalhoInterno(doc, 'Conferência de Status', kpi.nome)
    yStatus += 4
    desenharTabelaDetalheStatus(doc, yStatus, kpi, statusComTempo)
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

function desenharTabelaEquipe(doc: jsPDF, y: number, dados: KPIsProfissional[], statusComTempo: OpcaoStatus[]) {
  const numStatus = statusComTempo.length
  const baseHeaders = ['Profissional', 'Taxa', 'Tempo fabril', 'Horas agend.', 'Jornada', 'Atend.']
  const baseWidths = numStatus > 0 ? [38, 14, 24, 24, 24, 14] : [60, 16, 28, 28, 28, 18]
  const statusWidth = numStatus > 0
    ? (CONTENT_WIDTH - baseWidths.reduce((acc, w) => acc + w, 0)) / numStatus
    : 0

  const headers = [
    baseHeaders[0],
    ...statusComTempo.map((op) => op.label_curto),
    ...baseHeaders.slice(1),
  ]
  const widths = [
    baseWidths[0],
    ...statusComTempo.map(() => statusWidth),
    ...baseWidths.slice(1),
  ]

  let cursor = desenharLinhaTabela(doc, y, headers, widths, true)

  for (const item of dados) {
    if (cursor > PAGE_HEIGHT - 22) {
      doc.addPage()
      cursor = desenharCabecalhoInterno(doc, 'Visão Geral da Equipe', 'Continuação')
      cursor = desenharLinhaTabela(doc, cursor + 4, headers, widths, true)
    }

    cursor = desenharLinhaTabela(doc, cursor, [
      item.nome,
      ...statusComTempo.map((op) => {
        const min = item.tempoStatusMin[op.slug] ?? 0
        return min > 0 ? formatarMinutos(min) : '—'
      }),
      `${item.taxaOcupacao}%`,
      formatarMinutos(item.tempoFabrilMin),
      formatarMinutos(item.horasAgendamentoMin),
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

function desenharTabelaAtendimentos(doc: jsPDF, y: number, kpi: KPIsProfissional) {
  if (kpi.detalheAtendimentos.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.text('Nenhum atendimento fábril no período.', MARGIN_X, y + 4)
    return y + 8
  }

  const headers = ['Paciente', 'Tipo de Consulta', 'Dia', 'Tempo']
  const widths = [70, 46, 40, 22]
  let cursor = desenharLinhaTabela(doc, y, headers, widths, true)

  for (const atendimento of kpi.detalheAtendimentos) {
    if (cursor > PAGE_HEIGHT - 22) {
      doc.addPage()
      cursor = desenharCabecalhoInterno(doc, 'Atendimentos do Período', `${kpi.nome} · Continuação`)
      cursor = desenharLinhaTabela(doc, cursor + 4, headers, widths, true)
    }

    cursor = desenharLinhaTabela(doc, cursor, [
      atendimento.pacienteNome,
      atendimento.tipo,
      `${formatAppDate(atendimento.data)} ${formatAppTime(atendimento.data)}`,
      formatarMinutos(atendimento.duracaoMinutos),
    ], widths)
  }

  return cursor
}

function desenharTabelaDetalheStatus(
  doc: jsPDF,
  y: number,
  kpi: KPIsProfissional,
  statusOpcoes: OpcaoStatus[],
) {
  // AC-034: Motivo é o que torna a conferência auditável — sem ele o gestor lê
  // "3h de Em reunião" e não sabe qual reunião. Soma 178mm = CONTENT_WIDTH.
  const headers = ['Status', 'Motivo', 'Início', 'Fim', 'Duração']
  const widths = [40, 52, 34, 34, 18]
  const aligns: ('left' | 'right')[] = ['left', 'left', 'right', 'right', 'right']
  let cursor = desenharLinhaTabela(doc, y, headers, widths, true, aligns)

  let algumExpirado = false
  let algumDescontado = false

  // AC-041: o PDF leva o mesmo tempo líquido da tela e do Markdown. Um relatório
  // que se exporta com outro número é pior que nenhum, porque o arquivo é o que
  // circula fora do sistema.
  const liquidoDoBloco = (s: (typeof kpi.detalheStatus)[number]) =>
    Math.max(0, s.duracaoMinutos - s.descontadoMinutos)

  for (const s of kpi.detalheStatus) {
    if (cursor > PAGE_HEIGHT - 22) {
      doc.addPage()
      cursor = desenharCabecalhoInterno(doc, 'Conferência de Status', `${kpi.nome} · Continuação`)
      cursor = desenharLinhaTabela(doc, cursor + 4, headers, widths, true, aligns)
    }

    const label = statusOpcoes.find((op) => op.slug === s.status)?.label ?? s.status
    const fimLabel = s.aberto ? 'Em aberto' : `${formatAppDate(s.fim!)} ${formatAppTime(s.fim!)}`

    // AC-035: marcado com asterisco e explicado no rodapé da tabela. Escrever
    // "(expirou)" na célula de Fim não cabe na largura, e cortar a data para
    // caber seria pior do que a marca.
    const expirado = classificarBloco(s.duracaoMinutos, s.aberto) === 'expirado'
    if (expirado) algumExpirado = true

    // AC-041: a marca vai na coluna de Duração, junto do asterisco de expirado.
    // Mesma restrição do AC-035 — as larguras já foram rebalanceadas para
    // 178mm e não há espaço para uma coluna nova; a explicação vai no rodapé.
    const descontado = s.descontadoMinutos > 0
    if (descontado) algumDescontado = true

    cursor = desenharLinhaTabela(doc, cursor, [
      label,
      s.observacao ?? '—',
      `${formatAppDate(s.inicio)} ${formatAppTime(s.inicio)}`,
      fimLabel,
      `${formatarMinutos(liquidoDoBloco(s))}${expirado ? ' *' : ''}${descontado ? ' +' : ''}`,
    ], widths, false, aligns)
  }

  if (algumExpirado) {
    cursor = desenharBlocosTexto(doc, cursor + 3, [
      '* Fechado automaticamente no teto de 2h — a pessoa não encerrou o status.',
    ])
  }

  if (algumDescontado) {
    const descontadoTotal = kpi.detalheStatus.reduce((acc, s) => acc + s.descontadoMinutos, 0)
    cursor = desenharBlocosTexto(doc, cursor + 3, [
      `+ Parte do bloco aconteceu durante atendimento. ${formatarMinutos(descontadoTotal)} não entram nestes números — o tempo sobreposto conta uma vez, do lado do atendimento.`,
    ])
  }

  // Totais por status (bate com as colunas da tabela consolidada) + total geral
  const totaisPorStatus = new Map<string, number>()
  for (const s of kpi.detalheStatus) {
    totaisPorStatus.set(s.status, (totaisPorStatus.get(s.status) ?? 0) + liquidoDoBloco(s))
  }
  const totalGeral = kpi.detalheStatus.reduce((acc, s) => acc + liquidoDoBloco(s), 0)

  if (cursor > PAGE_HEIGHT - 30) {
    doc.addPage()
    cursor = desenharCabecalhoInterno(doc, 'Conferência de Status', `${kpi.nome} · Continuação`)
  }

  cursor += 6
  const linhasTotais = [...totaisPorStatus.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([slug, min]) => {
      const label = statusOpcoes.find((op) => op.slug === slug)?.label ?? slug
      return `${label}: ${formatarMinutos(min)}`
    })
  linhasTotais.push(`Total: ${formatarMinutos(totalGeral)}`)

  cursor = desenharBlocosTexto(doc, cursor, [linhasTotais.join('   ·   ')])

  return cursor
}

/**
 * Corta o texto para caber na largura, com reticências.
 *
 * A linha tem altura fixa de 8mm. Passar `maxWidth` ao jsPDF faz o texto
 * QUEBRAR em várias linhas, que transbordam a célula e invadem a linha de
 * baixo. Cortar é a única saída num layout de altura fixa — e passou a
 * importar de verdade com a coluna Motivo, que é texto livre.
 */
function truncarParaLargura(doc: jsPDF, texto: string, larguraDisponivel: number): string {
  if (doc.getTextWidth(texto) <= larguraDisponivel) return texto

  let corte = texto
  while (corte.length > 1 && doc.getTextWidth(`${corte}…`) > larguraDisponivel) {
    corte = corte.slice(0, -1)
  }
  return `${corte.trimEnd()}…`
}

function desenharLinhaTabela(
  doc: jsPDF,
  y: number,
  values: string[],
  widths: number[],
  isHeader = false,
  /**
   * Alinhamento por coluna. Sem isto, o padrão histórico é "primeira à
   * esquerda, todas as outras à direita" — o que serve para colunas numéricas,
   * mas deixa a coluna Motivo, que é texto corrido, colada na borda direita.
   */
  aligns?: ('left' | 'right')[],
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

    const align = aligns?.[index] ?? (index > 0 ? 'right' : 'left')
    const texto = truncarParaLargura(doc, value, widths[index] - 4)

    doc.text(texto, align === 'right' ? x + widths[index] - 2 : x + 2, y + 5.2, {
      align,
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
