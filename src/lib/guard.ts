import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { ModuloChave } from './modulos'

export async function getUsuarioComPermissoes() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, nivel_acesso, full_name, modulos_liberados')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const modulos: string[] = profile.modulos_liberados ?? []
  return { user, profile, modulos }
}

export async function requireModulo(chave: ModuloChave) {
  const ctx = await getUsuarioComPermissoes()

  // Empty modulos_liberados = full access (backward compatibility durante migração)
  if (ctx.modulos.length > 0 && !ctx.modulos.includes(chave)) {
    redirect(`/sem-acesso?modulo=${encodeURIComponent(chave)}`)
  }

  return ctx
}
