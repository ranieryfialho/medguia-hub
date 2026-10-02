import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'
import { NextResponse, type NextRequest } from 'next/server'
import { opcoesCookieSessao } from '@/lib/sso/dominio-cookie'
import { destinoRetornoSeguro } from '@/lib/sso/retorno-seguro'

function isPublicRoute(pathname: string) {
  return (
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/confirmar/') ||
    pathname === '/api/confirmacoes/sms-reply' ||
    pathname === '/api/confirmacoes/sms-status'
  )
}

// Margem para não aceitar um token prestes a expirar: dentro dela cai no
// getUser(), que renova a sessão via refresh token.
const MARGEM_EXPIRACAO_S = 60

const jwtSecret = process.env.SUPABASE_JWT_SECRET
  ? new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET)
  : null

// getUser() é uma chamada HTTP ao supabase-auth (3 queries no banco cada) e o
// proxy roda em toda requisição. Com o JWT_SECRET (HS256) validamos a
// assinatura localmente e só vamos ao Auth quando o token está ausente,
// inválido ou perto de expirar. Sem a variável, mantém o comportamento antigo.
async function resolverUsuario(supabase: SupabaseClient): Promise<{ id: string } | null> {
  if (jwtSecret) {
    try {
      // getSession() só lê os cookies; a assinatura é verificada abaixo.
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        const { payload } = await jwtVerify(session.access_token, jwtSecret, {
          algorithms: ['HS256'],
          audience: 'authenticated',
        })
        const agora = Math.floor(Date.now() / 1000)
        if (payload.sub && payload.exp && payload.exp - agora > MARGEM_EXPIRACAO_S) {
          return { id: payload.sub }
        }
      }
    } catch {
      // assinatura inválida/expirada: confirma no Auth
    }
  }

  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: opcoesCookieSessao(),
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const user = await resolverUsuario(supabase)

  const publicRoute = isPublicRoute(request.nextUrl.pathname)
  
  if (!user && !publicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && (request.nextUrl.pathname === '/' || request.nextUrl.pathname.startsWith('/login'))) {
     // SSO com o dashboard (AC-119): quem já está logado volta ao endereço que pediu.
     const retorno = destinoRetornoSeguro(request.nextUrl.searchParams.get('retorno'))
     if (retorno) return NextResponse.redirect(retorno)

     const url = request.nextUrl.clone()
     url.pathname = '/dashboard' 
     return NextResponse.redirect(url)
  }

  return supabaseResponse
}
