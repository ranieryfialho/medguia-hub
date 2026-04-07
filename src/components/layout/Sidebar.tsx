'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SlideNovoAgendamento } from '@/components/features/SlideNovoAgendamento'
import {
  HeartPulse,
  LayoutDashboard,
  CalendarDays,
  Users,
  FileText,
  Briefcase,
  Settings,
  Plus,
  HelpCircle,
  LogOut,
  PhoneCall,
  ChevronDown
} from 'lucide-react'

type Paciente = { id: string; nome: string }
type Profissional = { id: string; nome: string; cargo: string }

export function Sidebar({ pacientes, profissionais, userRole }: { pacientes: Paciente[]; profissionais: Profissional[]; userRole: string | null }) {
  const isGestorOuMedico = userRole === 'gestor' || userRole === 'médico'
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [confirmacoesOpen, setConfirmacoesOpen] = useState(() => pathname?.startsWith('/confirmacoes') ?? false)
  const [slideNovoAberto, setSlideNovoAberto] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login') // Redireciona para a tela de login
  }

  // Função auxiliar para verificar se o link está ativo
  const isActive = (path: string) => pathname?.startsWith(path)

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 overflow-y-auto z-[200] bg-[#f0f5f4] border-r border-[#dee3e3]/50 flex flex-col p-4 gap-2 hide-scrollbar">
      
      {/* Logo Area */}
      <div className="px-4 py-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#006b5a] to-[#33a68f] flex items-center justify-center text-white shadow-md">
          <HeartPulse size={24} strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[#006b5a] tracking-tight leading-none">MedGuia Hub</h1>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        <Link 
          href="/dashboard"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
            pathname === '/dashboard' 
              ? 'bg-white text-[#006b5a] shadow-sm translate-x-1 font-semibold' 
              : 'text-[#3d4945] hover:bg-[#dee3e3] font-medium'
          }`}
        >
          <LayoutDashboard size={20} />
          <span className="text-sm">Dashboard</span>
        </Link>

        <Link
          href="/agenda"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
            isActive('/agenda')
              ? 'bg-white text-[#006b5a] shadow-sm translate-x-1 font-semibold'
              : 'text-[#3d4945] hover:bg-[#dee3e3] font-medium'
          }`}
        >
          <CalendarDays size={20} />
          <span className="text-sm">Agenda</span>
        </Link>

        {/* Grupo Confirmações */}
        <div>
          <button
            onClick={() => setConfirmacoesOpen(v => !v)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              isActive('/confirmacoes')
                ? 'bg-white text-[#006b5a] shadow-sm font-semibold'
                : 'text-[#3d4945] hover:bg-[#dee3e3] font-medium'
            }`}
          >
            <PhoneCall size={20} />
            <span className="text-sm flex-1 text-left">Confirmações</span>
            <ChevronDown
              size={16}
              className={`transition-transform duration-200 ${confirmacoesOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {confirmacoesOpen && (
            <div className="mt-1 ml-4 space-y-0.5 border-l-2 border-[#bcc9c4]/40 pl-3">
              <Link
                href="/confirmacoes/cards"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                  isActive('/confirmacoes/cards')
                    ? 'bg-white text-[#006b5a] shadow-sm font-semibold'
                    : 'text-[#3d4945] hover:bg-[#dee3e3] font-medium'
                }`}
              >
                Cards
              </Link>
              <Link
                href="/confirmacoes/mensagens"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                  isActive('/confirmacoes/mensagens')
                    ? 'bg-white text-[#006b5a] shadow-sm font-semibold'
                    : 'text-[#3d4945] hover:bg-[#dee3e3] font-medium'
                }`}
              >
                Mensagens
              </Link>
            </div>
          )}
        </div>

        <Link
          href="/pacientes"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
            isActive('/pacientes')
              ? 'bg-white text-[#006b5a] shadow-sm translate-x-1 font-semibold' 
              : 'text-[#3d4945] hover:bg-[#dee3e3] font-medium'
          }`}
        >
          <Users size={20} />
          <span className="text-sm">Pacientes</span>
        </Link>

        <span className="flex items-center gap-3 px-4 py-3 rounded-xl opacity-40 cursor-not-allowed text-[#3d4945] font-medium">
          <FileText size={20} />
          <span className="text-sm">Prontuários</span>
        </span>

        {isGestorOuMedico && (
          <Link
            href="/equipe"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              isActive('/equipe')
                ? 'bg-white text-[#006b5a] shadow-sm translate-x-1 font-semibold'
                : 'text-[#3d4945] hover:bg-[#dee3e3] font-medium'
            }`}
          >
            <Briefcase size={20} />
            <span className="text-sm">Equipe</span>
          </Link>
        )}

        <span className="flex items-center gap-3 px-4 py-3 rounded-xl opacity-40 cursor-not-allowed text-[#3d4945] font-medium">
          <Settings size={20} />
          <span className="text-sm">Configurações</span>
        </span>
      </nav>

      {/* Footer Actions */}
      <div className="mt-auto pt-4 space-y-1 border-t border-[#bcc9c4]/30">
        <button
          onClick={() => setSlideNovoAberto(true)}
          className="w-full bg-gradient-to-r from-[#006b5a] to-[#33a68f] text-white rounded-full py-3 mb-4 flex items-center justify-center gap-2 shadow-lg shadow-[#006b5a]/20 hover:scale-[0.98] transition-transform"
        >
          <Plus size={18} strokeWidth={3} />
          <span className="text-xs font-bold uppercase tracking-wider">Novo Agendamento</span>
        </button>
        
        <span className="flex items-center gap-3 text-[#3d4945] px-4 py-3 rounded-xl font-medium opacity-40 cursor-not-allowed">
          <HelpCircle size={20} />
          <span className="text-sm">Suporte</span>
        </span>
        
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 text-[#3d4945] px-4 py-3 hover:bg-[#dee3e3] rounded-xl transition-all font-medium group cursor-pointer"
        >
          <LogOut size={20} className="text-[#ba1a1a] group-hover:scale-110 transition-transform" />
          <span className="text-sm">Sair</span>
        </button>
      </div>
      <SlideNovoAgendamento
        pacientes={pacientes}
        profissionais={profissionais}
        controlledOpen={slideNovoAberto}
        onControlledClose={() => setSlideNovoAberto(false)}
      />
    </aside>
  )
}