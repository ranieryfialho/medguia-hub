'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  buscarNotificacoes,
  marcarComoLida as marcarLidaAction,
  marcarTodasComoLidas as marcarTodasAction,
  limparNotificacoes as limparAction,
  registrarModalNotificacoesVisto,
  type Notificacao,
} from '@/actions/notificacoes'

import { formatAppDateKey } from '@/lib/datetime'
import { ehNotificacaoDerivada as ehDerivada } from '@/components/layout/notificacoes-tipos'

const INTERVALO_MIN_RECARGA_MS = 60_000

export function useNotificacoes(userId: string) {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modalVistoEm, setModalVistoEm] = useState<string | null>(null)

  const ultimaCarga = useRef(0)

  const carregar = useCallback(async () => {
    ultimaCarga.current = Date.now()
    const data = await buscarNotificacoes()
    setNotificacoes(data.notificacoes)
    setModalVistoEm(data.modalVistoEm)
    setCarregando(false)
  }, [])

  /** Recarrega só se a última carga tiver mais de 1 min (evita carga extra no servidor). */
  const recarregarSeAntigo = useCallback(() => {
    if (Date.now() - ultimaCarga.current >= INTERVALO_MIN_RECARGA_MS) void carregar()
  }, [carregar])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') recarregarSeAntigo()
    }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => document.removeEventListener('visibilitychange', aoVoltar)
  }, [recarregarSeAntigo])

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
    await marcarTodasAction(notificacoes.filter((n) => ehDerivada(n.id)).map((n) => n.id))
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })))
  }, [notificacoes])

  const limpar = useCallback(async (notificacoesAtuais: Notificacao[]) => {
    await limparAction(notificacoesAtuais.filter((n) => ehDerivada(n.id)).map((n) => n.id))
    setNotificacoes([])
  }, [])

  /** Fecha o modal do dia: registra o "visto hoje" e marca como lidas as pendências exibidas nele. */
  const marcarModalVisto = useCallback((idsExibidos: string[] = []) => {
    const ids = new Set(idsExibidos)
    setModalVistoEm(formatAppDateKey(new Date()))
    setNotificacoes((prev) => prev.map((n) => (ids.has(n.id) ? { ...n, lida: true } : n)))
    void registrarModalNotificacoesVisto(idsExibidos)
  }, [])

  const naoLidas = notificacoes.filter((n) => !n.lida).length

  return { notificacoes, naoLidas, carregando, modalVistoEm, marcarModalVisto, recarregarSeAntigo, marcarComoLida, marcarTodasComoLidas, limpar }
}
