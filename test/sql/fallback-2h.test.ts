/**
 * Asserções estáticas sobre o texto da migration de fallback vigente (ASM-002).
 * Não executa Postgres — garante forma e ordem do SQL, não comportamento.
 *
 * Substitui test/sql/fallback-1h.test.ts, removido na emenda de 11/08: manter os
 * dois faria a suíte exigir 1h e 2h ao mesmo tempo.
 *
 * Ver .spec/features/status-personalizados-ciclo-vida/spec.md
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const ler = (arquivo: string) =>
  readFileSync(path.join(__dirname, '../../database/', arquivo), 'utf-8')

/** A migration vigente: reagenda o job com o teto de 2h. */
const sql = ler('status_personalizados_fallback_2h_migration.sql')

/**
 * A migration de 10/08, que criou a coluna `origem` e sua constraint. Continua
 * sendo o registro do que rodou em produção e não é editada — por isso as
 * asserções de estrutura da coluna seguem apontando para ela.
 */
const sqlOrigemDaColuna = ler('status_personalizados_fallback_1h_migration.sql')

test('@spec:AC-004 o teto do bloco volta a ser de 2 horas', () => {
  assert.match(sql, /INTERVAL '2 hours'/)
})

test('@spec:AC-004 nenhum comando do job vigente permanece com o teto de 1 hora', () => {
  // A conferência da própria migration cita '1 hour' de propósito, para checar
  // que não sobrou resquício. Fora dessa linha, o prazo antigo não pode existir.
  const comandosDoJob = sql
    .split('\n')
    .filter((linha) => !/resquicio_1h/.test(linha))
    .join('\n')

  assert.doesNotMatch(comandosDoJob, /INTERVAL '1 hour'/)
})

test('@spec:AC-005 o job devolve status_disponibilidade para disponivel com origem fallback', () => {
  assert.match(sql, /UPDATE\s+status_disponibilidade/i)
  assert.match(sql, /status\s*=\s*'disponivel'/)
  assert.match(sql, /origem\s*=\s*'fallback'/)
})

test("@spec:AC-005 'fallback' é um valor aceito para origem", () => {
  assert.match(
    sqlOrigemDaColuna,
    /CHECK\s*\(origem IN \('manual', 'automatico', 'fallback'\)\)/,
  )
})

test('@spec:AC-005 a coluna origem é criada antes da constraint que a restringe', () => {
  const indiceAddColumn = sqlOrigemDaColuna.search(/ADD COLUMN IF NOT EXISTS origem/i)
  const indiceConstraint = sqlOrigemDaColuna.search(
    /ADD CONSTRAINT status_disponibilidade_origem_check/i,
  )

  assert.notEqual(indiceAddColumn, -1, 'a migration precisa criar a coluna defensivamente')
  assert.ok(indiceAddColumn < indiceConstraint, 'a coluna precisa existir antes da constraint')
})

test('@spec:AC-006 o histórico é fechado antes do status ser resetado', () => {
  const indiceFechamentoHistorico = sql.search(/UPDATE\s+historico_status_disponibilidade/i)
  const indiceResetStatus = sql.search(/UPDATE\s+status_disponibilidade\s+sd/i)

  assert.notEqual(indiceFechamentoHistorico, -1, 'deveria fechar o histórico')
  assert.notEqual(indiceResetStatus, -1, 'deveria resetar o status')
  assert.ok(
    indiceFechamentoHistorico < indiceResetStatus,
    'o fechamento do histórico precisa vir antes do reset do status — a ordem inversa infla o Tempo Fábril',
  )
})

test('@spec:AC-006 o reset do status depende do resultado do fechamento (mesmo statement/CTE)', () => {
  assert.match(sql, /WITH\s+fechados\s+AS\s*\(/i)
  assert.match(sql, /RETURNING\s+profissional_id/i)
  assert.match(sql, /FROM\s+fechados\s+f/i)
})

test('@spec:AC-019 destrava também quem não tem bloco aberto no histórico', () => {
  // A rede de segurança olha só o estado ao vivo — sem JOIN/CTE com o histórico.
  //
  // Aqui basta UMA ocorrência, dentro do cron. A migration de 1h precisava de
  // duas (uma recorrente e uma imediata) porque havia gente presa há dias e o
  // teto estava APERTANDO. Agora o teto afrouxa: ninguém fica em estado
  // inconsistente esperando, o próximo ciclo do cron já aplica o prazo novo.
  assert.match(
    sql,
    /UPDATE\s+status_disponibilidade\s+sd\s+SET[\s\S]*?WHERE\s+sd\.status\s+NOT IN \('disponivel', 'ausente', 'ocupado'\)\s*AND\s+sd\.atualizado_em\s*<\s*NOW\(\) - INTERVAL '2 hours'/i,
  )
})

test('@spec:AC-019 a rede de segurança não depende do CTE de fechamento', () => {
  const posCte = sql.slice(sql.search(/FROM\s+fechados\s+f/i))
  assert.match(
    posCte,
    /WHERE\s+sd\.status\s+NOT IN \('disponivel', 'ausente', 'ocupado'\)/i,
    'o destravamento por estado ao vivo precisa vir depois do reset acoplado ao CTE',
  )
})
