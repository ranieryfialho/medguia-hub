'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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
  LogOut 
} from 'lucide-react'

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login') // Redireciona para a tela de login
  }

  // Função auxiliar para verificar se o link está ativo
  const isActive = (path: string) => pathname?.startsWith(path)

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 overflow-y-auto z-50 bg-[#f0f5f4] border-r border-[#dee3e3]/50 flex flex-col p-4 gap-2 hide-scrollbar">
      
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

        <Link 
          href="/prontuarios"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
            isActive('/prontuarios')
              ? 'bg-white text-[#006b5a] shadow-sm translate-x-1 font-semibold' 
              : 'text-[#3d4945] hover:bg-[#dee3e3] font-medium'
          }`}
        >
          <FileText size={20} />
          <span className="text-sm">Prontuários</span>
        </Link>

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

        <Link 
          href="/configuracoes"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
            isActive('/configuracoes')
              ? 'bg-white text-[#006b5a] shadow-sm translate-x-1 font-semibold' 
              : 'text-[#3d4945] hover:bg-[#dee3e3] font-medium'
          }`}
        >
          <Settings size={20} />
          <span className="text-sm">Configurações</span>
        </Link>
      </nav>

      {/* Footer Actions */}
      <div className="mt-auto pt-4 space-y-1 border-t border-[#bcc9c4]/30">
        <button className="w-full bg-gradient-to-r from-[#006b5a] to-[#33a68f] text-white rounded-full py-3 mb-4 flex items-center justify-center gap-2 shadow-lg shadow-[#006b5a]/20 hover:scale-[0.98] transition-transform">
          <Plus size={18} strokeWidth={3} />
          <span className="text-xs font-bold uppercase tracking-wider">Nova Consulta</span>
        </button>
        
        <Link href="/suporte" className="flex items-center gap-3 text-[#3d4945] px-4 py-3 hover:bg-[#dee3e3] rounded-xl transition-all font-medium">
          <HelpCircle size={20} />
          <span className="text-sm">Suporte</span>
        </Link>
        
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 text-[#3d4945] px-4 py-3 hover:bg-[#dee3e3] rounded-xl transition-all font-medium group cursor-pointer"
        >
          <LogOut size={20} className="text-[#ba1a1a] group-hover:scale-110 transition-transform" />
          <span className="text-sm">Sair</span>
        </button>
      </div>
    </aside>
  )
}