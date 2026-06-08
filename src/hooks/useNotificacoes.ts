'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  buscarNotificacoes,
  marcarComoLida as marcarLidaAction,
  marcarTodasComoLidas as marcarTodasAction,
  limparNotificacoes as limparAction,
  type Notificacao,
} from '@/actions/notificacoes'

const DISMISSED_KEY = 'notif_dismissed_pending'

function getDismissedIds(): Set<string> {
  try {
    const stored = localStorage.getItem(DISMISSED_KEY)
    return new Set(stored ? (JSON.parse(stored) as string[]) : [])
  } catch { return new Set() }
}

function saveDismissedIds(ids: string[]) {
  try {
    const existing = getDismissedIds()
    ids.forEach((id) => existing.add(id))
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...existing]))
  } catch { /* noop */ }
}

export function useNotificacoes(userId: string) {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    const data = await buscarNotificacoes()
    const dismissed = getDismissedIds()
    setNotificacoes(data.filter((n) => !dismissed.has(n.id)))
    setCarregando(false)
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`notificacoes_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificacoes',
          filter: `usuario_id=eq.${userId}`,
        },
        (payload) => {
          setNotificacoes((prev) => [payload.new as Notificacao, ...prev])
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const marcarComoLida = useCallback(async (id: string) => {
    await marcarLidaAction(id)
    setNotificacoes((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)))
  }, [])

  const marcarTodasComoLidas = useCallback(async () => {
    await marcarTodasAction()
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })))
  }, [])

  const limpar = useCallback(async (notificacoesAtuais: Notificacao[]) => {
    await limparAction()
    // Guarda IDs das pendentes calculadas para não reaparecerem após reload
    const pendingIds = notificacoesAtuais
      .filter((n) => n.id.startsWith('pending-'))
      .map((n) => n.id)
    saveDismissedIds(pendingIds)
    setNotificacoes([])
  }, [])

  const naoLidas = notificacoes.filter((n) => !n.lida).length

  return { notificacoes, naoLidas, carregando, marcarComoLida, marcarTodasComoLidas, limpar }
}