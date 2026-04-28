'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
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
  ChevronDown,
  Target,
  BarChart3,
  UserCheck,
  Clock,
  Calendar,
  ShoppingCart,
  Package,
} from 'lucide-react'

export function Sidebar({ onMobileClose, onOpenNovoAgendamento, userRole: userRoleProp }: { onMobileClose?: () => void; onOpenNovoAgendamento?: () => void; userRole?: string }) {

  const pathname = usePathname()
  const router = useRouter()
  const [supabase] = useState(createClient)
  const [confirmacoesOpen, setConfirmacoesOpen] = useState(() => pathname?.startsWith('/confirmacoes') ?? false)
  const [contatosOpen, setContatosOpen] = useState(() => pathname?.startsWith('/contatos') ?? false)
  const [configOpen, setConfigOpen] = useState(() => pathname?.startsWith('/configuracoes') ?? false)
  const [equipeOpen, setEquipeOpen] = useState(() => (pathname?.startsWith('/equipe') || pathname?.startsWith('/relatorios/tempo-fabril')) ?? false)
  const [comercialOpen, setComercialOpen] = useState(() => (pathname?.startsWith('/vendas') || pathname?.startsWith('/produtos') || pathname?.startsWith('/relatorios/vendas')) ?? false)
  const [userRole, setUserRole] = useState(userRoleProp ?? '')

  useEffect(() => {
    async function fetchRole() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (data?.role) setUserRole(data.role)
    }
    fetchRole()
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login') // Redireciona para a tela de login
  }

  // Função auxiliar para verificar se o link está ativo
  const isActive = (path: string) => pathname?.startsWith(path)

  const handleNavClick = () => onMobileClose?.()

  return (
    <aside className="h-screen w-64 overflow-y-auto z-[200] bg-[#f0f5f4] border-r border-[#dee3e3]/50 flex flex-col p-4 gap-2 hide-scrollbar">

      {/* Logo Area */}
      <div className="px-4 py-6 flex items-center gap-3">
        <Image src="/logo.png" alt="MedGuia Hub" width={32} height={32} className="object-contain" />
        <div className="flex-1">
          <h1 className="text-lg font-bold text-[#006b5a] tracking-tight leading-none">MedGuia Hub</h1>
        </div>
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="lg:hidden p-1.5 rounded-lg hover:bg-[#dee3e3] text-[#6d7a75] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        <Link
          href="/dashboard"
          onClick={handleNavClick}
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
          onClick={handleNavClick}
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
                onClick={handleNavClick}
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
                onClick={handleNavClick}
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

        {/* Grupo Contatos */}
        <div>
          <button
            onClick={() => setContatosOpen(v => !v)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              isActive('/contatos')
                ? 'bg-white text-[#006b5a] shadow-sm font-semibold'
                : 'text-[#3d4945] hover:bg-[#dee3e3] font-medium'
            }`}
          >
            <Target size={20} />
            <span className="text-sm flex-1 text-left">Contatos</span>
            <ChevronDown
              size={16}
              className={`transition-transform duration-200 ${contatosOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {contatosOpen && (
            <div className="mt-1 ml-4 space-y-0.5 border-l-2 border-[#bcc9c4]/40 pl-3">
              <Link
                href="/contatos"
                onClick={handleNavClick}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                  isActive('/contatos') && !isActive('/contatos/relatorio')
                    ? 'bg-white text-[#006b5a] shadow-sm font-semibold'
                    : 'text-[#3d4945] hover:bg-[#dee3e3] font-medium'
                }`}
              >
                <Target size={14} />
                Base de Contatos
              </Link>
              <Link
                href="/contatos/relatorio"
                onClick={handleNavClick}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                  isActive('/contatos/relatorio')
                    ? 'bg-white text-[#006b5a] shadow-sm font-semibold'
                    : 'text-[#3d4945] hover:bg-[#dee3e3] font-medium'
                }`}
              >
                <BarChart3 size={14} />
                Relatório
              </Link>
            </div>
          )}
        </div>

        <Link
          href="/pacientes"
          onClick={handleNavClick}
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
          onClick={handleNavClick}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
            isActive('/prontuarios')
              ? 'bg-white text-[#006b5a] shadow-sm translate-x-1 font-semibold'
              : 'text-[#3d4945] hover:bg-[#dee3e3] font-medium'
          }`}
        >
          <FileText size={20} />
          <span className="text-sm">Prontuários</span>
        </Link>

        {/* Grupo Comercial */}
        <div>
          <button
            onClick={() => setComercialOpen(v => !v)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              isActive('/vendas') || isActive('/produtos') || isActive('/relatorios/vendas')
                ? 'bg-white text-[#006b5a] shadow-sm font-semibold'
                : 'text-[#3d4945] hover:bg-[#dee3e3] font-medium'
            }`}
          >
            <ShoppingCart size={20} />
            <span className="text-sm flex-1 text-left">Comercial</span>
            <ChevronDown
              size={16}
              className={`transition-transform duration-200 ${comercialOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {comercialOpen && (
            <div className="mt-1 ml-4 space-y-0.5 border-l-2 border-[#bcc9c4]/40 pl-3">
              <Link
                href="/vendas"
                onClick={handleNavClick}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                  isActive('/vendas')
                    ? 'bg-white text-[#006b5a] shadow-sm font-semibold'
                    : 'text-[#3d4945] hover:bg-[#dee3e3] font-medium'
                }`}
              >
                <ShoppingCart size={14} />
                Vendas
              </Link>
              <Link
                href="/produtos"
                onClick={handleNavClick}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                  isActive('/produtos')
                    ? 'bg-white text-[#006b5a] shadow-sm font-semibold'
                    : 'text-[#3d4945] hover:bg-[#dee3e3] font-medium'
                }`}
              >
                <Package size={14} />
                Produtos
              </Link>
              {(userRole === 'gestor' || userRole === 'master') && (
                <Link
                  href="/relatorios/vendas"
                  onClick={handleNavClick}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                    isActive('/relatorios/vendas')
                      ? 'bg-white text-[#006b5a] shadow-sm font-semibold'
                      : 'text-[#3d4945] hover:bg-[#dee3e3] font-medium'
                  }`}
                >
                  <BarChart3 size={14} />
                  Relatório de Vendas
                </Link>
              )}
            </div>
          )}
        </div>

        {(userRole === 'gestor' || userRole === 'master') && (
          <div>
            <button
              onClick={() => setEquipeOpen(v => !v)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive('/equipe') || isActive('/relatorios')
                  ? 'bg-white text-[#006b5a] shadow-sm font-semibold'
                  : 'text-[#3d4945] hover:bg-[#dee3e3] font-medium'
              }`}
            >
              <Briefcase size={20} />
              <span className="text-sm flex-1 text-left">Equipe</span>
              <ChevronDown
                size={16}
                className={`transition-transform duration-200 ${equipeOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {equipeOpen && (
              <div className="mt-1 ml-4 space-y-0.5 border-l-2 border-[#bcc9c4]/40 pl-3">
                <Link
                  href="/equipe"
                  onClick={handleNavClick}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                    isActive('/equipe') && !isActive('/relatorios')
                      ? 'bg-white text-[#006b5a] shadow-sm font-semibold'
                      : 'text-[#3d4945] hover:bg-[#dee3e3] font-medium'
                  }`}
                >
                  <UserCheck size={14} />
                  Membros
                </Link>
                <Link
                  href="/relatorios/tempo-fabril"
                  onClick={handleNavClick}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                    isActive('/relatorios/tempo-fabril')
                      ? 'bg-white text-[#006b5a] shadow-sm font-semibold'
                      : 'text-[#3d4945] hover:bg-[#dee3e3] font-medium'
                  }`}
                >
                  <BarChart3 size={14} />
                  Tempo Fábril
                </Link>
              </div>
            )}
          </div>
        )}

        <div>
          <button
            onClick={() => setConfigOpen(v => !v)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              isActive('/configuracoes')
                ? 'bg-white text-[#006b5a] shadow-sm font-semibold'
                : 'text-[#3d4945] hover:bg-[#dee3e3] font-medium'
            }`}
          >
            <Settings size={20} />
            <span className="text-sm flex-1 text-left">Configurações</span>
            <ChevronDown
              size={16}
              className={`transition-transform duration-200 ${configOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {configOpen && (
            <div className="mt-1 ml-4 space-y-0.5 border-l-2 border-[#bcc9c4]/40 pl-3">
              <Link
                href="/configuracoes/jornada"
                onClick={handleNavClick}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                  isActive('/configuracoes/jornada')
                    ? 'bg-white text-[#006b5a] shadow-sm font-semibold'
                    : 'text-[#3d4945] hover:bg-[#dee3e3] font-medium'
                }`}
              >
                <Clock size={14} />
                Jornada de Trabalho
              </Link>
              <Link
                href="/configuracoes/disponibilidade"
                onClick={handleNavClick}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                  isActive('/configuracoes/disponibilidade')
                    ? 'bg-white text-[#006b5a] shadow-sm font-semibold'
                    : 'text-[#3d4945] hover:bg-[#dee3e3] font-medium'
                }`}
              >
                <Calendar size={14} />
                Disponibilidade
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Footer Actions */}
      <div className="mt-auto pt-4 space-y-1 border-t border-[#bcc9c4]/30">
        <button
          onClick={onOpenNovoAgendamento}
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
    </aside>
  )
}
