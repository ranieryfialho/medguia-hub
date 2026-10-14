import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { opcoesCookieSessao } from '@/lib/sso/dominio-cookie'

const ROTAS_PUBLICAS = ['/login', '/confirmar/']

// Antes do SSO o cookie de sessão era do host; hoje é do domínio pai. Quem
// logou antes ficou com os dois e o navegador manda ambos. Quando o refresh
// token da cópia velha já foi usado, o supabase-js remove só o cookie do
// domínio, relê o velho e tenta renovar de novo, em loop (milhares de /token
// por minuto no supabase-auth). Ao perder a sessão, expiramos também a cópia
// sem domínio.
function expirarCookiesDeSessaoDoHost() {
  for (const parte of document.cookie.split(';')) {
    const nome = parte.split('=')[0].trim()
    if (/^sb-.+-auth-token(\.\d+)?$/.test(nome)) {
      document.cookie = `${nome}=; Max-Age=0; Path=/; SameSite=Lax`
    }
  }
}

let cliente: SupabaseClient | null = null

export function createClient(): SupabaseClient {
  if (typeof window === 'undefined') {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookieOptions: opcoesCookieSessao() },
    )
  }

  if (cliente) return cliente

  cliente = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: opcoesCookieSessao() },
  )

  cliente.auth.onAuthStateChange((evento) => {
    if (evento !== 'SIGNED_OUT') return
    expirarCookiesDeSessaoDoHost()
    const { pathname } = window.location
    const publica = pathname === '/' || ROTAS_PUBLICAS.some(r => pathname.startsWith(r))
    if (!publica) window.location.assign('/login')
  })

  return cliente
}
