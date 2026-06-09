'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export function formatarTempo(segundos: number): string {
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = segundos % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export type TempoEsperaResult =
  | { tipo: 'aguardando'; tempo: string }
  | { tipo: 'esperou';    tempo: string }
  | null

// Ticker global — único setInterval compartilhado por todas as instâncias.
// Garante que todos os contadores atualizam ao mesmo tempo.
type TickCb = () => void
const tickCallbacks = new Set<TickCb>()
let globalTicker: ReturnType<typeof setInterval> | null = null

function subscribeTick(cb: TickCb): () => void {
  tickCallbacks.add(cb)
  if (!globalTicker) {
    globalTicker = setInterval(() => tickCallbacks.forEach(fn => fn()), 1000)
  }
  return () => {
    tickCallbacks.delete(cb)
    if (tickCallbacks.size === 0 && globalTicker) {
      clearInterval(globalTicker)
      globalTicker = null
    }
  }
}

export function useTempoEspera(
  atendimentoId: string,
  aguardandoDesdeInicial: string | null | undefined,
  emAtendimentoDesdeInicial: string | null | undefined,
  onExternalUpdate?: () => void,
): TempoEsperaResult {
  const [tempoAoVivo, setTempoAoVivo] = useState<string | null>(null)
  const onUpdateRef = useRef(onExternalUpdate)
  // eslint-disable-next-line react-hooks/refs
  onUpdateRef.current = onExternalUpdate

  // Fonte de verdade única: as props vindas do servidor via router.refresh().
  // O Realtime apenas dispara onExternalUpdate para acionar um router.refresh()
  // no componente pai — sem estado Realtime local que possa ficar stale.
  const aguardandoDesde    = aguardandoDesdeInicial    ?? null
  const emAtendimentoDesde = emAtendimentoDesdeInicial ?? null

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`tempo-espera-${atendimentoId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'atendimentos', filter: `id=eq.${atendimentoId}` },
        () => { onUpdateRef.current?.() },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [atendimentoId])

  // Ticker global: dispara para todas as instâncias ao mesmo tempo
  useEffect(() => {
    if (!aguardandoDesde || emAtendimentoDesde) return
    const desde = aguardandoDesde
    const calcular = () => {
      const diff = Math.floor((Date.now() - new Date(desde).getTime()) / 1000)
      setTempoAoVivo(formatarTempo(Math.max(0, diff)))
    }
    const immediate = setTimeout(calcular, 0)
    const unsubscribe = subscribeTick(calcular)
    return () => { clearTimeout(immediate); unsubscribe() }
  }, [aguardandoDesde, emAtendimentoDesde])

  if (!aguardandoDesde) return null

  if (emAtendimentoDesde) {
    const diff = Math.floor(
      (new Date(emAtendimentoDesde).getTime() - new Date(aguardandoDesde).getTime()) / 1000,
    )
    return { tipo: 'esperou', tempo: formatarTempo(Math.max(0, diff)) }
  }

  return tempoAoVivo ? { tipo: 'aguardando', tempo: tempoAoVivo } : null
}
