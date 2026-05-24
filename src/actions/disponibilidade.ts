'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type DiaDisponibilidade = {
  dia_semana: number
  jornada_inicio: string
  jornada_fim: string
  intervalo_inicio: string | null
  intervalo_fim: string | null
  ativo: boolean
}

export async function listarDisponibilidade(profissionalId?: string): Promise<DiaDisponibilidade[]> {
  const supabase = await createClient()

  let targetId = profissionalId
  if (!targetId) {
    const { data: { user } } = await supabase.auth.getUser()
    targetId = user?.id
  }

  if (!targetId) return []

  const { data } = await supabase
    .from('disponibilidade_profissional')
    .select('dia_semana, jornada_inicio, jornada_fim, intervalo_inicio, intervalo_fim, ativo')
    .eq('profissional_id', targetId)
    .order('dia_semana')

  return (data ?? []) as DiaDisponibilidade[]
}

export async function listarTodasDisponibilidades(): Promise<
  {
    profissional_id: string
    dia_semana: number
    jornada_inicio: string
    jornada_fim: string
    intervalo_inicio: string | null
    intervalo_fim: string | null
    ativo: boolean
  }[]
> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('disponibilidade_profissional')
    .select('profissional_id, dia_semana, jornada_inicio, jornada_fim, intervalo_inicio, intervalo_fim, ativo')
    .eq('ativo', true)
  return data ?? []
}

export async function salvarDisponibilidade(
  profissionalId: string,
  dias: DiaDisponibilidade[]
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()

  const { error: deleteError } = await supabase
    .from('disponibilidade_profissional')
    .delete()
    .eq('profissional_id', profissionalId)

  if (deleteError) return { error: 'Erro ao limpar registros: ' + deleteError.message }

  const rows = dias.map(d => ({
    profissional_id: profissionalId,
    dia_semana: d.dia_semana,
    jornada_inicio: d.jornada_inicio,
    jornada_fim: d.jornada_fim,
    intervalo_inicio: d.intervalo_inicio,
    intervalo_fim: d.intervalo_fim,
    ativo: d.ativo,
  }))

  const { error: insertError } = await supabase
    .from('disponibilidade_profissional')
    .insert(rows)

  if (insertError) return { error: 'Erro ao salvar: ' + insertError.message }

  revalidatePath('/configuracoes', 'layout')
  revalidatePath('/agenda')
  return { success: true }
}
