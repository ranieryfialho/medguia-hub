'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { buildAppDateTimeISO, formatAppDateKey } from '@/lib/datetime'

function extractTimePart(dateTime: string) {
  const [, timePart = '00:00:00'] = dateTime.split('T')
  return timePart.replace(/([+-]\d{2}:\d{2}|Z)$/, '')
}

export async function criarAgendamento(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const paciente_id = formData.get('paciente_id') as string
  const profissional_id = formData.get('profissional_id') as string
  const dataStr = formData.get('data') as string // YYYY-MM-DD
  const horaInicio = formData.get('hora_inicio') as string // HH:mm
  const horaFim = formData.get('hora_fim') as string // HH:mm
  const tipo = formData.get('tipo') as string
  const observacoes = formData.get('observacoes') as string
  const gerou_venda = formData.get('gerou_venda') === 'on'
  const marcou_retorno = formData.get('marcou_retorno') === 'on'

  // Campos de recorrência
  const isRecorrente = formData.get('is_recorrente') === 'true'
  const frequencia = formData.get('frequencia') as string // '1', '2', '3', ou 'mes'
  const diasSemana = formData.get('dias_semana') as string // ex: "1,3,5"
  const terminaEm = formData.get('termina_em') as string // 'data', 'ocorrencias' ou 'sem_fim'
  const dataFimStr = formData.get('data_fim') as string
  const ocorrencias = parseInt(formData.get('ocorrencias') as string) || 1

  if (!paciente_id || !profissional_id || !dataStr || !horaInicio || !horaFim) {
    return { error: 'Preencha todos os campos obrigatórios.' }
  }

  // Calcula a duração em minutos
  const start = new Date(`1970-01-01T${horaInicio}:00`)
  const end = new Date(`1970-01-01T${horaFim}:00`)
  let duracao = (end.getTime() - start.getTime()) / 60000
  if (duracao <= 0) duracao = 30 // Fallback de segurança

  // Criar registro pai em agendamentos
  const { data: agendamentoPai, error: erroAgendamento } = await supabase
    .from('agendamentos')
    .insert({
      paciente_id,
      profissional_id,
      tipo: tipo || 'Sessão',
      data_inicio: dataStr,
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      duracao_minutos: duracao,
      is_recorrente: isRecorrente,
      frequencia: isRecorrente ? frequencia : null,
      dias_semana: isRecorrente ? diasSemana : null,
      termina_em: isRecorrente ? terminaEm : null,
      data_fim: isRecorrente && terminaEm === 'data' ? dataFimStr : null,
      total_ocorrencias: isRecorrente && terminaEm === 'ocorrencias' ? ocorrencias : null,
      observacoes,
      gerou_venda,
      marcou_retorno,
      criado_por: user?.id ?? null,
    })
    .select('id')
    .single()

  if (erroAgendamento || !agendamentoPai) {
    console.error('Erro ao criar agendamento pai:', erroAgendamento?.message)
    return { error: `Erro ao criar agendamento: ${erroAgendamento?.message ?? 'Resposta vazia do banco'}` }
  }

  const agendamentoId = agendamentoPai.id

  let atendimentosParaInserir = []

  if (!isRecorrente) {
    // AGENDAMENTO ÚNICO
    atendimentosParaInserir.push({
      paciente_id,
      profissional_id,
      data_agendamento: buildAppDateTimeISO(dataStr, horaInicio),
      tipo,
      duracao_minutos: duracao,
      observacoes,
      status: 'Aguardando',
      criado_por: user?.id ?? null,
      gerou_venda,
      marcou_retorno,
      agendamento_id: agendamentoId,
      numero_sessao: 1,
      total_sessoes: 1,
    })
  } else {
    // AGENDAMENTO RECORRENTE
    const dataInicio = new Date(`${dataStr}T00:00:00`)
    
    // Regra de Ouro: Nunca passar de 12 meses para evitar sobrecarga no banco
    const limiteMaximoSeguranca = new Date(dataInicio)
    limiteMaximoSeguranca.setMonth(limiteMaximoSeguranca.getMonth() + 12)

    let limiteData = new Date('2099-01-01T00:00:00')
    let limiteOcorrencias = 365

    if (terminaEm === 'sem_fim') {
      limiteData = limiteMaximoSeguranca
    } else if (terminaEm === 'data' && dataFimStr) {
      limiteData = new Date(`${dataFimStr}T23:59:59`)
      if (limiteData > limiteMaximoSeguranca) limiteData = limiteMaximoSeguranca
    } else if (terminaEm === 'ocorrencias') {
      limiteOcorrencias = Math.min(ocorrencias, 365)
    }

    let count = 0

    if (frequencia === 'mes') {
      // LÓGICA MENSAL (Cria exatamente 1 agendamento no mesmo dia do mês)
      let mesesAdicionados = 0
      while (count < limiteOcorrencias) {
        const dataBase = new Date(dataInicio)
        const targetMonth = dataBase.getMonth() + mesesAdicionados
        dataBase.setMonth(targetMonth)

        // Correção de overflow de mês (Ex: 31 de Jan + 1 mês = 28/29 de Fev e não março)
        if (dataBase.getMonth() !== (targetMonth % 12 + 12) % 12) {
          dataBase.setDate(0) // Volta pro último dia do mês correto
        }

        if (dataBase > limiteData) break;

        const dataFormatada = formatAppDateKey(dataBase)
        atendimentosParaInserir.push({
          paciente_id, profissional_id, tipo, duracao_minutos: duracao, observacoes, status: 'Aguardando',
          criado_por: user?.id ?? null, gerou_venda, marcou_retorno, agendamento_id: agendamentoId,
          data_agendamento: buildAppDateTimeISO(dataFormatada, horaInicio)
        })

        count++
        mesesAdicionados++
      }

    } else {
      // LÓGICA SEMANAL (Lida com pulos de 1, 2 ou 3 semanas)
      const diasArray = diasSemana ? diasSemana.split(',').map(Number) : []
      if (diasArray.length === 0) return { error: 'Selecione ao menos um dia da semana.' }

      const semanasPulo = parseInt(frequencia)
      const inicioDaSemanaBase = new Date(dataInicio)
      inicioDaSemanaBase.setDate(inicioDaSemanaBase.getDate() - dataInicio.getDay())

      const dataAtual = new Date(dataInicio)

      while (count < limiteOcorrencias && dataAtual <= limiteData) {
        if (diasArray.includes(dataAtual.getDay())) {
          // Descobre se a semana atual é uma semana "ativa" baseado no pulo (1, 2 ou 3)
          const diffTime = dataAtual.getTime() - inicioDaSemanaBase.getTime()
          const diffSemanas = Math.floor(Math.floor(diffTime / (1000 * 60 * 60 * 24)) / 7)

          if (diffSemanas % semanasPulo === 0) {
            const dataFormatada = formatAppDateKey(dataAtual)
            atendimentosParaInserir.push({
              paciente_id, profissional_id, tipo, duracao_minutos: duracao, observacoes, status: 'Aguardando',
              criado_por: user?.id ?? null, gerou_venda, marcou_retorno, agendamento_id: agendamentoId,
              data_agendamento: buildAppDateTimeISO(dataFormatada, horaInicio)
            })
            count++
          }
        }
        dataAtual.setDate(dataAtual.getDate() + 1)
      }
    }
  }

  // Para agendamentos recorrentes, numerar as sessões
  if (isRecorrente && atendimentosParaInserir.length > 0) {
    const total = atendimentosParaInserir.length
    atendimentosParaInserir = atendimentosParaInserir.map((a, idx) => ({
      ...a,
      numero_sessao: idx + 1,
      total_sessoes: total,
    }))
  }

  const { error } = await supabase.from('atendimentos').insert(atendimentosParaInserir)

  if (error) {
    console.error('Erro ao agendar:', error.message)
    return { error: `Erro ao salvar atendimento(s): ${error.message}` }
  }

  revalidatePath('/agenda')
  return { success: true }
}

export async function contarAtendimentosPaciente(pacienteId: string): Promise<{ total: number; cancelados: number }> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('atendimentos')
    .select('status')
    .eq('paciente_id', pacienteId)
  const total = data?.length ?? 0
  const cancelados = data?.filter(a => a.status === 'Cancelado' || a.status === 'Falta').length ?? 0
  return { total, cancelados }
}

export async function deletarAgendamento(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('atendimentos')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Erro ao deletar:', error.message)
    return { error: 'Não foi possível excluir o agendamento.' }
  }

  revalidatePath('/agenda')
  return { success: true }
}

function calcularProximaDataAgenda(
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

  const baseWeekStart = new Date(dataInicio)
  baseWeekStart.setUTCDate(dataInicio.getUTCDate() - dataInicio.getUTCDay())

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

export async function deletarAtendimentoPontualDaRecorrencia(id: string) {
  const supabase = await createClient()

  const { data: atual } = await supabase
    .from('atendimentos')
    .select('agendamento_id, data_agendamento')
    .eq('id', id)
    .single()

  if (!atual?.agendamento_id) {
    const { error } = await supabase.from('atendimentos').delete().eq('id', id)
    if (error) return { error: 'Não foi possível excluir o agendamento.' }
    revalidatePath('/agenda')
    return { success: true }
  }

  const { data: agendamento } = await supabase
    .from('agendamentos')
    .select('frequencia, dias_semana, data_inicio, duracao_minutos, paciente_id, profissional_id, tipo, observacoes, gerou_venda, marcou_retorno, is_recorrente')
    .eq('id', atual.agendamento_id)
    .single()

  const { error: deleteError } = await supabase.from('atendimentos').delete().eq('id', id)
  if (deleteError) return { error: 'Não foi possível excluir o agendamento.' }

  if (agendamento?.is_recorrente && agendamento?.frequencia) {
    const { data: ultimaSessao } = await supabase
      .from('atendimentos')
      .select('data_agendamento, numero_sessao, total_sessoes')
      .eq('agendamento_id', atual.agendamento_id)
      .order('data_agendamento', { ascending: false })
      .limit(1)
      .single()

    if (ultimaSessao) {
      const proximaDataStr = calcularProximaDataAgenda(
        ultimaSessao.data_agendamento,
        agendamento.data_inicio,
        agendamento.dias_semana,
        agendamento.frequencia
      )

      if (proximaDataStr) {
        const timeStr = ultimaSessao.data_agendamento.includes('T')
          ? extractTimePart(ultimaSessao.data_agendamento)
          : '00:00:00'
        const novaDataISO = `${proximaDataStr}T${timeStr}`
        const novoNumero = (ultimaSessao.numero_sessao ?? 1) + 1
        const novoTotal = (ultimaSessao.total_sessoes ?? novoNumero - 1) + 1

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
          await supabase
            .from('atendimentos')
            .update({ total_sessoes: novoTotal })
            .eq('agendamento_id', atual.agendamento_id)
        }
      }
    }
  }

  revalidatePath('/agenda')
  revalidatePath('/confirmacoes')
  revalidatePath('/pacientes', 'layout')
  return { success: true }
}

export async function deletarTodasRecorrencias(agendamentoId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('atendimentos')
    .delete()
    .eq('agendamento_id', agendamentoId)

  if (error) return { error: 'Não foi possível excluir os agendamentos.' }

  await supabase.from('agendamentos').delete().eq('id', agendamentoId)

  revalidatePath('/agenda')
  revalidatePath('/confirmacoes')
  revalidatePath('/pacientes', 'layout')
  return { success: true }
}

export async function editarAtendimento(id: string, formData: FormData) {
  const supabase = await createClient()

  const profissional_id = formData.get('profissional_id') as string
  const dataStr = formData.get('data') as string
  const horaInicio = formData.get('hora_inicio') as string
  const horaFim = formData.get('hora_fim') as string
  const tipo = formData.get('tipo') as string
  const observacoes = formData.get('observacoes') as string

  if (!dataStr || !horaInicio || !horaFim) {
    return { error: 'Preencha todos os campos obrigatórios.' }
  }

  const start = new Date(`1970-01-01T${horaInicio}:00`)
  const end = new Date(`1970-01-01T${horaFim}:00`)
  let duracao = (end.getTime() - start.getTime()) / 60000
  if (duracao <= 0) duracao = 30

  const { error } = await supabase
    .from('atendimentos')
    .update({
      profissional_id: profissional_id || null,
      data_agendamento: buildAppDateTimeISO(dataStr, horaInicio),
      tipo: tipo || 'Sessão',
      duracao_minutos: duracao,
      observacoes: observacoes || null,
    })
    .eq('id', id)

  if (error) {
    console.error('Erro ao editar:', error.message)
    return { error: 'Não foi possível editar o agendamento.' }
  }

  revalidatePath('/agenda')
  return { success: true }
}

export async function mudarStatusAgendamento(id: string, novoStatus: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('atendimentos')
    .update({ status: novoStatus })
    .eq('id', id)

  if (error) {
    console.error('Erro ao mudar status:', error.message)
    return { error: 'Não foi possível alterar o status.' }
  }

  revalidatePath('/agenda')
  revalidatePath('/pacientes', 'layout')
  return { success: true }
}
