/**
 * Asserções estáticas sobre o texto da migration de profissional inativo
 * (ASM-002). Não executa Postgres — garante forma e ordem do SQL, não
 * comportamento. Ver .spec/features/status-personalizados-ciclo-vida/spec.md
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sql = readFileSync(
  path.join(__dirname, '../../database/profissional_inativo_migration.sql'),
  'utf-8',
)
const sqlLower = sql.toLowerCase()

test('@spec:AC-017 o gatilho de inativação existe na tabela profiles', () => {
  assert.match(sql, /DROP TRIGGER IF EXISTS trg_profiles_inativar ON public\.profiles/i)
  assert.match(
    sql,
    /CREATE TRIGGER trg_profiles_inativar[\s\S]*?ON public\.profiles[\s\S]*?EXECUTE FUNCTION fn_inativar_profissional/i,
  )
})

test('@spec:AC-017 ao inativar, a migration grava a data de desligamento', () => {
  assert.match(sql, /ADD COLUMN IF NOT EXISTS inativado_em TIMESTAMPTZ/i)
  assert.match(sql, /NEW\.inativado_em\s*:=\s*NOW\(\)/i)
})

test('@spec:AC-017 ao inativar, a migration fecha o bloco aberto no histórico', () => {
  assert.match(
    sql,
    /UPDATE\s+historico_status_disponibilidade[\s\S]*?SET\s+fim\s*=\s*NOW\(\)[\s\S]*?WHERE\s+profissional_id\s*=\s*NEW\.id[\s\S]*?AND\s+fim IS NULL/i,
  )
})

test('@spec:AC-017 ao inativar, a migration remove a linha de estado ao vivo', () => {
  assert.match(
    sql,
    /DELETE FROM status_disponibilidade[\s\S]*?WHERE profissional_id\s*=\s*NEW\.id/i,
  )
})

test('@spec:AC-017 o histórico é fechado antes da linha de estado ao vivo ser removida', () => {
  const idxHistorico = sql.search(/UPDATE\s+historico_status_disponibilidade/i)
  const idxDelete = sql.search(/DELETE FROM status_disponibilidade/i)

  assert.notEqual(idxHistorico, -1, 'deveria fechar o bloco do histórico')
  assert.notEqual(idxDelete, -1, 'deveria remover a linha de estado ao vivo')
  assert.ok(
    idxHistorico < idxDelete,
    'o fechamento do histórico precisa vir antes da remoção da linha de estado ao vivo, para não deixar o bloco aberto para sempre',
  )
})

test('@spec:AC-017 o histórico não é apagado — só a linha de estado ao vivo', () => {
  assert.ok(
    !/DELETE FROM historico_status_disponibilidade/i.test(sql),
    'o histórico precisa ser preservado, apenas fechado',
  )
})

test('@spec:AC-017 o gatilho só age na transição de ativo para inativo', () => {
  assert.match(sql, /IF\s+NEW\.ativo\s*=\s*false\s+AND\s+OLD\.ativo\s*=\s*true\s+THEN/i)
})

test('ativo é normalizado e torna-se obrigatório (ASM-004)', () => {
  assert.match(sql, /UPDATE profiles[\s\S]*?SET\s+ativo\s*=\s*true[\s\S]*?WHERE\s+ativo IS NULL/i)
  assert.match(sql, /ALTER TABLE profiles[\s\S]*?ALTER COLUMN ativo SET NOT NULL/i)
})
