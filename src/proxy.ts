import { type NextRequest } from 'next/server'
import { updateSession } from './lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  // Exclude ALL _next/ internals (HMR, data, static) to avoid calling
  // supabase.auth.getUser() on every hot-reload request in dev mode.
  matcher: [
    '/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
