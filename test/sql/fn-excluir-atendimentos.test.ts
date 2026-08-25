/**
 * Asserções estáticas sobre o texto da migration de
 * database/fn_excluir_atendimentos_migration.sql (T-035). Não executa
 * Postgres — garante forma e ordem do SQL, não comportamento (mesma técnica
 * de test/sql/agendamentos-auditoria.test.ts e test/sql/fallback-2h.test.ts).
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
  path.join(__dirname, '../../database/fn_excluir_atendimentos_migration.sql'),
  'utf-8',
)

test('@spec:AC-056 usuario_id nulo bloqueia a exclusão', () => {
  assert.match(
    sql,
    /IF p_usuario_id IS NULL THEN\s*\n\s*RAISE EXCEPTION/i,
  )
})

test('@spec:AC-056 usuario_id que não existe em profiles bloqueia a exclusão', () => {
  assert.match(
    sql,
    /NOT EXISTS \(SELECT 1 FROM profiles WHERE id = p_usuario_id\)\s*THEN\s*\n\s*RAISE EXCEPTION/i,
  )
})

test('@spec:AC-056 a validação do operador acontece antes de qualquer leitura de atendimento', () => {
  const idxValidacaoNulo = sql.search(/IF p_usuario_id IS NULL THEN/i)
  const idxValidacaoExiste = sql.search(/NOT EXISTS \(SELECT 1 FROM profiles WHERE id = p_usuario_id\)/i)
  const idxPrimeiraLeituraAtendimentos = sql.search(/FROM atendimentos/i)

  assert.notEqual(idxValidacaoNulo, -1)
  assert.notEqual(idxValidacaoExiste, -1)
  assert.notEqual(idxPrimeiraLeituraAtendimentos, -1)
  assert.ok(idxValidacaoNulo < idxPrimeiraLeituraAtendimentos)
  assert.ok(idxValidacaoExiste < idxPrimeiraLeituraAtendimentos)
})

test('@spec:AC-057 a categoria de motivo precisa existir e estar ativa no catálogo', () => {
  assert.match(
    sql,
    /FROM motivos_exclusao_agendamento\s*\n\s*WHERE slug = p_motivo_categoria AND ativo = true/i,
  )
  assert.match(sql, /IF NOT FOUND THEN\s*\n\s*RAISE EXCEPTION 'Categoria de motivo inválida ou inativa/i)
})

test('@spec:AC-052 qualquer atendimento com status Concluído no escopo bloqueia a operação inteira', () => {
  assert.match(
    sql,
    /WHERE id = ANY\(p_ids\) AND status = 'Concluído'/,
  )
  assert.match(
    sql,
    /IF v_qtd_concluidos > 0 THEN\s*\n\s*RAISE EXCEPTION 'Exclusão recusada/i,
  )
})

test('@spec:AC-049 @spec:AC-050 o bloqueio de Concluído não depende da ação (mesmo caminho para série e lote)', () => {
  // O trecho que conta concluídos e recusa a operação não referencia p_acao —
  // ou seja, vale igual para exclusao_serie_completa (AC-049) e exclusao_lote
  // (AC-050): não existe um "if p_acao = ..." que abra exceção para nenhum
  // escopo.
  const idxInicio = sql.search(/SELECT COUNT\(\*\) INTO v_qtd_concluidos/i)
  const idxFim = sql.search(/Séries afetadas, capturadas/i)
  assert.notEqual(idxInicio, -1)
  assert.notEqual(idxFim, -1)
  const trechoBloqueio = sql.slice(idxInicio, idxFim)
  assert.doesNotMatch(trechoBloqueio, /p_acao/)
})

test('@spec:AC-053 o INSERT do log (snapshot) acontece antes do DELETE dos atendimentos', () => {
  const idxInsert = sql.search(/INSERT INTO agendamentos_auditoria/i)
  const idxDelete = sql.search(/DELETE FROM atendimentos WHERE id = ANY\(p_ids\)/i)

  assert.notEqual(idxInsert, -1)
  assert.notEqual(idxDelete, -1)
  assert.ok(idxInsert < idxDelete, 'o snapshot precisa ser gravado com os dados ainda vivos')
})

test('@spec:AC-053 o snapshot é lido da própria tabela atendimentos antes do delete, não de outra fonte', () => {
  const trechoInsert = sql.slice(
    sql.search(/INSERT INTO agendamentos_auditoria/i),
    sql.search(/DELETE FROM atendimentos WHERE id = ANY\(p_ids\)/i),
  )
  assert.match(trechoInsert, /FROM atendimentos a\s*\n\s*LEFT JOIN pacientes pac ON pac\.id = a\.paciente_id\s*\n\s*LEFT JOIN profiles prof ON prof\.id = a\.profissional_id\s*\n\s*WHERE a\.id = ANY\(p_ids\)/i)
})

test('@spec:AC-053 o snapshot contém data/hora, status, tipo, número e total de sessões', () => {
  const trechoSnapshot = sql.slice(
    sql.search(/jsonb_build_object\(/i),
    sql.search(/FROM atendimentos a\s*\n\s*LEFT JOIN pacientes/i),
  )

  for (const campo of ['data_agendamento', 'status', 'tipo', 'numero_sessao', 'total_sessoes']) {
    assert.match(trechoSnapshot, new RegExp(`'${campo}'`), `snapshot deveria conter o campo ${campo}`)
  }
})

test('@spec:AC-047 o snapshot guarda numero_sessao e total_sessoes, o que permite distinguir reposição de perda', () => {
  assert.match(sql, /'numero_sessao',\s*a\.numero_sessao/)
  assert.match(sql, /'total_sessoes',\s*a\.total_sessoes/)
})

test('@spec:AC-046 @spec:AC-051 o log é gravado com a ação recebida por parâmetro, não fixa por escopo', () => {
  // A mesma função serve aos 4 escopos (avulso → exclusao_avulso, lote →
  // exclusao_lote etc.) porque grava p_acao tal como recebido — quem decide
  // qual ação é essa continua em TypeScript (design.md).
  const colunas = sql.slice(
    sql.search(/INSERT INTO agendamentos_auditoria \(/i),
    sql.search(/\)\s*\n\s*SELECT/i),
  )
  assert.match(colunas, /\bacao\b/)
  assert.match(colunas, /\busuario_id\b/)
  assert.match(colunas, /\bmotivo_categoria\b/)
  assert.match(colunas, /\bdados_agendamento\b/)

  const valores = sql.slice(
    sql.search(/\)\s*\n\s*SELECT/i),
    sql.search(/FROM atendimentos a/i),
  )
  assert.match(valores, /p_acao/)
})

test('@spec:AC-046 @spec:AC-048 @spec:AC-051 o DELETE remove exatamente os ids do escopo recebido', () => {
  assert.match(sql, /DELETE FROM atendimentos WHERE id = ANY\(p_ids\)/i)
})

test('@spec:AC-048 a linha órfã em agendamentos é removida quando a série fica sem nenhum atendimento', () => {
  assert.match(
    sql,
    /IF NOT EXISTS \(SELECT 1 FROM atendimentos WHERE agendamento_id = v_agendamento_id\) THEN\s*\n\s*DELETE FROM agendamentos WHERE id = v_agendamento_id/i,
  )
})

test('@spec:AC-048 a checagem de série órfã acontece depois do DELETE dos atendimentos', () => {
  const idxDelete = sql.search(/DELETE FROM atendimentos WHERE id = ANY\(p_ids\)/i)
  const idxLimpezaOrfa = sql.search(/DELETE FROM agendamentos WHERE id = v_agendamento_id/i)

  assert.notEqual(idxDelete, -1)
  assert.notEqual(idxLimpezaOrfa, -1)
  assert.ok(idxDelete < idxLimpezaOrfa)
})

test('@spec:AC-054 a função não tem bloco EXCEPTION que capture e engula RAISE — falha desfaz tudo', () => {
  // Sem um "EXCEPTION WHEN ... THEN" no corpo, qualquer RAISE não tratado
  // aborta a transação inteira (INSERT já feito incluso) — é o que dá a
  // atomicidade tudo-ou-nada exigida pelo AC.
  assert.doesNotMatch(sql, /EXCEPTION\s+WHEN/i)
})

test('@spec:AC-054 a validação de Concluído acontece antes do INSERT do log — nada é logado parcialmente', () => {
  const idxBloqueioConcluido = sql.search(/IF v_qtd_concluidos > 0 THEN/i)
  const idxInsert = sql.search(/INSERT INTO agendamentos_auditoria/i)

  assert.notEqual(idxBloqueioConcluido, -1)
  assert.notEqual(idxInsert, -1)
  assert.ok(idxBloqueioConcluido < idxInsert)
})

test('a função é SECURITY DEFINER com search_path fixo (mitigação obrigatória, TDD 003)', () => {
  assert.match(sql, /SECURITY DEFINER\s*\nSET search_path = public, pg_temp/i)
})

test('EXECUTE não fica aberto a PUBLIC/anon — só service_role e authenticated', () => {
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION fn_excluir_atendimentos\([^)]*\) FROM PUBLIC/i,
  )
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION fn_excluir_atendimentos\([^)]*\) TO service_role, authenticated/i,
  )
  assert.doesNotMatch(sql, /TO\s+anon/i)
})

test('a função retorna a contagem de excluídos e se a série foi removida', () => {
  assert.match(sql, /RETURNS TABLE \(excluidos INT, serie_removida BOOLEAN\)/i)
  assert.match(sql, /RETURN QUERY SELECT v_qtd_excluidos, v_serie_removida/i)
})
