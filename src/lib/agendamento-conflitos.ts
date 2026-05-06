import { buildAppDateTimeISO, formatAppDateKey, formatAppTime } from '@/lib/datetime'
import { createClient } from '@/lib/supabase/server'

const STATUS_QUE_NAO_BLOQUEIAM = '("cancelado","Cancelado","falta","Falta","reagendado","Reagendado")'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface OcorrenciaAgendamento {
  data: string
  hora_inicio: string
  hora_fim: string
}

function calcularFimEmMinutos(hora: string, minutos: number) {
  const [horaBase, minutoBase] = hora.split(':').map(Number)
  const total = horaBase * 60 + minutoBase + minutos
  const horas = Math.floor(total / 60)
  const mins = total % 60
  return `${String(horas).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function montarIntervalo(ocorrencia: OcorrenciaAgendamento) {
  const inicioIso = buildAppDateTimeISO(ocorrencia.data, ocorrencia.hora_inicio)
  const fimIso = buildAppDateTimeISO(ocorrencia.data, ocorrencia.hora_fim)

  return {
    ...ocorrencia,
    inicio: new Date(inicioIso),
    fim: new Date(fimIso),
  }
}

export function calcularHoraFim(horaInicio: string, duracaoMinutos: number) {
  return calcularFimEmMinutos(horaInicio, duracaoMinutos)
}

export async function validarConflitosProfissional(
  supabase: SupabaseServerClient,
  profissionalId: string,
  ocorrencias: OcorrenciaAgendamento[],
  options?: { ignorarAtendimentoId?: string },
) {
  if (!profissionalId || ocorrencias.length === 0) return null

  const intervalos = ocorrencias.map(montarIntervalo)
  const menorData = intervalos.reduce((menor, item) => (item.data < menor ? item.data : menor), intervalos[0].data)
  const maiorData = intervalos.reduce((maior, item) => (item.data > maior ? item.data : maior), intervalos[0].data)

  let query = supabase
    .from('atendimentos')
    .select('id, data_agendamento, duracao_minutos, status')
    .eq('profissional_id', profissionalId)
    .gte('data_agendamento', buildAppDateTimeISO(menorData, '00:00'))
    .lte('data_agendamento', buildAppDateTimeISO(maiorData, '23:59'))
    .not('status', 'in', STATUS_QUE_NAO_BLOQUEIAM)

  if (options?.ignorarAtendimentoId) {
    query = query.neq('id', options.ignorarAtendimentoId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Erro ao validar conflitos de agenda:', error.message)
    return { error: 'Não foi possível validar conflitos de agenda.' }
  }

  const atendimentosPorData = new Map<
    string,
    Array<{ inicio: Date; fim: Date }>
  >()

  for (const atendimento of data ?? []) {
    const inicio = new Date(atendimento.data_agendamento)
    const fim = new Date(
      inicio.getTime() + Math.max(atendimento.duracao_minutos ?? 30, 1) * 60000,
    )
    const chaveData = formatAppDateKey(inicio)
    const lista = atendimentosPorData.get(chaveData) ?? []
    lista.push({ inicio, fim })
    atendimentosPorData.set(chaveData, lista)
  }

  for (const intervalo of intervalos) {
    const atendimentosNoDia = atendimentosPorData.get(intervalo.data) ?? []

    for (const existente of atendimentosNoDia) {
      const temSobreposicao =
        existente.inicio < intervalo.fim && existente.fim > intervalo.inicio

      if (!temSobreposicao) continue

      return {
        error: `O profissional já possui outro atendimento em ${intervalo.data}, entre ${formatAppTime(existente.inicio)} e ${formatAppTime(existente.fim)}.`,
      }
    }
  }

  return null
}
