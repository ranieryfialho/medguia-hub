/**
 * Integração: `calcularKPIs` de ponta a ponta com bloco de status sobreposto a
 * atendimento.
 *
 * POR QUE ESTE ARQUIVO EXISTE. `dedup-status-atendimento.test.ts` prova a
 * álgebra de intervalos; não prova a **ligação**. O portão da data de corte, a
 * união feita uma vez por profissional, o caminho semanal e o mapa de
 * `descontoPorBloco` só existem dentro de `calcularKPIs`, e nada os cobria.
 *
 * O caso que motivou: trocar `descontoSeAplica(ini)` por
 * `descontoSeAplica(inicioEfetivo)` não quebraria nenhum teste da regra pura —
 * e faria a data de corte depender do filtro escolhido na tela. O teste
 * "o portão olha o início real" abaixo é a trava contra exatamente isso.
 *
 * Ver .spec/features/status-personalizados-ciclo-vida/spec.md
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  calcularKPIs,
  type Atendimento,
  type HistoricoStatus,
  type Jornada,
} from '../../src/lib/relatorios/kpis-tempo-fabril.ts'

const PROF = { id: 'p1', nome: 'Luana Arruda' }

/**
 * Jornada 08:00–20:00 nos sete dias, sem intervalo de almoço.
 *
 * Os sete dias de propósito: `resolverJornadaDoDia` usa `Date.getDay()`, que lê
 * o fuso da máquina. Cadastrar a semana inteira faz o teste dar o mesmo
 * resultado em qualquer máquina, em vez de depender de o dia cair certo.
 */
const JORNADA: Jornada[] = Array.from({ length: 7 }, (_, dia) => ({
  profissional_id: PROF.id,
  dia_semana: dia,
  jornada_inicio: '08:00',
  jornada_fim: '20:00',
  intervalo_inicio: null,
  intervalo_fim: null,
}))

/** São Paulo é sempre UTC-3, mesmo pressuposto do cálculo. */
const em = (iso: string) => `${iso}-03:00`

function atendimento(
  inicio: string,
  duracao: number,
  status = 'Concluído',
): Atendimento {
  return {
    id: `a-${inicio}`,
    profissional_id: PROF.id,
    fisioterapeuta_id: null,
    data_agendamento: em(inicio),
    duracao_minutos: duracao,
    status,
    tipo: 'FOT Fisioterapia',
    numero_sessao: 1,
    paciente_id: 'pac1',
    paciente_nome: 'Marinilda Lima Santos',
  }
}

function bloco(id: string, inicio: string, fim: string, duracao: number): HistoricoStatus {
  return {
    id,
    profissional_id: PROF.id,
    status: 'hora_administrativa',
    observacao: 'Base contato',
    inicio: em(inicio),
    fim: em(fim),
    duracao_minutos: duracao,
  }
}

function calcular(
  atendimentos: Atendimento[],
  historico: HistoricoStatus[],
  de: string,
  ate: string,
) {
  return calcularKPIs(
    [PROF],
    atendimentos,
    JORNADA,
    [],
    new Date(em(de)),
    new Date(em(ate)),
    [],
    historico,
    [],
  )[0]
}

test('@spec:AC-039 bloco sobreposto a atendimento não conta duas vezes no total', () => {
  // 14/08 (depois do corte). Hora administrativa 09:00–11:00, atendimento
  // concluído 10:00–11:00. Antes desta entrega: 120 + 60 = 180.
  const kpi = calcular(
    [atendimento('2026-08-14T10:00:00', 60)],
    [bloco('b1', '2026-08-14T09:00:00', '2026-08-14T11:00:00', 120)],
    '2026-08-14T00:00:00',
    '2026-08-14T23:59:59',
  )

  assert.equal(kpi.horasAgendamentoMin, 60, 'o atendimento fica com os 60 min')
  assert.equal(kpi.tempoStatusMin['hora_administrativa'], 60, 'o bloco cede a hora sobreposta')
  assert.equal(kpi.tempoFabrilMin, 120, 'o total não pode ser 180')
})

test('@spec:AC-039 sem sobreposição o bloco entra inteiro', () => {
  const kpi = calcular(
    [atendimento('2026-08-14T14:00:00', 60)],
    [bloco('b1', '2026-08-14T09:00:00', '2026-08-14T11:00:00', 120)],
    '2026-08-14T00:00:00',
    '2026-08-14T23:59:59',
  )

  assert.equal(kpi.tempoStatusMin['hora_administrativa'], 120)
  assert.equal(kpi.tempoFabrilMin, 180)
})

test('@spec:AC-039 atendimento não fabril não desconta nada', () => {
  // 'Aguardando' não entra em horasAgendamentoMin, logo não há tempo em dobro.
  // Descontar por ele tiraria do bloco um tempo que o outro lado não somou.
  const kpi = calcular(
    [atendimento('2026-08-14T10:00:00', 60, 'Aguardando')],
    [bloco('b1', '2026-08-14T09:00:00', '2026-08-14T11:00:00', 120)],
    '2026-08-14T00:00:00',
    '2026-08-14T23:59:59',
  )

  assert.equal(kpi.horasAgendamentoMin, 0)
  assert.equal(kpi.tempoStatusMin['hora_administrativa'], 120)
})

test('@spec:AC-040 dois atendimentos sobrepostos entre si descontam a união, não a soma', () => {
  // 10:00–11:00 e 10:30–11:30 cobrem 90 min do bloco, não 120.
  const kpi = calcular(
    [
      atendimento('2026-08-14T10:00:00', 60),
      atendimento('2026-08-14T10:30:00', 60),
    ],
    [bloco('b1', '2026-08-14T09:00:00', '2026-08-14T12:00:00', 180)],
    '2026-08-14T00:00:00',
    '2026-08-14T23:59:59',
  )

  assert.equal(kpi.tempoStatusMin['hora_administrativa'], 90, '180 − 90 de união')
})

test('@spec:AC-043 bloco anterior à data de corte entra pelo bruto', () => {
  // 06/08, antes do corte de 13/08. Mesma sobreposição do primeiro teste, e o
  // relatório precisa devolver o número de antes desta entrega: 120 + 60.
  const kpi = calcular(
    [atendimento('2026-08-06T10:00:00', 60)],
    [bloco('b1', '2026-08-06T09:00:00', '2026-08-06T11:00:00', 120)],
    '2026-08-06T00:00:00',
    '2026-08-06T23:59:59',
  )

  assert.equal(kpi.tempoStatusMin['hora_administrativa'], 120, 'o passado não se reescreve')
  assert.equal(kpi.tempoFabrilMin, 180)
})

test('@spec:AC-043 o portão olha o início real do bloco, não o recortado pelo período', () => {
  // A trava contra o defeito mais provável desta implementação.
  //
  // Bloco travado das 18:00 de 12/08 (ANTES do corte) às 10:00 de 13/08 — o
  // cenário dos profissionais presos por dias que o RFC 002 documentou. O
  // relatório pede só o dia 13, então `inicioEfetivo` cai em 13/08 00:00, que é
  // DEPOIS do corte. Se o portão olhasse o recorte, o bloco seria descontado — e
  // o mesmo bloco mudaria de valor conforme o período filtrado na tela.
  const kpi = calcular(
    [atendimento('2026-08-13T09:00:00', 60)],
    [bloco('b1', '2026-08-12T18:00:00', '2026-08-13T10:00:00', 960)],
    '2026-08-13T00:00:00',
    '2026-08-13T23:59:59',
  )

  // Jornada 08:00–20:00: no dia 13 o bloco cobre 08:00–10:00 = 120 min.
  assert.equal(
    kpi.tempoStatusMin['hora_administrativa'],
    120,
    'bloco iniciado antes do corte não pode ser descontado, mesmo visto de um período posterior',
  )
})

test('@spec:AC-041 o desconto aplicado chega ao detalhe da conferência', () => {
  const kpi = calcular(
    [atendimento('2026-08-14T10:00:00', 60)],
    [bloco('b1', '2026-08-14T09:00:00', '2026-08-14T11:00:00', 120)],
    '2026-08-14T00:00:00',
    '2026-08-14T23:59:59',
  )

  const detalhe = kpi.detalheStatus.find((d) => d.id === 'b1')
  assert.ok(detalhe, 'o bloco precisa aparecer na conferência')
  assert.equal(detalhe.descontadoMinutos, 60)
  assert.equal(detalhe.duracaoMinutos, 120, 'a duração de relógio não é alterada')
})

test('@spec:AC-041 bloco sem sobreposição chega com desconto zero', () => {
  const kpi = calcular(
    [atendimento('2026-08-14T14:00:00', 60)],
    [bloco('b1', '2026-08-14T09:00:00', '2026-08-14T11:00:00', 120)],
    '2026-08-14T00:00:00',
    '2026-08-14T23:59:59',
  )

  assert.equal(kpi.detalheStatus.find((d) => d.id === 'b1')?.descontadoMinutos, 0)
})

/**
 * As duas semanais usam a semana inteira, com o bloco em dia que NÃO é o último
 * da janela, por causa de um defeito pré-existente descrito abaixo.
 *
 * `calcularEvolucaoSemanal` monta o fim do recorte com `parseAppDate(chave)`,
 * que devolve MEIA-NOITE do último dia. Um bloco de status nesse último dia cai
 * fora do filtro `ini > fim` e some do número da semana — enquanto continua
 * contando no total, que recebe o `dataFim` real do chamador.
 *
 * O defeito é anterior a esta entrega (a conta do fim do recorte não foi
 * tocada), afeta só o gráfico de evolução e vale para qualquer status, com ou
 * sem desconto. Registrado aqui porque foi descoberto ao escrever este teste;
 * corrigi-lo é outra entrega, e mexeria em números de semanas passadas.
 */
test('@spec:AC-039 o recorte semanal desconta pela mesma regra do total', () => {
  // Se o semanal somasse o bruto, a soma das semanas deixaria de bater com o
  // número do topo — e a divergência apareceria justamente nas semanas com
  // sobreposição, que são as que interessam.
  const kpi = calcular(
    [atendimento('2026-08-14T10:00:00', 60)],
    [bloco('b1', '2026-08-14T09:00:00', '2026-08-14T11:00:00', 120)],
    '2026-08-09T00:00:00',
    '2026-08-15T23:59:59',
  )

  const somaSemanal = kpi.evolucaoPorSemana.reduce((acc, s) => acc + s.fabrilMin, 0)
  assert.equal(kpi.tempoFabrilMin, 120, 'o total desconta')
  assert.equal(somaSemanal, kpi.tempoFabrilMin, 'e o semanal desconta igual')
})

test('@spec:AC-043 o recorte semanal também respeita a data de corte', () => {
  const kpi = calcular(
    [atendimento('2026-08-06T10:00:00', 60)],
    [bloco('b1', '2026-08-06T09:00:00', '2026-08-06T11:00:00', 120)],
    '2026-08-02T00:00:00',
    '2026-08-08T23:59:59',
  )

  const somaSemanal = kpi.evolucaoPorSemana.reduce((acc, s) => acc + s.fabrilMin, 0)
  assert.equal(kpi.tempoFabrilMin, 180, 'antes do corte, nada é descontado')
  assert.equal(somaSemanal, kpi.tempoFabrilMin, 'e o semanal também não desconta')
})

test('@spec:AC-040 o mesmo atendimento pelos dois papéis desconta uma vez', () => {
  // `calcularKPIs` inclui o atendimento quando o profissional é responsável OU
  // executor. Com os dois campos apontando para a mesma pessoa, o registro não
  // pode ser contado — nem descontado — duas vezes.
  const at = atendimento('2026-08-14T10:00:00', 60)
  const kpi = calcular(
    [{ ...at, fisioterapeuta_id: PROF.id }],
    [bloco('b1', '2026-08-14T09:00:00', '2026-08-14T11:00:00', 120)],
    '2026-08-14T00:00:00',
    '2026-08-14T23:59:59',
  )

  assert.equal(kpi.horasAgendamentoMin, 60)
  assert.equal(kpi.tempoStatusMin['hora_administrativa'], 60)
})
