/**
 * AC-041 — o bloco descontado não encolhe em silêncio.
 *
 * O Markdown é gerado de verdade (função pura). A tela e o PDF vão por asserção
 * estática sobre o texto do arquivo (ASM-005): não há runner de componente neste
 * projeto, e o jsPDF desenha num canvas que o teste não lê.
 *
 * Ver .spec/features/status-personalizados-ciclo-vida/spec.md
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { gerarMarkdownTempoFabril } from '../../src/lib/relatorios/markdown-tempo-fabril.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const lerFonte = (relativo: string) =>
  readFileSync(path.join(__dirname, '../../src/', relativo), 'utf-8')

type Kpi = Parameters<typeof gerarMarkdownTempoFabril>[0]['kpisEquipe'][number]

const OPCOES = [
  {
    id: '1',
    slug: 'hora_administrativa',
    label: 'Hora administrativa',
    label_curto: 'administrativa',
    cor: 'amber',
    ordem: 1,
    sistema: false,
    ativo: true,
    observacao_obrigatoria: false,
  },
]

/** O caso do print de 12/08: bloco de 2h com 1h dentro de atendimento. */
const BLOCO_DESCONTADO: Kpi['detalheStatus'][number] = {
  id: 'b1',
  status: 'hora_administrativa',
  observacao: 'Base contato',
  inicio: '2026-08-12T12:30:00Z',
  fim: '2026-08-12T14:30:00Z',
  duracaoMinutos: 120,
  aberto: false,
  descontadoMinutos: 60,
}

const BLOCO_LIMPO: Kpi['detalheStatus'][number] = {
  ...BLOCO_DESCONTADO,
  id: 'b2',
  observacao: 'Sem sobreposição',
  descontadoMinutos: 0,
}

const gerar = (detalheStatus: Kpi['detalheStatus']) =>
  gerarMarkdownTempoFabril({
    periodoLabel: '12/08/2026',
    kpisEquipe: [
      {
        profissionalId: 'p1',
        nome: 'Luana Arruda',
        jornadaContratadaMin: 2400,
        tempoFabrilMin: 720,
        horasAgendamentoMin: 600,
        tempoReuniaoMin: 0,
        tempoStatusMin: { hora_administrativa: 60 },
        taxaOcupacao: 30,
        qtdAtendimentos: 12,
        tempoMedioMin: 45,
        diasSubutilizados: 0,
        evolucaoPorSemana: [],
        detalheAtendimentos: [],
        detalheStatus,
      },
    ],
    profFiltro: 'p1',
    statusOpcoes: OPCOES,
  })

test('@spec:AC-041 a exportação mostra a duração já descontada, não a bruta', () => {
  const md = gerar([BLOCO_DESCONTADO])

  // 120 min de relógio, 60 dentro de atendimento → 1h entra no Tempo Fábril.
  assert.match(md, /\| 1h \+?†? ?\|/)
  assert.doesNotMatch(md, /\| 2h[^|]*\|/)
})

test('@spec:AC-041 o bloco descontado é marcado na tabela', () => {
  const md = gerar([BLOCO_DESCONTADO])
  assert.match(md, /†/)
})

test('@spec:AC-041 a marca é explicada, e diz quanto saiu', () => {
  const md = gerar([BLOCO_DESCONTADO])

  assert.match(md, /† Parte do bloco aconteceu durante atendimento/)
  assert.match(md, /1h não entram nestes números/)
  assert.match(md, /conta uma vez, do lado do atendimento/)
})

test('@spec:AC-041 bloco sem desconto não ganha marca nem rodapé', () => {
  const md = gerar([BLOCO_LIMPO])

  assert.doesNotMatch(md, /†/)
  assert.doesNotMatch(md, /durante atendimento/)
})

test('@spec:AC-041 os totais somam o líquido, não o bruto', () => {
  // Dois blocos de 2h, um com 1h descontada: 1h + 2h = 3h, não 4h.
  const md = gerar([BLOCO_DESCONTADO, BLOCO_LIMPO])

  assert.match(md, /\*\*Total:\*\* 3h/)
  assert.doesNotMatch(md, /\*\*Total:\*\* 4h/)
})

test('@spec:AC-041 a conferência da tela mostra o desconto e soma o líquido', () => {
  // ASM-005: asserção estática. O que ela trava é a regressão que já aconteceu
  // duas vezes nesta feature — o dado existir e nenhuma tela consumi-lo.
  const tela = lerFonte('components/features/relatorios/TabelaTempoFabril.tsx')

  assert.match(tela, /descontadoMinutos/, 'a tela precisa receber o desconto')
  assert.match(tela, /liquidoDoBloco/, 'a duração exibida precisa ser a líquida')
  assert.match(
    tela,
    /em atendimento/,
    'o desconto precisa ser nomeado na linha, não só subtraído',
  )
  assert.match(
    tela,
    /totalDescontadoMin/,
    'o rodapé precisa dizer quanto saiu do total',
  )
})

test('@spec:AC-041 o PDF leva o mesmo desconto da tela', () => {
  // T-027 provou que exportar pela metade é o modo de falha desta feature: a
  // observação existia na tela e faltava no PDF por uma entrega inteira.
  const pdf = lerFonte('lib/relatorios/pdf-tempo-fabril.ts')

  assert.match(pdf, /liquidoDoBloco/, 'o PDF precisa imprimir a duração líquida')
  assert.match(pdf, /algumDescontado/, 'o PDF precisa marcar os blocos descontados')
  assert.match(
    pdf,
    /Parte do bloco aconteceu durante atendimento/,
    'a marca do PDF precisa ser explicada no rodapé, como a de expirado',
  )
})
