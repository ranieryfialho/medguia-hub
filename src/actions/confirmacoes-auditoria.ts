'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export type TipoAuditoria = 'status_alterado' | 'whatsapp_enviado' | 'sms_enviado' | 'email_enviado'

export type EventoAuditoria = {
  id: string
  atendimento_id: string
  tipo: TipoAuditoria
  descricao: string
  usuario_id: string | null
  usuario_nome: string | null
  criado_em: string
  metadata: Record<string, unknown> | null
}

export type EventoAuditoriaGeral = EventoAuditoria & {
  atendimento: {
    data_agendamento: string
    paciente: { nome: string } | null
  } | null
}

function serviceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function registrarAuditoria(
  atendimentoId: string,
  tipo: TipoAuditoria,
  descricao: string,
  usuarioId?: string | null,
  usuarioNome?: string | null,
  metadata?: Record<string, unknown>,
) {
  const db = serviceClient()
  await db.from('confirmacoes_auditoria').insert({
    atendimento_id: atendimentoId,
    tipo,
    descricao,
    usuario_id: usuarioId ?? null,
    usuario_nome: usuarioNome ?? null,
    criado_em: new Date().toISOString(),
    metadata: metadata ?? null,
  })
}

export async function buscarAuditoriaAtendimento(atendimentoId: string): Promise<EventoAuditoria[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('confirmacoes_auditoria')
    .select('*')
    .eq('atendimento_id', atendimentoId)
    .order('criado_em', { ascending: false })
  return (data ?? []) as EventoAuditoria[]
}

export type ConfirmacaoPaciente = {
  id: string
  data_agendamento: string
  tipo: string | null
  status: string
  contato_confirmacao: string | null
  numero_sessao: number | null
  total_sessoes: number | null
}

export async function buscarConfirmacoesPaciente(pacienteId: string): Promise<ConfirmacaoPaciente[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('atendimentos')
    .select('id, data_agendamento, tipo, status, contato_confirmacao, numero_sessao, total_sessoes')
    .eq('paciente_id', pacienteId)
    .order('data_agendamento', { ascending: false })
    .limit(200)
  return (data ?? []) as ConfirmacaoPaciente[]
}

export async function buscarAuditoriaPorPaciente(pacienteId: string): Promise<EventoAuditoria[]> {
  const supabase = await createClient()
  const { data: atendimentos } = await supabase
    .from('atendimentos')
    .select('id')
    .eq('paciente_id', pacienteId)
  if (!atendimentos?.length) return []
  const ids = atendimentos.map(a => a.id)
  const { data } = await supabase
    .from('confirmacoes_auditoria')
    .select('*')
    .in('atendimento_id', ids)
    .order('criado_em', { ascending: false })
    .limit(100)
  return (data ?? []) as EventoAuditoria[]
}

export async function buscarAuditoriaGeral(filtros?: {
  data_inicio?: string
  data_fim?: string
  tipo?: TipoAuditoria
}): Promise<EventoAuditoriaGeral[]> {
  const supabase = await createClient()
  let query = supabase
    .from('confirmacoes_auditoria')
    .select(`
      *,
      atendimento:atendimentos(
        data_agendamento,
        paciente:pacientes(nome)
      )
    `)
    .order('criado_em', { ascending: false })
    .limit(300)

  if (filtros?.tipo) query = query.eq('tipo', filtros.tipo)
  if (filtros?.data_inicio) query = query.gte('criado_em', filtros.data_inicio)
  if (filtros?.data_fim) query = query.lte('criado_em', filtros.data_fim)

  const { data } = await query
  return (data ?? []) as EventoAuditoriaGeral[]
}
