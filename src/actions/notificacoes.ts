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
  const [pendentes, followUpsPendentes, contatosFrios] = await Promise.all([
    buscarProntuariosPendentes(supabase, user.id, role, descartados),
    buscarFollowUpsPendentesNotif(supabase, user.id, descartados),
    buscarContatosFriosNotif(supabase, user.id, role),
  ])

  return [...followUpsPendentes, ...contatosFrios, ...pendentes, ...(notifs ?? [])] as Notificacao[]
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
  } else {
    // Exclui atendimentos cujo profissional é médico (mesma regra do RPC listar_atendimentos_sem_prontuario)
    const { data: naoMedicos } = await supabase
      .from('profiles')
      .select('id')
      .neq('role', 'medico')
    const idsNaoMedico = (naoMedicos ?? []).map((p: { id: string }) => p.id)
    if (idsNaoMedico.length > 0) {
      query = query.in('profissional_id', idsNaoMedico)
    }
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

async function buscarFollowUpsPendentesNotif(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  descartados: Set<string>,
): Promise<Notificacao[]> {
  const { data: followUps } = await supabase
    .from('follow_ups')
    .select('id, paciente_id, created_at, pacientes(nome), tipo:follow_up_tipos(nome)')
    .eq('responsavel_id', userId)
    .eq('status', 'pendente')
    .order('created_at', { ascending: false })
    .limit(20)

  return (followUps ?? [])
    .filter((f: { id: string }) => !descartados.has(`followup-${f.id}`))
    .map((f: { id: string; paciente_id: string; created_at: string; pacientes?: { nome: string }; tipo?: { nome: string } }) => ({
      id: `followup-${f.id}`,
      tipo: 'follow_up_atribuido',
      titulo: 'Follow-up pendente',
      mensagem: `${f.pacientes?.nome ?? 'Paciente'} — ${f.tipo?.nome ?? 'follow-up'} aguarda seu atendimento`,
      lida: false,
      link: '/follow-ups',
      metadados: { follow_up_id: f.id, paciente_id: f.paciente_id },
      criado_em: f.created_at,
    }))
}

const DIAS_SEM_ATIVIDADE_POR_STATUS: Record<string, number> = {
  a_contactar: 7,
  recuperacao_base: 7,
  tentativa: 3,
  em_conversa: 7,
}

function cutoffIso(dias: number) {
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()
}

async function buscarContatosFriosNotif(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  role: string,
): Promise<Notificacao[]> {
  try {
    const isGestor = role === 'gestor' || role === 'master'

    // Filtro SQL preciso por status+threshold — sem JS filter adicional
    const orFilter = Object.entries(DIAS_SEM_ATIVIDADE_POR_STATUS)
      .map(([status, dias]) => `and(status.eq.${status},ultima_atividade.lt.${cutoffIso(dias)})`)
      .join(',')

    let query = supabase
      .from('contatos_base')
      .select('paciente_id, status, ultima_atividade, pacientes(nome)')
      .or(orFilter)
      .order('ultima_atividade', { ascending: true })

    if (!isGestor) {
      query = query.eq('responsavel_id', userId)
    }

    const { data, error } = await query

    if (error) return []

    const frios = data ?? []
    if (frios.length === 0) return []

    return [{
      id: 'cold-contacts-summary',
      tipo: 'contato_frio',
      titulo: `Base fria: ${frios.length} contato${frios.length !== 1 ? 's' : ''} sem atividade`,
      mensagem: 'Revise a base para mantê-la aquecida.',
      lida: false,
      link: '/contatos',
      metadados: { total: frios.length },
      criado_em: new Date().toISOString(),
    }]
  } catch {
    return []
  }
}

export async function marcarComoLida(id: string): Promise<void> {
  if (id.startsWith('pending-') || id.startsWith('followup-') || id.startsWith('cold-')) return
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
