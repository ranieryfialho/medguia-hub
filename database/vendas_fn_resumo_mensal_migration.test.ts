import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Não há harness de banco de dados real neste repositório para migrations
// (mesmo espírito de database/vendas_venda_em_consultorio_migration.test.ts).
// A prova aqui é de inspeção estrutural do SQL: confirma que a função
// implementa as regras de "venda contável" descritas nos ACs, no mesmo
// espírito de AC-070 ("quando a migration é inspecionada").
const __dirname = dirname(fileURLToPath(import.meta.url))
const sql = readFileSync(join(__dirname, 'vendas_fn_resumo_mensal_migration.sql'), 'utf-8')

test('@spec:AC-065 função existe com todos os parâmetros de filtro e colunas de retorno documentadas', () => {
  assert.match(
    sql,
    /CREATE OR REPLACE FUNCTION public\.fn_vendas_resumo_mensal\(/,
    'fn_vendas_resumo_mensal deve existir'
  )

  for (const parametro of [
    'p_data_inicio date',
    'p_data_fim date',
    'p_profissional_id uuid DEFAULT NULL',
    'p_medico_id uuid DEFAULT NULL',
    'p_origem text DEFAULT NULL',
    'p_categoria text DEFAULT NULL',
    'p_modalidade text DEFAULT NULL',
  ]) {
    assert.ok(sql.includes(parametro), `parâmetro ausente: ${parametro}`)
  }

  for (const coluna of [
    'faturamento numeric',
    'qtd_vendas integer',
    'ticket_medio numeric',
    'faturamento_consultorio numeric',
    'qtd_consultorio integer',
    'faturamento_fisio numeric',
    'qtd_fisio integer',
    'qtd_nao_classificada integer',
    'qtd_orcamento_pendente integer',
    'qtd_orcamento_recusado integer',
    'top_produto text',
    'top_profissional text',
  ]) {
    assert.ok(sql.includes(coluna), `coluna de retorno ausente: ${coluna}`)
  }

  assert.match(
    sql,
    /WHERE vf\.status = 'venda_confirmada'/,
    'faturamento/qtd_vendas devem considerar apenas status = venda_confirmada'
  )
})

test('@spec:AC-066 venda confirmada sem itens soma 0 ao faturamento e 1 a qtd_vendas', () => {
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

test('@spec:AC-067 mês sem vendas aparece com zeros e ticket médio nunca quebra por divisão por zero', () => {
  assert.match(
    sql,
    /generate_series\(\s*date_trunc\('month', p_data_inicio\),\s*date_trunc\('month', p_data_fim\),\s*interval '1 month'\s*\)/,
    'a série de meses deve cobrir todo o período, independente de haver venda'
  )
  assert.match(sql, /FROM meses m\s*\n\s*LEFT JOIN resumo_mes rm ON rm\.mes = m\.mes/, 'meses sem venda devem aparecer via LEFT JOIN a partir da série de meses')
  assert.match(
    sql,
    /CASE\s*\n\s*WHEN COALESCE\(rm\.qtd_vendas, 0\) = 0 THEN 0\s*\n\s*ELSE ROUND\(rm\.faturamento \/ rm\.qtd_vendas, 2\)\s*\n\s*END AS ticket_medio/,
    'ticket_medio deve ser 0 (não erro de divisão por zero) quando não há vendas no mês'
  )
})

test('@spec:AC-068 orçamentos pendente/recusado ficam fora de faturamento e qtd_vendas', () => {
  assert.match(
    sql,
    /vendas_confirmadas AS \(\s*\n\s*SELECT[\s\S]*?WHERE vf\.status = 'venda_confirmada'\s*\n\s*\)/,
    'a CTE que alimenta faturamento/qtd_vendas deve filtrar exclusivamente venda_confirmada'
  )
  assert.match(
    sql,
    /orcamentos_mes AS \([\s\S]*?COUNT\(\*\) FILTER \(WHERE vf\.status = 'orcamento_pendente'\) AS qtd_orcamento_pendente[\s\S]*?COUNT\(\*\) FILTER \(WHERE vf\.status = 'orcamento_recusado'\) AS qtd_orcamento_recusado/,
    'orçamentos devem ser contados separadamente, sem entrar em faturamento/qtd_vendas'
  )
})

test('@spec:AC-070 função é SECURITY DEFINER com search_path fixo', () => {
  assert.match(sql, /SECURITY DEFINER\s*\n\s*SET search_path = public, pg_temp/, 'função deve declarar SECURITY DEFINER com search_path fixo')
})
