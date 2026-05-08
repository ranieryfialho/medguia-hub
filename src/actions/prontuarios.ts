'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { temAcesso } from '@/lib/modulos'
import { STATUS_CONCLUIDO_RAW_VALUES } from '@/lib/atendimento-status'

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

  revalidatePath('/', 'layout')
  revalidatePath('/prontuarios')
  return {}
}

export async function contarProntuariosPendentes(): Promise<number> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, modulos_liberados')
    .eq('id', user.id)
    .single()

  const modulos: string[] = profile?.modulos_liberados ?? []
  if (!temAcesso(modulos, 'prontuarios')) return 0

  const role = profile?.role || ''
  const isFisio = role !== 'gestor' && role !== 'master'

  let query = supabase
    .from('atendimentos')
    .select('id')
    .in('status', STATUS_CONCLUIDO_RAW_VALUES)
  if (isFisio) query = query.eq('profissional_id', user.id)

  const [{ data: comProntuario }, { data: concluidos }] = await Promise.all([
    supabase.from('prontuarios').select('atendimento_id'),
    query,
  ])

  const idsComProntuario = new Set((comProntuario ?? []).map(p => p.atendimento_id))
  return (concluidos ?? []).filter(a => !idsComProntuario.has(a.id)).length
}
