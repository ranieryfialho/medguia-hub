import type { jsPDF } from 'jspdf'

export type SessaoPdf = {
  id: string
  data_agendamento: string
  status: string
  tipo: string
  is_recorrente: boolean
  observacoes: string | null
}

export type ItemVendaPdf = {
  nome: string
  quantidade: number
  preco_unitario: number
}

export type VendaPdf = {
  id: string
  data_venda: string
  origem: string
  medico_referenciador_nome: string | null
  observacoes: string | null
  profissional_nome: string | null
  itens: ItemVendaPdf[]
}

export type GerarPdfProntuarioInput = {
  paciente: {
    nome: string
    cpf: string | null
    data_nascimento: string | null
    convenio: string | null
    origem: string | null
    observacoes_gerais: string | null
    ativo: boolean
  }
  sessoesParaPdf: SessaoPdf[]
  vendasParaPdf: VendaPdf[]
}

type RGB = readonly [number, number, number]

const PW = 210
const PH = 297
const MX = 16
const CW = PW - MX * 2
const BRAND: RGB = [0, 107, 90]
const TXT: RGB = [24, 29, 28]
const MUT: RGB = [102, 112, 108]
const LIN: RGB = [220, 226, 223]
const SFT: RGB = [246, 248, 247]

const STATUS_MAP: Record<string, string> = {
  tratamento_ativo: 'Em Tratamento',
  pausado: 'Pausado',
  aguardando_avaliacao: 'Aguardando Avaliação',
  alta: 'Alta',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  agendado: 'Agendado',
}

const ORIGEM_MAP: Record<string, string> = {
  medico: 'Médico',
  leads: 'Leads',
  indicacao: 'Indicação',
  renovacao: 'Renovação',
  campanha: 'Campanha',
}

const fmtMoeda = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtData = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

const fmtIdade = (dn: string | null): string => {
  if (!dn) return '--'
  const hoje = new Date()
  const nasc = new Date(dn)
  let idade = hoje.getFullYear() - nasc.getFullYear()
  const m = hoje.getMonth() - nasc.getMonth()
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--
  return `${idade} anos`
}

export async function gerarPdfProntuario(input: GerarPdfProntuarioInput) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const dataGeracao = new Date().toLocaleDateString('pt-BR')

  paginaFicha(doc, input, dataGeracao)

  if (input.sessoesParaPdf.length > 0 || input.vendasParaPdf.length > 0) {
    doc.addPage()
    paginaJornada(doc, input)
  }

  rodape(doc, input.paciente.nome, dataGeracao)

  const slug = input.paciente.nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
  doc.save(`prontuario-${slug}.pdf`)
}

function paginaFicha(doc: jsPDF, input: GerarPdfProntuarioInput, dataGeracao: string) {
  const { paciente, sessoesParaPdf, vendasParaPdf } = input

  doc.setFillColor(...BRAND)
  doc.rect(0, 0, PW, 52, 'F')

  const iniciais = paciente.nome
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
  doc.setFillColor(0, 88, 74)
  doc.roundedRect(MX, 9, 32, 32, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(255, 255, 255)
  doc.text(iniciais, MX + 16, 29, { align: 'center' })

  const nomeFontSize = paciente.nome.length > 32 ? 13 : 18
  doc.setFontSize(nomeFontSize)
  doc.text(paciente.nome, MX + 38, 22)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(`Prontuário Digital  ·  MedGuia  ·  Gerado em ${dataGeracao}`, MX + 38, 30)

  doc.setFontSize(8)
  if (paciente.ativo) {
    doc.setTextColor(180, 245, 210)
    doc.text('● Paciente Ativo', MX + 38, 38)
  } else {
    doc.setTextColor(255, 180, 180)
    doc.text('● Paciente Inativo', MX + 38, 38)
  }

  let y = 62

  y = grade(doc, y, [
    ['CPF', paciente.cpf || 'Não informado'],
    ['Idade', fmtIdade(paciente.data_nascimento)],
    ['Convênio', paciente.convenio || 'Particular'],
    ['Captação', ORIGEM_MAP[paciente.origem ?? ''] || paciente.origem || 'Não informada'],
  ])

  y += 8

  y = secao(doc, y, 'Resumo Clínico')

  const ultimoStatus = sessoesParaPdf[0]?.status
  let resumo =
    sessoesParaPdf.length === 0
      ? 'Paciente recém-cadastrado, ainda sem histórico na jornada de eventos.'
      : `Paciente possui histórico de ${sessoesParaPdf.length} sessão(ões) registrada(s). Última com status "${STATUS_MAP[ultimoStatus] || ultimoStatus}".`

  if (paciente.observacoes_gerais) {
    const obsArr = paciente.observacoes_gerais.split('\n').filter((o) => o.trim())
    if (obsArr.length > 0) {
      const ultima = obsArr[obsArr.length - 1]
        .replace(/^[•\-]\s*/, '')
        .replace(/^\[.*?\]\s*/, '')
        .trim()
      resumo += ` Última nota: "${ultima}".`
    }
  }

  y = blocoTexto(doc, y, resumo)
  y += 8

  const ultimaInteracao = sessoesParaPdf[0]?.data_agendamento
    ? fmtData(sessoesParaPdf[0].data_agendamento)
    : 'Sem registros'

  y = grade(doc, y, [
    ['Sessões Registradas', String(sessoesParaPdf.length)],
    ['Última Interação', ultimaInteracao],
    ['Vendas Realizadas', String(vendasParaPdf.length)],
    ['Status', paciente.ativo ? 'Ativo' : 'Inativo'],
  ])

  if (paciente.observacoes_gerais) {
    y += 8
    y = secao(doc, y, 'Observações Críticas')
    const obsArr = paciente.observacoes_gerais.split('\n').filter((o) => o.trim())
    for (const obs of obsArr) {
      if (y > PH - 24) break
      const texto = obs.replace(/^•\s*/, '').trim()
      const linhas = doc.splitTextToSize(`• ${texto}`, CW - 8)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...TXT)
      doc.text(linhas, MX + 4, y)
      y += linhas.length * 4.4 + 2
    }
  }
}

function paginaJornada(doc: jsPDF, input: GerarPdfProntuarioInput) {
  type Ev =
    | { tipo: 'sessao'; ms: number; sessao: SessaoPdf }
    | { tipo: 'venda'; ms: number; venda: VendaPdf }

  const eventos: Ev[] = [
    ...input.sessoesParaPdf.map((s) => ({
      tipo: 'sessao' as const,
      ms: new Date(s.data_agendamento).getTime(),
      sessao: s,
    })),
    ...input.vendasParaPdf.map((v) => ({
      tipo: 'venda' as const,
      ms: new Date(v.data_venda).getTime(),
      venda: v,
    })),
  ].sort((a, b) => b.ms - a.ms)

  let y = cabecalho(doc, 'Jornada do Paciente', `${eventos.length} evento(s) registrado(s)`)

  for (const ev of eventos) {
    if (ev.tipo === 'sessao') {
      const h = 10
      if (y + h > PH - 16) {
        doc.addPage()
        y = cabecalho(doc, 'Jornada do Paciente', 'Continuação')
      }
      y = linhaEvento(doc, y, ev.sessao)
    } else {
      const nLinhasProd = ev.venda.itens.length > 0
        ? doc.splitTextToSize(ev.venda.itens.map((i) => `${i.nome} (${i.quantidade}x)`).join(', '), CW - 82).length
        : 0
      const h = Math.max(12, nLinhasProd * 4 + 8)
      if (y + h > PH - 16) {
        doc.addPage()
        y = cabecalho(doc, 'Jornada do Paciente', 'Continuação')
      }
      y = linhaVenda(doc, y, ev.venda)
    }
  }
}

function linhaEvento(doc: jsPDF, y: number, sessao: SessaoPdf): number {
  const status = STATUS_MAP[sessao.status] || sessao.status
  const recorrente = sessao.is_recorrente ? ' · Recorrente' : ''

  doc.setFillColor(...SFT)
  doc.setDrawColor(...LIN)
  doc.roundedRect(MX, y, CW, 10, 1, 1, 'FD')

  doc.setFillColor(...BRAND)
  doc.rect(MX, y, 2, 10, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...TXT)
  doc.text(fmtData(sessao.data_agendamento), MX + 5, y + 6.5)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MUT)
  doc.text(`${sessao.tipo}${recorrente}`, MX + 36, y + 6.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...BRAND)
  doc.text(status.toUpperCase(), PW - MX - 2, y + 6.5, { align: 'right' })

  return y + 12
}

function linhaVenda(doc: jsPDF, y: number, venda: VendaPdf): number {
  const origem = ORIGEM_MAP[venda.origem] || venda.origem || 'Não informada'
  const total = venda.itens.reduce((acc, i) => acc + i.preco_unitario * i.quantidade, 0)
  const prodStr = venda.itens.map((i) => `${i.nome} (${i.quantidade}x)`).join(', ')
  const linhasProd = prodStr ? doc.splitTextToSize(prodStr, CW - 82) : []
  const height = Math.max(12, linhasProd.length * 4 + 8)

  doc.setFillColor(240, 250, 248)
  doc.setDrawColor(...LIN)
  doc.roundedRect(MX, y, CW, height, 1, 1, 'FD')

  doc.setFillColor(51, 166, 143)
  doc.rect(MX, y, 2, height, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...TXT)
  doc.text(fmtData(venda.data_venda), MX + 5, y + 6.5)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MUT)
  doc.text(`Venda · ${origem}`, MX + 36, y + 6.5)

  if (linhasProd.length > 0) {
    doc.setFontSize(7)
    doc.text(linhasProd, MX + 36, y + 10.5)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(51, 166, 143)
  doc.text(fmtMoeda(total), PW - MX - 2, y + 6.5, { align: 'right' })

  return y + height + 2
}

function grade(doc: jsPDF, y: number, cards: [string, string][]): number {
  const gap = 4
  const cols = 2
  const cardW = (CW - gap) / cols
  const cardH = 16

  cards.forEach(([label, valor], i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = MX + col * (cardW + gap)
    const cy = y + row * (cardH + gap)

    doc.setFillColor(...SFT)
    doc.setDrawColor(...LIN)
    doc.roundedRect(x, cy, cardW, cardH, 2, 2, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(...MUT)
    doc.text(label.toUpperCase(), x + 4, cy + 5.5)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...TXT)
    const val = doc.splitTextToSize(valor, cardW - 8)[0]
    doc.text(val, x + 4, cy + 12.5)
  })

  return y + Math.ceil(cards.length / cols) * (cardH + gap) - gap
}

function secao(doc: jsPDF, y: number, texto: string): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...BRAND)
  doc.text(texto, MX, y)
  doc.setDrawColor(...LIN)
  doc.line(MX, y + 3, PW - MX, y + 3)
  return y + 8
}

function blocoTexto(doc: jsPDF, y: number, texto: string): number {
  const linhas = doc.splitTextToSize(texto, CW - 8)
  const h = linhas.length * 4.4 + 8
  doc.setFillColor(...SFT)
  doc.setDrawColor(...LIN)
  doc.roundedRect(MX, y, CW, h, 2, 2, 'FD')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...TXT)
  doc.text(linhas, MX + 4, y + 5.5)
  return y + h
}

function cabecalho(doc: jsPDF, titulo: string, subtitulo: string): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...TXT)
  doc.text(titulo, MX, 22)
  if (subtitulo) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...MUT)
    doc.text(subtitulo, MX, 29)
  }
  doc.setDrawColor(...LIN)
  doc.line(MX, 34, PW - MX, 34)
  return 40
}

function rodape(doc: jsPDF, nomePaciente: string, dataGeracao: string) {
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setDrawColor(...LIN)
    doc.line(MX, PH - 11, PW - MX, PH - 11)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...MUT)
    doc.text(`${nomePaciente}  ·  MedGuia  ·  ${dataGeracao}`, MX, PH - 6)
    doc.text(`Página ${p} de ${pages}`, PW - MX, PH - 6, { align: 'right' })
  }
}
