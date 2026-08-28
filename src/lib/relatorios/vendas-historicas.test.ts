import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  calcularVariacaoMoM,
  derivarCardsExecutivos,
  montarTabelaHistorico,
  compararKpisComFuncaoCanonica,
  type LinhaMensal,
} from './vendas-historicas.ts'

function linha(overrides: Partial<LinhaMensal>): LinhaMensal {
  return {
    mes: '2026-06-01',
    faturamento: 0,
    qtd_vendas: 0,
    ticket_medio: 0,
    faturamento_consultorio: 0,
    qtd_consultorio: 0,
    faturamento_fisio: 0,
    qtd_fisio: 0,
    qtd_nao_classificada: 0,
    qtd_orcamento_pendente: 0,
    qtd_orcamento_recusado: 0,
    top_produto: null,
    top_profissional: null,
    ...overrides,
  }
}

test('@spec:AC-067 mês anterior sem vendas não produz -100%, retorna null (—)', () => {
  const { percentual, direcao } = calcularVariacaoMoM(1000, 0)
  assert.equal(percentual, null)
  assert.equal(direcao, null)
})

test('@spec:AC-067 mês anterior ausente (undefined) também retorna null', () => {
  const { percentual, direcao } = calcularVariacaoMoM(1000, undefined)
  assert.equal(percentual, null)
  assert.equal(direcao, null)
})

test('@spec:AC-080 variação MoM positiva calcula percentual e direção corretos', () => {
  const { percentual, direcao } = calcularVariacaoMoM(1500, 1000)
  assert.equal(percentual, 50)
  assert.equal(direcao, 'alta')
})

test('@spec:AC-080 variação MoM negativa calcula percentual e direção corretos', () => {
  const { percentual, direcao } = calcularVariacaoMoM(500, 1000)
  assert.equal(percentual, -50)
  assert.equal(direcao, 'queda')
})

test('@spec:AC-078 cards executivos: mês sem vendas não conta como melhor mês nem quebra o ticket médio', () => {
  const linhas = [
    linha({ mes: '2026-04-01', faturamento: 1700, qtd_vendas: 1, ticket_medio: 1700 }),
    linha({ mes: '2026-05-01', faturamento: 0, qtd_vendas: 0, ticket_medio: 0 }),
    linha({ mes: '2026-06-01', faturamento: 2800, qtd_vendas: 1, ticket_medio: 2800 }),
  ]
  const cards = derivarCardsExecutivos(linhas)

  assert.equal(cards.faturamentoTotal, 4500)
  assert.equal(cards.volumeTotal, 2)
  assert.equal(cards.ticketMedioConsolidado, 2250)
  assert.deepEqual(cards.melhorMes, { mes: '2026-06-01', faturamento: 2800 })
})

test('@spec:AC-078 cards executivos: nenhuma venda no período retorna ticket médio 0 e melhor mês nulo', () => {
  const linhas = [linha({ mes: '2026-06-01' }), linha({ mes: '2026-07-01' })]
  const cards = derivarCardsExecutivos(linhas)

  assert.equal(cards.faturamentoTotal, 0)
  assert.equal(cards.volumeTotal, 0)
  assert.equal(cards.ticketMedioConsolidado, 0)
  assert.equal(cards.melhorMes, null)
  assert.equal(cards.crescimentoMedioMoM, null)
})

test('@spec:AC-080 tabela histórica sai em ordem cronológica decrescente com MoM correto', () => {
  const linhas = [
    linha({ mes: '2026-04-01', faturamento: 1500, qtd_vendas: 1, ticket_medio: 1500 }),
    linha({ mes: '2026-05-01', faturamento: 1700, qtd_vendas: 1, ticket_medio: 1700 }),
  ]
  const tabela = montarTabelaHistorico(linhas)

  assert.equal(tabela[0].mes, '2026-05-01')
  assert.equal(tabela[1].mes, '2026-04-01')
  assert.ok(tabela[0].variacaoFaturamentoMoM.percentual !== null)
  assert.ok(Math.abs(tabela[0].variacaoFaturamentoMoM.percentual! - 13.333333333333334) < 0.0001)
  assert.equal(tabela[1].variacaoFaturamentoMoM.percentual, null)
})

test('@spec:AC-076 comparação de KPIs detecta divergência entre laço em memória e função canônica', () => {
  const resultado = compararKpisComFuncaoCanonica(
    { faturamento: 1000, qtdVendas: 2 },
    [{ faturamento: 1000, qtd_vendas: 1 }],
  )
  assert.equal(resultado.divergente, true)
  assert.equal(resultado.qtdVendasCanonica, 1)
})

test('@spec:AC-076 comparação de KPIs não acusa divergência quando os valores batem', () => {
  const resultado = compararKpisComFuncaoCanonica(
    { faturamento: 2300, qtdVendas: 4 },
    [{ faturamento: 1300, qtd_vendas: 2 }, { faturamento: 1000, qtd_vendas: 2 }],
  )
  assert.equal(resultado.divergente, false)
})
