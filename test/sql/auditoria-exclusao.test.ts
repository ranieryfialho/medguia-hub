/**
 * Asserções estáticas cruzando database/agendamentos_auditoria_migration.sql
 * (T-033) e database/fn_excluir_atendimentos_migration.sql (T-035): forma e
 * ordem do SQL, não comportamento — não executa Postgres (mesma técnica de
 * test/sql/agendamentos-auditoria.test.ts e test/sql/fn-excluir-atendimentos.test.ts).
 *
 * Ver .spec/features/auditoria-exclusao-agendamentos/spec.md
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const sqlAuditoria = readFileSync(
  path.join(__dirname, '../../database/agendamentos_auditoria_migration.sql'),
  'utf-8',
)
const sqlFuncao = readFileSync(
  path.join(__dirname, '../../database/fn_excluir_atendimentos_migration.sql'),
  'utf-8',
)

test('@spec:AC-053 a tabela de auditoria não tem REFERENCES para atendimentos, pacientes ou profiles', () => {
  const trechoTabela = sqlAuditoria.slice(
    sqlAuditoria.search(/CREATE TABLE IF NOT EXISTS agendamentos_auditoria/i),
    sqlAuditoria.search(/\);/),
  )
  assert.notEqual(trechoTabela.length, -1)
  assert.doesNotMatch(trechoTabela, /REFERENCES/i)
})

test('@spec:AC-053 o snapshot gravado pela função contém data/hora, status, tipo, número e total de sessões', () => {
  const trechoSnapshot = sqlFuncao.slice(
    sqlFuncao.search(/jsonb_build_object\(/i),
    sqlFuncao.search(/FROM atendimentos a\s*\n\s*LEFT JOIN pacientes/i),
  )
  for (const campo of ['data_agendamento', 'status', 'tipo', 'numero_sessao', 'total_sessoes']) {
    assert.match(trechoSnapshot, new RegExp(`'${campo}'`), `snapshot deveria conter o campo ${campo}`)
  }
})

test('@spec:AC-053 o INSERT do log acontece antes do DELETE dos atendimentos, na mesma função', () => {
  const idxInsert = sqlFuncao.search(/INSERT INTO agendamentos_auditoria/i)
  const idxDelete = sqlFuncao.search(/DELETE FROM atendimentos WHERE id = ANY\(p_ids\)/i)

  assert.notEqual(idxInsert, -1)
  assert.notEqual(idxDelete, -1)
  assert.ok(idxInsert < idxDelete, 'o snapshot precisa ser lido e gravado antes de os dados serem apagados')
})

test('@spec:AC-054 a função não tem bloco EXCEPTION que capture RAISE — qualquer falha desfaz log e delete juntos', () => {
  // Sem "EXCEPTION WHEN" no corpo, um RAISE em qualquer validação aborta a
  // transação inteira (mesmo que o INSERT do log já tenha sido executado
  // antes do RAISE), cumprindo o "tudo ou nada" do AC-054.
  assert.doesNotMatch(sqlFuncao, /EXCEPTION\s+WHEN/i)
})

test('@spec:AC-054 a validação de bloqueio de Concluído acontece antes do INSERT do log e do DELETE', () => {
  const idxBloqueioConcluido = sqlFuncao.search(/IF v_qtd_concluidos > 0 THEN/i)
  const idxInsert = sqlFuncao.search(/INSERT INTO agendamentos_auditoria/i)
  const idxDelete = sqlFuncao.search(/DELETE FROM atendimentos WHERE id = ANY\(p_ids\)/i)

  assert.notEqual(idxBloqueioConcluido, -1)
  assert.notEqual(idxInsert, -1)
  assert.notEqual(idxDelete, -1)
  assert.ok(idxBloqueioConcluido < idxInsert)
  assert.ok(idxBloqueioConcluido < idxDelete)
})

test('@spec:AC-054 a função inteira roda dentro de um único corpo (nenhum COMMIT/ROLLBACK manual quebrando a transação implícita)', () => {
  assert.doesNotMatch(sqlFuncao, /\bCOMMIT\b/i)
  assert.doesNotMatch(sqlFuncao, /\bROLLBACK\b/i)
})

test('@spec:AC-055 existe um trigger BEFORE UPDATE OR DELETE na tabela de auditoria que recusa a alteração', () => {
  assert.match(
    sqlAuditoria,
    /CREATE TRIGGER trg_auditoria_append_only\s+BEFORE UPDATE OR DELETE ON agendamentos_auditoria/i,
  )
  assert.match(sqlAuditoria, /RAISE EXCEPTION/i)
})

test('@spec:AC-055 nenhuma política de RLS libera UPDATE ou DELETE para authenticated ou service_role', () => {
  assert.doesNotMatch(sqlAuditoria, /FOR (UPDATE|DELETE) TO (authenticated|service_role)/i)
  assert.doesNotMatch(sqlAuditoria, /TO service_role/i)
})

test('@spec:AC-055 o trigger de append-only está associado à função de bloqueio na mesma migration', () => {
  const idxFuncao = sqlAuditoria.search(/CREATE (OR REPLACE )?FUNCTION fn_agendamentos_auditoria_bloquear_alteracao/i)
  const idxTrigger = sqlAuditoria.search(/CREATE TRIGGER trg_auditoria_append_only/i)

  assert.notEqual(idxFuncao, -1, 'precisa existir a função de bloqueio referenciada pelo trigger')
  assert.notEqual(idxTrigger, -1)
  assert.ok(idxFuncao < idxTrigger, 'a função precisa existir antes do trigger que a referencia')
})

test('a função fn_excluir_atendimentos é SECURITY DEFINER com search_path fixo (mitigação obrigatória, TDD 003)', () => {
  assert.match(sqlFuncao, /SECURITY DEFINER\s*\nSET search_path = public, pg_temp/i)
})
