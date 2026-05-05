'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { SlideNovoAgendamento } from '@/components/features/SlideNovoAgendamento'
import { Menu } from 'lucide-react'
import type { DisponibilidadeDia } from '@/lib/disponibilidade'
import { SlideNovoAgendamentoProvider } from './SlideNovoAgendamentoContext'

type Profissional = { id: string; nome: string; cargo: string }

type HeaderData = {
  nomeUsuario: string
  cargoUsuario: string
  avatarUrl: string
  userRole: string
  userNivelAcesso: string
  modulosLiberados: string[]
  prontuariosPendentes: number
}

export function AppShell({
  children,
  profissionais,
  disponibilidades,
  headerData,
}: {
  children: React.ReactNode
  profissionais: Profissional[]
  disponibilidades?: Record<string, Record<number, DisponibilidadeDia>>
  headerData: HeaderData
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [slideNovoAberto, setSlideNovoAberto] = useState(false)

  return (
    <SlideNovoAgendamentoProvider aberto={slideNovoAberto}>
      <div className="flex min-h-screen bg-[#f5faf9]">

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-[190] lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar — drawer em mobile, fixo em desktop */}
        <div
          className={`
            fixed inset-y-0 left-0 z-[200] transition-transform duration-300
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            lg:translate-x-0
          `}
        >
          <Sidebar
            onMobileClose={() => setSidebarOpen(false)}
            onOpenNovoAgendamento={() => setSlideNovoAberto(true)}
            modulosLiberados={headerData.modulosLiberados}
            prontuariosPendentes={headerData.prontuariosPendentes}
          />
        </div>

        {/* Conteúdo principal */}
        <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">

          {/* Topbar mobile */}
          <div className="lg:hidden sticky top-0 z-40 bg-[#f5faf9]/95 backdrop-blur-md border-b border-[#dee3e3]/50 flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-xl hover:bg-[#dee3e3] text-[#3d4945] transition-colors"
            >
              <Menu size={22} />
            </button>
            <span className="font-bold text-[#006b5a] text-base tracking-tight flex-1">MedGuia Hub</span>
            <img
              src={headerData.avatarUrl}
              alt={headerData.nomeUsuario}
              className="w-8 h-8 rounded-xl object-cover border border-slate-200"
            />
          </div>

          {children}
        </div>

        {/* SlideNovoAgendamento fora da div com transform para fixed funcionar corretamente */}
        <SlideNovoAgendamento
          profissionais={profissionais}
          disponibilidades={disponibilidades}
          controlledOpen={slideNovoAberto}
          onControlledClose={() => setSlideNovoAberto(false)}
        />
      </div>
    </SlideNovoAgendamentoProvider>
  )
}
