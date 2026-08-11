/**
 * Testes da exportação Markdown do Tempo Fábril.
 *
 * Diferente das asserções estáticas sobre componentes, aqui dá para executar de
 * verdade: `gerarMarkdownTempoFabril` é função pura. O teste gera o documento e
 * lê o resultado.
 *
 * Ver .spec/features/status-personalizados-ciclo-vida/spec.md (AC-034, AC-036)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gerarMarkdownTempoFabril } from './markdown-tempo-fabril.ts'

type Kpi = Parameters<typeof gerarMarkdownTempoFabril>[0]['kpisEquipe'][number]

const OPCOES = [
  { id: '1', slug: 'reuniao', label: 'Em reunião', label_curto: 'reunião', cor: 'amber', ordem: 1, sistema: false, ativo: true, observacao_obrigatoria: true },
  { id: '2', slug: 'gravacao_mkt_1784656463413', label: 'Gravação MKT', label_curto: 'gravação', cor: 'amber', ordem: 4, sistema: false, ativo: false, observacao_obrigatoria: false },
]

function kpiCom(detalheStatus: Kpi['detalheStatus']): Kpi {
  return {
    profissionalId: 'p1',
    nome: 'Luana Arruda',
    jornadaContratadaMin: 2400,
    tempoFabrilMin: 720,
    horasAgendamentoMin: 600,
    tempoReuniaoMin: 120,
    tempoStatusMin: { reuniao: 120 },
    taxaOcupacao: 30,
    qtdAtendimentos: 12,
    tempoMedioMin: 45,
    diasSubutilizados: 1,
    evolucaoPorSemana: [],
    detalheAtendimentos: [],
    detalheStatus,
  }
}

/**
 * `profFiltro` aponta para o profissional, não para 'todos'.
 *
 * A "Conferência de Status" — a seção que carrega os motivos — só é gerada
 * quando há um profissional selecionado. Exportar com 'todos' produz apenas
 * resumo, ranking e comparativo, sem bloco nenhum. Comportamento anterior a
 * esta entrega, e o motivo de o primeiro rascunho deste teste falhar com a
 * tabela simplesmente ausente.
 */
const gerar = (detalheStatus: Kpi['detalheStatus']) =>
  gerarMarkdownTempoFabril({
    periodoLabel: '11/08/2026',
    kpisEquipe: [kpiCom(detalheStatus)],
    profFiltro: 'p1',
    statusOpcoes: OPCOES,
  })

test('@spec:AC-034 a exportação Markdown traz o motivo declarado', () => {
  const md = gerar([
    {
      id: 'b1',
      status: 'reuniao',
      observacao: 'Alinhamento com a Dra. Marina',
      inicio: '2026-08-11T12:00:00Z',
      fim: '2026-08-11T13:00:00Z',
      duracaoMinutos: 60,
      aberto: false,
    },
  ])

  assert.match(md, /\| Status \| Motivo \| Início \| Fim \| Duração \|/)
  assert.match(md, /Alinhamento com a Dra\. Marina/)
})

test('@spec:AC-034 bloco sem observação não quebra a tabela', () => {
  const md = gerar([
    {
      id: 'b1',
      status: 'reuniao',
      observacao: null,
      inicio: '2026-08-11T12:00:00Z',
      fim: '2026-08-11T13:00:00Z',
      duracaoMinutos: 60,
      aberto: false,
    },
  ])

  // Cinco colunas => seis barras na linha. Uma célula vazia deslocaria tudo.
  const linhaDados = md.split('\n').find((l) => l.includes('Em reunião') && l.startsWith('|'))
  assert.ok(linhaDados, 'a linha do bloco precisa existir')
  assert.equal((linhaDados!.match(/(?<!\\)\|/g) ?? []).length, 6)
  assert.match(linhaDados!, /\| — \|/)
})

test('@spec:AC-036 observação com barra vertical não destrói a tabela', () => {
  // Texto livre digitado pelo profissional. Um `|` cru encerraria a célula e
  // deslocaria todas as colunas seguintes — sem erro, só dado errado na tela.
  const md = gerar([
    {
      id: 'b1',
      status: 'reuniao',
      observacao: 'Reunião A | Reunião B',
      inicio: '2026-08-11T12:00:00Z',
      fim: '2026-08-11T13:00:00Z',
      duracaoMinutos: 60,
      aberto: false,
    },
  ])

  const linhaDados = md.split('\n').find((l) => l.includes('Reunião A') && l.startsWith('|'))
  assert.ok(linhaDados)
  assert.match(linhaDados!, /Reunião A \\\| Reunião B/)
  // Continua com exatamente 6 separadores reais.
  assert.equal((linhaDados!.match(/(?<!\\)\|/g) ?? []).length, 6)
})

test('@spec:AC-036 observação com quebra de linha vira espaço', () => {
  const md = gerar([
    {
      id: 'b1',
      status: 'reuniao',
      observacao: 'Primeira linha\nSegunda linha',
      inicio: '2026-08-11T12:00:00Z',
      fim: '2026-08-11T13:00:00Z',
      duracaoMinutos: 60,
      aberto: false,
    },
  ])

  const linhaDados = md.split('\n').find((l) => l.includes('Primeira linha') && l.startsWith('|'))
  assert.ok(linhaDados)
  assert.match(linhaDados!, /Primeira linha Segunda linha/)
})

test('@spec:AC-035 bloco no teto é marcado e explicado no rodapé', () => {
  const md = gerar([
    {
      id: 'b1',
      status: 'reuniao',
      observacao: 'Esqueci de encerrar',
      inicio: '2026-08-11T12:00:00Z',
      fim: '2026-08-11T14:00:00Z',
      duracaoMinutos: 120,
      aberto: false,
    },
  ])

  assert.match(md, /\\\*/, 'o bloco capado precisa da marca')
  assert.match(md, /Fechado automaticamente no teto de 2h/)
})

test('@spec:AC-035 bloco normal não recebe a marca nem o rodapé', () => {
  const md = gerar([
    {
      id: 'b1',
      status: 'reuniao',
      observacao: 'Encerrei na hora',
      inicio: '2026-08-11T12:00:00Z',
      fim: '2026-08-11T12:40:00Z',
      duracaoMinutos: 40,
      aberto: false,
    },
  ])

  assert.doesNotMatch(md, /Fechado automaticamente no teto/)
})

test('@spec:AC-034 status removido pelo gestor mantém o rótulo na exportação', () => {
  // O catálogo de exibição inclui removidos (AC-033). Sem isso, horas reais
  // sairiam no relatório com o identificador cru.
  const md = gerar([
    {
      id: 'b1',
      status: 'gravacao_mkt_1784656463413',
      observacao: 'Gravação do institucional',
      inicio: '2026-08-11T12:00:00Z',
      fim: '2026-08-11T13:00:00Z',
      duracaoMinutos: 60,
      aberto: false,
    },
  ])

  assert.match(md, /Gravação MKT/)
  assert.doesNotMatch(md, /gravacao_mkt_1784656463413/)
})
