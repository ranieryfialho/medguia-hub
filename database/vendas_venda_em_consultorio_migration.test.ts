import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Não há harness de banco de dados real neste repositório para migrations
// (nenhum arquivo database/vendas_*_migration.sql tem teste hoje). A prova
// aqui é de inspeção estrutural do SQL, no mesmo espírito de AC-070
// ("quando a migration é inspecionada").
const __dirname = dirname(fileURLToPath(import.meta.url))
const sql = readFileSync(join(__dirname, 'vendas_venda_em_consultorio_migration.sql'), 'utf-8')

test('@spec:AC-063 coluna venda_em_consultorio é gravável e o CHECK só permite valor não nulo com origem = medico', () => {
  assert.match(
    sql,
    /ADD COLUMN IF NOT EXISTS venda_em_consultorio BOOLEAN NULL/,
    'coluna venda_em_consultorio deve existir como BOOLEAN nullable'
  )

  assert.match(
    sql,
    /ADD CONSTRAINT vendas_consultorio_apenas_origem_medico\s*\n?\s*CHECK \(venda_em_consultorio IS NULL OR origem = 'medico'\)/,
    'CHECK deve rejeitar venda_em_consultorio não nulo quando origem for diferente de medico'
  )
})

test('@spec:AC-064 coluna não tem DEFAULT, então vendas legadas e não-médicas ficam NULL (não classificadas)', () => {
  const colunaMatch = sql.match(/ADD COLUMN IF NOT EXISTS venda_em_consultorio[^\n;]*/)
  assert.ok(colunaMatch, 'definição da coluna venda_em_consultorio deve existir')

  const definicaoColuna = colunaMatch![0]
  assert.doesNotMatch(
    definicaoColuna,
    /DEFAULT/i,
    'coluna não pode ter DEFAULT — vendas existentes e novas de origem não-médica devem ficar NULL, nunca false'
  )
  assert.match(definicaoColuna, /NULL\b/, 'coluna deve ser explicitamente nullable')
})

test('@spec:AC-064 migration é aditiva e idempotente (IF NOT EXISTS / DROP CONSTRAINT IF EXISTS)', () => {
  assert.match(sql, /ALTER TABLE vendas\s*\n\s*ADD COLUMN IF NOT EXISTS venda_em_consultorio/)
  assert.match(sql, /DROP CONSTRAINT IF EXISTS vendas_consultorio_apenas_origem_medico/)
  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_vendas_data_status/)
  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_vendas_medico_ref_nome/)
})
