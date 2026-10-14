import type { SupabaseClient, User } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'

// Margem para não aceitar um token prestes a expirar: dentro dela o chamador
// cai no getUser(), que renova a sessão via refresh token.
const MARGEM_EXPIRACAO_S = 60

const jwtSecret = process.env.SUPABASE_JWT_SECRET
  ? new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET)
  : null

/**
 * getUser() é uma chamada HTTP ao supabase-auth (3 queries no banco cada).
 * Com o JWT_SECRET (HS256) validamos a assinatura localmente e só vamos ao
 * Auth quando o token está ausente, inválido ou perto de expirar. Sem a
 * variável devolve null e o chamador mantém o comportamento antigo.
 *
 * Contrapartida: uma sessão revogada no Auth segue válida até o `exp` do
 * access token (1h por padrão).
 */
export async function usuarioPorJwtLocal(supabase: SupabaseClient): Promise<User | null> {
  if (!jwtSecret) return null

  try {
    // getSession() só lê os cookies; a assinatura é verificada abaixo.
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return null

    const { payload } = await jwtVerify(session.access_token, jwtSecret, {
      algorithms: ['HS256'],
      audience: 'authenticated',
    })
    const agora = Math.floor(Date.now() / 1000)
    if (!payload.sub || !payload.exp || payload.exp - agora <= MARGEM_EXPIRACAO_S) return null

    return {
      id: payload.sub,
      aud: 'authenticated',
      role: typeof payload.role === 'string' ? payload.role : 'authenticated',
      email: typeof payload.email === 'string' ? payload.email : undefined,
      phone: typeof payload.phone === 'string' ? payload.phone : undefined,
      app_metadata: (payload.app_metadata as User['app_metadata']) ?? {},
      user_metadata: (payload.user_metadata as User['user_metadata']) ?? {},
      created_at: '',
    }
  } catch {
    // assinatura inválida/expirada: o chamador confirma no Auth
    return null
  }
}
