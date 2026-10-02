import { createBrowserClient } from '@supabase/ssr'
import { opcoesCookieSessao } from '@/lib/sso/dominio-cookie'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: opcoesCookieSessao() }
  )
}