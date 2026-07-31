'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { endOfMonth, format, parse, startOfMonth } from 'date-fns'

export type BloqueioDia = {
  id: string
  data: string
  hora_inicio: string
  hora_fim: string
  motivo: string
}

export type BloqueioForm = {
  data: string
  hora_inicio: string
  hora_fim: string
  motivo: string
}

function parseMesReferencia(mesReferencia: string) {
  return parse(`${mesReferencia}-01`, 'yyyy-MM-dd', new Date())
}

function normalizeTime(value: string) {
  return value.slice(0, 5)
}

export async function listarBloqueiosMes(
  profissionalId: string,
  mesReferencia: string,
): Promise<BloqueioDia[]> {
  const supabase = await createClient()
  const inicio = format(startOfMonth(parseMesReferencia(mesReferencia)), 'yyyy-MM-dd')
  const fim = format(endOfMonth(parseMesReferencia(mesReferencia)), 'yyyy-MM-dd')

  const { data } = await supabase
    .from('jornada_mensal_bloqueio')
    .select('id, data, hora_inicio, hora_fim, motivo')
    .eq('profissional_id', profissionalId)
    .gte('data', inicio)
    .lte('data', fim)
    .order('data')
    .order('hora_inicio')

  return (data ?? []).map((item) => ({
    id: item.id,
    data: item.data,
    hora_inicio: normalizeTime(item.hora_inicio),
    hora_fim: normalizeTime(item.hora_fim),
    motivo: item.motivo,
  }))
}

export async function adicionarBloqueioHorario(
  profissionalId: string,
  bloqueio: BloqueioForm,
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()

  const horaInicio = normalizeTime(bloqueio.hora_inicio)
  const horaFim = normalizeTime(bloqueio.hora_fim)
  const motivo = bloqueio.motivo.trim()

  if (!horaInicio || !horaFim || horaFim <= horaInicio) {
    return { error: 'Informe um horário de início e fim válidos (fim depois do início).' }
  }

  if (!motivo) {
    return { error: 'Informe o motivo do bloqueio.' }
  }

  const { error } = await supabase.from('jornada_mensal_bloqueio').insert({
    profissional_id: profissionalId,
    data: bloqueio.data,
    hora_inicio: horaInicio,
    hora_fim: horaFim,
    motivo,
  })

  if (error) return { error: `Erro ao adicionar bloqueio: ${error.message}` }

  revalidatePath('/configuracoes', 'layout')
  revalidatePath('/agenda')

  return { success: true }
}

export async function removerBloqueioHorario(
  bloqueioId: string,
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('jornada_mensal_bloqueio')
    .delete()
    .eq('id', bloqueioId)

  if (error) return { error: `Erro ao remover bloqueio: ${error.message}` }

  revalidatePath('/configuracoes', 'layout')
  revalidatePath('/agenda')

  return { success: true }
}
