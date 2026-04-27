'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ProntuarioData = {
  id: string
  atendimento_id: string
  paciente_id: string
  profissional_id: string | null
  queixa_principal: string | null
  evolucao: string | null
  procedimentos: string | null
  escala_dor: number | null
  observacoes: string | null
  created_at: string
  updated_at: string
}

export async function buscarProntuarioPorAtendimento(atendimentoId: string): Promise<ProntuarioData | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('prontuarios')
    .select('*')
    .eq('atendimento_id', atendimentoId)
    .maybeSingle()
  return data
}

export async function buscarProntuariosPorPaciente(pacienteId: string): Promise<ProntuarioData[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('prontuarios')
    .select('*')
    .eq('paciente_id', pacienteId)
    .order('created_at', { ascending: true })
  return data ?? []
}

export async function salvarProntuario(
  atendimentoId: string,
  pacienteId: string,
  input: {
    queixa_principal?: string
    evolucao?: string
    procedimentos?: string
    escala_dor?: number | null
    observacoes?: string
  }
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado' }

  const { error } = await supabase
    .from('prontuarios')
    .upsert(
      {
        atendimento_id: atendimentoId,
        paciente_id: pacienteId,
        profissional_id: user.id,
        queixa_principal: input.queixa_principal?.trim() || null,
        evolucao: input.evolucao?.trim() || null,
        procedimentos: input.procedimentos?.trim() || null,
        escala_dor: input.escala_dor ?? null,
        observacoes: input.observacoes?.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'atendimento_id' }
    )

  if (error) return { error: error.message }

  revalidatePath('/pacientes', 'layout')
  revalidatePath('/prontuarios')
  return {}
}