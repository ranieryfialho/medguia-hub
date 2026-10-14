import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { usuarioPorJwtLocal } from '@/lib/supabase/jwt-local'
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

async function resolverUsuario(supabase: SupabaseClient): Promise<{ id: string } | null> {
  const local = await usuarioPorJwtLocal(supabase)
  if (local) return local

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
