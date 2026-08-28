/**
 * AC-086 — /relatorios/vendas-historicas usa o mesmo guard de acesso de
 * /relatorios/vendas ('comercial:relatorio_vendas'), nunca mais permissivo.
 *
 * O projeto não tem runner de componente Server Component nem mock de
 * Supabase para exercitar requireModulo() de ponta a ponta em teste
 * automatizado — mesma limitação já documentada para outras rotas do
 * projeto. A prova aqui é estática: confirma que a página nova e a Server
 * Action de drill-down chamam requireModulo com a mesma chave que a rota
 * de referência, e que nenhuma delas usa uma chave diferente ou pula o
 * guard. Regressão real (rota acessível sem permissão) seria pega no
 * roteiro de validação manual em produção, listado no TDD 004.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

function lerFonte(caminhoRelativo: string) {
  return readFileSync(join(__dirname, caminhoRelativo), 'utf8')
}

test('@spec:AC-086 /relatorios/vendas usa requireModulo(\'comercial:relatorio_vendas\')', () => {
  const fonteReferencia = lerFonte('../vendas/page.tsx')
  assert.match(fonteReferencia, /requireModulo\('comercial:relatorio_vendas'\)/)
})

test('@spec:AC-086 /relatorios/vendas-historicas usa o mesmo guard da rota de referência', () => {
  const fonteHistorico = lerFonte('./page.tsx')
  assert.match(fonteHistorico, /requireModulo\('comercial:relatorio_vendas'\)/)
})

test('@spec:AC-086 a Server Action de drill-down (buscarDrillDownMes) também exige o guard', () => {
  const fonteAction = lerFonte('../../../../actions/vendas-historicas.ts')
  assert.match(fonteAction, /requireModulo\('comercial:relatorio_vendas'\)/)
})

test('@spec:AC-086 nenhuma das duas rotas usa uma chave de módulo diferente da referência', () => {
  const fonteHistorico = lerFonte('./page.tsx')
  const chamadasRequireModulo = [...fonteHistorico.matchAll(/requireModulo\('([^']+)'\)/g)].map((m) => m[1])
  assert.deepEqual(chamadasRequireModulo, ['comercial:relatorio_vendas'])
})
