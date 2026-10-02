# Tasks: SSO cookie dashboard

> feature: sso-cookie-dashboard

## T-043 — Domínio do cookie compartilhado nos três clientes Supabase [concluida]
- Refs: US-035, AC-116, AC-117
- Arquivos: src/lib/sso/dominio-cookie.ts, src/lib/supabase/client.ts, src/lib/supabase/server.ts, src/lib/supabase/middleware.ts, test/sso/dominio-cookie.test.ts
- Modelo: claude-sonnet-5-5
- Esforço: baixo
- Notas: `opcoesCookieSessao(appUrl)` puro devolve `{ domain }` ou `{}`; os três clientes passam `cookieOptions`.

## T-044 — Retorno seguro no proxy e no login [concluida]
- Refs: US-035, AC-118, AC-119, AC-120
- Arquivos: src/lib/sso/retorno-seguro.ts, src/lib/supabase/middleware.ts, src/actions/auth.ts, src/app/(auth)/login/page.tsx, test/sso/retorno-seguro.test.ts
- Modelo: claude-sonnet-5-5
- Esforço: medio
- Notas: `destinoRetornoSeguro(retorno, appUrl)` puro. Depende da T-043 (mesmo `middleware.ts`).
