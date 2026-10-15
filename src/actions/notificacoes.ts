'use server'

import { createClient } from '@/lib/supabase/server'
import { TAG_SISTEMA_SEM_CONTRATO } from '@/lib/venda-tags-sistema'
import { formatAppDateKey } from '@/lib/datetime'

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

const PREFIXOS_DERIVADAS = ['pending-', 'followup-', 'cold-', 'contrato-'] as const
const LIMITE_PRONTUARIOS_PENDENTES = 30

function ehDerivada(id: string) {
  return PREFIXOS_DERIVADAS.some((p) => id.startsWith(p))
}

export type ResultadoNotificacoes = {
  notificacoes: Notificacao[]
  /** Dia (yyyy-mm-dd, America/Sao_Paulo) em que o modal diário foi visto por último. */
  modalVistoEm: string | null
}

/** Lê role + dia do modal na mesma query; se a coluna ainda não existir, cai para só o role. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function lerPerfil(supabase: any, userId: string): Promise<{ role: string; modalVistoEm: string | null }> {
  const completo = await supabase
    .from('profiles')
    .select('role, modal_notif_visto_em')
    .eq('id', userId)
    .single()
  if (!completo.error) {
    return { role: completo.data?.role ?? '', modalVistoEm: completo.data?.modal_notif_visto_em ?? null }
  }
  const basico = await supabase.from('profiles').select('role').eq('id', userId).single()
  return { role: basico.data?.role ?? '', modalVistoEm: null }
}

export async function buscarNotificacoes(): Promise<ResultadoNotificacoes> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { notificacoes: [], modalVistoEm: null }

  const [{ data: notifs }, perfil, { data: estados }] = await Promise.all([
    supabase
      .from('notificacoes')
      .select('id, tipo, titulo, mensagem, lida, link, metadados, criado_em')
      .eq('usuario_id', user.id)
      .order('criado_em', { ascending: false })
      .limit(30),
    lerPerfil(supabase, user.id),
    supabase
      .from('notificacoes_estado')
      .select('chave, lida, dispensada')
      .eq('usuario_id', user.id),
  ])

  const role = perfil.role
  const [pendentes, followUps, contatosFrios, contratos] = await Promise.all([
    buscarProntuariosPendentes(supabase, user.id, role),
    buscarFollowUpsPendentesNotif(supabase, user.id),
    buscarContatosFriosNotif(supabase, user.id, role),
    buscarContratosNaoAssinadosNotif(supabase, role),
  ])

  const derivadas = [...followUps, ...contatosFrios, ...contratos, ...pendentes]
  const estadoPorChave = new Map(
    (estados ?? []).map((e: { chave: string; lida: boolean; dispensada: boolean }) => [e.chave, e]),
  )

  // Poda estados de pendências que já foram resolvidas (chave não é mais gerada).
  const chavesAtuais = new Set(derivadas.map((n) => n.id))
  const obsoletas = (estados ?? [])
    .map((e: { chave: string }) => e.chave)
    .filter((c: string) => !chavesAtuais.has(c))
  if (obsoletas.length > 0) {
    await supabase
      .from('notificacoes_estado')
      .delete()
      .eq('usuario_id', user.id)
      .in('chave', obsoletas)
  }

  const visiveis = derivadas
    .filter((n) => !estadoPorChave.get(n.id)?.dispensada)
    .map((n) => ({ ...n, lida: estadoPorChave.get(n.id)?.lida ?? false }))

  const notificacoes = [...visiveis, ...((notifs ?? []) as Notificacao[])].sort(
    (a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime(),
  )
  return { notificacoes, modalVistoEm: perfil.modalVistoEm }
}

/**
 * Registra que o usuário já viu o modal de hoje (dia local da clínica) e marca
 * como lidas as pendências que ele exibiu. Uma ida ao banco por dia.
 */
export async function registrarModalNotificacoesVisto(idsExibidos: string[] = []): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await Promise.all([
    supabase
      .from('profiles')
      .update({ modal_notif_visto_em: formatAppDateKey(new Date()) })
      .eq('id', user.id),
    gravarEstado(supabase, user.id, idsExibidos.slice(0, 50), { lida: true }),
  ])
}

async function buscarProntuariosPendentes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  role: string,
): Promise<Notificacao[]> {
  if (role === 'medico') return []

  const isFisio = role !== 'gestor' && role !== 'master'

  // Mesma regra da tela de prontuários (RPC): exclui atendimentos de médicos
  // e já considera o fisioterapeuta executor.
  const { data, error } = await supabase.rpc('listar_atendimentos_sem_prontuario', {
    limit_count: LIMITE_PRONTUARIOS_PENDENTES,
    fisio_id: isFisio ? userId : null,
  })
  if (error) return []

  return (data ?? []).map(
    (a: { id: string; paciente_nome: string | null; data_agendamento: string | null }) => ({
      id: `pending-${a.id}`,
      tipo: 'prontuario_pendente',
      titulo: 'Prontuário pendente',
      mensagem: `${a.paciente_nome ?? 'Paciente'} aguarda registro clínico`,
      lida: false,
      link: '/prontuarios',
      metadados: { atendimento_id: a.id },
      criado_em: a.data_agendamento ?? new Date().toISOString(),
    }),
  )
}

async function buscarFollowUpsPendentesNotif(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<Notificacao[]> {
  const { data: followUps, error } = await supabase
    .from('follow_ups')
    .select('id, paciente_id, created_at, pacientes(nome), tipo:follow_up_tipos(nome)')
    .eq('responsavel_id', userId)
    .eq('status', 'pendente')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) return []

  return (followUps ?? []).map(
    (f: { id: string; paciente_id: string; created_at: string; pacientes?: { nome: string }; tipo?: { nome: string } }) => ({
      id: `followup-${f.id}`,
      tipo: 'follow_up_atribuido',
      titulo: 'Follow-up pendente',
      mensagem: `${f.pacientes?.nome ?? 'Paciente'} — ${f.tipo?.nome ?? 'follow-up'} aguarda seu atendimento`,
      lida: false,
      link: '/follow-ups',
      metadados: { follow_up_id: f.id, paciente_id: f.paciente_id },
      criado_em: f.created_at,
    }),
  )
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

/** Segunda-feira (UTC) da semana corrente, yyyy-mm-dd. Faz o aviso reaparecer semanalmente após ser dispensado. */
function inicioDaSemanaUtc() {
  const d = new Date()
  const dia = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dia)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

async function buscarContatosFriosNotif(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  role: string,
): Promise<Notificacao[]> {
  try {
    const isGestor = role === 'gestor' || role === 'master'

    const orFilter = Object.entries(DIAS_SEM_ATIVIDADE_POR_STATUS)
      .map(([status, dias]) => `and(status.eq.${status},ultima_atividade.lt.${cutoffIso(dias)})`)
      .join(',')

    let query = supabase
      .from('contatos_base')
      .select('paciente_id', { count: 'exact', head: true })
      .or(orFilter)

    if (!isGestor) query = query.eq('responsavel_id', userId)

    const { count, error } = await query
    if (error || !count) return []

    const semana = inicioDaSemanaUtc()
    return [{
      id: `cold-${semana.toISOString().slice(0, 10)}`,
      tipo: 'contato_frio',
      titulo: `Base fria: ${count} contato${count !== 1 ? 's' : ''} sem atividade`,
      mensagem: 'Revise a base para mantê-la aquecida.',
      lida: false,
      link: '/contatos',
      metadados: { total: count },
      criado_em: semana.toISOString(),
    }]
  } catch {
    return []
  }
}

const ROLES_CONTRATOS_NAO_ASSINADOS = ['gestor', 'master', 'recepcionista', 'comercial']

/**
 * Vendas confirmadas com a tag de sistema SEM CONTRATO (mantida por
 * sincronizarTagContratoVenda). Só gestor, master, recepção e comercial
 * recebem o aviso, sempre com o total da clínica.
 */
async function buscarContratosNaoAssinadosNotif(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  role: string,
): Promise<Notificacao[]> {
  if (!ROLES_CONTRATOS_NAO_ASSINADOS.includes(role)) return []

  try {
    const { data: tag } = await supabase
      .from('venda_tags')
      .select('id')
      .eq('sistema_chave', TAG_SISTEMA_SEM_CONTRATO)
      .maybeSingle()
    if (!tag) return []

    const { count, error } = await supabase
      .from('venda_tags_vinculos')
      .select('venda_id', { count: 'exact', head: true })
      .eq('tag_id', tag.id)
    if (error || !count) return []

    const semana = inicioDaSemanaUtc()
    return [{
      id: `contrato-${semana.toISOString().slice(0, 10)}`,
      tipo: 'contrato_nao_assinado',
      titulo: `${count} contrato${count !== 1 ? 's' : ''} sem assinatura`,
      mensagem: count !== 1
        ? 'Há vendas confirmadas sem contrato. Gere e colete a assinatura.'
        : 'Há uma venda confirmada sem contrato. Gere e colete a assinatura.',
      lida: false,
      link: `/vendas?tag=${tag.id}`,
      metadados: { total: count },
      criado_em: semana.toISOString(),
    }]
  } catch {
    return []
  }
}

async function gravarEstado(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  ids: string[],
  campos: { lida?: boolean; dispensada?: boolean },
) {
  const chaves = [...new Set(ids.filter(ehDerivada))]
  if (chaves.length === 0) return
  // Em conflito, só as colunas informadas são sobrescritas (o resto mantém o valor atual).
  await supabase.from('notificacoes_estado').upsert(
    chaves.map((chave) => ({
      usuario_id: userId,
      chave,
      ...campos,
      atualizado_em: new Date().toISOString(),
    })),
    { onConflict: 'usuario_id,chave' },
  )
}

export async function marcarComoLida(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  if (ehDerivada(id)) {
    await gravarEstado(supabase, user.id, [id], { lida: true })
    return
  }
  await supabase.from('notificacoes').update({ lida: true }).eq('id', id).eq('usuario_id', user.id)
}

/** `idsDerivadas`: ids das notificações calculadas visíveis no sino. */
export async function marcarTodasComoLidas(idsDerivadas: string[] = []): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await Promise.all([
    supabase
      .from('notificacoes')
      .update({ lida: true })
      .eq('usuario_id', user.id)
      .eq('lida', false),
    gravarEstado(supabase, user.id, idsDerivadas, { lida: true }),
  ])
}

/** Apaga as persistidas e dispensa as derivadas informadas (até a pendência ser resolvida/renovada). */
export async function limparNotificacoes(idsDerivadas: string[]): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await Promise.all([
    supabase.from('notificacoes').delete().eq('usuario_id', user.id),
    gravarEstado(supabase, user.id, idsDerivadas, { lida: true, dispensada: true }),
  ])
}
