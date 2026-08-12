/**
 * AC-039 e AC-040 — o minuto sobreposto conta uma vez, para o atendimento.
 *
 * Import relativo com extensão (ASM-001): `node --test` não resolve o alias `@/`.
 * Ver .spec/features/status-personalizados-ciclo-vida/spec.md
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  descontar,
  descontoSeAplica,
  INICIO_DO_DESCONTO,
  intersecoes,
  intervalosDeAtendimentos,
  minutosSobrepostos,
  unirIntervalos,
  type Intervalo,
} from './dedup-status-atendimento.ts'

/** Horário de São Paulo, que é sempre UTC-3. */
const em = (hhmm: string) => new Date(`2026-08-12T${hhmm}:00-03:00`)

const bloco = (inicio: string, fim: string): Intervalo => ({
  inicio: em(inicio),
  fim: em(fim),
})

/**
 * Régua de teste: minutos crus, sem jornada. A capagem pela jornada é
 * responsabilidade de `calcularMinutosStatusNaJornada`, que já tem cobertura
 * própria — o que se prova aqui é a álgebra de intervalos.
 */
const medirCru = (inicio: Date, fim: Date) =>
  Math.round((fim.getTime() - inicio.getTime()) / 60_000)

test('@spec:AC-039 o tempo sobreposto ao atendimento é descontado do bloco', () => {
  // Hora administrativa 09:30–11:30, atendimento 10:00–11:00.
  const ocupados = unirIntervalos(
    intervalosDeAtendimentos([
      { data_agendamento: em('10:00').toISOString(), duracao_minutos: 60 },
    ]),
  )

  const sobreposto = minutosSobrepostos(bloco('09:30', '11:30'), ocupados, medirCru)

  assert.equal(sobreposto, 60)
  assert.equal(descontar(120, sobreposto), 60)
})

test('@spec:AC-039 o atendimento fica com o minuto, o bloco perde — nunca o contrário', () => {
  // O caso do print de 12/08: a hora administrativa cobre o atendimento inteiro.
  // O relatório continua contando os 60 min do atendimento; o bloco cede.
  const ocupados = unirIntervalos(
    intervalosDeAtendimentos([
      { data_agendamento: em('10:00').toISOString(), duracao_minutos: 60 },
    ]),
  )

  const restante = descontar(120, minutosSobrepostos(bloco('09:30', '11:30'), ocupados, medirCru))

  // 120 do bloco + 60 do atendimento = 180 antes; 60 + 60 = 120 depois.
  assert.equal(restante + 60, 120)
})

test('@spec:AC-039 sem sobreposição, o bloco não é tocado', () => {
  const ocupados = unirIntervalos(
    intervalosDeAtendimentos([
      { data_agendamento: em('14:00').toISOString(), duracao_minutos: 60 },
    ]),
  )

  assert.equal(minutosSobrepostos(bloco('09:30', '11:30'), ocupados, medirCru), 0)
  assert.equal(descontar(120, 0), 120)
})

test('@spec:AC-039 bloco que só encosta no atendimento não perde nada', () => {
  // Fim do bloco == início do atendimento. É exatamente o que a regra da hora
  // marcada (AC-037) produz a partir de 12/08 — e o desconto precisa dar zero
  // nesses blocos, senão a mesma correção seria aplicada duas vezes.
  const ocupados = unirIntervalos(
    intervalosDeAtendimentos([
      { data_agendamento: em('10:00').toISOString(), duracao_minutos: 60 },
    ]),
  )

  assert.equal(minutosSobrepostos(bloco('09:30', '10:00'), ocupados, medirCru), 0)
})

test('@spec:AC-039 o desconto é medido pela régua injetada, não por tempo cru', () => {
  // ASM-008: o bloco entra no relatório capado pela jornada. Uma régua que
  // devolve zero (fatia inteiramente fora da jornada) não pode descontar nada.
  const ocupados = unirIntervalos(
    intervalosDeAtendimentos([
      { data_agendamento: em('10:00').toISOString(), duracao_minutos: 60 },
    ]),
  )

  const foraDaJornada = () => 0

  assert.equal(minutosSobrepostos(bloco('09:30', '11:30'), ocupados, foraDaJornada), 0)
})

test('@spec:AC-040 o desconto nunca leva o bloco abaixo de zero', () => {
  assert.equal(descontar(30, 120), 0)
  assert.equal(descontar(0, 45), 0)
  // Os dois lados são medidos por caminhos diferentes; um minuto de
  // arredondamento a mais não pode virar tempo negativo.
  assert.equal(descontar(60, 61), 0)
})

test('@spec:AC-040 atendimentos sobrepostos entre si não descontam o mesmo minuto duas vezes', () => {
  // Dois atendimentos 10:00–11:00 e 10:30–11:30 cobrem 10:00–11:30 = 90 min,
  // não 60 + 60 = 120.
  const ocupados = unirIntervalos(
    intervalosDeAtendimentos([
      { data_agendamento: em('10:00').toISOString(), duracao_minutos: 60 },
      { data_agendamento: em('10:30').toISOString(), duracao_minutos: 60 },
    ]),
  )

  assert.equal(ocupados.length, 1)
  assert.equal(minutosSobrepostos(bloco('09:00', '12:00'), ocupados, medirCru), 90)
})

test('@spec:AC-040 o mesmo atendimento repetido conta uma vez só', () => {
  // Acontece de verdade: `calcularKPIs` inclui o atendimento quando o
  // profissional é responsável OU executor, e o mesmo registro pode chegar
  // duplicado por caminhos diferentes.
  const duplicado = { data_agendamento: em('10:00').toISOString(), duracao_minutos: 60 }
  const ocupados = unirIntervalos(intervalosDeAtendimentos([duplicado, duplicado]))

  assert.equal(minutosSobrepostos(bloco('09:00', '12:00'), ocupados, medirCru), 60)
})

test('@spec:AC-040 atendimentos separados descontam cada um a sua parte', () => {
  const ocupados = unirIntervalos(
    intervalosDeAtendimentos([
      { data_agendamento: em('10:00').toISOString(), duracao_minutos: 30 },
      { data_agendamento: em('11:00').toISOString(), duracao_minutos: 30 },
    ]),
  )

  assert.equal(ocupados.length, 2)
  assert.equal(minutosSobrepostos(bloco('09:00', '12:00'), ocupados, medirCru), 60)
})

test('@spec:AC-040 atendimento sem duração não desconta nada', () => {
  // Espelha `duracao_minutos ?? 0` de horasAgendamentoMin: se não somou tempo
  // fabril, não há tempo em dobro a tirar.
  const ocupados = unirIntervalos(
    intervalosDeAtendimentos([
      { data_agendamento: em('10:00').toISOString(), duracao_minutos: null },
      { data_agendamento: em('10:00').toISOString(), duracao_minutos: 0 },
    ]),
  )

  assert.deepEqual(ocupados, [])
  assert.equal(minutosSobrepostos(bloco('09:00', '12:00'), ocupados, medirCru), 0)
})

test('@spec:AC-040 data inválida é ignorada em vez de virar intervalo NaN', () => {
  const ocupados = intervalosDeAtendimentos([
    { data_agendamento: 'não é data', duracao_minutos: 60 },
  ])

  assert.deepEqual(ocupados, [])
})

test('@spec:AC-040 a interseção recorta o bloco, não o atendimento', () => {
  const ocupados = unirIntervalos(
    intervalosDeAtendimentos([
      { data_agendamento: em('08:00').toISOString(), duracao_minutos: 240 },
    ]),
  )

  const fatias = intersecoes(bloco('09:30', '10:30'), ocupados)

  assert.equal(fatias.length, 1)
  assert.equal(fatias[0].inicio.getTime(), em('09:30').getTime())
  assert.equal(fatias[0].fim.getTime(), em('10:30').getTime())
})

test('@spec:AC-040 lista vazia de atendimentos é caso normal, não erro', () => {
  assert.deepEqual(unirIntervalos([]), [])
  assert.equal(minutosSobrepostos(bloco('09:00', '10:00'), [], medirCru), 0)
})

test('@spec:AC-043 bloco anterior à data de corte não é descontado', () => {
  // Os 26 pares medidos em 10/08, e todo o resto do passado.
  assert.equal(descontoSeAplica(new Date('2026-08-10T12:00:00-03:00')), false)
  assert.equal(descontoSeAplica(new Date('2026-07-22T14:00:00-03:00')), false)
})

test('@spec:AC-043 o dia 12 inteiro fica de fora — foi regime misto', () => {
  // A regra da hora marcada entrou ~15:00 UTC do dia 12. Cortar no meio do dia
  // produziria um relatório diário com duas regras dentro.
  assert.equal(descontoSeAplica(new Date('2026-08-12T23:59:59-03:00')), false)
})

test('@spec:AC-043 bloco a partir do corte é descontado', () => {
  assert.equal(descontoSeAplica(new Date('2026-08-13T00:00:00-03:00')), true)
  assert.equal(descontoSeAplica(new Date('2026-09-01T09:00:00-03:00')), true)
})

test('@spec:AC-043 o corte é o primeiro dia inteiro sob a regra nova', () => {
  // Trava a constante: mudá-la muda retroativamente números de relatório, então
  // não pode ser ajustada sem que um teste caia junto.
  assert.equal(INICIO_DO_DESCONTO.toISOString(), '2026-08-13T03:00:00.000Z')
})
