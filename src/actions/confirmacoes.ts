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

  // Para "vai_faltar": criar nova sessão ao final da recorrência
  let proxima: { data: string; numero: number } | null = null

  if (resultado === 'vai_faltar') {
    const { data: atual } = await supabase
      .from('atendimentos')
      .select('agendamento_id, data_agendamento')
      .eq('id', atendimentoId)
      .single()

    if (atual?.agendamento_id) {
      // Buscar configuração de recorrência do agendamento pai
      const { data: agendamento } = await supabase
        .from('agendamentos')
        .select('frequencia, dias_semana, data_inicio, hora_inicio, hora_fim, duracao_minutos, paciente_id, profissional_id, tipo, observacoes, gerou_venda, marcou_retorno, is_recorrente')
        .eq('id', atual.agendamento_id)
        .single()

      // Buscar última sessão da recorrência (maior data_agendamento)
      const { data: ultimaSessao } = await supabase
        .from('atendimentos')
        .select('data_agendamento, numero_sessao, total_sessoes')
        .eq('agendamento_id', atual.agendamento_id)
        .order('data_agendamento', { ascending: false })
        .limit(1)
        .single()

      if (agendamento?.is_recorrente && agendamento?.frequencia && ultimaSessao) {
        const proximaDataStr = calcularProximaData(
          ultimaSessao.data_agendamento,
          agendamento.data_inicio,
          agendamento.dias_semana,
          agendamento.frequencia
        )

        if (proximaDataStr) {
          // Preservar o mesmo horário das sessões existentes
          const timeStr = ultimaSessao.data_agendamento.includes('T')
            ? ultimaSessao.data_agendamento.split('T')[1]
            : '00:00:00+00:00'
          const novaDataISO = `${proximaDataStr}T${timeStr}`

          const novoNumero = (ultimaSessao.numero_sessao ?? 1) + 1
          const novoTotal = (ultimaSessao.total_sessoes ?? novoNumero - 1) + 1

          // Inserir nova sessão
          const { error: insertError } = await supabase.from('atendimentos').insert({
            paciente_id: agendamento.paciente_id,
            profissional_id: agendamento.profissional_id,
            data_agendamento: novaDataISO,
            tipo: agendamento.tipo,
            duracao_minutos: agendamento.duracao_minutos,
            observacoes: agendamento.observacoes,
            status: 'Aguardando',
            agendamento_id: atual.agendamento_id,
            numero_sessao: novoNumero,
            total_sessoes: novoTotal,
            gerou_venda: agendamento.gerou_venda ?? false,
            marcou_retorno: agendamento.marcou_retorno ?? false,
          })

          if (!insertError) {
            // Atualizar total_sessoes em todas as sessões da recorrência
            await supabase
              .from('atendimentos')
              .update({ total_sessoes: novoTotal })
              .eq('agendamento_id', atual.agendamento_id)

            proxima = { data: novaDataISO, numero: novoNumero }
          }
        }
      }
    }
  }

  revalidatePath('/confirmacoes')
  revalidatePath('/agenda')
  return { success: true, proxima }
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