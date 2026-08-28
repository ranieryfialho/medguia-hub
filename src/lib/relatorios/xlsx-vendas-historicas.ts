import type { LinhaTabelaHistorico } from './vendas-historicas'

export type GerarXlsxVendasHistoricasInput = {
  periodoLabel: string
  linhas: LinhaTabelaHistorico[]
}

const fmtMes = (mes: string) =>
  new Date(mes + 'T00:00:00').toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })

export async function gerarXlsxVendasHistoricas(input: GerarXlsxVendasHistoricasInput) {
  const XLSX = await import('xlsx')

  const linhas = input.linhas.map((l) => ({
    'Mês': fmtMes(l.mes),
    'Faturamento (R$)': l.faturamento,
    'Variação MoM Faturamento (%)': l.variacaoFaturamentoMoM.percentual !== null ? Number(l.variacaoFaturamentoMoM.percentual.toFixed(2)) : null,
    'Qtd. Vendas': l.qtd_vendas,
    'Ticket Médio (R$)': l.ticket_medio,
    'Variação MoM Ticket Médio (%)': l.variacaoTicketMedioMoM.percentual !== null ? Number(l.variacaoTicketMedioMoM.percentual.toFixed(2)) : null,
    'Faturamento Consultório (R$)': l.faturamento_consultorio,
    'Qtd. Consultório': l.qtd_consultorio,
    'Faturamento Conversão Fisio (R$)': l.faturamento_fisio,
    'Qtd. Conversão Fisio': l.qtd_fisio,
    'Qtd. Não Classificada': l.qtd_nao_classificada,
    'Orçamentos Pendentes': l.qtd_orcamento_pendente,
    'Orçamentos Recusados': l.qtd_orcamento_recusado,
    'Top Produto': l.top_produto || '',
    'Top Profissional': l.top_profissional || '',
  }))

  const worksheet = XLSX.utils.json_to_sheet(linhas)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Vendas Históricas')

  XLSX.writeFile(workbook, 'vendas-historicas.xlsx')
}
