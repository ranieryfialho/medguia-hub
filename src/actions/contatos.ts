'use server'

import { createClient } from '@/lib/supabase/server'

export type StatusContato = 'a_contactar' | 'tentativa' | 'em_conversa' | 'sem_interesse' | 'agendou'

async function upsertContato(pacienteId: string, updates: Record<string, unknown>) {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('contatos_base')
    .select('id')
    .eq('paciente_id', pacienteId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('contatos_base')
      .update({ ...updates, atualizado_em: new Date().toISOString() })
      .eq('id', existing.id)
    return error ? { error: error.message } : { success: true }
  } else {
    const { error } = await supabase
      .from('contatos_base')
      .insert({ paciente_id: pacienteId, status: 'a_contactar', ...updates })
    return error ? { error: error.message } : { success: true }
  }
}

export async function atualizarStatusContato(pacienteId: string, status: StatusContato) {
  return upsertContato(pacienteId, { status })
}

export async function atualizarResponsavelContato(pacienteId: string, responsavelId: string | null) {
  return upsertContato(pacienteId, { responsavel_id: responsavelId })
}

export async function adicionarNota(pacienteId: string, texto: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('notas_contato')
    .insert({ paciente_id: pacienteId, texto, autor_id: user?.id ?? null })

  return error ? { error: error.message } : { success: true }
}

export async function buscarNotas(pacienteId: string) {
  const supabase = await createClient()

  const { data: notas } = await supabase
    .from('notas_contato')
    .select('id, texto, criado_em, autor_id')
    .eq('paciente_id', pacienteId)
    .order('criado_em', { ascending: true })

  if (!notas?.length) return []

  // Buscar nomes dos autores
  const autorIds = [...new Set(notas.map(n => n.autor_id).filter(Boolean))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', autorIds)

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.full_name]))

  return notas.map(n => ({
    ...n,
    autor_nome: n.autor_id ? profileMap[n.autor_id] : null,
  }))
}