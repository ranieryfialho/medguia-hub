'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { SlideNovoAgendamento } from '@/components/features/SlideNovoAgendamento'
import { Menu } from 'lucide-react'

type Paciente = { id: string; nome: string }
type Profissional = { id: string; nome: string; cargo: string }

type HeaderData = {
  nomeUsuario: string
  cargoUsuario: string
  avatarUrl: string
}

export function AppShell({
  children,
  pacientes,
  profissionais,
  userRole,
  headerData,
}: {
  children: React.ReactNode
  pacientes: Paciente[]
  profissionais: Profissional[]
  userRole: string | null
  headerData: HeaderData
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [slideNovoAberto, setSlideNovoAberto] = useState(false)

  return (
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
          userRole={userRole}
          onMobileClose={() => setSidebarOpen(false)}
          onOpenNovoAgendamento={() => setSlideNovoAberto(true)}
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
        pacientes={pacientes}
        profissionais={profissionais}
        controlledOpen={slideNovoAberto}
        onControlledClose={() => setSlideNovoAberto(false)}
      />
    </div>
  )
}