'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { buildAppDateTimeISO, formatAppDateKey } from '@/lib/datetime'
import {
  normalizarDisponibilidade,
  validarHorarioDisponibilidade,
  type DisponibilidadeDia,
} from '@/lib/disponibilidade'
import { validarConflitosProfissional } from '@/lib/agendamento-conflitos'
import {
  adicionarMesesPreservandoDiaLocal,
  adicionarMesesPreservandoDiaUTC,
  recorrenciaSemanalAtiva,
} from '@/lib/recorrencia'
import {
  getAtendimentoStatusKey,
  isStatusNaoEfetivo,
  normalizeAtendimentoStatus,
} from '@/lib/atendimento-status'

function extractTimePart(dateTime: string) {
  const [, timePart = '00:00:00'] = dateTime.split('T')
  return timePart.replace(/([+-]\d{2}:\d{2}|Z)$/, '')
}

async function carregarDisponibilidadesProfissional(profissionalId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('disponibilidade_profissional')
    .select('dia_semana, hora_inicio, hora_fim, almoco_inicio, almoco_fim')
    .eq('profissional_id', profissionalId)
    .eq('ativo', true)

  const disponibilidades = new Map<number, DisponibilidadeDia>()
  for (const item of data ?? []) {
    disponibilidades.set(item.dia_semana, normalizarDisponibilidade(item))
  }

  return disponibilidades
}

async function carregarRoleProfissional(profissionalId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', profissionalId)
    .maybeSingle()

  return data?.role ?? null
}

function validarOcorrenciasNaDisponibilidade(
  disponibilidades: Map<number, DisponibilidadeDia>,
  ocorrencias: { data: string; hora_inicio: string; hora_fim: string }[],
) {
  for (const ocorrencia of ocorrencias) {
    const validacao = validarHorarioDisponibilidade(
      disponibilidades,
      ocorrencia.data,
      ocorrencia.hora_inicio,
      ocorrencia.hora_fim,
    )

    if (!validacao.ok) {
      if (validacao.motivo === 'sem_jornada') {
        return {
          error: `O profissional não possui disponibilidade cadastrada em ${ocorrencia.data}.`,
        }
      }

      return {
        error: `O horário ${ocorrencia.hora_inicio}–${ocorrencia.hora_fim} em ${ocorrencia.data} está fora da disponibilidade. Faixas permitidas: ${validacao.faixas}.`,
      }
    }
  }

  return null
}

function removerMetadadosDisponibilidade(atendimento: {
  data: string
  hora_inicio: string
  hora_fim: string
  [key: string]: boolean | number | string | null | undefined
}) {
  const { data, hora_inicio, hora_fim, ...semMetadados } = atendimento
  void data
  void hora_inicio
  void hora_fim
  return semMetadados
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
  const ocorrencias = Math.max(1, Math.min(365, parseInt(formData.get('ocorrencias') as string) || 1))

  if (!paciente_id || !profissional_id || !dataStr || !horaInicio || !horaFim) {
    return { error: 'Preencha todos os campos obrigatórios.' }
  }

  const roleProfissional = await carregarRoleProfissional(profissional_id)
  const exigeDisponibilidade = roleProfissional !== 'medico'

  // Calcula a duração em minutos
  const start = new Date(`1970-01-01T${horaInicio}:00`)
  const end = new Date(`1970-01-01T${horaFim}:00`)
  let duracao = (end.getTime() - start.getTime()) / 60000
  if (duracao <= 0) duracao = 30 // Fallback de segurança

  let atendimentosParaInserir: Array<{
    paciente_id: string
    profissional_id: string
    data_agendamento: string
    tipo: string
    duracao_minutos: number
    observacoes: string
    status: string
    criado_por: string | null
    gerou_venda: boolean
    marcou_retorno: boolean
    agendamento_id: string
    numero_sessao?: number
    total_sessoes?: number
    data: string
    hora_inicio: string
    hora_fim: string
  }> = []

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
      agendamento_id: '',
      data: dataStr,
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      numero_sessao: 1,
      total_sessoes: 1,
    })
  } else {
    // AGENDAMENTO RECORRENTE
    const dataInicio = new Date(`${dataStr}T00:00:00-03:00`)
    let count = 0

    if (frequencia === 'mes') {
      // LÓGICA MENSAL (Cria exatamente 1 agendamento no mesmo dia do mês)
      let mesesAdicionados = 0
      while (count < ocorrencias) {
        const dataBase = adicionarMesesPreservandoDiaLocal(dataInicio, mesesAdicionados)

        const dataFormatada = formatAppDateKey(dataBase)
        atendimentosParaInserir.push({
          paciente_id, profissional_id, tipo, duracao_minutos: duracao, observacoes, status: 'Aguardando',
          criado_por: user?.id ?? null, gerou_venda, marcou_retorno, agendamento_id: '',
          data_agendamento: buildAppDateTimeISO(dataFormatada, horaInicio),
          data: dataFormatada,
          hora_inicio: horaInicio,
          hora_fim: horaFim,
        })

        count++
        mesesAdicionados++
      }

    } else {
      // LÓGICA SEMANAL (Lida com pulos de 1, 2 ou 3 semanas)
      const diasArray = diasSemana ? diasSemana.split(',').map(Number) : []
      if (diasArray.length === 0) return { error: 'Selecione ao menos um dia da semana.' }

      const semanasPulo = parseInt(frequencia)
      const dataAtual = new Date(`${dataStr}T00:00:00-03:00`)

      while (count < ocorrencias) {
        if (diasArray.includes(dataAtual.getDay())) {
          if (recorrenciaSemanalAtiva(dataAtual, dataInicio, semanasPulo)) {
            const dataFormatada = formatAppDateKey(dataAtual)
            atendimentosParaInserir.push({
              paciente_id, profissional_id, tipo, duracao_minutos: duracao, observacoes, status: 'Aguardando',
              criado_por: user?.id ?? null, gerou_venda, marcou_retorno, agendamento_id: '',
              data_agendamento: buildAppDateTimeISO(dataFormatada, horaInicio),
              data: dataFormatada,
              hora_inicio: horaInicio,
              hora_fim: horaFim,
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

  if (exigeDisponibilidade) {
    const disponibilidades = await carregarDisponibilidadesProfissional(profissional_id)
    const erroDisponibilidade = validarOcorrenciasNaDisponibilidade(
      disponibilidades,
      atendimentosParaInserir.map((a) => ({
        data: a.data,
        hora_inicio: a.hora_inicio,
        hora_fim: a.hora_fim,
      })),
    )

    if (erroDisponibilidade) {
      return erroDisponibilidade
    }
  }

  const erroConflito = await validarConflitosProfissional(
    supabase,
    profissional_id,
    atendimentosParaInserir.map((a) => ({
      data: a.data,
      hora_inicio: a.hora_inicio,
      hora_fim: a.hora_fim,
    })),
  )

  if (erroConflito) {
    return erroConflito
  }

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
      termina_em: isRecorrente ? 'ocorrencias' : null,
      data_fim: null,
      total_ocorrencias: isRecorrente ? ocorrencias : null,
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

  const { error } = await supabase.from('atendimentos').insert(
    atendimentosParaInserir.map((atendimento) =>
      removerMetadadosDisponibilidade({
        ...atendimento,
        agendamento_id: agendamentoPai.id,
      }),
    ),
  )

  if (error) {
    console.error('Erro ao agendar:', error.message)
    return { error: `Erro ao salvar atendimento(s): ${error.message}` }
  }

  revalidatePath('/agenda')
  return { success: true }
}

export async function buscarDetalhesAgendamento(atendimentoId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('atendimentos')
    .select(`
      id,
      paciente_id,
      profissional_id,
      agendamento_id,
      data_agendamento,
      status,
      tipo,
      duracao_minutos,
      observacoes,
      numero_sessao,
      total_sessoes,
      pacientes (nome, telefone, email),
      profissional:profiles!profissional_id(full_name, role)
    `)
    .eq('id', atendimentoId)
    .maybeSingle()

  if (error) {
    return { error: error.message }
  }

  return { data }
}

export async function contarAtendimentosPaciente(pacienteId: string): Promise<{ total: number; cancelados: number }> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('atendimentos')
    .select('status')
    .eq('paciente_id', pacienteId)
  const total = data?.length ?? 0
  const cancelados = data?.filter(a => isStatusNaoEfetivo(a.status)).length ?? 0
  return { total, cancelados }
}

export async function deletarAgendamento(id: string) {
  const supabase = await createClient()

  const { data: atendimento } = await supabase
    .from('atendimentos')
    .select('agendamento_id')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase
    .from('atendimentos')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Erro ao deletar:', error.message)
    return { error: 'Não foi possível excluir o agendamento.' }
  }

  if (atendimento?.agendamento_id) {
    const { count } = await supabase
      .from('atendimentos')
      .select('id', { count: 'exact', head: true })
      .eq('agendamento_id', atendimento.agendamento_id)

    if (count === 0) {
      await supabase.from('agendamentos').delete().eq('id', atendimento.agendamento_id)
    }
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
    const next = adicionarMesesPreservandoDiaUTC(ultimaData, 1)
    return next.toISOString().split('T')[0]
  }

  if (!diasSemanaStr) return null

  const diasArray = diasSemanaStr.split(',').map(Number)
  const semanasPulo = parseInt(frequencia)
  const dataInicio = toUTC(dataInicioStr)

  const dataAtual = new Date(ultimaData)
  dataAtual.setUTCDate(dataAtual.getUTCDate() + 1)

  for (let i = 0; i < 365; i++) {
    const dayOfWeek = dataAtual.getUTCDay()
    if (diasArray.includes(dayOfWeek)) {
      if (recorrenciaSemanalAtiva(dataAtual, dataInicio, semanasPulo)) {
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

  if (!profissional_id) {
    return { error: 'Selecione um profissional.' }
  }

  const roleProfissional = await carregarRoleProfissional(profissional_id)
  if (roleProfissional !== 'medico') {
    const disponibilidades = await carregarDisponibilidadesProfissional(profissional_id)
    const erroDisponibilidade = validarOcorrenciasNaDisponibilidade(disponibilidades, [
      { data: dataStr, hora_inicio: horaInicio, hora_fim: horaFim },
    ])

    if (erroDisponibilidade) {
      return erroDisponibilidade
    }
  }

  const erroConflito = await validarConflitosProfissional(
    supabase,
    profissional_id,
    [{ data: dataStr, hora_inicio: horaInicio, hora_fim: horaFim }],
    { ignorarAtendimentoId: id },
  )

  if (erroConflito) {
    return erroConflito
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
  const statusKey = getAtendimentoStatusKey(novoStatus)
  if (statusKey === 'desconhecido') {
    return { error: `Status inválido: ${novoStatus}` }
  }

  const statusCanonico = normalizeAtendimentoStatus(novoStatus)

  const { error } = await supabase
    .from('atendimentos')
    .update({ status: statusCanonico })
    .eq('id', id)

  if (error) {
    console.error('Erro ao mudar status:', error.message)
    return { error: `Não foi possível alterar o status para "${statusCanonico}": ${error.message}` }
  }

  revalidatePath('/agenda')
  return { success: true }
}
