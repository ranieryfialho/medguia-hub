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
    rg: string | null
    orgao_emissor_rg: string | null
    endereco: string | null
    complemento: string | null
  }
  profissional: string | null
  forma_pagamento: string
  data_venda: string
  itens: ItemReciboPdf[]
  total: number
  tipoVenda?: string | null
  protocoloNome?: string | null
  medicoReferenciador?: string | null
  observacoes?: string | null
  assinaturaDataUrl?: string
  clinica?: ConfigClinica | null
}

type RGB = readonly [number, number, number]

const PW = 210
const MX = 16
const CW = PW - MX * 2
const BOTTOM = 280
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
    try {
      // Encaixa a logo preservando a proporção original (em vez de esticar
      // pra caber exatamente na caixa, o que distorcia imagens não quadradas).
      const { width: imgWNatural, height: imgHNatural } = doc.getImageProperties(logoDataUrl)
      const boxW = logoW - 4
      const boxH = logoH - 4
      const escala = Math.min(boxW / imgWNatural, boxH / imgHNatural)
      const imgW = imgWNatural * escala
      const imgH = imgHNatural * escala
      const imgX = logoX + (logoW - imgW) / 2
      const imgY = 4 + (logoH - imgH) / 2
      doc.addImage(logoDataUrl, imgX, imgY, imgW, imgH)
    } catch (err) {
      console.error('[PDF Recibo] falha ao inserir logo', err)
    }
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

  const dataAtual = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  // Sem logo, número/data cabem no canto do cabeçalho. Com logo, esse canto
  // já está ocupado pela imagem — mostramos a mesma informação numa linha
  // logo abaixo do cabeçalho em vez de desenhar por cima da logo.
  if (!logoDataUrl) {
    doc.text(numeroRecibo, PW - MX, yInicio, { align: 'right' })
    doc.text(dataAtual, PW - MX, yInicio + 7, { align: 'right' })
    return alturaHeader + 8
  }

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MUT)
  doc.text(`${numeroRecibo}  ·  Emitido em ${dataAtual}`, PW - MX, alturaHeader + 6, { align: 'right' })

  return alturaHeader + 11
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

  return y + 10
}

/** Campo "Label: valor" numa única linha (quebra para as linhas seguintes se o valor não couber). Devolve a altura ocupada, para o chamador avançar o `y`. */
function campoInline(doc: jsPDF, x: number, y: number, w: number, label: string, valor: string | null): number {
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...MUT)
  const rotulo = `${label}: `
  doc.text(rotulo, x, y)
  const larguraRotulo = doc.getTextWidth(rotulo)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...TXT)
  const linhas = doc.splitTextToSize(valor || '—', Math.max(w - larguraRotulo, 20))
  doc.text(linhas, x + larguraRotulo, y)

  return 6.5 + Math.max(0, linhas.length - 1) * 4.2
}

function divisor(doc: jsPDF, y: number): number {
  doc.setDrawColor(...LIN)
  doc.line(MX, y, PW - MX, y)
  return y + 5
}

function garantirEspaco(doc: jsPDF, y: number, alturaNecessaria: number): number {
  if (y + alturaNecessaria > BOTTOM) {
    doc.addPage()
    return 14
  }
  return y
}

const TIPO_VENDA_LABEL: Record<string, string> = {
  fisioterapica: 'Fisioterápica',
  medica: 'Médica',
}

export async function gerarPdfReciboVenda(input: GerarPdfReciboInput): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const logoDataUrl = input.clinica?.logo_url
    ? await urlParaDataUrl(input.clinica.logo_url)
    : null

  const contratadaNome = input.clinica?.nome ?? 'Clínica não configurada'
  const contratadaCnpj = input.clinica?.cnpj ?? null
  const contratadaEndereco = input.clinica ? enderecoCompleto(input.clinica) : null

  let y = cabecalho(doc, input.vendaId, input.clinica, logoDataUrl)

  // --- Contratada ---
  y = secao(doc, y, 'Contratada')
  y += campoInline(doc, MX, y, CW, 'Razão social', contratadaNome)
  y += Math.max(
    campoInline(doc, MX, y, 95, 'CNPJ', contratadaCnpj),
    campoInline(doc, MX + 100, y, 78, 'Endereço', contratadaEndereco),
  )
  y += 3

  // --- Dados do Paciente ---
  y = secao(doc, y, 'Dados do Contratante')
  const { paciente } = input
  const docRg = paciente.rg
    ? `${paciente.rg}${paciente.orgao_emissor_rg ? ` — ${paciente.orgao_emissor_rg}` : ''}`
    : null
  const enderecoPaciente = paciente.complemento
    ? `${paciente.endereco ?? ''}, ${paciente.complemento}`.replace(/^, /, '')
    : paciente.endereco

  y += Math.max(
    campoInline(doc, MX, y, 115, 'Nome completo', paciente.nome),
    campoInline(doc, MX + 120, y, 58, 'CPF', paciente.cpf),
  )
  y += Math.max(
    campoInline(doc, MX, y, 95, 'RG', docRg),
    campoInline(doc, MX + 100, y, 78, 'Endereço', enderecoPaciente),
  )
  y += 3

  // --- Detalhes da venda ---
  const temDetalhesVenda = !!(input.tipoVenda || input.protocoloNome || input.medicoReferenciador || input.observacoes)
  if (temDetalhesVenda) {
    y = secao(doc, y, 'Detalhes da Venda')
    if (input.tipoVenda || input.protocoloNome) {
      y += Math.max(
        input.tipoVenda ? campoInline(doc, MX, y, 95, 'Tipo da venda', TIPO_VENDA_LABEL[input.tipoVenda] ?? input.tipoVenda) : 0,
        input.protocoloNome ? campoInline(doc, MX + 100, y, 78, 'Protocolo', input.protocoloNome) : 0,
      )
    }
    if (input.medicoReferenciador) {
      y += campoInline(doc, MX, y, CW, 'Médico referenciador', input.medicoReferenciador)
    }
    if (input.observacoes) {
      y += campoInline(doc, MX, y, CW, 'Observações', input.observacoes)
    }
    y += 3
  }

  y = divisor(doc, y)

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
    y = garantirEspaco(doc, y, 8)
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

  y = garantirEspaco(doc, y, 11)
  doc.setFillColor(...SFT)
  doc.rect(MX, y, CW, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND)
  doc.text('TOTAL', MX + 4, y + 5.5)
  doc.text(fmtMoeda(input.total), PW - MX - 2, y + 5.5, { align: 'right' })
  y += 11

  // --- Detalhes do Pagamento ---
  y = garantirEspaco(doc, y, 14)
  y = secao(doc, y, 'Detalhes do Pagamento')
  y += Math.max(
    campoInline(doc, MX, y, 62, 'Forma de pagamento', input.forma_pagamento),
    campoInline(doc, MX + 66, y, 62, 'Profissional', input.profissional),
    campoInline(doc, MX + 132, y, 46, 'Data', fmtData(input.data_venda)),
  )
  y += 3

  // --- Declaração ---
  y = garantirEspaco(doc, y, 14)
  y = divisor(doc, y)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(...MUT)
  const declaracao = 'Declaro que li e concordo com a contratação dos serviços descritos neste recibo, confirmando a compra nas condições de pagamento estabelecidas e autorizando o início dos procedimentos.'
  const wrappedDecl = doc.splitTextToSize(declaracao, CW)
  y = garantirEspaco(doc, y, wrappedDecl.length * 4.2)
  doc.text(wrappedDecl, MX, y)
  y += wrappedDecl.length * 4.2 + 5

  // --- Assinatura ---
  const alturaAssinatura = 20
  const larguraAssinatura = 80
  const temAssinatura = !!input.assinaturaDataUrl

  y = garantirEspaco(doc, y, alturaAssinatura + 12)

  doc.setDrawColor(...LIN)
  doc.rect(MX, y, larguraAssinatura, alturaAssinatura, 'S')
  if (temAssinatura) {
    try {
      doc.addImage(input.assinaturaDataUrl!, 'PNG', MX + 2, y + 2, larguraAssinatura - 4, alturaAssinatura - 4)
    } catch {
      // ignore image error
    }
  }

  y += alturaAssinatura + 3

  doc.setDrawColor(...TXT)
  doc.line(MX, y, MX + larguraAssinatura, y)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MUT)
  doc.text('Assinatura do contratante', MX, y + 4.5)

  if (temAssinatura) {
    const dataHoraAssinatura = new Date().toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
    doc.setFontSize(7.5)
    doc.text(`Assinado digitalmente em: ${dataHoraAssinatura}`, MX, y + 9)
  }

  // Rodapé
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...MUT)
    const rodapeInfo = [
      contratadaCnpj ? `CNPJ ${contratadaCnpj}` : null,
      contratadaEndereco,
    ].filter(Boolean).join(' · ')
    doc.text(`${contratadaNome}${rodapeInfo ? ` — ${rodapeInfo}` : ''} — Documento gerado eletronicamente`, MX, 292, {
      maxWidth: CW - 25,
    })
    doc.text(`Página ${i} de ${totalPages}`, PW - MX, 292, { align: 'right' })
  }

  return doc.output('blob')
}
