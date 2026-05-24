'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { addDays, endOfMonth, format, parse, startOfMonth } from 'date-fns'
import { listarDisponibilidade, type DiaDisponibilidade } from '@/actions/disponibilidade'

export type JornadaMensalDia = {
  data: string
  jornada_inicio: string | null
  jornada_fim: string | null
  intervalo_inicio: string | null
  intervalo_fim: string | null
  ativo: boolean
  origem: 'template' | 'ajuste_manual' | 'folga' | 'feriado' | 'extra' | 'afastamento'
  observacao: string | null
}

export type JornadaMensalForm = {
  data: string
  jornada_inicio: string | null
  jornada_fim: string | null
  intervalo_inicio: string | null
  intervalo_fim: string | null
  ativo: boolean
  observacao?: string | null
}

function parseMesReferencia(mesReferencia: string) {
  return parse(`${mesReferencia}-01`, 'yyyy-MM-dd', new Date())
}

function normalizeTime(value: string | null | undefined) {
  return value ? value.slice(0, 5) : null
}

function normalizarTemplate(template?: DiaDisponibilidade) {
  if (!template?.ativo) {
    return {
      ativo: false,
      jornada_inicio: null,
      jornada_fim: null,
      intervalo_inicio: null,
      intervalo_fim: null,
    }
  }

  return {
    ativo: true,
    jornada_inicio: normalizeTime(template.jornada_inicio),
    jornada_fim: normalizeTime(template.jornada_fim),
    intervalo_inicio: normalizeTime(template.intervalo_inicio),
    intervalo_fim: normalizeTime(template.intervalo_fim),
  }
}

function jornadaIgualAoTemplate(
  jornada: {
    ativo: boolean
    jornada_inicio: string | null
    jornada_fim: string | null
    intervalo_inicio: string | null
    intervalo_fim: string | null
  },
  template?: DiaDisponibilidade,
) {
  const base = normalizarTemplate(template)

  return (
    jornada.ativo === base.ativo &&
    normalizeTime(jornada.jornada_inicio) === base.jornada_inicio &&
    normalizeTime(jornada.jornada_fim) === base.jornada_fim &&
    normalizeTime(jornada.intervalo_inicio) === base.intervalo_inicio &&
    normalizeTime(jornada.intervalo_fim) === base.intervalo_fim
  )
}

function inferirOrigem(
  jornada: {
    ativo: boolean
    jornada_inicio: string | null
    jornada_fim: string | null
    intervalo_inicio: string | null
    intervalo_fim: string | null
  },
  template?: DiaDisponibilidade,
): JornadaMensalDia['origem'] {
  if (!jornada.ativo) return 'folga'
  if (jornadaIgualAoTemplate(jornada, template)) return 'template'

  const base = normalizarTemplate(template)
  if (!base.ativo) return 'extra'

  const entrouMaisCedo = Boolean(base.jornada_inicio && jornada.jornada_inicio && jornada.jornada_inicio < base.jornada_inicio)
  const saiuMaisTarde = Boolean(base.jornada_fim && jornada.jornada_fim && jornada.jornada_fim > base.jornada_fim)

  if (entrouMaisCedo || saiuMaisTarde) {
    return 'extra'
  }

  return 'ajuste_manual'
}

function buildTemplateRow(data: string, template: DiaDisponibilidade | undefined) {
  if (!template?.ativo) {
    return {
      data,
      jornada_inicio: null,
      jornada_fim: null,
      intervalo_inicio: null,
      intervalo_fim: null,
      ativo: false,
      origem: 'template' as const,
      observacao: null,
    }
  }

  return {
    data,
    jornada_inicio: template.jornada_inicio,
    jornada_fim: template.jornada_fim,
    intervalo_inicio: template.intervalo_inicio,
    intervalo_fim: template.intervalo_fim,
    ativo: true,
    origem: 'template' as const,
    observacao: null,
  }
}

export async function listarJornadaMensal(
  profissionalId: string,
  mesReferencia: string,
): Promise<JornadaMensalDia[]> {
  const supabase = await createClient()
  const inicio = format(startOfMonth(parseMesReferencia(mesReferencia)), 'yyyy-MM-dd')
  const fim = format(endOfMonth(parseMesReferencia(mesReferencia)), 'yyyy-MM-dd')

  const { data } = await supabase
    .from('jornada_mensal_profissional')
    .select('data, jornada_inicio, jornada_fim, intervalo_inicio, intervalo_fim, ativo, origem, observacao')
    .eq('profissional_id', profissionalId)
    .gte('data', inicio)
    .lte('data', fim)
    .order('data')

  return ((data ?? []) as JornadaMensalDia[]).map((item) => ({
    ...item,
    data: item.data,
    jornada_inicio: normalizeTime(item.jornada_inicio),
    jornada_fim: normalizeTime(item.jornada_fim),
    intervalo_inicio: normalizeTime(item.intervalo_inicio),
    intervalo_fim: normalizeTime(item.intervalo_fim),
  }))
}

export async function materializarJornadaMensal(
  profissionalId: string,
  mesReferencia: string,
): Promise<{ success?: boolean; error?: string; updated?: number }> {
  const supabase = await createClient()
  const inicio = startOfMonth(parseMesReferencia(mesReferencia))
  const fim = endOfMonth(parseMesReferencia(mesReferencia))
  const templateSemanal = await listarDisponibilidade(profissionalId)
  const templateMap = new Map(templateSemanal.map((dia) => [dia.dia_semana, dia]))
  const existentes = await listarJornadaMensal(profissionalId, mesReferencia)
  const existentesMap = new Map(existentes.map((dia) => [dia.data, dia]))

  const rows: Array<{
    profissional_id: string
    data: string
    jornada_inicio: string | null
    jornada_fim: string | null
    intervalo_inicio: string | null
    intervalo_fim: string | null
    ativo: boolean
    origem: 'template'
    observacao: null
  }> = []

  let cursor = inicio
  while (cursor <= fim) {
    const data = format(cursor, 'yyyy-MM-dd')
    const existente = existentesMap.get(data)

    if (!existente || existente.origem === 'template') {
      const template = templateMap.get(cursor.getDay())
      const row = buildTemplateRow(data, template)
      rows.push({
        profissional_id: profissionalId,
        ...row,
      })
    }

    cursor = addDays(cursor, 1)
  }

  if (rows.length === 0) {
    return { success: true, updated: 0 }
  }

  const { error } = await supabase
    .from('jornada_mensal_profissional')
    .upsert(rows, { onConflict: 'profissional_id,data' })

  if (error) return { error: `Erro ao aplicar template: ${error.message}` }

  revalidatePath('/configuracoes', 'layout')
  revalidatePath('/dashboard')
  revalidatePath('/relatorios/tempo-fabril')

  return { success: true, updated: rows.length }
}

export async function salvarJornadaMensalDia(
  profissionalId: string,
  jornada: JornadaMensalForm,
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const templateSemanal = await listarDisponibilidade(profissionalId)
  const dataDia = parse(jornada.data, 'yyyy-MM-dd', new Date())
  const templateDia = templateSemanal.find((dia) => dia.dia_semana === dataDia.getDay())

  const ativo = jornada.ativo
  const jornadaInicio = ativo ? normalizeTime(jornada.jornada_inicio) : null
  const jornadaFim = ativo ? normalizeTime(jornada.jornada_fim) : null
  const intervaloInicio = ativo ? normalizeTime(jornada.intervalo_inicio) : null
  const intervaloFim = ativo ? normalizeTime(jornada.intervalo_fim) : null
  const motivo = jornada.observacao?.trim() || null

  if (ativo && (!jornadaInicio || !jornadaFim)) {
    return { error: 'Preencha início e fim da jornada.' }
  }

  const jornadaNormalizada = {
    ativo,
    jornada_inicio: jornadaInicio,
    jornada_fim: jornadaFim,
    intervalo_inicio: intervaloInicio,
    intervalo_fim: intervaloFim,
  }
  const igualAoTemplate = jornadaIgualAoTemplate(jornadaNormalizada, templateDia)

  if (!igualAoTemplate && !motivo) {
    return { error: 'Informe o motivo da alteração quando o dia sair do padrão da jornada.' }
  }

  const origem = inferirOrigem(jornadaNormalizada, templateDia)

  const { error } = await supabase
    .from('jornada_mensal_profissional')
    .upsert({
      profissional_id: profissionalId,
      data: jornada.data,
      jornada_inicio: jornadaInicio,
      jornada_fim: jornadaFim,
      intervalo_inicio: intervaloInicio,
      intervalo_fim: intervaloFim,
      ativo,
      origem,
      observacao: motivo,
    }, { onConflict: 'profissional_id,data' })

  if (error) return { error: `Erro ao salvar jornada do dia: ${error.message}` }

  revalidatePath('/configuracoes', 'layout')
  revalidatePath('/dashboard')
  revalidatePath('/relatorios/tempo-fabril')

  return { success: true }
}

export async function restaurarJornadaMensalDia(
  profissionalId: string,
  data: string,
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('jornada_mensal_profissional')
    .delete()
    .eq('profissional_id', profissionalId)
    .eq('data', data)

  if (error) return { error: `Erro ao restaurar template do dia: ${error.message}` }

  revalidatePath('/configuracoes', 'layout')
  revalidatePath('/dashboard')
  revalidatePath('/relatorios/tempo-fabril')

  return { success: true }
}
