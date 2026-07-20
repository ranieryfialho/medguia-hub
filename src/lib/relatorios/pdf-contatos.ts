import type { jsPDF } from 'jspdf'
import { LABEL_POR_STATUS_CONTATO, STATUS_CONTATO_PADRAO } from '@/lib/contatos-kanban'
import type {
  DadosRelatorioContatos,
  ContatoPorResponsavelResumo,
  AtividadeContatoResponsavelResumo,
  ContatoEmRiscoResumo,
  AnotacaoContatoResumo,
} from './contatos-relatorio-dados'

export type GerarPdfContatosInput = DadosRelatorioContatos

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

function bucketRisco(dias: number): string {
  return dias >= 90 ? 'Em Risco (90+d)' : 'Atenção (30-89d)'
}

export async function gerarPdfContatos(input: GerarPdfContatosInput) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  desenharPaginaResumo(doc, input)

  doc.addPage()
  desenharPaginaDistribuicaoGeral(doc, input)

  if (input.contatosPorResponsavelGlobal.length > 0 || input.contatosPorResponsavelPeriodo.length > 0) {
    doc.addPage()
    desenharPaginaResponsaveis(doc, input)
  }

  if (input.atividadeContatosPorResponsavelGlobal.length > 0 || input.atividadeContatosPorResponsavel.length > 0) {
    doc.addPage()
    desenharPaginaAtividade(doc, input)
  }

  if (input.contatosEmRisco.length > 0) {
    doc.addPage()
    desenharPaginaRisco(doc, input.contatosEmRisco)
  }

  if (input.anotacoes.length > 0) {
    doc.addPage()
    desenharPaginaAnotacoes(doc, input.anotacoes)
  }

  aplicarRodape(doc, input.periodoLabel)
  doc.save('relatorio-contatos.pdf')
}

function desenharPaginaResumo(doc: jsPDF, input: GerarPdfContatosInput) {
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, PAGE_WIDTH, 48, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(255, 255, 255)
  doc.text('Relatório de Contatos', MARGIN_X, 22)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Funil de vendas e performance de contatos — base completa e período filtrado', MARGIN_X, 30)
  doc.text(input.periodoLabel, MARGIN_X, 38)

  let y = 58
  y = desenharGradeCards(doc, y, [
    ['Carteira total (geral)', String(input.totalContatos)],
    ['Contatos no período', String(input.totalContatosPeriodo)],
    ['Taxa conversão geral', `${input.taxaConversaoGeral}%`],
    ['Taxa conversão (período)', `${input.taxaConversaoPeriodo}%`],
    ['Contatos em risco', String(input.contatosEmRisco.length)],
    ['Sem responsável', String(input.contatosSemResponsavelCount)],
  ])

  y += 10
  y = desenharTituloSecao(doc, y, 'Destaques')
  y = desenharBlocosTexto(doc, y, montarDestaques(input))

  y += 8
  if (y > PAGE_HEIGHT - 60) {
    doc.addPage()
    y = desenharCabecalhoInterno(doc, 'Etapas do Kanban (Período)', '')
  } else {
    y = desenharTituloSecao(doc, y, 'Etapas do Kanban (Período)')
  }
  const headers = ['Etapa', 'Contatos', '%']
  const widths = [110, 30, 38]
  y = desenharLinhaTabela(doc, y, headers, widths, true)

  const colunasComTotal = input.contagemPorColunaPeriodo.filter(c => c.total > 0)
  for (const coluna of colunasComTotal) {
    if (y > PAGE_HEIGHT - 22) break
    y = desenharLinhaTabela(doc, y, [coluna.nome, String(coluna.total), fmtPct(coluna.total, input.totalContatosPeriodo)], widths)
  }
}

function desenharPaginaDistribuicaoGeral(doc: jsPDF, input: GerarPdfContatosInput) {
  let y = desenharCabecalhoInterno(doc, 'Distribuição por Status', 'Base completa (geral) x Período filtrado')
  y += 4

  const headers = ['Status', 'Geral', '% Geral', 'Período', '% Período']
  const widths = [56, 26, 28, 32, 32]
  y = desenharLinhaTabela(doc, y, headers, widths, true)

  for (const status of STATUS_CONTATO_PADRAO) {
    const geral = input.contagemPorStatusGlobal[status]
    const periodo = input.contagemPorStatusPeriodo[status]
    if (geral === 0 && periodo === 0) continue
    if (y > PAGE_HEIGHT - 22) {
      doc.addPage()
      y = desenharCabecalhoInterno(doc, 'Distribuição por Status', 'Continuação')
      y = desenharLinhaTabela(doc, y + 4, headers, widths, true)
    }
    y = desenharLinhaTabela(doc, y, [
      LABEL_POR_STATUS_CONTATO[status],
      String(geral),
      fmtPct(geral, input.totalContatos),
      String(periodo),
      fmtPct(periodo, input.totalContatosPeriodo),
    ], widths)
  }

  y += 12
  if (y > PAGE_HEIGHT - 60) {
    doc.addPage()
    y = desenharCabecalhoInterno(doc, 'Etapas do Kanban', 'Base completa (geral) x Período filtrado')
  } else {
    y = desenharTituloSecao(doc, y, 'Etapas do Kanban — Geral x Período')
  }

  const headersK = ['Etapa', 'Geral', '% Geral', 'Período', '% Período']
  const widthsK = [56, 26, 28, 32, 32]
  y = desenharLinhaTabela(doc, y, headersK, widthsK, true)

  const nomesEtapas = new Set([
    ...input.contagemPorColunaGlobal.map(c => c.nome),
    ...input.contagemPorColunaPeriodo.map(c => c.nome),
  ])
  for (const nome of nomesEtapas) {
    const geral = input.contagemPorColunaGlobal.find(c => c.nome === nome)?.total ?? 0
    const periodo = input.contagemPorColunaPeriodo.find(c => c.nome === nome)?.total ?? 0
    if (geral === 0 && periodo === 0) continue
    if (y > PAGE_HEIGHT - 22) {
      doc.addPage()
      y = desenharCabecalhoInterno(doc, 'Etapas do Kanban', 'Continuação')
      y = desenharLinhaTabela(doc, y + 4, headersK, widthsK, true)
    }
    y = desenharLinhaTabela(doc, y, [
      nome,
      String(geral),
      fmtPct(geral, input.totalContatos),
      String(periodo),
      fmtPct(periodo, input.totalContatosPeriodo),
    ], widthsK)
  }
}

function desenharTabelaResponsaveis(
  doc: jsPDF,
  y: number,
  titulo: string,
  lista: ContatoPorResponsavelResumo[],
  tituloPagina: string,
) {
  const headers = ['Responsável', 'Total', 'Agendou', 'Taxa Conversão']
  const widths = [80, 26, 26, 36]

  y = desenharTituloSecao(doc, y, titulo)
  y = desenharLinhaTabela(doc, y, headers, widths, true)

  const ordenados = [...lista].sort((a, b) => b.total - a.total)
  for (const resp of ordenados) {
    if (y > PAGE_HEIGHT - 22) {
      doc.addPage()
      y = desenharCabecalhoInterno(doc, tituloPagina, 'Continuação')
      y = desenharLinhaTabela(doc, y + 4, headers, widths, true)
    }
    y = desenharLinhaTabela(doc, y, [
      resp.nome,
      String(resp.total),
      String(resp.contagemPorStatus.agendou),
      `${resp.taxaConversao}%`,
    ], widths)
  }

  return y
}

function desenharPaginaResponsaveis(doc: jsPDF, input: GerarPdfContatosInput) {
  const titulo = 'Performance por Responsável'
  let y = desenharCabecalhoInterno(doc, titulo, 'Base completa (geral)')
  y += 4

  y = desenharTabelaResponsaveis(doc, y, 'Geral (toda a base)', input.contatosPorResponsavelGlobal, titulo)

  y += 12
  if (y > PAGE_HEIGHT - 60) {
    doc.addPage()
    y = desenharCabecalhoInterno(doc, titulo, 'Período filtrado')
  }
  desenharTabelaResponsaveis(doc, y, `Período — ${input.periodoLabel}`, input.contatosPorResponsavelPeriodo, titulo)
}

function desenharTabelaAtividade(
  doc: jsPDF,
  y: number,
  titulo: string,
  lista: AtividadeContatoResponsavelResumo[],
  tituloPagina: string,
) {
  const headers = ['Profissional', 'Carteira', 'Contatados', 'Efetivos', 'Taxa Efetiv.']
  const widths = [56, 26, 30, 26, 34]

  y = desenharTituloSecao(doc, y, titulo)
  y = desenharLinhaTabela(doc, y, headers, widths, true)

  const ordenados = [...lista].sort((a, b) => b.contatados - a.contatados)
  for (const item of ordenados) {
    if (y > PAGE_HEIGHT - 22) {
      doc.addPage()
      y = desenharCabecalhoInterno(doc, tituloPagina, 'Continuação')
      y = desenharLinhaTabela(doc, y + 4, headers, widths, true)
    }
    y = desenharLinhaTabela(doc, y, [
      item.nome,
      String(item.carteira),
      String(item.contatados),
      String(item.efetivos),
      `${item.taxaEfetividade}%`,
    ], widths)
  }

  return y
}

function desenharPaginaAtividade(doc: jsPDF, input: GerarPdfContatosInput) {
  const titulo = 'Atividade por Responsável'
  let y = desenharCabecalhoInterno(doc, titulo, 'Contatados x efetivos — geral e no período')
  y += 4

  const taxaEfetGeral = input.totalContatadosGlobal > 0
    ? Math.round((input.totalEfetivosGlobal / input.totalContatadosGlobal) * 100)
    : 0
  const taxaEfetPeriodo = input.totalContatadosPeriodo > 0
    ? Math.round((input.totalEfetivosPeriodo / input.totalContatadosPeriodo) * 100)
    : 0

  y = desenharGradeCards(doc, y, [
    ['Contatados (geral)', String(input.totalContatadosGlobal)],
    ['Contatados (período)', String(input.totalContatadosPeriodo)],
    ['Efetivos (geral)', String(input.totalEfetivosGlobal)],
    ['Efetivos (período)', String(input.totalEfetivosPeriodo)],
    ['Taxa efetividade (geral)', `${taxaEfetGeral}%`],
    ['Taxa efetividade (período)', `${taxaEfetPeriodo}%`],
  ])
  y += 10

  y = desenharTabelaAtividade(doc, y, 'Geral (toda a base)', input.atividadeContatosPorResponsavelGlobal, titulo)

  y += 12
  if (y > PAGE_HEIGHT - 60) {
    doc.addPage()
    y = desenharCabecalhoInterno(doc, titulo, 'Período filtrado')
  }
  desenharTabelaAtividade(doc, y, `Período — ${input.periodoLabel}`, input.atividadeContatosPorResponsavel, titulo)
}

function desenharPaginaRisco(doc: jsPDF, contatosEmRisco: ContatoEmRiscoResumo[]) {
  const titulo = 'Contatos em Risco'
  let y = desenharCabecalhoInterno(doc, titulo, `${contatosEmRisco.length} contato(s) sem atividade há 30+ dias (base completa)`)
  y += 4

  const emAtencao = contatosEmRisco.filter(c => c.dias_sem_atividade < 90).length
  const emRisco = contatosEmRisco.filter(c => c.dias_sem_atividade >= 90).length

  y = desenharGradeCards(doc, y, [
    ['Total em risco', String(contatosEmRisco.length)],
    ['Atenção (30-89 dias)', String(emAtencao)],
    ['Em risco (90+ dias)', String(emRisco)],
  ])
  y += 10

  // Agrupamento por responsável
  const porResponsavel = new Map<string, number>()
  for (const c of contatosEmRisco) {
    const chave = c.responsavel_nome ?? 'Sem responsável'
    porResponsavel.set(chave, (porResponsavel.get(chave) ?? 0) + 1)
  }
  const respOrdenados = [...porResponsavel.entries()].sort((a, b) => b[1] - a[1])

  if (respOrdenados.length > 0) {
    y = desenharTituloSecao(doc, y, 'Por Responsável')
    const headersResp = ['Responsável', 'Contatos em Risco']
    const widthsResp = [140, 38]
    y = desenharLinhaTabela(doc, y, headersResp, widthsResp, true)
    for (const [nome, total] of respOrdenados) {
      if (y > PAGE_HEIGHT - 22) {
        doc.addPage()
        y = desenharCabecalhoInterno(doc, titulo, 'Continuação')
        y = desenharLinhaTabela(doc, y + 4, headersResp, widthsResp, true)
      }
      y = desenharLinhaTabela(doc, y, [nome, String(total)], widthsResp)
    }
    y += 12
  }

  if (y > PAGE_HEIGHT - 60) {
    doc.addPage()
    y = desenharCabecalhoInterno(doc, titulo, 'Detalhamento')
  } else {
    y = desenharTituloSecao(doc, y, 'Detalhamento')
  }

  const headers = ['Paciente', 'Etapa', 'Responsável', 'Dias', 'Situação']
  const widths = [46, 40, 40, 18, 34]
  y = desenharLinhaTabela(doc, y, headers, widths, true)

  const ordenados = [...contatosEmRisco].sort((a, b) => b.dias_sem_atividade - a.dias_sem_atividade)
  for (const c of ordenados) {
    if (y > PAGE_HEIGHT - 22) {
      doc.addPage()
      y = desenharCabecalhoInterno(doc, titulo, 'Continuação')
      y = desenharLinhaTabela(doc, y + 4, headers, widths, true)
    }
    y = desenharLinhaTabela(doc, y, [
      c.paciente_nome,
      c.kanban_coluna_nome,
      c.responsavel_nome ?? 'Sem responsável',
      String(c.dias_sem_atividade),
      bucketRisco(c.dias_sem_atividade),
    ], widths)
  }
}

function desenharPaginaAnotacoes(doc: jsPDF, anotacoes: AnotacaoContatoResumo[]) {
  const titulo = 'Anotações'
  let y = desenharCabecalhoInterno(doc, titulo, `${anotacoes.length} anotação(ões) registrada(s)`)
  y += 4

  const headers = ['Data', 'Paciente', 'Autor', 'Anotação']
  const widths = [22, 36, 30, 90]
  y = desenharLinhaTabela(doc, y, headers, widths, true)

  const ordenadas = [...anotacoes].sort((a, b) => b.criado_em.localeCompare(a.criado_em))
  for (const nota of ordenadas) {
    const linhasTexto = doc.splitTextToSize(nota.texto, widths[3] - 4)
    const rowH = Math.max(8, linhasTexto.length * 4 + 4)

    if (y + rowH > PAGE_HEIGHT - 22) {
      doc.addPage()
      y = desenharCabecalhoInterno(doc, titulo, 'Continuação')
      y = desenharLinhaTabela(doc, y + 4, headers, widths, true)
    }

    const data = new Date(nota.criado_em).toLocaleDateString('pt-BR')
    const cols = [data, nota.paciente_nome, nota.autor_nome ?? '—', nota.texto]

    let x = MARGIN_X
    cols.forEach((val, idx) => {
      doc.setDrawColor(...LINE)
      doc.setFillColor(255, 255, 255)
      doc.rect(x, y, widths[idx], rowH, 'FD')

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...TEXT)

      const linhas = doc.splitTextToSize(val, widths[idx] - 4)
      doc.text(linhas, x + 2, y + 4.5, { maxWidth: widths[idx] - 4 })

      x += widths[idx]
    })

    y += rowH
  }
}

function montarDestaques(input: GerarPdfContatosInput): string[] {
  const destaques: string[] = []

  destaques.push(
    `A base possui ${input.totalContatos} contato(s) no total, com taxa de conversão geral de ${input.taxaConversaoGeral}%.`,
  )

  if (input.totalContatosPeriodo > 0) {
    destaques.push(
      `No período selecionado, ${input.totalContatosPeriodo} contato(s) foram atualizados, com taxa de conversão de ${input.taxaConversaoPeriodo}%.`,
    )
  } else {
    destaques.push('Não há contatos atualizados no período selecionado.')
  }

  const topResponsavelGeral = [...input.contatosPorResponsavelGlobal].sort((a, b) => b.total - a.total)[0]
  if (topResponsavelGeral) {
    destaques.push(
      `${topResponsavelGeral.nome} lidera o volume geral de contatos, com ${topResponsavelGeral.total} contato(s) e ${topResponsavelGeral.taxaConversao}% de conversão.`,
    )
  }

  const topEfetividade = [...input.atividadeContatosPorResponsavelGlobal].sort((a, b) => b.taxaEfetividade - a.taxaEfetividade)[0]
  if (topEfetividade && topEfetividade.contatados > 0) {
    destaques.push(
      `${topEfetividade.nome} tem a maior taxa de efetividade geral (${topEfetividade.taxaEfetividade}%), com ${topEfetividade.efetivos} de ${topEfetividade.contatados} contatos efetivos.`,
    )
  }

  if (input.contatosEmRisco.length > 0) {
    const emRisco90 = input.contatosEmRisco.filter(c => c.dias_sem_atividade >= 90).length
    destaques.push(
      `${input.contatosEmRisco.length} contato(s) estão em risco (30+ dias sem atividade), sendo ${emRisco90} há mais de 90 dias.`,
    )
  }

  if (input.contatosSemResponsavelCount > 0) {
    destaques.push(`${input.contatosSemResponsavelCount} contato(s) ainda não têm responsável atribuído.`)
  }

  if (input.anotacoes.length > 0) {
    destaques.push(`${input.anotacoes.length} anotação(ões) registrada(s) nos contatos.`)
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
