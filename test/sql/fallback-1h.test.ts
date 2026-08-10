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

test('@spec:AC-019 destrava também quem não tem bloco aberto no histórico', () => {
  // A rede de segurança olha só o estado ao vivo — sem JOIN/CTE com o histórico.
  const redeDeSeguranca =
    /UPDATE\s+status_disponibilidade\s+sd\s+SET[\s\S]*?WHERE\s+sd\.status\s+NOT IN \('disponivel', 'ausente', 'ocupado'\)\s*AND\s+sd\.atualizado_em\s*<\s*NOW\(\) - INTERVAL '1 hour'/i

  const ocorrencias = sql.match(new RegExp(redeDeSeguranca, 'gi')) ?? []

  assert.ok(
    ocorrencias.length >= 2,
    'precisa existir dentro do cron (recorrente) e uma vez na migration (destrava os presos agora)',
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

test('@spec:AC-006 o reset do status depende do resultado do fechamento (mesma transação/CTE)', () => {
  assert.match(sql, /WITH\s+fechados\s+AS\s*\(/i)
  assert.match(sql, /RETURNING\s+profissional_id/i)
  assert.match(sql, /FROM\s+fechados\s+f/i)
})
