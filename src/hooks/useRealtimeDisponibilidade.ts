'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { listarStatusDisponibilidade, type StatusRow } from '@/actions/status-disponibilidade'

export type { StatusRow }

export function useRealtimeDisponibilidade(initial: StatusRow[], profissionalIds: string[]) {
  const [statuses, setStatuses] = useState<StatusRow[]>(initial)
  const idsRef = useRef(profissionalIds)

  useEffect(() => {
    idsRef.current = profissionalIds
  })

  const upsert = useCallback((row: StatusRow) => {
    setStatuses(prev => {
      const idx = prev.findIndex(s => s.profissional_id === row.profissional_id)
      if (idx === -1) return [...prev, row]
      const next = [...prev]
      next[idx] = row
      return next
    })
  }, [])

  const refreshAll = useCallback(async () => {
    const ids = idsRef.current
    if (ids.length === 0) return
    const fresh = await listarStatusDisponibilidade(ids)
    // Só atualiza se o servidor retornou dados — previne sobrescrever estado válido
    // com array vazio em caso de erro silencioso no RPC
    if (fresh.length > 0) setStatuses(fresh)
  }, [])

  useEffect(() => {
    setStatuses(initial)
  }, [initial])

  // Polling de 60s como fallback para quando o pg_cron ou o Realtime não cobrirem
  useEffect(() => {
    const id = setInterval(() => { void refreshAll() }, 60_000)
    return () => clearInterval(id)
  }, [refreshAll])

  useEffect(() => {
    const supabase = createClient()
    let active = true
    const statusChannelName = `status_disp:${crypto.randomUUID()}`
    const atendChannelName = `atend_disp:${crypto.randomUUID()}`

    const subscribe = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return

      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token)
      }

      // Mudanças manuais de status (disponivel ↔ reuniao ↔ ocupado)
      const statusChannel = supabase
        .channel(statusChannelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'status_disponibilidade' },
          (payload) => {
            if (!active) return
            if (payload.new && typeof payload.new === 'object') {
              upsert(payload.new as StatusRow)
            }
          }
        )
        .subscribe()

      // Mudanças em atendimentos → recalcula ocupado/livre em tempo real
      const atendChannel = supabase
        .channel(atendChannelName)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'atendimentos' },
          () => {
            if (!active) return
            void refreshAll()
          }
        )
        .subscribe()

      return { statusChannel, atendChannel }
    }

    const channelsPromise = subscribe()

    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token)
      }
    })

    return () => {
      active = false
      authListener.subscription.unsubscribe()
      void channelsPromise.then((channels) => {
        if (channels) {
          supabase.removeChannel(channels.statusChannel)
          supabase.removeChannel(channels.atendChannel)
        }
      })
    }
  }, [upsert, refreshAll])

  return statuses
}
