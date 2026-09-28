import type { jsPDF } from 'jspdf'
import type { ConfigClinica } from '@/lib/clinica'
import { enderecoCompleto, urlParaDataUrl } from '@/lib/clinica'

export type ItemTermoPdf = {
  nome: string
  quantidade: number
  preco_unitario: number
  subtotal: number
}

export type GerarPdfTermoInput = {
  paciente: {
    nome: string
    cpf: string | null
    rg: string | null
    orgao_emissor_rg: string | null
    data_nascimento: string | null
    telefone: string | null
    email: string | null
    endereco: string | null
    complemento: string | null
  }
  profissional: string | null
  forma_pagamento: string
  data_venda: string
  itens: ItemTermoPdf[]
  total: number
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

const fmtDataExtenso = (d: Date) =>
  d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

function cabecalho(doc: jsPDF, clinica?: ConfigClinica | null, logoDataUrl?: string | null): number {
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
      console.error('[PDF Contrato] falha ao inserir logo', err)
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

  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('Condições Gerais para Prestação de', MX, yInicio)
  doc.text('Serviços de Fisioterapia e Ortopedia', MX, yInicio + 6)

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(200, 230, 225)
  if (!logoDataUrl) {
    const dataAtual = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    doc.text(dataAtual, PW - MX, yInicio + 6, { align: 'right' })
  }

  return alturaHeader + 8
}

function rodape(doc: jsPDF, clinica?: ConfigClinica | null) {
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...MUT)
    const rodapeNome = clinica?.nome ?? 'Clínica não configurada'
    const rodapeInfo = [
      clinica?.cnpj ? `CNPJ ${clinica.cnpj}` : null,
      clinica ? enderecoCompleto(clinica) : null,
    ].filter(Boolean).join(' · ')
    doc.text(`${rodapeNome} — ${rodapeInfo} — Documento gerado eletronicamente`, MX, 292, {
      maxWidth: CW - 25,
    })
    doc.text(`Página ${i} de ${totalPages}`, PW - MX, 292, { align: 'right' })
  }
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

function campo(doc: jsPDF, x: number, y: number, w: number, label: string, valor: string | null): void {
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...MUT)
  doc.text(label, x, y)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...TXT)
  const linhas = doc.splitTextToSize(valor || '—', w)
  doc.text(linhas, x, y + 4.5)
}

function divisor(doc: jsPDF, y: number): number {
  doc.setDrawColor(...LIN)
  doc.line(MX, y, PW - MX, y)
  return y + 5
}

/** Garante espaço vertical, adicionando nova página se necessário. */
function garantirEspaco(doc: jsPDF, y: number, alturaNecessaria: number): number {
  if (y + alturaNecessaria > BOTTOM) {
    doc.addPage()
    return 14
  }
  return y
}

/** Escreve um bloco de cláusula: título em negrito + parágrafos numerados. */
function clausula(doc: jsPDF, y: number, titulo: string, paragrafos: string[]): number {
  y = garantirEspaco(doc, y, 12)
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BRAND)
  const linhasTitulo = doc.splitTextToSize(titulo, CW)
  doc.text(linhasTitulo, MX, y)
  y += linhasTitulo.length * 5 + 2

  for (const paragrafo of paragrafos) {
    doc.setFontSize(8.3)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...TXT)
    const linhas = doc.splitTextToSize(paragrafo, CW)
    const altura = linhas.length * 4.2

    y = garantirEspaco(doc, y, altura)
    doc.text(linhas, MX, y)
    y += altura + 2.5
  }

  return y + 2
}

export type ClausulaCondicoesGerais = { titulo: string; paragrafos: string[] }

/**
 * Texto das cláusulas das Condições Gerais — fonte única usada tanto para
 * renderizar o PDF quanto para o paciente ler no modal antes de assinar
 * (ModalTermoVenda), garantindo que os dois nunca divirjam.
 */
export function clausulasCondicoesGerais(nomeContratante: string, formaPagamentoTexto: string): ClausulaCondicoesGerais[] {
  return [
    {
      titulo: '1. DO OBJETO',
      paragrafos: [
        '1.1. Constitui objeto das presentes Condições Gerais a prestação, pela Contratada ao Contratante/Beneficiário, dos serviços de fisioterapia e/ou atendimento ortopédico descritos no Quadro Resumo e nos orçamentos aprovados.',
        '1.2. Caso o Beneficiário seja menor de idade ou pessoa incapaz, o Contratante declara, para todos os fins de direito, ostentar a condição de representante legal ou responsável, nos termos dos arts. 3º e 4º do Código Civil, respondendo integralmente pelas obrigações assumidas neste instrumento, inclusive as de natureza financeira.',
      ],
    },
    {
      titulo: '2. DOS SERVIÇOS',
      paragrafos: [
        '2.1. Os serviços têm caráter eletivo (não urgente), com atendimento em horário comercial, abrangendo assistência profissional especializada e, quando aplicável, o fornecimento dos insumos necessários à execução do tratamento.',
        '2.2. Profissionais habilitados da Contratada avaliarão o Contratante/Beneficiário e elaborarão um plano terapêutico individualizado, de acordo com as necessidades clínicas identificadas.',
        '2.3. A remuneração poderá vincular-se à realização de etapas formais de avaliação e de reavaliação (pré e pós-atendimento), integradas ao sistema da Contratada, para aferição objetiva das sessões efetivamente executadas.',
        '2.4. Em razão da natureza personalíssima do tratamento, caso o Contratante/Beneficiário desista da sessão após a manipulação ou preparação de material ou insumo específico, obriga-se ao pagamento integral do respectivo item, ante a impossibilidade de reaproveitamento.',
        '2.5. As sessões contratadas e pagas antecipadamente deverão ser fruídas no prazo máximo de 180 (cento e oitenta) dias corridos, contados da contratação. Transcorrido o prazo sem agendamento por inação do Contratante, o crédito será convertido em multa compensatória administrativa, salvo justificativa clínica documentada, apresentada à Contratada, que avaliará sua plausibilidade.',
        '2.6. Previamente à realização de procedimentos que envolvam risco relevante ou técnicas invasivas, a Contratada disponibilizará ao Contratante/Beneficiário Termo de Consentimento Livre e Esclarecido específico, contendo informações sobre riscos, benefícios, alternativas terapêuticas e possíveis intercorrências, cuja assinatura constitui condição para a execução do respectivo procedimento.',
      ],
    },
    {
      titulo: '3. DO PREÇO E DA FORMA DE PAGAMENTO',
      paragrafos: [
        `3.1. A cobrança será baseada no orçamento aprovado pelo Contratante, que se torna anexo deste instrumento, ajustado aos serviços efetivamente realizados e aos materiais fornecidos. Forma de pagamento pactuada: ${formaPagamentoTexto}.`,
        '3.2. O valor poderá variar conforme os componentes utilizados; os preços constam do orçamento submetido ao Contratante, atualizável em caso de variação significativa de custo ou por solicitação do Contratante.',
        '3.2.1. Na hipótese de contratação com vigência superior a 12 (doze) meses, os valores poderão, ainda, ser reajustados anualmente pela variação acumulada do IPCA (Índice Nacional de Preços ao Consumidor Amplo) ou por outro índice que vier a substituí-lo, sem prejuízo do disposto no caput desta Cláusula.',
        '3.3. A Contratada emitirá Nota Fiscal Eletrônica de serviço, em nome do Contratante, até o fechamento do mês de competência, sendo vedada a emissão em nome de terceiros estranhos à relação contratual, nos termos da legislação fiscal aplicável.',
        '3.4. Caso o Contratante pretenda reembolso junto a seguradora ou operadora de plano de saúde, deverá verificar previamente a aceitação de Nota Fiscal de Serviços, uma vez que a Contratada não comercializa produtos.',
        '3.5. A não efetivação dos pagamentos na forma e prazos pactuados, por culpa do Contratante, acarretará multa moratória de 2% (dois por cento) sobre o valor em atraso, juros de mora de 1% (um por cento) ao mês, calculados pro rata die, e correção monetária pelo IPCA, além de honorários advocatícios em caso de cobrança extrajudicial (10%) ou judicial (20%).',
      ],
    },
    {
      titulo: '4. DA POLÍTICA DE CANCELAMENTO, REEMBOLSO E REMARCAÇÃO',
      paragrafos: [
        '4.1. Direito de arrependimento. Quando a contratação ocorrer fora do estabelecimento da Contratada (por exemplo, por meio eletrônico ou à distância), o Contratante poderá exercer o direito de arrependimento no prazo de 7 (sete) dias, contados da contratação ou do pagamento, o que ocorrer por último, com devolução integral dos valores pagos, nos termos do art. 49 do Código de Defesa do Consumidor, desde que não iniciada a execução dos serviços.',
        '4.2. Cancelamento após o início da execução. Iniciado o tratamento, o cancelamento a pedido do Contratante observará os seguintes critérios: (a) as sessões efetivamente realizadas serão cobradas pelo valor unitário avulso vigente, e não pelo valor proporcional do pacote promocional, dada a perda da condição que motivou o desconto; (b) sobre o saldo das sessões não usufruídas incidirá taxa administrativa de 10% (dez por cento), a título de custos operacionais de reserva de agenda; (c) os materiais e insumos já adquiridos, manipulados ou personalizados para o Contratante/Beneficiário não são reembolsáveis, nos termos da Cláusula 2.4.',
        '4.3. Prazo e forma de reembolso. A solicitação de cancelamento e de reembolso deverá ser formalizada por escrito (inclusive por meio eletrônico). Apurado o valor conforme a Cláusula 4.2, a devolução do saldo será efetuada em até 30 (trinta) dias, pelo mesmo meio de pagamento utilizado, sempre que possível.',
        '4.4. Remarcação e ausências (no-show). O Contratante/Beneficiário poderá remarcar sessão previamente agendada mediante aviso com antecedência mínima de 24 (vinte e quatro) horas. A ausência não justificada ou o cancelamento com antecedência inferior implicará a consideração da sessão como realizada, para fins de dedução do pacote, ressalvados os casos fortuitos ou de força maior devidamente comprovados.',
        '4.5. A retenção de valores prevista nesta Cláusula 4 limita-se aos custos administrativos e operacionais comprovadamente incorridos pela Contratada até a data do cancelamento, sendo vedada a retenção de valores que configure vantagem manifestamente excessiva em desfavor do Contratante, nos termos do art. 51, IV e XV, da Lei nº 8.078/1990 (Código de Defesa do Consumidor).',
      ],
    },
    {
      titulo: '5. DAS OBRIGAÇÕES DAS PARTES',
      paragrafos: [
        `5.1. São obrigações do Contratante/Beneficiário: prestar informações verdadeiras sobre seu histórico de saúde, condições clínicas e medicamentos em uso, informando previamente eventuais alergias; pagar os valores devidos nos prazos ajustados no Quadro Resumo; seguir criteriosamente as prescrições, orientações e recomendações terapêuticas, ciente de que a inobservância pode comprometer a eficácia e a segurança do tratamento; comparecer às sessões nos horários agendados.`,
        '5.2. São obrigações da Contratada: prestar as informações pertinentes aos atos a serem realizados; executar os serviços conforme as regras técnicas e éticas aplicáveis; empregar os esforços e procedimentos necessários para resolver intercorrências que venham a ocorrer durante o atendimento; zelar pela guarda e sigilo dos dados e do prontuário do Contratante/Beneficiário.',
      ],
    },
    {
      titulo: '6. DA RESCISÃO',
      paragrafos: [
        '6.1. O presente Contrato poderá ser rescindido por qualquer das Partes mediante comunicação prévia, por escrito, com 48 (quarenta e oito) horas de antecedência, sem prejuízo do pagamento pelos serviços efetivamente prestados até então e da aplicação da Cláusula 4.',
        '6.2. Poderá ser rescindido, ainda, de imediato, na hipótese de infração a qualquer de suas cláusulas, inclusive inadimplemento não sanado.',
        '6.3. Na eventualidade de suspensão definitiva da terapia por óbito do beneficiário, o instrumento será automaticamente rescindido a partir da comunicação do fato pela Contratante à Contratada, sendo dispensável o cumprimento do aviso prévio de 48 (quarenta e oito) horas, sem que tal fato exonere os sucessores do Contratante da obrigação de quitar os serviços e insumos efetivamente disponibilizados até a data do falecimento. Parágrafo Único: na hipótese de falecimento do Contratante, a responsabilidade pelo pagamento do saldo devedor remanescente recairá sobre o seu espólio ou, sucessivamente, sobre seus herdeiros, nos limites das forças da herança, em conformidade com o art. 1.997 do Código Civil.',
      ],
    },
    {
      titulo: '7. DA VIGÊNCIA',
      paragrafos: [
        '7.1. A prestação de serviços regida por estas Condições Gerais vigorará pelo período estipulado no Quadro Resumo ou, na ausência de prazo determinado, até a conclusão dos serviços contratados.',
      ],
    },
    {
      titulo: '8. DO SIGILO, DA CONFIDENCIALIDADE E DA PROTEÇÃO DE DADOS',
      paragrafos: [
        '8.1. A Contratada tratará os dados pessoais e sensíveis do Contratante/Beneficiário em conformidade com a LGPD, observando os princípios da finalidade, adequação, necessidade, segurança e transparência, limitando o tratamento às finalidades legítimas e específicas da prestação dos serviços.',
        '8.1.1. Tratando-se de dados sensíveis relativos à saúde, o tratamento fundamenta-se na hipótese do art. 11, II, alínea "f", da Lei nº 13.709/2018 (LGPD), por ser realizado por profissionais de saúde e serviços de saúde, dispensando-se, para essa finalidade específica, o consentimento destacado do titular, sem prejuízo do dever de transparência previsto no art. 9º da mesma Lei.',
        '8.1.2. Os dados constantes do prontuário do Contratante/Beneficiário serão conservados pelo prazo mínimo de 20 (vinte) anos, contado do último registro, em observância ao art. 9º, §2º, da Resolução CFM nº 1.821/2007, findo o qual poderão ser eliminados ou preservados em meio digital, a critério da Contratada.',
        '8.1.3. Para o exercício dos direitos previstos no art. 18 da LGPD, o titular dos dados poderá dirigir-se ao Encarregado de Proteção de Dados da Contratada, cujo canal de contato será disponibilizado mediante solicitação.',
        '8.2. Os dados de saúde constituem dado pessoal sensível e serão mantidos sob sigilo, com acesso restrito aos profissionais envolvidos no atendimento, sendo o compartilhamento restrito às hipóteses legais ou mediante autorização do titular.',
        '8.3. As Partes obrigam-se a manter sigilo sobre as informações a que tiverem acesso em razão deste Contrato, durante sua vigência e após o seu término, ressalvadas as hipóteses de disponibilização exigidas por lei ou por autoridade competente.',
      ],
    },
    {
      titulo: '9. DAS DISPOSIÇÕES FINAIS',
      paragrafos: [
        '9.1. Estas Condições Gerais, em conjunto com o orçamento assinado ou formalmente aceito pelo Contratante, constituem título executivo extrajudicial, nos termos do art. 784 do Código de Processo Civil.',
        '9.1.1. Em caso de conflito ou divergência entre o disposto nestas Condições Gerais e os termos do orçamento específico aprovado pelo Contratante, prevalecerão as disposições destas Condições Gerais, ressalvadas as condições comerciais específicas (valores, forma de pagamento e cronograma), que prevalecerão em relação ao respectivo orçamento.',
        '9.2. A tolerância quanto a eventual descumprimento não implicará novação ou renúncia de direitos.',
        '9.3. As Partes reconhecem a validade da assinatura eletrônica deste instrumento, que produzirá os mesmos efeitos da assinatura física, nos termos da Medida Provisória nº 2.200-2/2001 e da Lei nº 14.063/2020, ainda que por plataforma não credenciada à ICP-Brasil.',
        '9.4. Nenhuma das Partes será responsabilizada por descumprimento de obrigação decorrente de caso fortuito ou força maior, nos termos do art. 393 do Código Civil, devendo a Parte impossibilitada comunicar o fato à outra em prazo razoável e envidar esforços para mitigar os efeitos do evento.',
        '9.5. É vedada a cessão, total ou parcial, dos direitos e obrigações decorrentes deste instrumento, por qualquer das Partes, sem a prévia e expressa anuência da outra.',
      ],
    },
    {
      titulo: '10. DO FORO',
      paragrafos: [
        `10.1. Fica eleito o foro da comarca de Fortaleza/CE para dirimir quaisquer questões oriundas deste instrumento. E, por estarem de comum acordo, ${nomeContratante} e a Contratada firmam o presente instrumento, cuja aceitação eletrônica produz os mesmos efeitos da assinatura física, conforme Cláusula 9.3.`,
      ],
    },
  ]
}

export async function gerarPdfTermoVenda(input: GerarPdfTermoInput): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const logoDataUrl = input.clinica?.logo_url
    ? await urlParaDataUrl(input.clinica.logo_url)
    : null

  const contratadaNome = input.clinica?.nome ?? null
  const contratadaCnpj = input.clinica?.cnpj ?? null
  const contratadaEndereco = input.clinica ? enderecoCompleto(input.clinica) : null

  let y = cabecalho(doc, input.clinica, logoDataUrl)

  // --- Considerando / preâmbulo ---
  doc.setFontSize(7.8)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(...MUT)
  const preambulo = doc.splitTextToSize(
    'Estas Condições Gerais regem a prestação de serviços de fisioterapia e ortopedia pela Contratada ' +
    'ao Contratante/Beneficiário abaixo qualificados, observados os preceitos técnicos e éticos dos ' +
    'Conselhos Profissionais (COFFITO/CREFITO e CFM/CRM) e a legislação vigente, ciente o Contratante, ' +
    'para os efeitos do art. 6º do Código de Defesa do Consumidor, de que recebeu explicações claras sobre ' +
    'o tratamento proposto, seus riscos, benefícios e possíveis intercorrências.',
    CW,
  )
  doc.text(preambulo, MX, y)
  y += preambulo.length * 3.6 + 4

  // --- Quadro Resumo: Contratante ---
  y = secao(doc, y, 'Quadro Resumo — Contratante')

  const { paciente } = input
  const nascFormatado = paciente.data_nascimento ? fmtData(paciente.data_nascimento) : null
  const docRg = paciente.rg
    ? `${paciente.rg}${paciente.orgao_emissor_rg ? ` — ${paciente.orgao_emissor_rg}` : ''}`
    : null
  const enderecoPaciente = paciente.complemento
    ? `${paciente.endereco ?? ''}, ${paciente.complemento}`.replace(/^, /, '')
    : paciente.endereco

  campo(doc, MX, y, 90, 'Nome completo (Contratante/Beneficiário)', paciente.nome)
  campo(doc, MX + 100, y, 45, 'CPF', paciente.cpf)
  y += 10
  campo(doc, MX, y, 90, 'RG', docRg)
  campo(doc, MX + 100, y, 45, 'Data de nascimento', nascFormatado)
  y += 10
  campo(doc, MX, y, 90, 'Telefone', paciente.telefone)
  campo(doc, MX + 100, y, 60, 'E-mail', paciente.email)
  y += 10
  if (enderecoPaciente) {
    campo(doc, MX, y, CW, 'Endereço', enderecoPaciente)
    y += 10
  }

  y = divisor(doc, y)

  // --- Quadro Resumo: Contratada ---
  y = secao(doc, y, 'Quadro Resumo — Contratada')
  campo(doc, MX, y, CW, 'Razão social', contratadaNome)
  y += 10
  campo(doc, MX, y, 90, 'CNPJ', contratadaCnpj)
  campo(doc, MX + 100, y, 60, 'Endereço', contratadaEndereco)
  y += 10

  y = divisor(doc, y)

  // --- Objeto: tratamentos contratados ---
  y = secao(doc, y, 'Objeto — Tratamentos Contratados')

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...MUT)
  doc.text('TRATAMENTO', MX + 2, y)
  doc.text('QTD', MX + 110, y, { align: 'center' })
  doc.text('VALOR UNIT.', MX + 140, y, { align: 'right' })
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
    doc.text(fmtMoeda(item.preco_unitario), MX + 140, y, { align: 'right' })
    doc.text(fmtMoeda(item.subtotal), PW - MX - 2, y, { align: 'right' })

    doc.setDrawColor(...LIN)
    doc.line(MX, y + 2, PW - MX, y + 2)
    y += 7
  }

  y = garantirEspaco(doc, y, 13)
  doc.setFillColor(...SFT)
  doc.rect(MX, y, CW, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND)
  doc.text('TOTAL', MX + 4, y + 5.5)
  doc.text(fmtMoeda(input.total), PW - MX - 2, y + 5.5, { align: 'right' })
  y += 13

  campo(doc, MX, y, 80, 'Forma de pagamento', input.forma_pagamento)
  campo(doc, MX + 90, y, 55, 'Profissional responsável', input.profissional)
  campo(doc, MX + 150, y, 40, 'Data da venda', fmtData(input.data_venda))
  y += 14

  y = divisor(doc, y)

  // --- Cláusulas ---
  const clausulas = clausulasCondicoesGerais(paciente.nome, input.forma_pagamento)
  for (const { titulo, paragrafos } of clausulas) {
    y = clausula(doc, y, titulo, paragrafos)
  }

  // --- Declaração ---
  y = garantirEspaco(doc, y, 20)
  y = divisor(doc, y)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(...MUT)
  const declaracao = 'Declaro que li e compreendi todas as cláusulas destas Condições Gerais, concordando com os tratamentos contratados, condições de pagamento e política de cancelamento, remarcação e reembolso acima descritas.'
  const wrappedDecl = doc.splitTextToSize(declaracao, CW)
  y = garantirEspaco(doc, y, wrappedDecl.length * 5)
  doc.text(wrappedDecl, MX, y)
  y += wrappedDecl.length * 5 + 5

  // --- Assinatura ---
  const alturaAssinatura = 30
  const larguraAssinatura = 80
  const xContratada = PW - MX - larguraAssinatura
  const temAssinatura = !!input.assinaturaDataUrl

  y = garantirEspaco(doc, y, alturaAssinatura + 26)
  const yBoxTopo = y

  // Caixa da assinatura — Contratante/Beneficiário
  doc.setDrawColor(...LIN)
  doc.rect(MX, yBoxTopo, larguraAssinatura, alturaAssinatura, 'S')
  if (temAssinatura) {
    try {
      doc.addImage(input.assinaturaDataUrl!, 'PNG', MX + 2, yBoxTopo + 2, larguraAssinatura - 4, alturaAssinatura - 4)
    } catch {
      // ignore image error
    }
  }

  // Caixa de identificação — Contratada
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...TXT)
  doc.text(doc.splitTextToSize(contratadaNome ?? 'Clínica não configurada', larguraAssinatura)[0], xContratada, yBoxTopo + alturaAssinatura / 2)

  const yLinha = yBoxTopo + alturaAssinatura + 3
  doc.setDrawColor(...TXT)
  doc.line(MX, yLinha, MX + larguraAssinatura, yLinha)
  doc.line(xContratada, yLinha, xContratada + larguraAssinatura, yLinha)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MUT)
  doc.text('CONTRATANTE / BENEFICIÁRIO', MX, yLinha + 4.5)
  doc.text('CONTRATADA', xContratada, yLinha + 4.5)

  if (temAssinatura) {
    const dataHoraAssinatura = new Date().toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
    doc.setFontSize(7.5)
    doc.text(`Assinado digitalmente em: ${dataHoraAssinatura}`, MX, yLinha + 9)
  }

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MUT)
  doc.text(`Fortaleza/CE, ${fmtDataExtenso(new Date())}`, MX, yLinha + 16)

  rodape(doc, input.clinica)

  return doc.output('blob')
}
