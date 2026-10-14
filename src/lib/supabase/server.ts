import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { usuarioPorJwtLocal } from '@/lib/supabase/jwt-local'
import { opcoesCookieSessao } from '@/lib/sso/dominio-cookie'

export async function createClient() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: opcoesCookieSessao(),
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
          }
        },
      },
    }
  )

  // Os ~60 `auth.getUser()` do app (actions, rotas, layout) passam a valer o
  // JWT localmente quando há SUPABASE_JWT_SECRET, em vez de um HTTP ao Auth
  // por chamada. Com `jwt` explícito ou sem segredo, vai ao Auth como antes.
  const getUserNoAuth = supabase.auth.getUser.bind(supabase.auth)
  supabase.auth.getUser = async (jwt?: string) => {
    if (!jwt) {
      const user = await usuarioPorJwtLocal(supabase)
      if (user) return { data: { user }, error: null }
    }
    return getUserNoAuth(jwt)
  }

  return supabase
}
