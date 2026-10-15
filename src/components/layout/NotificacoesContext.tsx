'use client'

import { createContext, useContext } from 'react'
import { useNotificacoes } from '@/hooks/useNotificacoes'

type NotificacoesValor = ReturnType<typeof useNotificacoes>

const NotificacoesContext = createContext<NotificacoesValor | null>(null)

/**
 * Instância única de useNotificacoes para o layout inteiro. O sino aparece
 * duas vezes (topbar mobile e header desktop) e o modal diário usa os mesmos
 * dados, então uma só carga e um só canal realtime atendem os três.
 */
export function NotificacoesProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const valor = useNotificacoes(userId)
  return <NotificacoesContext.Provider value={valor}>{children}</NotificacoesContext.Provider>
}

export function useNotificacoesContext() {
  const ctx = useContext(NotificacoesContext)
  if (!ctx) throw new Error('useNotificacoesContext fora de NotificacoesProvider')
  return ctx
}
