/**
 * Asserções estáticas sobre o texto da migration de fallback (ASM-002).
 * Não executa Postgres — garante forma e ordem do SQL, não comportamento.
 * Ver .spec/features/status-personalizados-ciclo-vida/spec.md
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sql = readFileSync(
  path.join(__dirname, '../../database/status_personalizados_fallback_1h_migration.sql'),
  'utf-8',
)

test('@spec:AC-004 o teto do bloco passa a ser de 1 hora, não mais 2', () => {
  assert.match(sql, /INTERVAL '1 hour'/)
  assert.doesNotMatch(sql, /INTERVAL '2 hours?'/)
})

test('@spec:AC-005 o job devolve status_disponibilidade para disponivel com origem fallback', () => {
  assert.match(sql, /UPDATE\s+status_disponibilidade/i)
  assert.match(sql, /status\s*=\s*'disponivel'/)
  assert.match(sql, /origem\s*=\s*'fallback'/)
})

test("@spec:AC-005 'fallback' passa a ser um valor aceito para origem", () => {
  assert.match(sql, /CHECK\s*\(origem IN \('manual', 'automatico', 'fallback'\)\)/)
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

test('@spec:AC-006 o reset do status depende do resultado do fechamento (mesma transação/CTE)', () => {
  assert.match(sql, /WITH\s+fechados\s+AS\s*\(/i)
  assert.match(sql, /RETURNING\s+profissional_id/i)
  assert.match(sql, /FROM\s+fechados\s+f/i)
})
