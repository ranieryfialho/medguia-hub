'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Dado a data da última sessão e o padrão de recorrência, calcula a próxima data
 * seguindo a mesma lógica usada em criarAgendamento.
 */
function calcularProximaData(
  ultimaDataStr: string,
  dataInicioStr: string,
  diasSemanaStr: string | null,
  frequencia: string
): string | null {
  const toUTC = (s: string) => new Date(`${s.split('T')[0]}T00:00:00Z`)
  const ultimaData = toUTC(ultimaDataStr)

  if (frequencia === 'mes') {
    const next = new Date(ultimaData)
    next.setUTCMonth(next.getUTCMonth() + 1)
    return next.toISOString().split('T')[0]
  }

  if (!diasSemanaStr) return null

  const diasArray = diasSemanaStr.split(',').map(Number)
  const semanasPulo = parseInt(frequencia)
  const dataInicio = toUTC(dataInicioStr)

  // Domingo da semana base (igual à lógica de criarAgendamento)
  const baseWeekStart = new Date(dataInicio)
  baseWeekStart.setUTCDate(dataInicio.getUTCDate() - dataInicio.getUTCDay())

  // Buscar a partir do dia seguinte à última sessão
  const dataAtual = new Date(ultimaData)
  dataAtual.setUTCDate(dataAtual.getUTCDate() + 1)

  for (let i = 0; i < 365; i++) {
    const dayOfWeek = dataAtual.getUTCDay()
    if (diasArray.includes(dayOfWeek)) {
      const diffDias = Math.round((dataAtual.getTime() - baseWeekStart.getTime()) / (1000 * 60 * 60 * 24))
      const diffSemanas = Math.floor(diffDias / 7)
      if (diffSemanas % semanasPulo === 0) {
        return dataAtual.toISOString().split('T')[0]
      }
    }
    dataAtual.setUTCDate(dataAtual.getUTCDate() + 1)
  }

  return null
}

/**
 * Apenas calcula a próxima data de uma recorrência sem salvar nada no DB.
 * Usado para pré-preencher o slide antes de abrir.
 */
export async function obterProximaData(atendimentoId: string): Promise<{ data: string } | null> {
  const supabase = await createClient()

  const { data: atual } = await supabase
    .from('atendimentos')
    .select('agendamento_id, data_agendamento')
    .eq('id', atendimentoId)
    .single()

  if (!atual?.agendamento_id) return null

  const { data: agendamento } = await supabase
    .from('agendamentos')
    .select('frequencia, dias_semana, data_inicio, is_recorrente')
    .eq('id', atual.agendamento_id)
    .single()

  const { data: ultimaSessao } = await supabase
    .from('atendimentos')
    .select('data_agendamento')
    .eq('agendamento_id', atual.agendamento_id)
    .order('data_agendamento', { ascending: false })
    .limit(1)
    .single()

  if (!agendamento?.is_recorrente || !agendamento?.frequencia || !ultimaSessao) return null

  const proximaDataStr = calcularProximaData(
    ultimaSessao.data_agendamento,
    agendamento.data_inicio,
    agendamento.dias_semana,
    agendamento.frequencia
  )

  return proximaDataStr ? { data: proximaDataStr } : null
}

export async function registrarContato(
  atendimentoId: string,
  resultado: 'confirmou' | 'vai_faltar' | 'nao_atendeu' | 'reagendou'
) {
  const supabase = await createClient()

  let novoStatus: string | null = null
  if (resultado === 'confirmou') {
    novoStatus = 'Confirmado'
  } else if (resultado === 'vai_faltar') {
    novoStatus = 'Falta'
  } else if (resultado === 'reagendou') {
    novoStatus = 'Reagendado'
  }

  const updateData: any = { contato_confirmacao: resultado }
  if (novoStatus) {
    updateData.status = novoStatus
  }

  const { error } = await supabase
    .from('atendimentos')
    .update(updateData)
    .eq('id', atendimentoId)

  if (error) {
    console.error('Erro ao registrar contato:', error.message)
    return { error: 'Não foi possível registrar o contato.' }
  }

  revalidatePath('/confirmacoes')
  revalidatePath('/agenda')
  revalidatePath('/pacientes', 'layout')
  return { success: true }
}

/**
 * Adiciona uma sessão de reposição ao agendamento existente do paciente.
 * Não cria um novo agendamento — insere um atendimento no bloco já existente.
 */
export async function adicionarSessaoReposicao(
  agendamentoId: string,
  data: string, // 'yyyy-MM-dd'
  hora: string  // 'HH:mm'
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: agendamento } = await supabase
    .from('agendamentos')
    .select('paciente_id, profissional_id, tipo, duracao_minutos, observacoes')
    .eq('id', agendamentoId)
    .single()

  if (!agendamento) return { error: 'Agendamento não encontrado.' }

  const { count } = await supabase
    .from('atendimentos')
    .select('id', { count: 'exact', head: true })
    .eq('agendamento_id', agendamentoId)

  const novoNumero = (count ?? 0) + 1

  const { error } = await supabase.from('atendimentos').insert({
    paciente_id: agendamento.paciente_id,
    profissional_id: agendamento.profissional_id,
    data_agendamento: new Date(`${data}T${hora}:00`).toISOString(),
    tipo: agendamento.tipo,
    duracao_minutos: agendamento.duracao_minutos ?? 30,
    observacoes: agendamento.observacoes,
    status: 'Aguardando',
    agendamento_id: agendamentoId,
    numero_sessao: novoNumero,
    total_sessoes: novoNumero,
  })

  if (error) {
    console.error('Erro ao adicionar sessão de reposição:', error.message)
    return { error: 'Não foi possível agendar a reposição.' }
  }

  // Atualiza total_sessoes em todos os atendimentos do bloco
  await supabase
    .from('atendimentos')
    .update({ total_sessoes: novoNumero })
    .eq('agendamento_id', agendamentoId)

  revalidatePath('/agenda')
  revalidatePath('/confirmacoes')
  revalidatePath('/pacientes', 'layout')
  return { success: true }
}

export async function registrarEnvioWhatsApp(
  atendimentoId: string,
  templateId: string
) {
  try {
    const supabase = await createClient()

    await supabase
      .from('atendimentos')
      .update({
        ultimo_template_enviado: templateId,
        data_ultimo_envio_whatsapp: new Date().toISOString()
      })
      .eq('id', atendimentoId)

    revalidatePath('/confirmacoes')
    return { success: true }
  } catch (error) {
    console.error('Erro ao registrar envio WhatsApp:', error)
    return { success: true }
  }
}