'use server'

import { createClient } from '@/lib/supabase/server'
import { requireModulo } from '@/lib/guard'

export type DrillDownOrigem = { origem: string; faturamento: number; qtd_vendas: number }
export type DrillDownCategoria = { categoria: string; faturamento: number; qtd_vendas: number }
export type DrillDownMedico = { medico_id: string; medico_nome: string | null; faturamento: number; qtd_vendas: number }
export type DrillDownFisio = { profissional_id: string; profissional_nome: string | null; faturamento: number; qtd_vendas: number }

export type DrillDownMes = {
  quebra_origem: DrillDownOrigem[]
  quebra_categoria: DrillDownCategoria[]
  ranking_medicos: DrillDownMedico[]
  ranking_fisios: DrillDownFisio[]
}

type Filtros = {
  profissional_id?: string
  medico_id?: string
  origem?: string
  categoria?: string
}

/**
 * Drill-down de um mês do relatório de vendas históricas, buscado ao
 * expandir a linha (AC-081) — nunca no carregamento inicial da página.
 * Mesmo guard de /relatorios/vendas (AC-086).
 */
export async function buscarDrillDownMes(mes: string, filtros: Filtros): Promise<DrillDownMes> {
  await requireModulo('comercial:relatorio_vendas')

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('fn_vendas_detalhe_mes', {
    p_mes: mes,
    p_profissional_id: filtros.profissional_id || null,
    p_medico_id: filtros.medico_id || null,
    p_origem: filtros.origem || null,
    p_categoria: filtros.categoria || null,
  })

  if (error) {
    throw new Error(`Erro ao buscar detalhamento do mês: ${error.message}`)
  }

  const linha = Array.isArray(data) ? data[0] : data

  return {
    quebra_origem: linha?.quebra_origem ?? [],
    quebra_categoria: linha?.quebra_categoria ?? [],
    ranking_medicos: linha?.ranking_medicos ?? [],
    ranking_fisios: linha?.ranking_fisios ?? [],
  }
}
