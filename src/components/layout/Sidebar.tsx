'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
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
  ClipboardList,
  ShoppingCart,
  Package,
  ShieldCheck,
  Heart,
  UserPlus,
  Layers,
  HardDrive,
  Lock,
  Cake,
  MessageSquare,
  CircleDot,
  ShieldAlert,
  TrendingUp,
  MessageCircleWarning,
  Stethoscope,
  Tag,
  Building2,
} from 'lucide-react'
import { ProntuariosBadge } from './ProntuariosBadge'
import { FollowUpsBadge } from './FollowUpsBadge'
import { GrupoProntuariosBadge } from './GrupoProntuariosBadge'
import { temAcesso, temAcessoGrupo } from '@/lib/modulos'
import type { ModuloChave } from '@/lib/modulos'
import { isGestorSistema } from '@/lib/permissoes'


export function Sidebar({
  onMobileClose,
  onOpenNovoAgendamento,
  modulosLiberados: modulosLiberadosProp,
  prontuariosPendentes: prontuariosPendentesProp,
  followUpsPendentes: followUpsPendentesProp,
  userNivelAcesso,
}: {
  onMobileClose?: () => void
  onOpenNovoAgendamento?: () => void
  modulosLiberados?: string[]
  prontuariosPendentes?: number
  followUpsPendentes?: number
  userNivelAcesso?: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [supabase] = useState(createClient)
  const [confirmacoesOpen, setConfirmacoesOpen] = useState(() => pathname?.startsWith('/confirmacoes') ?? false)
  const [contatosOpen, setContatosOpen] = useState(() => pathname?.startsWith('/contatos') ?? false)
  const [configOpen, setConfigOpen] = useState(() => pathname?.startsWith('/configuracoes') ?? false)
  const [equipeOpen, setEquipeOpen] = useState(() => (pathname?.startsWith('/equipe') || pathname?.startsWith('/relatorios/tempo-fabril') || pathname?.startsWith('/relatorios/conferencia-agendamentos') || pathname?.startsWith('/relatorios/auditoria-exclusoes') || pathname?.startsWith('/configuracoes/jornada') || pathname?.startsWith('/configuracoes/disponibilidade') || pathname?.startsWith('/configuracoes/status-disponibilidade')) ?? false)
  const [comercialOpen, setComercialOpen] = useState(() => (pathname?.startsWith('/vendas') || pathname?.startsWith('/produtos') || pathname?.startsWith('/objecoes') || pathname?.startsWith('/relatorios/vendas') || pathname?.startsWith('/vendas/protocolos')) ?? false)
  const [pacientesOpen, setPacientesOpen] = useState(() => pathname?.startsWith('/pacientes') ?? false)
  const [prontuariosOpen, setProntuariosOpen] = useState(() => (pathname?.startsWith('/prontuarios') || pathname?.startsWith('/follow-ups') || pathname?.startsWith('/relatorios/follow-ups')) ?? false)
  const modulos = modulosLiberadosProp ?? []
  const prontuariosPendentes = prontuariosPendentesProp ?? 0
  const followUpsPendentes = followUpsPendentesProp ?? 0

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (path: string) => pathname?.startsWith(path)
  const handleNavClick = () => onMobileClose?.()
  const pv = (chave: ModuloChave) => temAcesso(modulos, chave)
  const pvGrupo = (chave_grupo: string) => temAcessoGrupo(modulos, chave_grupo)
  const isGestor = isGestorSistema(userNivelAcesso)

  const linkCls = (active: boolean) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${
      active ? 'bg-white text-[#006b5a] shadow-sm translate-x-1 font-semibold' : 'text-[#3d4945] hover:bg-[#dee3e3]'
    }`

  const groupCls = (active: boolean) =>
    `w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${
      active ? 'bg-white text-[#006b5a] shadow-sm font-semibold' : 'text-[#3d4945] hover:bg-[#dee3e3]'
    }`

  const subLinkCls = (active: boolean) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all font-medium ${
      active ? 'bg-white text-[#006b5a] shadow-sm font-semibold' : 'text-[#3d4945] hover:bg-[#dee3e3]'
    }`

  return (
    <aside className="h-dvh w-64 overflow-y-auto z-200 bg-[#f0f5f4] border-r border-[#dee3e3]/50 flex flex-col p-4 gap-2 hide-scrollbar" style={{ paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))' }}>
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

      <nav className="flex-1 space-y-1">
        {pv('dashboard') && (
          <Link href="/dashboard" onClick={handleNavClick} className={linkCls(pathname === '/dashboard')}>
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </Link>
        )}

        {pv('agenda') && (
          <Link href="/agenda" onClick={handleNavClick} className={linkCls(!!isActive('/agenda'))}>
            <CalendarDays size={20} />
            <span>Agenda</span>
          </Link>
        )}

        {pv('pre_consultas') && (
          <Link href="/pre-consultas" onClick={handleNavClick} className={linkCls(!!isActive('/pre-consultas'))}>
            <Stethoscope size={20} />
            <span>Pré/Pós-consultas</span>
          </Link>
        )}

        {pvGrupo('confirmacoes') && (
          <div>
            <button onClick={() => setConfirmacoesOpen(v => !v)} className={groupCls(!!isActive('/confirmacoes'))}>
              <PhoneCall size={20} />
              <span className="flex-1 text-left">Confirmações</span>
              <ChevronDown size={16} className={`transition-transform duration-200 ${confirmacoesOpen ? 'rotate-180' : ''}`} />
            </button>
            {confirmacoesOpen && (
              <div className="mt-1 ml-4 space-y-0.5 border-l-2 border-[#bcc9c4]/40 pl-3">
                {pv('confirmacoes:cards') && (
                  <Link href="/confirmacoes/cards" onClick={handleNavClick} className={subLinkCls(!!isActive('/confirmacoes/cards'))}>
                    Cards
                  </Link>
                )}
                {pv('confirmacoes:semana') && (
                  <Link href="/confirmacoes/semana" onClick={handleNavClick} className={subLinkCls(!!isActive('/confirmacoes/semana'))}>
                    Semana
                  </Link>
                )}
                {pv('confirmacoes:historico') && (
                  <Link href="/confirmacoes/historico" onClick={handleNavClick} className={subLinkCls(!!isActive('/confirmacoes/historico'))}>
                    Histórico
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {pvGrupo('contatos') && (
          <div>
            <button onClick={() => setContatosOpen(v => !v)} className={groupCls(!!isActive('/contatos'))}>
              <Target size={20} />
              <span className="flex-1 text-left">Contatos</span>
              <ChevronDown size={16} className={`transition-transform duration-200 ${contatosOpen ? 'rotate-180' : ''}`} />
            </button>
            {contatosOpen && (
              <div className="mt-1 ml-4 space-y-0.5 border-l-2 border-[#bcc9c4]/40 pl-3">
                {pv('contatos:base') && (
                  <Link href="/contatos" onClick={handleNavClick} className={subLinkCls(!!isActive('/contatos') && !isActive('/contatos/relatorio'))}>
                    <Target size={14} />
                    Base de Contatos
                  </Link>
                )}
                {pv('contatos:relatorio') && (
                  <Link href="/contatos/relatorio" onClick={handleNavClick} className={subLinkCls(!!isActive('/contatos/relatorio'))}>
                    <BarChart3 size={14} />
                    Relatório
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {pv('pacientes') && (
          <div>
            <button
              onClick={() => setPacientesOpen(v => !v)}
              className={groupCls(!!isActive('/pacientes'))}
            >
              <Users size={20} />
              <span className="flex-1 text-left">Pacientes</span>
              <ChevronDown size={16} className={`transition-transform duration-200 ${pacientesOpen ? 'rotate-180' : ''}`} />
            </button>
            {pacientesOpen && (
              <div className="mt-1 ml-4 space-y-0.5 border-l-2 border-[#bcc9c4]/40 pl-3">
                <Link href="/pacientes" onClick={handleNavClick} className={subLinkCls(!!isActive('/pacientes') && !isActive('/pacientes/origens') && !isActive('/pacientes/tipos-consulta') && !isActive('/pacientes/planos-saude') && !isActive('/pacientes/tags') && !isActive('/pacientes/relatorio-consultas') && !isActive('/pacientes/relatorio-cadastros') && !isActive('/pacientes/relatorio-atendidos') && !isActive('/pacientes/relatorio-aniversariantes'))}>
                  <Users size={14} />
                  Listar Pacientes
                </Link>
                <Link href="/pacientes/tags" onClick={handleNavClick} className={subLinkCls(!!isActive('/pacientes/tags'))}>
                  <Tag size={14} />
                  Tags
                </Link>
                <Link href="/pacientes/origens" onClick={handleNavClick} className={subLinkCls(!!isActive('/pacientes/origens'))}>
                  <Target size={14} />
                  Origens
                </Link>
                <Link href="/pacientes/tipos-consulta" onClick={handleNavClick} className={subLinkCls(!!isActive('/pacientes/tipos-consulta'))}>
                  <Calendar size={14} />
                  Tipos de consulta
                </Link>
                <Link href="/pacientes/planos-saude" onClick={handleNavClick} className={subLinkCls(!!isActive('/pacientes/planos-saude'))}>
                  <Heart size={14} />
                  Planos de Saúde
                </Link>
                <Link href="/pacientes/relatorio-consultas" onClick={handleNavClick} className={subLinkCls(!!isActive('/pacientes/relatorio-consultas'))}>
                  <ClipboardList size={14} />
                  Relatório de Consultas
                </Link>
                <Link href="/pacientes/relatorio-cadastros" onClick={handleNavClick} className={subLinkCls(!!isActive('/pacientes/relatorio-cadastros'))}>
                  <UserPlus size={14} />
                  Relatório de Cadastros
                </Link>
                <Link href="/pacientes/relatorio-atendidos" onClick={handleNavClick} className={subLinkCls(!!isActive('/pacientes/relatorio-atendidos'))}>
                  <Stethoscope size={14} />
                  Relatório de Atendidos
                </Link>
                <Link href="/pacientes/relatorio-aniversariantes" onClick={handleNavClick} className={subLinkCls(!!isActive('/pacientes/relatorio-aniversariantes'))}>
                  <Cake size={14} />
                  Aniversariantes
                </Link>
              </div>
            )}
          </div>
        )}

        {pvGrupo('prontuarios') && (
          <div>
            <button onClick={() => setProntuariosOpen(v => !v)} className={groupCls(!!isActive('/prontuarios') || !!isActive('/follow-ups') || !!isActive('/relatorios/follow-ups'))}>
              <FileText size={20} />
              <span className="flex-1 text-left">Prontuários e Follow-ups</span>
              {!prontuariosOpen && (
                <GrupoProntuariosBadge initialProntuarios={prontuariosPendentes} initialFollowUps={followUpsPendentes} />
              )}
              <ChevronDown size={16} className={`transition-transform duration-200 ${prontuariosOpen ? 'rotate-180' : ''}`} />
            </button>
            {prontuariosOpen && (
              <div className="mt-1 ml-4 space-y-0.5 border-l-2 border-[#bcc9c4]/40 pl-3">
                {pv('prontuarios') && (
                  <Link href="/prontuarios" onClick={handleNavClick} className={subLinkCls(!!isActive('/prontuarios'))}>
                    <FileText size={14} />
                    <span className="flex-1">Prontuários</span>
                    <ProntuariosBadge initialCount={prontuariosPendentes} />
                  </Link>
                )}
                {pv('follow_ups') && (
                  <Link href="/follow-ups" onClick={handleNavClick} className={subLinkCls(!!isActive('/follow-ups') && !isActive('/follow-ups/tipos') && !isActive('/follow-ups/templates'))}>
                    <ClipboardList size={14} />
                    <span className="flex-1">Follow-ups</span>
                    <FollowUpsBadge initialCount={followUpsPendentes} />
                  </Link>
                )}
                {pv('follow_ups') && (
                  <Link href="/relatorios/follow-ups" onClick={handleNavClick} className={subLinkCls(!!isActive('/relatorios/follow-ups'))}>
                    <BarChart3 size={14} />
                    Relatório de Follow-ups
                  </Link>
                )}
                {pv('follow_ups:tipos') && (
                  <Link href="/follow-ups/tipos" onClick={handleNavClick} className={subLinkCls(!!isActive('/follow-ups/tipos'))}>
                    <Layers size={14} />
                    Tipos de Follow-up
                  </Link>
                )}
                {pv('follow_ups:templates') && (
                  <Link href="/follow-ups/templates" onClick={handleNavClick} className={subLinkCls(!!isActive('/follow-ups/templates'))}>
                    <ClipboardList size={14} />
                    Templates de Follow-up
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {pvGrupo('comercial') && (
          <div>
            <button
              onClick={() => setComercialOpen(v => !v)}
              className={groupCls(!!isActive('/vendas') || !!isActive('/produtos') || !!isActive('/objecoes') || !!isActive('/relatorios/vendas'))}
            >
              <ShoppingCart size={20} />
              <span className="flex-1 text-left">Comercial</span>
              <ChevronDown size={16} className={`transition-transform duration-200 ${comercialOpen ? 'rotate-180' : ''}`} />
            </button>
            {comercialOpen && (
              <div className="mt-1 ml-4 space-y-0.5 border-l-2 border-[#bcc9c4]/40 pl-3">
                {pv('comercial:vendas') && (
                  <Link href="/vendas" onClick={handleNavClick} className={subLinkCls(!!isActive('/vendas') && !isActive('/vendas/protocolos') && !isActive('/vendas/tags'))}>
                    <ShoppingCart size={14} />
                    Vendas
                  </Link>
                )}
                {pv('comercial:vendas') && (
                  <Link href="/vendas/tags" onClick={handleNavClick} className={subLinkCls(!!isActive('/vendas/tags'))}>
                    <Tag size={14} />
                    Tags
                  </Link>
                )}
                {pv('comercial:produtos') && (
                  <Link href="/produtos" onClick={handleNavClick} className={subLinkCls(!!isActive('/produtos'))}>
                    <Package size={14} />
                    Produtos
                  </Link>
                )}
                {pv('comercial:produtos') && (
                  <Link href="/vendas/protocolos" onClick={handleNavClick} className={subLinkCls(!!isActive('/vendas/protocolos'))}>
                    <Layers size={14} />
                    Protocolos
                  </Link>
                )}
                {pv('comercial:objecoes') && (
                  <Link href="/objecoes" onClick={handleNavClick} className={subLinkCls(!!isActive('/objecoes'))}>
                    <MessageCircleWarning size={14} />
                    Objeções
                  </Link>
                )}
                {pv('comercial:relatorio_vendas') && (
                  <Link href="/relatorios/vendas" onClick={handleNavClick} className={subLinkCls(pathname === '/relatorios/vendas')}>
                    <BarChart3 size={14} />
                    Relatório de Vendas
                  </Link>
                )}
                {pv('comercial:relatorio_vendas') && (
                  <Link href="/relatorios/vendas-historicas" onClick={handleNavClick} className={subLinkCls(!!isActive('/relatorios/vendas-historicas'))}>
                    <TrendingUp size={14} />
                    Vendas Históricas
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        <div>
          {pvGrupo('equipe') ? (
            <button
              onClick={() => setEquipeOpen(v => !v)}
              className={groupCls(!!isActive('/equipe') || !!isActive('/relatorios/tempo-fabril') || !!isActive('/relatorios/conferencia-agendamentos') || !!isActive('/relatorios/auditoria-exclusoes'))}
            >
              <Briefcase size={20} />
              <span className="flex-1 text-left">Equipe</span>
              <ChevronDown size={16} className={`transition-transform duration-200 ${equipeOpen ? 'rotate-180' : ''}`} />
            </button>
          ) : (
            <div
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#bcc9c4] cursor-not-allowed select-none"
              title="Você não tem acesso a nenhum item deste menu"
            >
              <Briefcase size={20} className="shrink-0" />
              <span className="flex-1 text-left">Equipe</span>
              <Lock size={13} className="shrink-0" />
            </div>
          )}
          {pvGrupo('equipe') && equipeOpen && (
            <div className="mt-1 ml-4 space-y-0.5 border-l-2 border-[#bcc9c4]/40 pl-3">
              {pv('equipe:membros') && (
                <Link href="/equipe" onClick={handleNavClick} className={subLinkCls(!!isActive('/equipe') && !isActive('/equipe/acessos') && !isActive('/relatorios'))}>
                  <UserCheck size={14} />
                  Membros
                </Link>
              )}
              {pv('equipe:tempo_fabril') && (
                <Link href="/relatorios/tempo-fabril" onClick={handleNavClick} className={subLinkCls(!!isActive('/relatorios/tempo-fabril'))}>
                  <BarChart3 size={14} />
                  Tempo Fabril
                </Link>
              )}
              {pv('equipe:conferencia') && (
                <Link href="/relatorios/conferencia-agendamentos" onClick={handleNavClick} className={subLinkCls(!!isActive('/relatorios/conferencia-agendamentos'))}>
                  <ClipboardList size={14} />
                  Conferência
                </Link>
              )}
              {pv('equipe:acessos') && (
                <Link href="/equipe/acessos" onClick={handleNavClick} className={subLinkCls(!!isActive('/equipe/acessos'))}>
                  <ShieldCheck size={14} />
                  Gestão de Acessos
                </Link>
              )}
              {isGestor && (
                <Link href="/relatorios/auditoria-exclusoes" onClick={handleNavClick} className={subLinkCls(!!isActive('/relatorios/auditoria-exclusoes'))}>
                  <ShieldAlert size={14} />
                  Auditoria de Exclusões
                </Link>
              )}
              {pv('configuracoes:jornada') && (
                <Link href="/configuracoes/jornada" onClick={handleNavClick} className={subLinkCls(!!isActive('/configuracoes/jornada'))}>
                  <Clock size={14} />
                  Jornada de Trabalho
                </Link>
              )}
              {pv('configuracoes:disponibilidade') && (
                <Link href="/configuracoes/disponibilidade" onClick={handleNavClick} className={subLinkCls(!!isActive('/configuracoes/disponibilidade'))}>
                  <Calendar size={14} />
                  Disponibilidade
                </Link>
              )}
              {pv('configuracoes:status_disponibilidade') && (
                <Link href="/configuracoes/status-disponibilidade" onClick={handleNavClick} className={subLinkCls(!!isActive('/configuracoes/status-disponibilidade'))}>
                  <CircleDot size={14} />
                  Status de Disponibilidade
                </Link>
              )}
            </div>
          )}
        </div>

        {pvGrupo('configuracoes') && (
          <div>
            <button onClick={() => setConfigOpen(v => !v)} className={groupCls(!!isActive('/configuracoes'))}>
              <Settings size={20} />
              <span className="flex-1 text-left">Configurações</span>
              <ChevronDown size={16} className={`transition-transform duration-200 ${configOpen ? 'rotate-180' : ''}`} />
            </button>
            {configOpen && (
              <div className="mt-1 ml-4 space-y-0.5 border-l-2 border-[#bcc9c4]/40 pl-3">
                {pv('confirmacoes:mensagens') && (
                  <Link href="/configuracoes/mensagens" onClick={handleNavClick} className={subLinkCls(!!isActive('/configuracoes/mensagens'))}>
                    <MessageSquare size={14} />
                    Mensagens
                  </Link>
                )}
                {pv('configuracoes:clinica') && (
                  <Link href="/configuracoes/clinica" onClick={handleNavClick} className={subLinkCls(!!isActive('/configuracoes/clinica'))}>
                    <Building2 size={14} />
                    Dados da Clínica
                  </Link>
                )}
                {pv('configuracoes:google_drive') && (
                  <Link href="/configuracoes/google-drive" onClick={handleNavClick} className={subLinkCls(!!isActive('/configuracoes/google-drive'))}>
                    <HardDrive size={14} />
                    Google Drive
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </nav>

      <div className="mt-auto pt-4 space-y-1 border-t border-[#bcc9c4]/30">
        <button
          onClick={onOpenNovoAgendamento}
          className="w-full bg-linear-to-r from-[#006b5a] to-[#33a68f] text-white rounded-full py-3 mb-4 flex items-center justify-center gap-2 shadow-lg shadow-[#006b5a]/20 hover:scale-[0.98] transition-transform"
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
