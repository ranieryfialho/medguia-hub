/**
 * Desconto da interseção entre atendimento fabril e status personalizado.
 * Sem I/O — álgebra de intervalos pura, testável com `node --test`.
 *
 * O PROBLEMA (AC-039). O Tempo Fábril soma dois tempos que podem descrever o
 * mesmo minuto de relógio:
 *
 *     tempoFabril = horasAgendamento + tempoStatusPersonalizado
 *
 * Quando alguém declara "Hora administrativa" e atende no mesmo horário, aquele
 * minuto entra duas vezes. Medido em 10/08: 960 minutos em 26 pares, 0,77% em
 * 90 dias.
 *
 * A REGRA. O minuto sobreposto conta uma vez, **para o atendimento** — o mesmo
 * lado que já vence na tela desde a decisão de 10/08. O gestor não precisa de
 * duas explicações para a mesma regra.
 *
 * O QUE ESTE MÓDULO NÃO RESOLVE. A partir de 12/08 o bloco para sozinho na hora
 * marcada do atendimento (AC-037), então a sobreposição futura praticamente
 * deixa de nascer. Isto aqui existe para o passado já gravado e para o resíduo
 * que a regra da hora marcada não alcança: status declarado NO MEIO de um
 * atendimento em curso (AC-042).
 *
 * Ver .spec/features/status-personalizados-ciclo-vida/spec.md
 */

/**
 * A partir de quando o desconto vale — AC-043.
 *
 * Decisão do dono em 12/08: *"o que já passou não devemos mexer. foi um erro na
 * nossa regra de negócio, então já passou."* Descontar retroativamente mudaria
 * o número de períodos já fechados e já usados em decisão de gestão, sem nada
 * na tela explicando por que o mês passado encolheu.
 *
 * É 13/08 e não 12/08 porque a regra da hora marcada entrou em produção no meio
 * do dia 12 (migration aplicada ~15:00 UTC). O dia 12 é de regime misto — parte
 * sob a regra velha, parte sob a nova — e um corte no meio dele produziria um
 * relatório diário que ninguém consegue explicar. O primeiro dia inteiro sob a
 * regra nova é o 13.
 *
 * Meia-noite em São Paulo, que é sempre UTC-3 (sem horário de verão desde 2020),
 * mesmo pressuposto de `calcularMinutosStatusNaJornada`.
 */
export const INICIO_DO_DESCONTO = new Date('2026-08-13T00:00:00-03:00')

/** AC-043: bloco anterior ao corte é passado, e passado não se reescreve. */
export function descontoSeAplica(
  inicioDoBloco: Date,
  corte: Date = INICIO_DO_DESCONTO,
): boolean {
  return inicioDoBloco.getTime() >= corte.getTime()
}

export type Intervalo = {
  inicio: Date
  fim: Date
}

export type AtendimentoParaDesconto = {
  data_agendamento: string
  duracao_minutos: number | null
}

/**
 * Mede um intervalo na mesma unidade em que o tempo foi somado ao relatório.
 *
 * ASM-008: o bloco de status entra no Tempo Fábril já capado pela jornada do
 * profissional; o atendimento entra pela duração cheia. Descontar a interseção
 * crua tiraria do bloco minutos que ele nunca somou — um atendimento fabril
 * fora da jornada cadastrada zeraria um bloco legítimo. Por isso o desconto é
 * medido pela mesma função que fez a soma, injetada aqui para manter este
 * módulo livre de dependência de jornada.
 */
export type MedirIntervalo = (inicio: Date, fim: Date) => number

/**
 * Converte atendimentos em intervalos de relógio.
 *
 * `duracao_minutos ?? 0` espelha `horasAgendamentoMin` em `kpis-tempo-fabril.ts`:
 * atendimento sem duração contribui zero para o Tempo Fábril, logo não há o que
 * descontar por ele. Usar um padrão de 60 min aqui descontaria tempo que o
 * outro lado nunca somou.
 */
export function intervalosDeAtendimentos(
  atendimentos: AtendimentoParaDesconto[],
): Intervalo[] {
  const intervalos: Intervalo[] = []

  for (const a of atendimentos) {
    const duracao = a.duracao_minutos ?? 0
    if (duracao <= 0) continue

    const inicio = new Date(a.data_agendamento)
    if (Number.isNaN(inicio.getTime())) continue

    intervalos.push({
      inicio,
      fim: new Date(inicio.getTime() + duracao * 60_000),
    })
  }

  return intervalos
}

/**
 * Funde intervalos que se sobrepõem ou se encostam.
 *
 * AC-040: sem isto, dois atendimentos sobrepostos entre si — sessões
 * simultâneas, ou o mesmo atendimento contado pelos dois papéis — descontariam
 * o mesmo minuto do bloco duas vezes, e o bloco encolheria além do devido.
 */
export function unirIntervalos(intervalos: Intervalo[]): Intervalo[] {
  if (intervalos.length === 0) return []

  const ordenados = [...intervalos].sort(
    (a, b) => a.inicio.getTime() - b.inicio.getTime(),
  )

  const unidos: Intervalo[] = [
    { inicio: ordenados[0].inicio, fim: ordenados[0].fim },
  ]

  for (const atual of ordenados.slice(1)) {
    const ultimo = unidos[unidos.length - 1]

    if (atual.inicio.getTime() <= ultimo.fim.getTime()) {
      if (atual.fim.getTime() > ultimo.fim.getTime()) {
        ultimo.fim = atual.fim
      }
      continue
    }

    unidos.push({ inicio: atual.inicio, fim: atual.fim })
  }

  return unidos
}

/** As fatias de `bloco` cobertas por `ocupados` (que precisa vir já unido). */
export function intersecoes(bloco: Intervalo, ocupados: Intervalo[]): Intervalo[] {
  const fatias: Intervalo[] = []

  for (const ocupado of ocupados) {
    const inicio = Math.max(bloco.inicio.getTime(), ocupado.inicio.getTime())
    const fim = Math.min(bloco.fim.getTime(), ocupado.fim.getTime())

    if (fim > inicio) {
      fatias.push({ inicio: new Date(inicio), fim: new Date(fim) })
    }
  }

  return fatias
}

/**
 * Minutos de um bloco que também foram contados como atendimento.
 *
 * `ocupados` precisa vir de `unirIntervalos` — a função confia nisso e não
 * refaz a união a cada bloco, porque o chamador une uma vez por profissional.
 */
export function minutosSobrepostos(
  bloco: Intervalo,
  ocupados: Intervalo[],
  medir: MedirIntervalo,
): number {
  let total = 0

  for (const fatia of intersecoes(bloco, ocupados)) {
    total += medir(fatia.inicio, fatia.fim)
  }

  return Math.max(0, total)
}

/**
 * O tempo do bloco depois do desconto.
 *
 * AC-040: nunca abaixo de zero. O piso não é defensivo por precaução — os dois
 * lados são medidos por caminhos diferentes (o bloco varre dia a dia pelos
 * intervalos da jornada; a fatia é medida direto), e arredondamentos podem
 * fazer o desconto passar do bruto por um minuto.
 */
export function descontar(minutosBrutos: number, minutosSobrepostos: number): number {
  return Math.max(0, minutosBrutos - minutosSobrepostos)
}
