'use server'

import { createClient } from '@/lib/supabase/server'

export async function obterPreferenciaTela<T = Record<string, unknown>>(
  tela: string
): Promise<T | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('preferencias_usuario')
    .select('preferencias')
    .eq('usuario_id', user.id)
    .eq('tela', tela)
    .maybeSingle()

  return (data?.preferencias as T | undefined) ?? null
}

export async function salvarPreferenciaTela(
  tela: string,
  preferencias: Record<string, unknown>
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase
    .from('preferencias_usuario')
    .upsert(
      {
        usuario_id: user.id,
        tela,
        preferencias,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: 'usuario_id,tela' }
    )

  if (error) return { error: error.message }
  return {}
}
