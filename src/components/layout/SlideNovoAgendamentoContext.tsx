'use client'

import { createContext, useContext } from 'react'

type SlideNovoAgendamentoContextValue = {
  aberto: boolean
  abrir: () => void
}

const SlideNovoAgendamentoContext = createContext<SlideNovoAgendamentoContextValue>({
  aberto: false,
  abrir: () => {},
})

export function SlideNovoAgendamentoProvider({
  aberto,
  abrir,
  children,
}: {
  aberto: boolean
  abrir: () => void
  children: React.ReactNode
}) {
  return (
    <SlideNovoAgendamentoContext.Provider value={{ aberto, abrir }}>
      {children}
    </SlideNovoAgendamentoContext.Provider>
  )
}

export function useSlideNovoAgendamentoAberto() {
  return useContext(SlideNovoAgendamentoContext).aberto
}

export function useAbrirNovoAgendamento() {
  return useContext(SlideNovoAgendamentoContext).abrir
}
