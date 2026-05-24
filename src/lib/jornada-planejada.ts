import { formatAppDateKey, parseAppDate } from '@/lib/datetime'
import type { JornadaDia } from '@/lib/jornada'

export type JornadaSemanal = {
  profissional_id: string
  dia_semana: number
  jornada_inicio: string
  jornada_fim: string
  intervalo_inicio?: string | null
  intervalo_fim?: string | null
}

export type JornadaMensalDiaPlanejado = {
  data: string
  jornada_inicio: string | null
  jornada_fim: string | null
  intervalo_inicio?: string | null
  intervalo_fim?: string | null
  ativo: boolean
}

export type JornadaMensalPlanejada = JornadaMensalDiaPlanejado & {
  profissional_id: string
}

export function normalizarJornadaDia(jornada: {
  jornada_inicio: string
  jornada_fim: string
  intervalo_inicio?: string | null
  intervalo_fim?: string | null
}): JornadaDia {
  return {
    jornada_inicio: jornada.jornada_inicio.slice(0, 5),
    jornada_fim: jornada.jornada_fim.slice(0, 5),
    intervalo_inicio: jornada.intervalo_inicio?.slice(0, 5) ?? null,
    intervalo_fim: jornada.intervalo_fim?.slice(0, 5) ?? null,
  }
}

export function buildMapaSemanalPorProfissional(jornadas: JornadaSemanal[]) {
  const mapa = new Map<string, Map<number, JornadaDia>>()

  for (const jornada of jornadas) {
    if (!mapa.has(jornada.profissional_id)) {
      mapa.set(jornada.profissional_id, new Map())
    }
    mapa.get(jornada.profissional_id)!.set(jornada.dia_semana, normalizarJornadaDia(jornada))
  }

  return mapa
}

export function buildMapaMensalPorProfissional(jornadas: JornadaMensalPlanejada[]) {
  const mapa = new Map<string, Map<string, JornadaMensalDiaPlanejado>>()

  for (const jornada of jornadas) {
    if (!mapa.has(jornada.profissional_id)) {
      mapa.set(jornada.profissional_id, new Map())
    }

    const dataKey = /^\d{4}-\d{2}-\d{2}$/.test(jornada.data)
      ? formatAppDateKey(parseAppDate(jornada.data))
      : formatAppDateKey(jornada.data)

    mapa.get(jornada.profissional_id)!.set(dataKey, jornada)
  }

  return mapa
}

export function resolverJornadaDoDia(
  data: Date,
  jornadaSemanalMap: Map<number, JornadaDia>,
  jornadaMensalMap?: Map<string, JornadaMensalDiaPlanejado>,
) {
  const dataKey = formatAppDateKey(data)
  const jornadaMensal = jornadaMensalMap?.get(dataKey)

  if (jornadaMensal) {
    if (!jornadaMensal.ativo || !jornadaMensal.jornada_inicio || !jornadaMensal.jornada_fim) {
      return null
    }

    return normalizarJornadaDia({
      jornada_inicio: jornadaMensal.jornada_inicio,
      jornada_fim: jornadaMensal.jornada_fim,
      intervalo_inicio: jornadaMensal.intervalo_inicio ?? null,
      intervalo_fim: jornadaMensal.intervalo_fim ?? null,
    })
  }

  return jornadaSemanalMap.get(data.getDay()) ?? null
}

export function profissionalTemAlgumaJornada(
  profissionalId: string,
  jornadasSemanaisMap: Map<string, Map<number, JornadaDia>>,
  jornadasMensaisMap: Map<string, Map<string, JornadaMensalDiaPlanejado>>,
) {
  return jornadasSemanaisMap.has(profissionalId) || jornadasMensaisMap.has(profissionalId)
}
