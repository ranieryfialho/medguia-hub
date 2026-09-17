'use server'

import { revalidatePath } from 'next/cache'
import { requirePermissaoAgendaAdmin, editarAtendimento, deletarAgendamento, type MotivoExclusao } from '@/actions/agenda'
import { createClient } from '@/lib/supabase/server'

// Tipo fixo de toda pré-consulta gerada por este fluxo — a pré-consulta já
// é, por definição, esse tipo, então não faz sentido pedir para o usuário
// escolher entre os tipos de consulta cadastrados.
const TIPO_PRE_CONSULTA = 'Pré-consulta'

export type CriarPreConsultaPendenteInput = {
  consultaMedicaAtendimentoId: string
}

export async function criarPreConsultaPendente(
  input: CriarPreConsultaPendenteInput,
): Promise<{ success?: true; id?: string; error?: string }> {
  const ctx = await requirePermissaoAgendaAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { supabaseAdmin, userId } = ctx

  const consultaMedicaAtendimentoId = input.consultaMedicaAtendimentoId.trim()

  if (!consultaMedicaAtendimentoId) {
    return { error: 'Consulta médica de origem não informada.' }
  }

  const { data: origem, error: erroOrigem } = await supabaseAdmin
    .from('atendimentos')
    .select('id, paciente_id')
    .eq('id', consultaMedicaAtendimentoId)
    .maybeSingle()

  if (erroOrigem || !origem) {
    return { error: 'Consulta médica de origem não encontrada.' }
  }

  const { count: pendenciaExistente } = await supabaseAdmin
    .from('atendimentos')
    .select('id', { count: 'exact', head: true })
    .eq('agendamento_origem_id', consultaMedicaAtendimentoId)
    .eq('status', 'Aguardando Fisioterapeuta')

  if ((pendenciaExistente ?? 0) > 0) {
    return { error: 'Já existe uma pré-consulta pendente para essa consulta.' }
  }

  const { data: criado, error } = await supabaseAdmin
    .from('atendimentos')
    .insert({
      paciente_id: origem.paciente_id,
      profissional_id: null,
      fisioterapeuta_id: null,
      data_agendamento: null,
      tipo: TIPO_PRE_CONSULTA,
      status: 'Aguardando Fisioterapeuta',
      tipo_evento: 'agendamento',
      agendamento_id: null,
      agendamento_origem_id: consultaMedicaAtendimentoId,
      direcao_encaminhamento: 'pre',
      criado_por: userId,
      numero_sessao: 1,
      total_sessoes: 1,
    })
    .select('id')
    .single()

  if (error || !criado) {
    console.error('Erro ao criar pré-consulta pendente:', error?.message)
    return { error: `Não foi possível criar a pré-consulta: ${error?.message ?? 'resposta vazia do banco'}` }
  }

  revalidatePath('/agenda')
  revalidatePath('/pre-consultas')
  return { success: true, id: criado.id }
}

export async function atribuirFisioterapeutaPreConsulta(
  atendimentoId: string,
  formData: FormData,
): Promise<{ success?: true; error?: string }> {
  const resultado = await editarAtendimento(atendimentoId, formData)
  if ('error' in resultado && resultado.error) return { error: resultado.error }

  const ctx = await requirePermissaoAgendaAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { supabaseAdmin } = ctx

  const { error } = await supabaseAdmin
    .from('atendimentos')
    .update({ status: 'Aguardando' })
    .eq('id', atendimentoId)
    .eq('status', 'Aguardando Fisioterapeuta')

  if (error) {
    console.error('Erro ao atualizar status após atribuir fisioterapeuta:', error.message)
    return { error: 'O fisioterapeuta foi atribuído, mas não foi possível atualizar o status.' }
  }

  revalidatePath('/pre-consultas')
  revalidatePath('/agenda')
  return { success: true }
}

// Trava de escopo desta Server Action: só exclui um atendimento que ainda
// esteja "Aguardando Fisioterapeuta" (pendente, sem fisio atribuído) e que
// seja ele mesmo uma pré/pós-consulta gerada por uma consulta médica
// (agendamento_origem_id preenchido). A consulta médica de origem nunca é o
// alvo — ela não tem agendamento_origem_id — então excluir aqui nunca
// mexe nela.
export async function excluirPreConsultaPendente(
  atendimentoId: string,
  motivo: MotivoExclusao,
): Promise<{ success?: true; error?: string }> {
  const ctx = await requirePermissaoAgendaAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { supabaseAdmin } = ctx

  const { data, error } = await supabaseAdmin
    .from('atendimentos')
    .select('id, agendamento_origem_id, status')
    .eq('id', atendimentoId)
    .maybeSingle()

  if (error || !data) {
    return { error: 'Pré/pós-consulta não encontrada.' }
  }

  if (!data.agendamento_origem_id) {
    return { error: 'Isso não é uma pré/pós-consulta de fisioterapia.' }
  }

  if (data.status !== 'Aguardando Fisioterapeuta') {
    return { error: 'Só é possível excluir pré/pós-consultas ainda pendentes de atribuição.' }
  }

  const resultado = await deletarAgendamento(atendimentoId, motivo)
  if (resultado.error) return { error: resultado.error }

  revalidatePath('/pre-consultas')
  return { success: true }
}

export async function buscarOcultarAvisoPreConsulta(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from('profiles')
    .select('ocultar_aviso_pre_consulta')
    .eq('id', user.id)
    .maybeSingle()

  return data?.ocultar_aviso_pre_consulta ?? false
}

export async function salvarOcultarAvisoPreConsulta(ocultar: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { error } = await supabase
    .from('profiles')
    .update({ ocultar_aviso_pre_consulta: ocultar })
    .eq('id', user.id)

  if (error) {
    console.error('Erro ao salvar preferência de aviso de pré-consulta:', error.message)
    return { error: 'Não foi possível salvar a preferência.' }
  }

  return {}
}

export type ConsultaMedicaSemVinculo = {
  id: string
  data_agendamento: string
  profissionalNome: string | null
}

export async function buscarConsultaMedicaSemVinculo(
  pacienteId: string,
): Promise<ConsultaMedicaSemVinculo | null> {
  if (!pacienteId) return null
  const supabase = await createClient()

  const { data: medicos } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'medico')

  const idsMedicos = (medicos ?? []).map((m) => m.id)
  if (idsMedicos.length === 0) return null

  const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: candidatas } = await supabase
    .from('atendimentos')
    .select('id, data_agendamento, profissional:profiles!profissional_id(full_name)')
    .eq('paciente_id', pacienteId)
    .in('profissional_id', idsMedicos)
    .neq('status', 'Cancelado')
    .gte('data_agendamento', seteDiasAtras)
    .order('data_agendamento', { ascending: false })
    .limit(10)

  const lista = (candidatas ?? []) as Array<{
    id: string
    data_agendamento: string
    profissional: { full_name: string | null } | { full_name: string | null }[] | null
  }>

  if (lista.length === 0) return null

  const { data: vinculadas } = await supabase
    .from('atendimentos')
    .select('agendamento_origem_id')
    .in('agendamento_origem_id', lista.map((item) => item.id))

  const idsJaVinculados = new Set((vinculadas ?? []).map((v) => v.agendamento_origem_id))

  const semVinculo = lista.find((item) => !idsJaVinculados.has(item.id))
  if (!semVinculo) return null

  const profissional = Array.isArray(semVinculo.profissional)
    ? semVinculo.profissional[0] ?? null
    : semVinculo.profissional

  return {
    id: semVinculo.id,
    data_agendamento: semVinculo.data_agendamento,
    profissionalNome: profissional?.full_name ?? null,
  }
}
