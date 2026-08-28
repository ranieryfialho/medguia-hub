import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Não há harness de banco de dados real neste repositório para migrations
// (mesmo espírito de database/vendas_fn_resumo_mensal_migration.test.ts).
// A prova aqui é de inspeção estrutural do SQL: confirma que a função de
// drill-down reaproveita a regra de venda contável e expõe as quebras
// exigidas por AC-069, no mesmo espírito de AC-070 ("quando a migration é
// inspecionada").
const __dirname = dirname(fileURLToPath(import.meta.url))
const sql = readFileSync(join(__dirname, 'vendas_fn_detalhe_mes_migration.sql'), 'utf-8')

test('@spec:AC-069 função existe com os mesmos filtros de fn_vendas_resumo_mensal trocando o período por p_mes', () => {
  assert.match(
    sql,
    /CREATE OR REPLACE FUNCTION public\.fn_vendas_detalhe_mes\(/,
    'fn_vendas_detalhe_mes deve existir'
  )

  for (const parametro of [
    'p_mes date',
    'p_profissional_id uuid DEFAULT NULL',
    'p_medico_id uuid DEFAULT NULL',
    'p_origem text DEFAULT NULL',
    'p_categoria text DEFAULT NULL',
    'p_modalidade text DEFAULT NULL',
  ]) {
    assert.ok(sql.includes(parametro), `parâmetro ausente: ${parametro}`)
  }

  assert.ok(!sql.includes('p_data_inicio'), 'drill-down deve receber p_mes, não um intervalo de datas')

  assert.match(
    sql,
    /WHERE \(v\.data_venda AT TIME ZONE 'America\/Sao_Paulo'\)::date BETWEEN v_data_inicio AND v_data_fim/,
    'o mês deve ser resolvido para o intervalo do primeiro ao último dia'
  )

  assert.match(
    sql,
    /AND v\.status = 'venda_confirmada'/,
    'apenas vendas com status = venda_confirmada entram nas agregações do drill-down'
  )
})

test('@spec:AC-069 retorna quebra por origem, quebra por categoria, ranking de médicos e ranking de fisioterapeutas', () => {
  for (const coluna of ['quebra_origem jsonb', 'quebra_categoria jsonb', 'ranking_medicos jsonb', 'ranking_fisios jsonb']) {
    assert.ok(sql.includes(coluna), `coluna de retorno ausente: ${coluna}`)
  }

  assert.match(sql, /origem_agg AS \(/, 'deve existir agregação por origem')
  assert.match(sql, /categoria_agg AS \(/, 'deve existir agregação por categoria')
  assert.match(sql, /medicos_agg AS \(/, 'deve existir ranking de médicos referenciadores')
  assert.match(sql, /fisios_agg AS \(/, 'deve existir ranking de fisioterapeutas')

  assert.match(
    sql,
    /WHERE vc\.profissional_id IS NOT NULL\s*\n\s*AND vc\.venda_em_consultorio = false/,
    'ranking de fisioterapeutas deve considerar apenas conversões (venda_em_consultorio = false)'
  )
})

test('@spec:AC-069 venda confirmada sem itens não é descartada das agregações do drill-down (mesma regra de AC-066)', () => {
  assert.match(
    sql,
    /LEFT JOIN totais_por_venda tv ON tv\.venda_id = vf\.id/,
    'join com os totais de itens deve ser LEFT JOIN — venda sem itens não pode sumir da agregação'
  )
  assert.match(
    sql,
    /COALESCE\(tv\.total, 0\) AS total_venda/,
    'venda sem itens deve contar total 0, não ser descartada'
  )
})

test('@spec:AC-070 função é SECURITY DEFINER com search_path fixo', () => {
  assert.match(sql, /SECURITY DEFINER\s*\n\s*SET search_path = public, pg_temp/, 'função deve declarar SECURITY DEFINER com search_path fixo')
})
