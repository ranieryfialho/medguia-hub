import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// Asserção estática sobre o texto da migration — não prova comportamento do
// Postgres (ASM-002). Sem Docker/psql neste ambiente.
const migrationPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../database/status_operacionais_contrato_migration.sql',
)
const sql = readFileSync(migrationPath, 'utf8')
const sqlLower = sql.toLowerCase()

test('@spec:AC-013 renomeia o rótulo de "ocupado" sem alterar o identificador', () => {
  assert.match(
    sql,
    /UPDATE\s+status_disponibilidade_opcoes[\s\S]*?SET[\s\S]*?label\s*=\s*'Em atendimento'[\s\S]*?WHERE\s+slug\s*=\s*'ocupado'/i,
    'a migration deve trocar o rótulo de "ocupado" para "Em atendimento" mantendo o identificador no WHERE',
  )

  assert.match(
    sql,
    /UPDATE\s+status_disponibilidade_opcoes[\s\S]*?SET[\s\S]*?sistema\s*=\s*true[\s\S]*?WHERE\s+slug\s*=\s*'ocupado'/i,
    'a migration deve reclassificar "ocupado" como status de sistema',
  )

  // O identificador 'ocupado' não pode ser reatribuído: ele está fixo em
  // quatro pontos do sistema sem integridade referencial entre si.
  assert.ok(
    !/SET[\s\S]*?slug\s*=\s*'(?!ocupado')[a-z_]+'[\s\S]*?WHERE\s+slug\s*=\s*'ocupado'/i.test(sql),
    'o identificador "ocupado" não pode ser reatribuído para outro slug',
  )
  assert.ok(
    sqlLower.includes("slug = 'ocupado'"),
    'a migration deve localizar a opção pelo identificador "ocupado"',
  )
})

test('@spec:AC-018 remove o gatilho legado e as funções órfãs, gatilho antes das funções', () => {
  const idxTrigger = sqlLower.indexOf('drop trigger if exists trg_concluir_atendimento')
  const idxFnTrigger = sqlLower.indexOf('drop function if exists public.fn_trigger_concluir_atendimento')
  const idxFnAtualizar = sqlLower.indexOf('drop function if exists public.fn_atualizar_status_em_atendimento')

  assert.notEqual(idxTrigger, -1, 'a migration deve remover o gatilho trg_concluir_atendimento')
  assert.notEqual(idxFnTrigger, -1, 'a migration deve remover a função fn_trigger_concluir_atendimento')
  assert.notEqual(idxFnAtualizar, -1, 'a migration deve remover a função órfã fn_atualizar_status_em_atendimento')

  assert.match(
    sql,
    /drop trigger if exists trg_concluir_atendimento on public\.atendimentos/i,
    'o gatilho deve ser removido da tabela atendimentos',
  )

  assert.ok(
    idxTrigger < idxFnTrigger,
    'o gatilho deve ser removido antes da função que ele executa',
  )
  assert.ok(
    idxTrigger < idxFnAtualizar,
    'o gatilho deve ser removido antes das funções órfãs',
  )
})
