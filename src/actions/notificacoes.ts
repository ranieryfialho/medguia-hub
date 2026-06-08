'use server'

import { createClient } from '@/lib/supabase/server'

export type Notificacao = {
  id: string
  tipo: string
  titulo: string
  mensagem: string
  lida: boolean
  link: string | null
  metadados: Record<string, unknown> | null
  criado_em: string
}

const STATUS_CONCLUIDO = ['Concluído', 'Concluido', 'concluído', 'concluido']

export async function buscarNotificacoes(): Promise<Notificacao[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const [{ data: notifs }, { data: profile }] = await Promise.all([
    supabase
      .from('notificacoes')
      .select('id, tipo, titulo, mensagem, lida, link, metadados, criado_em')
      .eq('usuario_id', user.id)
      .order('criado_em', { ascending: false })
      .limit(30),
    supabase
      .from('profiles')
      .select('role, pendentes_descartados')
      .eq('id', user.id)
      .single(),
  ])

  const role = profile?.role ?? ''
  const descartados = new Set<string>(profile?.pendentes_descartados ?? [])
  const pendentes = await buscarProntuariosPendentes(supabase, user.id, role, descartados)

  return [...pendentes, ...(notifs ?? [])] as Notificacao[]
}

async function buscarProntuariosPendentes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  role: string,
  descartados: Set<string>,
): Promise<Notificacao[]> {
  if (role === 'medico') return []

  const isFisio = role !== 'gestor' && role !== 'master'

  let query = supabase
    .from('atendimentos')
    .select('id, paciente_id, data_agendamento, pacientes(nome)')
    .in('status', STATUS_CONCLUIDO)

  if (isFisio) {
    query = query.eq('profissional_id', userId)
  }

  const [{ data: atendimentos }, { data: comProntuario }] = await Promise.all([
    query,
    supabase.from('prontuarios').select('atendimento_id'),
  ])

  const idsComProntuario = new Set(
    (comProntuario ?? []).map((p: { atendimento_id: string }) => p.atendimento_id),
  )

  return (atendimentos ?? [])
    .filter((a: { id: string }) => !idsComProntuario.has(a.id) && !descartados.has(`pending-${a.id}`))
    .map((a: { id: string; paciente_id: string; data_agendamento: string; pacientes?: { nome: string } }) => ({
      id: `pending-${a.id}`,
      tipo: 'prontuario_pendente',
      titulo: 'Prontuário pendente',
      mensagem: `${a.pacientes?.nome ?? 'Paciente'} aguarda registro clínico`,
      lida: false,
      link: '/prontuarios',
      metadados: { atendimento_id: a.id, paciente_id: a.paciente_id },
      criado_em: a.data_agendamento ?? new Date().toISOString(),
    }))
}

export async function marcarComoLida(id: string): Promise<void> {
  if (id.startsWith('pending-')) return
  const supabase = await createClient()
  await supabase.from('notificacoes').update({ lida: true }).eq('id', id)
}

export async function marcarTodasComoLidas(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase
    .from('notificacoes')
    .update({ lida: true })
    .eq('usuario_id', user.id)
    .eq('lida', false)
}

export async function limparNotificacoes(pendingIds: string[]): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('profiles')
    .select('pendentes_descartados')
    .eq('id', user.id)
    .single()

  const jaDescartados: string[] = profile?.pendentes_descartados ?? []
  const novosDescartados = [...new Set([...jaDescartados, ...pendingIds])]

  await Promise.all([
    supabase.from('notificacoes').delete().eq('usuario_id', user.id),
    supabase.from('profiles').update({ pendentes_descartados: novosDescartados }).eq('id', user.id),
  ])
}
