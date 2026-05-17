'use client'

import { createContext, useContext } from 'react'
import type { ProtocoloAtendimento } from '@/actions/protocolos-atendimento'

const ProtocolosAtendimentoContext = createContext<ProtocoloAtendimento[]>([])

export function ProtocolosAtendimentoProvider({
  protocolosAtendimento,
  children,
}: {
  protocolosAtendimento: ProtocoloAtendimento[]
  children: React.ReactNode
}) {
  return (
    <ProtocolosAtendimentoContext.Provider value={protocolosAtendimento}>
      {children}
    </ProtocolosAtendimentoContext.Provider>
  )
}

export function useProtocolosAtendimento() {
  return useContext(ProtocolosAtendimentoContext)
}
