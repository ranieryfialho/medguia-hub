import type { jsPDF } from 'jspdf'

export type SessaoConferencia = {
  pacienteNome: string
  hora: string
  tipo: string
  duracaoMinutos: number
  planoSaude: string
}

export type DiaConferencia = {
  dataLabel: string
  sessoes: SessaoConferencia[]
  totalSessoes: number
  totalMinutos: number
}

export type SessaoPendente = {
  pacienteNome: string
  hora: string
  dataLabel: string
  tipo: string
  status: string
}

export type GrupoProfissionalConferencia = {
  profissionalNome: string
  dias: DiaConferencia[]
  totalSessoes: number
  totalMinutos: number
  pendentesPassados?: SessaoPendente[]
}

export type GerarPdfConferenciaInput = {
  periodoLabel: string
  profissionalFiltro?: string
  grupos: GrupoProfissionalConferencia[]
  totalGeralSessoes: number
  totalGeralMinutos: number
}

type RGB = readonly [number, number, number]

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const MARGIN_X = 14
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2

const BRAND: RGB = [0, 107, 90]
const TEXT: RGB = [24, 29, 28]
const MUTED: RGB = [102, 112, 108]
const LINE: RGB = [220, 226, 223]
const SOFT: RGB = [246, 248, 247]
const BRAND_LIGHT: RGB = [232, 245, 242]

// Colunas detalhe: Hora | Paciente | Tipo | Duração | Plano de Saúde
const COL_WIDTHS = [18, 54, 40, 22, 48] as const
const COL_HEADERS = ['Hora', 'Paciente', 'Tipo', 'Duração', 'Plano de Saúde']

// Colunas resumo: Profissional | Sessões | Horas
const RES_WIDTHS = [100, 30, 52] as const
const RES_HEADERS = ['Profissional', 'Sessões', 'Total trabalhado']

function formatarMinutos(minutos: number): string {
  if (minutos <= 0) return '—'
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h}h` : `${h}h ${m}min`
}

function truncar(texto: string, max: number): string {
  return texto.length > max ? texto.slice(0, max - 1) + '…' : texto
}

function novasPaginas(doc: jsPDF, y: number, alturaMinima: number, periodoLabel: string): number {
  if (y + alturaMinima > PAGE_HEIGHT - 18) {
    doc.addPage()
    aplicarRodapeUmaPagina(doc, periodoLabel, doc.getNumberOfPages())
    return 16
  }
  return y
}

function aplicarRodapeUmaPagina(doc: jsPDF, periodoLabel: string, page: number) {
  doc.setDrawColor(...LINE)
  doc.line(MARGIN_X, PAGE_HEIGHT - 10, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...MUTED)
  doc.text(periodoLabel, MARGIN_X, PAGE_HEIGHT - 6)
  doc.text(`Página ${page}`, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 6, { align: 'right' })
}

function desenharLinhaTabela(
  doc: jsPDF,
  y: number,
  values: string[],
  widths: readonly number[],
  isHeader = false,
  sombreada = false,
): number {
  let x = MARGIN_X
  const rowHeight = 7.5

  values.forEach((value, index) => {
    const bg: RGB = isHeader ? BRAND : sombreada ? SOFT : [255, 255, 255]
    doc.setFillColor(...bg)
    doc.setDrawColor(...LINE)
    doc.rect(x, y, widths[index], rowHeight, 'FD')

    doc.setFont('helvetica', isHeader ? 'bold' : 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...(isHeader ? ([255, 255, 255] as const) : TEXT))

    doc.text(value, x + 2, y + 5, {
      align: 'left',
      maxWidth: widths[index] - 4,
    })

    x += widths[index]
  })

  return y + rowHeight
}

export async function gerarPdfConferenciaAgendamentos(input: GerarPdfConferenciaInput) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // ── Cabeçalho ────────────────────────────────────────────────────
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, PAGE_WIDTH, 46, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(255, 255, 255)
  doc.text('Conferência de Agendamentos', MARGIN_X, 20)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.text('Atendimentos concluídos agrupados por profissional e data', MARGIN_X, 28)
  doc.text(
    input.periodoLabel + (input.profissionalFiltro ? ` · ${input.profissionalFiltro}` : ''),
    MARGIN_X,
    36,
  )

  // ── Cards de resumo geral ─────────────────────────────────────────
  let y = 54
  const cardW = (CONTENT_WIDTH - 6) / 2
  const cardH = 17

  const cards: [string, string][] = [
    ['Total de sessões', String(input.totalGeralSessoes)],
    ['Total trabalhado', formatarMinutos(input.totalGeralMinutos)],
  ]

  cards.forEach(([titulo, valor], i) => {
    const x = MARGIN_X + i * (cardW + 6)
    doc.setFillColor(...SOFT)
    doc.setDrawColor(...LINE)
    doc.roundedRect(x, y, cardW, cardH, 2, 2, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(...MUTED)
    doc.text(titulo.toUpperCase(), x + 4, y + 5)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...TEXT)
    doc.text(valor, x + 4, y + 13.5)
  })

  y += cardH + 8
  aplicarRodapeUmaPagina(doc, input.periodoLabel, 1)

  // ── Tabela de resumo por profissional ─────────────────────────────
  y = novasPaginas(doc, y, 16 + input.grupos.length * 7.5 + 10, input.periodoLabel)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...BRAND)
  doc.text('Resumo por Profissional', MARGIN_X, y + 4)
  y += 8

  // Header
  y = desenharLinhaTabela(doc, y, RES_HEADERS, RES_WIDTHS, true)

  // Linhas
  input.grupos.forEach((grupo, index) => {
    y = novasPaginas(doc, y, 10, input.periodoLabel)
    y = desenharLinhaTabela(
      doc,
      y,
      [
        truncar(grupo.profissionalNome, 50),
        String(grupo.totalSessoes),
        formatarMinutos(grupo.totalMinutos),
      ],
      RES_WIDTHS,
      false,
      index % 2 === 1,
    )
  })

  // Linha de total
  y = novasPaginas(doc, y, 10, input.periodoLabel)
  let rx = MARGIN_X
  const totalValues = [
    'TOTAL GERAL',
    String(input.totalGeralSessoes),
    formatarMinutos(input.totalGeralMinutos),
  ]
  totalValues.forEach((val, i) => {
    doc.setFillColor(230, 245, 241)
    doc.setDrawColor(...LINE)
    doc.rect(rx, y, RES_WIDTHS[i], 8, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...BRAND)
    doc.text(val, rx + 2, y + 5.5)
    rx += RES_WIDTHS[i]
  })
  y += 14

  // ── Detalhamento por profissional ─────────────────────────────────
  for (const grupo of input.grupos) {
    y = novasPaginas(doc, y, 28, input.periodoLabel)

    doc.setFillColor(...BRAND)
    doc.roundedRect(MARGIN_X, y, CONTENT_WIDTH, 10, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text(grupo.profissionalNome, MARGIN_X + 4, y + 7)
    doc.text(
      `${grupo.totalSessoes} sessões · ${formatarMinutos(grupo.totalMinutos)}`,
      PAGE_WIDTH - MARGIN_X - 4,
      y + 7,
      { align: 'right' },
    )
    y += 13

    for (const dia of grupo.dias) {
      y = novasPaginas(doc, y, 24, input.periodoLabel)

      doc.setFillColor(...BRAND_LIGHT)
      doc.setDrawColor(...LINE)
      doc.rect(MARGIN_X, y, CONTENT_WIDTH, 8, 'FD')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...BRAND)
      doc.text(dia.dataLabel, MARGIN_X + 3, y + 5.5)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...MUTED)
      doc.text(
        `${dia.totalSessoes} sessão(ões) · ${formatarMinutos(dia.totalMinutos)}`,
        PAGE_WIDTH - MARGIN_X - 3,
        y + 5.5,
        { align: 'right' },
      )
      y += 8

      y = novasPaginas(doc, y, 10, input.periodoLabel)
      y = desenharLinhaTabela(doc, y, COL_HEADERS, COL_WIDTHS, true)

      dia.sessoes.forEach((sessao, index) => {
        y = novasPaginas(doc, y, 10, input.periodoLabel)
        y = desenharLinhaTabela(
          doc,
          y,
          [
            sessao.hora,
            truncar(sessao.pacienteNome, 30),
            truncar(sessao.tipo, 22),
            sessao.duracaoMinutos > 0 ? `${sessao.duracaoMinutos} min` : '—',
            truncar(sessao.planoSaude, 26),
          ],
          COL_WIDTHS,
          false,
          index % 2 === 1,
        )
      })

      y += 4
    }

    // Totalizador do profissional
    y = novasPaginas(doc, y, 10, input.periodoLabel)
    doc.setFillColor(230, 245, 241)
    doc.setDrawColor(...LINE)
    doc.rect(MARGIN_X, y, CONTENT_WIDTH, 8, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...BRAND)
    doc.text(`Total — ${grupo.profissionalNome}`, MARGIN_X + 3, y + 5.5)
    doc.text(
      `${grupo.totalSessoes} sessões · ${formatarMinutos(grupo.totalMinutos)}`,
      PAGE_WIDTH - MARGIN_X - 3,
      y + 5.5,
      { align: 'right' },
    )
    y += 8

    // Agendamentos não concluídos (se houver)
    if (grupo.pendentesPassados && grupo.pendentesPassados.length > 0) {
      y = novasPaginas(doc, y, 16, input.periodoLabel)

      // Header âmbar
      doc.setFillColor(254, 243, 199)
      doc.setDrawColor(253, 230, 138)
      doc.rect(MARGIN_X, y, CONTENT_WIDTH, 8, 'FD')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(180, 83, 9)
      doc.text(
        `⚠  Agendamentos não concluídos — ${grupo.pendentesPassados.length} registro(s)`,
        MARGIN_X + 3,
        y + 5.5,
      )
      y += 8

      // Cabeçalho da tabela pendentes — 4 colunas
      const PEND_WIDTHS = [38, 52, 48, 44] as const
      const PEND_HEADERS = ['Data / Hora', 'Paciente', 'Tipo', 'Status']

      y = novasPaginas(doc, y, 10, input.periodoLabel)
      let px = MARGIN_X
      PEND_HEADERS.forEach((h, i) => {
        doc.setFillColor(253, 230, 138)
        doc.setDrawColor(253, 230, 138)
        doc.rect(px, y, PEND_WIDTHS[i], 7, 'FD')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.setTextColor(180, 83, 9)
        doc.text(h, px + 2, y + 5)
        px += PEND_WIDTHS[i]
      })
      y += 7

      grupo.pendentesPassados.forEach((p, index) => {
        y = novasPaginas(doc, y, 8, input.periodoLabel)
        const bg: RGB = index % 2 === 1 ? [255, 251, 235] : [255, 255, 255]
        let cx = MARGIN_X
        const vals = [
          `${p.dataLabel} ${p.hora}`,
          truncar(p.pacienteNome, 28),
          truncar(p.tipo, 26),
          truncar(p.status, 22),
        ]
        vals.forEach((v, i) => {
          doc.setFillColor(...bg)
          doc.setDrawColor(253, 230, 138)
          doc.rect(cx, y, PEND_WIDTHS[i], 7, 'FD')
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7)
          doc.setTextColor(120, 53, 15)
          doc.text(v, cx + 2, y + 5)
          cx += PEND_WIDTHS[i]
        })
        y += 7
      })
    }

    y += 6
  }

  // ── Total geral final ─────────────────────────────────────────────
  y = novasPaginas(doc, y, 14, input.periodoLabel)
  doc.setFillColor(...BRAND)
  doc.roundedRect(MARGIN_X, y, CONTENT_WIDTH, 11, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(255, 255, 255)
  doc.text('TOTAL GERAL', MARGIN_X + 4, y + 7.5)
  doc.text(
    `${input.totalGeralSessoes} sessões · ${formatarMinutos(input.totalGeralMinutos)}`,
    PAGE_WIDTH - MARGIN_X - 4,
    y + 7.5,
    { align: 'right' },
  )

  // Numeração de páginas
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...MUTED)
    doc.text(`Página ${p} de ${pages}`, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 6, { align: 'right' })
    doc.text(input.periodoLabel, MARGIN_X, PAGE_HEIGHT - 6)
  }

  doc.save('conferencia-agendamentos.pdf')
}
