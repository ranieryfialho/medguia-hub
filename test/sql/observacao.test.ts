import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// @spec-note: asserção estática sobre o texto da migration (ASM-002) — não
// prova comportamento do Postgres, garante forma e ordem.
const migrationPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'database',
  'status_personalizados_observacao_migration.sql',
)
const sql = readFileSync(migrationPath, 'utf-8')

test('@spec:AC-003 status_disponibilidade e historico_status_disponibilidade ganham a coluna observacao', () => {
  assert.match(
    sql,
    /ALTER TABLE status_disponibilidade\s+ADD COLUMN IF NOT EXISTS observacao TEXT/,
  )
  assert.match(
    sql,
    /ALTER TABLE historico_status_disponibilidade\s+ADD COLUMN IF NOT EXISTS observacao TEXT/,
  )
})

test('@spec:AC-003 status_disponibilidade_opcoes ganha observacao_obrigatoria', () => {
  assert.match(
    sql,
    /ALTER TABLE status_disponibilidade_opcoes\s+ADD COLUMN IF NOT EXISTS observacao_obrigatoria BOOLEAN NOT NULL DEFAULT false/,
  )
})

test('@spec:AC-003 o INSERT que abre o bloco no histórico grava a observação', () => {
  const insertMatch = sql.match(
    /INSERT INTO historico_status_disponibilidade \(([^)]+)\)\s*VALUES \(([^;]+)\);/,
  )
  assert.ok(insertMatch, 'deveria existir um INSERT em historico_status_disponibilidade')

  const [, colunas, valores] = insertMatch as unknown as [string, string, string]
  assert.match(colunas, /\bobservacao\b/, 'a lista de colunas do INSERT deveria incluir observacao')
  assert.match(
    valores,
    /NEW\.observacao/,
    'o INSERT deveria gravar NEW.observacao, não um literal fixo',
  )
})

test('@spec:AC-003 a função de log é recriada com CREATE OR REPLACE, preservando o nome existente', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION fn_log_mudanca_status_disponibilidade\(\)/)
})
