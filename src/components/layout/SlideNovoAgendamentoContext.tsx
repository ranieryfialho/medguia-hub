'use client'

import { createContext, useContext } from 'react'

const SlideNovoAgendamentoContext = createContext(false)

export function SlideNovoAgendamentoProvider({
  aberto,
  children,
}: {
  aberto: boolean
  children: React.ReactNode
}) {
  return (
    <SlideNovoAgendamentoContext.Provider value={aberto}>
      {children}
    </SlideNovoAgendamentoContext.Provider>
  )
}

export function useSlideNovoAgendamentoAberto() {
  return useContext(SlideNovoAgendamentoContext)
}
