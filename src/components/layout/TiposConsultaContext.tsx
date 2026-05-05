'use client'

import { createContext, useContext } from 'react'
import type { TipoConsulta } from '@/actions/tipos-consulta'

const TiposConsultaContext = createContext<TipoConsulta[]>([])

export function TiposConsultaProvider({
  tiposConsulta,
  children,
}: {
  tiposConsulta: TipoConsulta[]
  children: React.ReactNode
}) {
  return (
    <TiposConsultaContext.Provider value={tiposConsulta}>
      {children}
    </TiposConsultaContext.Provider>
  )
}

export function useTiposConsulta() {
  return useContext(TiposConsultaContext)
}
