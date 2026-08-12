/**
 * Asserções estáticas sobre o texto da migration que faz o bloco parar na hora
 * marcada do atendimento (ASM-002). Não executa Postgres — garante forma e
 * ordem do SQL, não comportamento.
 *
 * Ver .spec/features/status-personalizados-ciclo-vida/spec.md — AC-037, AC-038,
 * AC-042.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const ler = (arquivo: string) =>
  readFileSync(path.join(__dirname, '../../database/', arquivo), 'utf-8')

/** A migration vigente do job `fechar-status-esquecidos`. */
const sql = ler('status_para_na_hora_do_atendimento_migration.sql')

/** Só o corpo do cron — a conferência final cita nomes de propósito. */
const comandoDoCron = sql.slice(sql.indexOf('$cron$'), sql.lastIndexOf('$cron$'))

/**
 * O mesmo corpo sem os comentários `--`. Necessário para as asserções de
 * ausência: os comentários explicam quais status ficam DE FORA e por quê, então
 * citam 'Reagendado' e 'Reposição' literalmente. Procurar essas palavras no
 * texto cru acusaria a documentação como se fosse código.
 */
const comandoSemComentarios = comandoDoCron
  .split('\n')
  // Sem `$` de propósito: o repositório grava CRLF, e `$` (fora de multiline)
  // não casa antes do `\r` que sobra no fim da linha — os comentários passavam
  // intactos e as asserções de ausência acusavam a própria documentação. Só
  // apareceu depois do primeiro commit, quando o git converteu as quebras.
  .map((linha) => linha.replace(/--.*/, ''))
  .join('\n')

test('@spec:AC-037 o bloco aberto é cruzado com os atendimentos do profissional', () => {
  assert.match(comandoDoCron, /FROM\s+historico_status_disponibilidade\s+h/i)
  assert.match(comandoDoCron, /JOIN\s+public\.atendimentos\s+a/i)
  assert.match(comandoDoCron, /h\.fim\s+IS\s+NULL/i)
})

test('@spec:AC-037 alcança tanto o responsável quanto o executor do atendimento', () => {
  // ASM-007: decisão do dono em 12/08. A tela e o relatório já tratam os dois
  // como ocupados durante o atendimento.
  assert.match(
    comandoDoCron,
    /a\.profissional_id\s*=\s*h\.profissional_id\s+OR\s+a\.fisioterapeuta_id\s*=\s*h\.profissional_id/i,
  )
})

test('@spec:AC-037 o filtro de status do atendimento é positivo, não negativo', () => {
  // Uma lista negativa erraria em silêncio: 'Reagendado' tem variantes de
  // grafia ('Reposição', 'reposicao') em STATUS_RAW_VALUES_BY_KEY, e esquecer
  // uma delas encerraria o bloco por um atendimento que não aconteceu.
  assert.match(comandoDoCron, /lower\(a\.status\)\s+IN\s*\(/i)
  assert.doesNotMatch(comandoSemComentarios, /a\.status\s+NOT\s+IN/i)

  for (const status of [
    'confirmado',
    'aguardando',
    'aguardando consulta',
    'em atendimento',
    'concluido',
  ]) {
    assert.ok(
      comandoDoCron.includes(`'${status}'`),
      `o status '${status}' precisa estar na lista de atendimentos que valem`,
    )
  }
})

test('@spec:AC-037 os status que não aconteceram não encerram bloco nenhum', () => {
  for (const status of ['cancelado', 'falta', 'reagendado', 'reposi']) {
    assert.ok(
      !comandoSemComentarios.toLowerCase().includes(`'${status}`),
      `'${status}' não pode entrar na lista — o atendimento não aconteceu`,
    )
  }
})

test('@spec:AC-037 o job apaga a declaração e nunca grava o status derivado', () => {
  // "Em atendimento" é EFEITO da regra 1 da fn_status_equipe_agora, não algo a
  // gravar. AC-011 marcou 'ocupado' como status de sistema exatamente para que
  // ninguém o escreva — gravá-lo reintroduz a Divergência 1 do RFC 002.
  assert.match(comandoDoCron, /SET\s+status\s*=\s*'disponivel'[\s\S]*?origem\s*=\s*'agenda'/i)
  assert.doesNotMatch(comandoDoCron, /SET\s+status\s*=\s*'ocupado'/i)
  assert.doesNotMatch(comandoDoCron, /status\s*=\s*'ocupado'\s*,/i)
})

test("@spec:AC-037 'agenda' é um valor aceito para origem", () => {
  // Sem ampliar a constraint, o job viola o CHECK e falha a cada 10 minutos em
  // silêncio — o pg_cron registra em cron.job_run_details e nada mais aparece.
  assert.match(
    sql,
    /ADD CONSTRAINT status_disponibilidade_origem_check\s*CHECK \(origem IN \('manual', 'automatico', 'fallback', 'agenda'\)\)/i,
  )
})

test('@spec:AC-037 a constraint é derrubada antes de ser recriada', () => {
  const indiceDrop = sql.search(/DROP CONSTRAINT IF EXISTS status_disponibilidade_origem_check/i)
  const indiceAdd = sql.search(/ADD CONSTRAINT status_disponibilidade_origem_check/i)

  assert.notEqual(indiceDrop, -1, 'a constraint antiga precisa sair antes')
  assert.ok(indiceDrop < indiceAdd, 'sem o DROP, o ADD falha porque a constraint já existe')
})

test('@spec:AC-037 a ampliação da constraint vem antes do agendamento do job', () => {
  const indiceConstraint = sql.search(/ADD CONSTRAINT status_disponibilidade_origem_check/i)
  const indiceSchedule = sql.search(/SELECT cron\.schedule/i)

  assert.ok(
    indiceConstraint < indiceSchedule,
    "o job precisa de 'agenda' já aceito no momento em que roda pela primeira vez",
  )
})

test('@spec:AC-038 o fim gravado é a hora marcada do atendimento, não NOW()', () => {
  assert.match(comandoDoCron, /SET\s+fim\s*=\s*b\.hora_marcada/i)
})

test('@spec:AC-038 havendo mais de um atendimento na janela, vale o mais cedo', () => {
  // Sem MIN, um UPDATE ... FROM com dois atendimentos elegíveis deixa o
  // Postgres escolher qualquer um — o bloco fecharia em hora não determinística.
  assert.match(comandoDoCron, /MIN\(a\.data_agendamento\)\s+AS\s+hora_marcada/i)
  assert.match(comandoDoCron, /GROUP BY\s+h\.id,\s*h\.profissional_id/i)
})

test('@spec:AC-038 o histórico é fechado antes do status ser resetado', () => {
  const indiceFechamento = comandoDoCron.search(
    /UPDATE\s+historico_status_disponibilidade\s+h\s+SET\s+fim\s*=\s*b\.hora_marcada/i,
  )
  const indiceReset = comandoDoCron.search(/FROM\s+fechados_pela_agenda\s+f/i)

  assert.notEqual(indiceFechamento, -1, 'deveria fechar o histórico na hora marcada')
  assert.notEqual(indiceReset, -1, 'deveria resetar o status a partir do fechamento')
  assert.ok(
    indiceFechamento < indiceReset,
    'invertida, a UPDATE em status_disponibilidade dispara o trigger de log, que fecha o bloco com fim = NOW() — até 10 min depois da hora marcada',
  )
})

test('@spec:AC-038 o reset depende do fechamento pelo mesmo statement (CTE)', () => {
  assert.match(comandoDoCron, /WITH\s+blocos_com_atendimento\s+AS\s*\(/i)
  assert.match(comandoDoCron, /fechados_pela_agenda\s+AS\s*\(/i)
  assert.match(comandoDoCron, /RETURNING\s+h\.profissional_id/i)
})

test('@spec:AC-042 não fecha bloco em hora anterior ao próprio início', () => {
  // Um status declarado NO MEIO de um atendimento em curso tem hora marcada
  // anterior ao bloco. Gravar esse fim produziria duração zero ou negativa.
  assert.match(comandoDoCron, /a\.data_agendamento\s*>=\s*h\.inicio/i)
})

test('@spec:AC-042 só considera atendimento cuja hora marcada já chegou', () => {
  assert.match(comandoDoCron, /a\.data_agendamento\s*<=\s*NOW\(\)/i)
})

test('@spec:AC-042 o comando da agenda roda antes do teto de 2 horas', () => {
  // Um bloco aberto há mais de 2h que TAMBÉM tenha atendimento marcado deve
  // fechar na hora do atendimento, não em inicio+2h. Se o teto rodasse antes,
  // fecharia o bloco e o comando da agenda não acharia mais nada aberto —
  // gravando a hora errada de forma permanente.
  const indiceAgenda = comandoDoCron.search(/WITH\s+blocos_com_atendimento\s+AS/i)
  const indiceTeto = comandoDoCron.search(/SET\s+fim\s*=\s*inicio \+ INTERVAL '2 hours'/i)

  assert.notEqual(indiceTeto, -1, 'o teto de 2h precisa continuar no job')
  assert.ok(indiceAgenda < indiceTeto, 'a hora marcada é mais específica que o teto')
})

test('@spec:AC-042 os dois comandos herdados continuam no job reagendado', () => {
  // cron.schedule substitui o comando INTEIRO. Perder o teto (AC-004/005/006)
  // ou a rede de destravamento (AC-019) aqui seria uma regressão silenciosa do
  // que já está em produção.
  assert.match(comandoDoCron, /SET\s+fim\s*=\s*inicio \+ INTERVAL '2 hours'/i)
  assert.match(comandoDoCron, /origem\s*=\s*'fallback'/i)
  assert.match(
    comandoDoCron,
    /WHERE\s+sd\.status\s+NOT IN \('disponivel', 'ausente', 'ocupado'\)\s*AND\s+sd\.atualizado_em\s*<\s*NOW\(\) - INTERVAL '2 hours'/i,
  )
})

test('@spec:AC-042 nenhum resquício do teto de 1 hora entra no job', () => {
  assert.doesNotMatch(comandoDoCron, /INTERVAL '1 hour'/)
})
