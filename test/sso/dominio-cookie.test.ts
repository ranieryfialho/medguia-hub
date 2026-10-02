/**
 * Domínio do cookie compartilhado com o dashboard.
 * Ver .spec/features/sso-cookie-dashboard/spec.md (AC-116, AC-117)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { dominioPaiDoHub, opcoesCookieSessao } from '../../src/lib/sso/dominio-cookie.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ler = (relativo: string) => readFileSync(path.join(__dirname, '../../', relativo), 'utf-8')

test('AC-116: o cookie vale para o domínio pai do Hub @spec:AC-116', () => {
  assert.equal(dominioPaiDoHub('https://hub.medguia.cloud'), '.medguia.cloud')
  assert.deepEqual(opcoesCookieSessao('https://hub.medguia.cloud'), { domain: '.medguia.cloud' })
  assert.deepEqual(opcoesCookieSessao('https://hub.medguia.cloud/'), { domain: '.medguia.cloud' })
})

test('AC-116: em localhost, IP, URL ausente ou inválida não há domínio (cookie do próprio host) @spec:AC-116', () => {
  for (const url of ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000', 'https://medguia.cloud', 'isto não é url', '', undefined, null]) {
    assert.deepEqual(opcoesCookieSessao(url), {}, `esperado sem domínio para ${JSON.stringify(url)}`)
  }
})

test('AC-117: os três clientes do Supabase usam as mesmas opções de cookie @spec:AC-117', () => {
  for (const arquivo of ['src/lib/supabase/client.ts', 'src/lib/supabase/server.ts', 'src/lib/supabase/middleware.ts']) {
    const fonte = ler(arquivo)
    assert.match(fonte, /opcoesCookieSessao/, `${arquivo} deve importar as opções de cookie`)
    assert.match(fonte, /cookieOptions:\s*opcoesCookieSessao\(\)/, `${arquivo} deve passar cookieOptions`)
  }
})
