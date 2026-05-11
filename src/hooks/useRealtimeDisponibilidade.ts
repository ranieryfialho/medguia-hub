'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { StatusRow } from '@/actions/status-disponibilidade'

export type { StatusRow }

export function useRealtimeDisponibilidade(initial: StatusRow[]) {
  const [statuses, setStatuses] = useState<StatusRow[]>(initial)

  const upsert = useCallback((row: StatusRow) => {
    setStatuses(prev => {
      const idx = prev.findIndex(s => s.profissional_id === row.profissional_id)
      if (idx === -1) return [...prev, row]
      const next = [...prev]
      next[idx] = row
      return next
    })
  }, [])

  useEffect(() => {
    setStatuses(initial)
  }, [initial])

  useEffect(() => {
    const supabase = createClient()
    let active = true
    const channelName = `status_disponibilidade:${crypto.randomUUID()}`

    const subscribe = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return

      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token)
      }

      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'status_disponibilidade' },
          (payload) => {
            if (payload.new && typeof payload.new === 'object') {
              upsert(payload.new as StatusRow)
            }
          }
        )
        .subscribe()

      return channel
    }

    const currentChannelPromise = subscribe()
    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token)
      }
    })

    return () => {
      active = false
      authListener.subscription.unsubscribe()
      void currentChannelPromise.then((channel) => {
        if (channel) {
          supabase.removeChannel(channel)
        }
      })
    }
  }, [upsert])

  return statuses
}
