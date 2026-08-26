'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface DirtyContextType {
  dirty: boolean
  setDirty: (dirty: boolean) => void
}

const DirtyContext = createContext<DirtyContextType>({
  dirty: false,
  setDirty: () => {},
})

export function useProntuarioDirty() {
  return useContext(DirtyContext)
}

const AVISO_SAIDA = 'A evolução ainda não foi salva. Sair mesmo assim?'

export function ProntuarioDirtyGuardProvider({ children }: { children: React.ReactNode }) {
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  return (
    <DirtyContext.Provider value={{ dirty, setDirty }}>
      {children}
    </DirtyContext.Provider>
  )
}

const BTN_CLASS = 'p-2 hover:bg-slate-100 rounded-full transition-all text-slate-600'

export function BtnVoltarComGuarda({ href }: { href: string }) {
  const { dirty } = useProntuarioDirty()
  return (
    <Link
      href={href}
      aria-label="Voltar"
      className={BTN_CLASS}
      onNavigate={(e) => {
        if (dirty && !window.confirm(AVISO_SAIDA)) {
          e.preventDefault()
        }
      }}
    >
      <ArrowLeft size={24} />
    </Link>
  )
}
