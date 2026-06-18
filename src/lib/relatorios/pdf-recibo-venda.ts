import type { jsPDF } from 'jspdf'
import type { ConfigClinica } from '@/lib/clinica'
import { enderecoCompleto, urlParaDataUrl } from '@/lib/clinica'

export type ItemReciboPdf = {
  nome: string
  quantidade: number
  preco_unitario: number
  subtotal: number
}

export type GerarPdfReciboInput = {
  vendaId: string
  paciente: {
    nome: string
    cpf: string | null
  }
  profissional: string | null
  forma_pagamento: string
  data_venda: string
  itens: ItemReciboPdf[]
  total: number
  clinica?: ConfigClinica | null
}

type RGB = readonly [number, number, number]

const PW = 210
const MX = 16
const CW = PW - MX * 2
const BRAND: RGB = [0, 107, 90]
const TXT: RGB = [24, 29, 28]
const MUT: RGB = [102, 112, 108]
const LIN: RGB = [220, 226, 223]
const SFT: RGB = [246, 248, 247]

const fmtMoeda = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtData = (iso: string) => {
  const d = new Date(iso.slice(0, 10) + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function cabecalho(doc: jsPDF, vendaId: string, clinica?: ConfigClinica | null, logoDataUrl?: string | null): number {
  const temClinica = !!clinica?.nome
  const alturaHeader = temClinica ? 48 : 40
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, PW, alturaHeader, 'F')

  const logoW = 36
  const logoH = alturaHeader - 8
  const logoX = PW - MX - logoW

  if (logoDataUrl) {
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(logoX - 2, 3, logoW + 4, logoH + 2, 2, 2, 'F')
    try { doc.addImage(logoDataUrl, logoX, 5, logoW, logoH - 2) } catch {}
  }

  const textLimit = logoDataUrl ? logoX - MX - 4 : PW - MX * 2
  let yInicio = temClinica ? 12 : 18

  if (temClinica) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text(doc.splitTextToSize(clinica!.nome!, textLimit)[0], MX, yInicio)

    const info = [clinica!.cnpj, clinica!.telefone].filter(Boolean).join(' · ')
    if (info) {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(200, 230, 225)
      doc.text(info, MX, yInicio + 5)
    }
    yInicio += 11
  }

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('Recibo de Contratação', MX, yInicio)

  const numeroRecibo = `N° ${vendaId.replace(/-/g, '').slice(0, 8).toUpperCase()}`
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(200, 230, 225)
  doc.text('Comprovante de contratação e compra de serviços', MX, yInicio + 7)

  if (!logoDataUrl) {
    doc.text(numeroRecibo, PW - MX, yInicio, { align: 'right' })
    const dataAtual = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    doc.text(dataAtual, PW - MX, yInicio + 7, { align: 'right' })
  }

  return alturaHeader + 8
}

function secao(doc: jsPDF, y: number, titulo: string): number {
  doc.setFillColor(...SFT)
  doc.rect(MX, y, CW, 7, 'F')
  doc.setDrawColor(...LIN)
  doc.rect(MX, y, CW, 7, 'S')

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BRAND)
  doc.text(titulo.toUpperCase(), MX + 3, y + 4.8)

  return y + 11
}

function campo(doc: jsPDF, x: number, y: number, label: string, valor: string | null): void {
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...MUT)
  doc.text(label, x, y)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...TXT)
  doc.text(valor || '—', x, y + 4.5)
}

function divisor(doc: jsPDF, y: number): number {
  doc.setDrawColor(...LIN)
  doc.line(MX, y, PW - MX, y)
  return y + 5
}

export async function gerarPdfReciboVenda(input: GerarPdfReciboInput): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const logoDataUrl = input.clinica?.logo_url
    ? await urlParaDataUrl(input.clinica.logo_url)
    : null

  let y = cabecalho(doc, input.vendaId, input.clinica, logoDataUrl)

  // --- Dados do Paciente ---
  y = secao(doc, y, 'Dados do Paciente')
  campo(doc, MX, y, 'Nome completo', input.paciente.nome)
  campo(doc, MX + 110, y, 'CPF', input.paciente.cpf)
  y += 14

  // --- Serviços / Produtos ---
  y = secao(doc, y, 'Serviços / Produtos')

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...MUT)
  doc.text('DESCRIÇÃO', MX + 2, y)
  doc.text('QTD', MX + 110, y, { align: 'center' })
  doc.text('VALOR UNIT.', MX + 145, y, { align: 'right' })
  doc.text('SUBTOTAL', PW - MX - 2, y, { align: 'right' })
  y += 5

  doc.setDrawColor(...LIN)
  doc.line(MX, y, PW - MX, y)
  y += 3

  for (const item of input.itens) {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...TXT)
    doc.setFontSize(8)
    doc.text(item.nome, MX + 2, y)
    doc.text(String(item.quantidade), MX + 110, y, { align: 'center' })
    doc.text(fmtMoeda(item.preco_unitario), MX + 145, y, { align: 'right' })
    doc.text(fmtMoeda(item.subtotal), PW - MX - 2, y, { align: 'right' })

    doc.setDrawColor(...LIN)
    doc.line(MX, y + 2, PW - MX, y + 2)
    y += 7
  }

  doc.setFillColor(...SFT)
  doc.rect(MX, y, CW, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND)
  doc.text('TOTAL', MX + 4, y + 5.5)
  doc.text(fmtMoeda(input.total), PW - MX - 2, y + 5.5, { align: 'right' })
  y += 13

  // --- Detalhes do Pagamento ---
  y = secao(doc, y, 'Detalhes do Pagamento')
  campo(doc, MX, y, 'Forma de pagamento', input.forma_pagamento)
  campo(doc, MX + 80, y, 'Profissional responsável', input.profissional)
  campo(doc, MX + 145, y, 'Data da venda', fmtData(input.data_venda))
  y += 18

  // --- Declaração ---
  y = divisor(doc, y)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(...MUT)
  const declaracao = `Declaro que li e concordo com a contratação dos serviços descritos neste recibo, confirmando a compra nas condições de pagamento estabelecidas e autorizando o início dos procedimentos.`
  const wrappedDecl = doc.splitTextToSize(declaracao, CW)
  doc.text(wrappedDecl, MX, y)
  y += wrappedDecl.length * 5 + 8

  // --- Assinatura ---
  const larguraAssinatura = 80

  doc.setDrawColor(...LIN)
  doc.rect(MX, y, larguraAssinatura, 22, 'S')

  y += 25

  doc.setDrawColor(...TXT)
  doc.line(MX, y, MX + larguraAssinatura, y)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MUT)
  doc.text('Assinatura do contratante', MX, y + 4.5)

  // Rodapé
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...MUT)
    const c = input.clinica
    const rodapeNome = c?.nome ?? 'MedGuia Hub'
    const rodapeInfo = [
      c?.cnpj ? `CNPJ ${c.cnpj}` : null,
      c ? enderecoCompleto(c) : null,
    ].filter(Boolean).join(' · ')
    doc.text(`${rodapeNome}${rodapeInfo ? ` — ${rodapeInfo}` : ''} — Documento gerado eletronicamente`, MX, 292)
    doc.text(`Página ${i} de ${totalPages}`, PW - MX, 292, { align: 'right' })
  }

  return doc.output('blob')
}