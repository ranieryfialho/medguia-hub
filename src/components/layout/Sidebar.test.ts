/**
 * AC-085 — link para /relatorios/vendas-historicas no Sidebar, ao lado do
 * link existente para /relatorios/vendas.
 *
 * Sem runner de componente no projeto (mesma limitação documentada em
 * outras features) — prova estática sobre o código-fonte do Sidebar.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fonte = readFileSync(join(__dirname, './Sidebar.tsx'), 'utf8')

test('@spec:AC-085 Sidebar tem um link para /relatorios/vendas-historicas', () => {
  assert.match(fonte, /href="\/relatorios\/vendas-historicas"/)
})

test('@spec:AC-085 o link novo está no mesmo bloco condicional do link de /relatorios/vendas (grupo Comercial)', () => {
  const idxLinkExistente = fonte.indexOf('href="/relatorios/vendas"')
  const idxLinkNovo = fonte.indexOf('href="/relatorios/vendas-historicas"')
  assert.ok(idxLinkExistente > -1, 'link de /relatorios/vendas não encontrado')
  assert.ok(idxLinkNovo > -1, 'link de /relatorios/vendas-historicas não encontrado')
  // O link novo aparece logo depois do existente, dentro da mesma distância
  // curta (mesmo bloco JSX do grupo Comercial, não em outro grupo do menu).
  assert.ok(idxLinkNovo > idxLinkExistente && idxLinkNovo - idxLinkExistente < 500)
})
