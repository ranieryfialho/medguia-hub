'use server'

import { createClient } from '@/lib/supabase/server'

export type StatusDisponibilidade = 'disponivel' | 'reuniao' | 'ocupado' | 'ausente'

export type StatusRow = {
  profissional_id: string
  status: string
  atualizado_em: string
}

export async function setStatusDisponibilidade(
  novoStatus: string,
): Promise<{ status: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'NÃ£o autenticado' }

  const payload = {
    profissional_id: user.id,
    status: novoStatus,
    atualizado_em: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('status_disponibilidade')
    .upsert({
      ...payload,
      origem: 'manual',
    })

  if (error?.message.includes("Could not find the 'origem' column")) {
    const { error: fallbackError } = await supabase
      .from('status_disponibilidade')
      .upsert(payload)

    if (fallbackError) return { error: fallbackError.message }
    return { status: novoStatus }
  }

  if (error) return { error: error.message }
  return { status: novoStatus }
}

export async function listarStatusDisponibilidade(profissionalIds?: string[]): Promise<StatusRow[]> {
  const supabase = await createClient()

  if (profissionalIds && profissionalIds.length > 0) {
    const { data } = await supabase.rpc('fn_status_equipe_agora', { p_ids: profissionalIds })
    return (data ?? []) as StatusRow[]
  }

  const { data } = await supabase
    .from('status_disponibilidade')
    .select('profissional_id, status, atualizado_em')
  return (data ?? []) as StatusRow[]
}
