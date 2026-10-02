/**
 * Retorno seguro do login (SSO com o dashboard).
 * Ver .spec/features/sso-cookie-dashboard/spec.md (AC-118, AC-119, AC-120)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { destinoRetornoSeguro } from '../../src/lib/sso/retorno-seguro.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ler = (relativo: string) => readFileSync(path.join(__dirname, '../../', relativo), 'utf-8')
const HUB = 'https://hub.medguia.cloud'

test('AC-118: aceita https no domínio pai do Hub e em subdomínios, preservando caminho e filtros @spec:AC-118', () => {
  assert.equal(
    destinoRetornoSeguro('https://dashboard.medguia.cloud/comercial?periodo=mes', HUB),
    'https://dashboard.medguia.cloud/comercial?periodo=mes',
  )
  assert.equal(destinoRetornoSeguro('https://dashboard.medguia.cloud/', HUB), 'https://dashboard.medguia.cloud/')
  assert.equal(destinoRetornoSeguro('https://medguia.cloud/x', HUB), 'https://medguia.cloud/x')
})

test('AC-118: recusa http, outro domínio, domínio parecido, usuário na URL, javascript:, relativo e vazio @spec:AC-118', () => {
  const atacantes = [
    'http://dashboard.medguia.cloud/',
    'https://evil.com/',
    'https://medguia.cloud.evil.com/',
    'https://evilmedguia.cloud/',
    'https://dashboard.medguia.cloud@evil.com/',
    'https://user:senha@dashboard.medguia.cloud/',
    'javascript:alert(1)',
    'data:text/html,<script>1</script>',
    '//evil.com/',
    '/dashboard',
    'dashboard.medguia.cloud',
    '',
    '   ',
  ]
  for (const retorno of atacantes) {
    assert.equal(destinoRetornoSeguro(retorno, HUB), null, `deveria recusar ${JSON.stringify(retorno)}`)
  }
  assert.equal(destinoRetornoSeguro(null, HUB), null)
  assert.equal(destinoRetornoSeguro(undefined, HUB), null)
})

test('AC-118: sem domínio pai (localhost) nenhum retorno é aceito @spec:AC-118', () => {
  assert.equal(destinoRetornoSeguro('https://dashboard.medguia.cloud/', 'http://localhost:3000'), null)
  assert.equal(destinoRetornoSeguro('https://dashboard.medguia.cloud/', undefined), null)
})

test('AC-119: o proxy leva quem já está logado ao retorno seguro e, sem ele, a /dashboard @spec:AC-119', () => {
  const fonte = ler('src/lib/supabase/middleware.ts')
  assert.match(fonte, /destinoRetornoSeguro\(request\.nextUrl\.searchParams\.get\('retorno'\)\)/)
  const bloco = fonte.slice(fonte.indexOf("request.nextUrl.pathname === '/'"))
  assert.ok(
    bloco.indexOf('destinoRetornoSeguro') < bloco.indexOf("url.pathname = '/dashboard'"),
    'o retorno é tratado antes do destino padrão /dashboard',
  )
  assert.match(bloco, /if \(retorno\) return NextResponse\.redirect\(retorno\)/)
})

test('AC-120: a tela de login repassa o retorno e a ação o valida de novo no servidor @spec:AC-120', () => {
  const pagina = ler('src/app/(auth)/login/page.tsx')
  assert.match(pagina, /useSearchParams\(\)\.get\('retorno'\)/)
  assert.match(pagina, /name="retorno"/)
  assert.match(pagina, /<Suspense>/, 'useSearchParams exige Suspense no build estático')

  const acao = ler('src/actions/auth.ts')
  assert.match(acao, /destinoRetornoSeguro\(formData\.get\('retorno'\)/)
  assert.match(acao, /redirect\(retorno \?\? '\/dashboard'\)/)
})
