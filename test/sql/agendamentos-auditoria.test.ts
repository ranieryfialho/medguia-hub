/**
 * Asserções estáticas sobre o texto da migration de
 * database/agendamentos_auditoria_migration.sql (T-033). Não executa
 * Postgres — garante forma, não comportamento.
 *
 * Ver .spec/features/auditoria-exclusao-agendamentos/spec.md
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sql = readFileSync(
  path.join(__dirname, '../../database/agendamentos_auditoria_migration.sql'),
  'utf-8',
)

test('@spec:AC-053 a tabela guarda um snapshot JSONB obrigatório do atendimento', () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS agendamentos_auditoria/i)
  assert.match(sql, /dados_agendamento\s+JSONB\s+NOT NULL/i)
})

test('@spec:AC-053 a tabela não tem REFERENCES para atendimentos, pacientes ou profiles', () => {
  // Restrição deliberada (design.md): o log precisa sobreviver mesmo que o
  // atendimento, o paciente ou o profissional original sejam removidos depois.
  const trechoTabela = sql.slice(
    sql.search(/CREATE TABLE IF NOT EXISTS agendamentos_auditoria/i),
    sql.search(/\);/),
  )

  assert.doesNotMatch(trechoTabela, /REFERENCES/i)
})

test('@spec:AC-055 existe um trigger BEFORE UPDATE OR DELETE que recusa a alteração', () => {
  assert.match(
    sql,
    /CREATE TRIGGER trg_auditoria_append_only\s+BEFORE UPDATE OR DELETE ON agendamentos_auditoria/i,
  )
  assert.match(sql, /RAISE EXCEPTION/i)
})

test('@spec:AC-055 nenhuma política de RLS libera INSERT, UPDATE ou DELETE para authenticated', () => {
  assert.doesNotMatch(sql, /FOR (INSERT|UPDATE|DELETE) TO authenticated/i)
})

test('@spec:AC-055 não há política que dê acesso irrestrito ao service_role', () => {
  // O trigger precisa valer para TODO OP, inclusive vindo da chave de
  // service role — uma policy "FOR ALL TO service_role USING (true)" não
  // bypassaria o trigger, mas sua ausência aqui documenta que não existe
  // atalho de escrita fora de fn_excluir_atendimentos.
  assert.doesNotMatch(sql, /TO service_role/i)
})

test('@spec:AC-058 existe índice por paciente em ordem cronológica decrescente', () => {
  assert.match(
    sql,
    /CREATE INDEX IF NOT EXISTS agendamentos_auditoria_paciente_criado_em_idx\s+ON agendamentos_auditoria \(paciente_id, criado_em DESC\)/i,
  )
})

test('@spec:AC-058 RLS de SELECT é liberada para qualquer usuário autenticado (ASM-012)', () => {
  assert.match(
    sql,
    /CREATE POLICY[^;]*FOR SELECT TO authenticated USING \(true\)/i,
  )
})

test('a tabela é criada e o RLS é habilitado antes da policy de SELECT', () => {
  const idxCreateTable = sql.search(/CREATE TABLE IF NOT EXISTS agendamentos_auditoria/i)
  const idxEnableRls = sql.search(/ALTER TABLE agendamentos_auditoria ENABLE ROW LEVEL SECURITY/i)
  const idxPolicy = sql.search(/CREATE POLICY/i)

  assert.notEqual(idxCreateTable, -1)
  assert.notEqual(idxEnableRls, -1)
  assert.notEqual(idxPolicy, -1)
  assert.ok(idxCreateTable < idxEnableRls)
  assert.ok(idxEnableRls < idxPolicy)
})
