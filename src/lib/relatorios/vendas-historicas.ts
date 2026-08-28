// Funções puras de agregação e MoM para o relatório de vendas históricas
// (T-014) e para a validação lado a lado dos KPIs de /relatorios/vendas
// (T-011). Extraídas do Server Component para serem testáveis sem banco —
// única forma de cobrir os cenários críticos do TDD 004 (mês sem venda,
// divisão por zero) com `node --test`.

export type LinhaMensal = {
  mes: string
  faturamento: number
  qtd_vendas: number
  ticket_medio: number
  faturamento_consultorio: number
  qtd_consultorio: number
  faturamento_fisio: number
  qtd_fisio: number
  qtd_nao_classificada: number
  qtd_orcamento_pendente: number
  qtd_orcamento_recusado: number
  top_produto: string | null
  top_profissional: string | null
}

export type VariacaoMoM = {
  percentual: number | null
  direcao: 'alta' | 'queda' | 'estavel' | null
}

/**
 * Variação percentual mês a mês. Mês anterior com faturamento/qtd_vendas
 * zero (ou ausente) nunca produz divisão por zero — retorna `null`
 * (renderizado como "—"), nunca "-100%" (AC-067).
 */
export function calcularVariacaoMoM(atual: number, anterior: number | undefined | null): VariacaoMoM {
  if (anterior === undefined || anterior === null || anterior === 0) {
    return { percentual: null, direcao: null }
  }
  const percentual = ((atual - anterior) / anterior) * 100
  const direcao = percentual > 0 ? 'alta' : percentual < 0 ? 'queda' : 'estavel'
  return { percentual, direcao }
}

export type CardsExecutivos = {
  faturamentoTotal: number
  volumeTotal: number
  ticketMedioConsolidado: number
  melhorMes: { mes: string; faturamento: number } | null
  crescimentoMedioMoM: number | null
}

/**
 * Deriva os cards executivos de resumo (PRD 3.1) a partir das linhas
 * mensais já calculadas — sem chamada extra ao servidor (AC-078).
 */
export function derivarCardsExecutivos(linhas: LinhaMensal[]): CardsExecutivos {
  const faturamentoTotal = linhas.reduce((s, l) => s + l.faturamento, 0)
  const volumeTotal = linhas.reduce((s, l) => s + l.qtd_vendas, 0)
  const ticketMedioConsolidado = volumeTotal > 0 ? faturamentoTotal / volumeTotal : 0

  const melhorMes = linhas.reduce<{ mes: string; faturamento: number } | null>((melhor, l) => {
    if (l.qtd_vendas === 0) return melhor
    if (!melhor || l.faturamento > melhor.faturamento) return { mes: l.mes, faturamento: l.faturamento }
    return melhor
  }, null)

  const variacoes: number[] = []
  for (let i = 1; i < linhas.length; i++) {
    const { percentual } = calcularVariacaoMoM(linhas[i].faturamento, linhas[i - 1].faturamento)
    if (percentual !== null) variacoes.push(percentual)
  }
  const crescimentoMedioMoM = variacoes.length > 0
    ? variacoes.reduce((s, v) => s + v, 0) / variacoes.length
    : null

  return { faturamentoTotal, volumeTotal, ticketMedioConsolidado, melhorMes, crescimentoMedioMoM }
}

export type LinhaTabelaHistorico = LinhaMensal & {
  variacaoFaturamentoMoM: VariacaoMoM
  variacaoTicketMedioMoM: VariacaoMoM
}

/**
 * Monta as linhas da tabela mês a mês (PRD 3.3) em ordem cronológica
 * decrescente, cada uma já com a variação MoM de faturamento e de ticket
 * médio calculada contra o mês anterior na ordem cronológica (não na ordem
 * de exibição).
 */
export function montarTabelaHistorico(linhas: LinhaMensal[]): LinhaTabelaHistorico[] {
  const comVariacao: LinhaTabelaHistorico[] = linhas.map((linha, i) => {
    const anterior = i > 0 ? linhas[i - 1] : undefined
    return {
      ...linha,
      variacaoFaturamentoMoM: calcularVariacaoMoM(linha.faturamento, anterior?.faturamento),
      variacaoTicketMedioMoM: calcularVariacaoMoM(linha.ticket_medio, anterior?.ticket_medio),
    }
  })
  return [...comVariacao].reverse()
}

/**
 * Compara os KPIs de topo do laço em memória de /relatorios/vendas com a
 * soma das linhas de fn_vendas_resumo_mensal para o mesmo intervalo —
 * suporta a validação lado a lado do protocolo de corte (T-011, TDD fase 5).
 */
export function compararKpisComFuncaoCanonica(
  atual: { faturamento: number; qtdVendas: number },
  linhasCanonicas: Array<{ faturamento: number; qtd_vendas: number }>,
): { divergente: boolean; faturamentoCanonico: number; qtdVendasCanonica: number } {
  const faturamentoCanonico = linhasCanonicas.reduce((s, l) => s + Number(l.faturamento), 0)
  const qtdVendasCanonica = linhasCanonicas.reduce((s, l) => s + l.qtd_vendas, 0)
  const divergente = Math.abs(faturamentoCanonico - atual.faturamento) > 0.01 || qtdVendasCanonica !== atual.qtdVendas
  return { divergente, faturamentoCanonico, qtdVendasCanonica }
}
