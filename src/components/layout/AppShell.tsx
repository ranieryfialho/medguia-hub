'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Sidebar } from './Sidebar'
import { SlideNovoAgendamento } from '@/components/features/agenda'
import { BuscaGlobal } from './BuscaGlobal'
import { BuscaGlobalTrigger } from './BuscaGlobalTrigger'
import { SinoNotificacoes } from './SinoNotificacoes'
import { Menu } from 'lucide-react'
import type { DisponibilidadeDia } from '@/lib/disponibilidade'
import { SlideNovoAgendamentoProvider } from './SlideNovoAgendamentoContext'
import { ProtocolosAtendimentoProvider } from './ProtocolosAtendimentoContext'
import { TiposConsultaProvider } from './TiposConsultaContext'
import type { ProtocoloAtendimento } from '@/actions/protocolos-atendimento'
import type { TipoConsulta } from '@/actions/tipos-consulta'
import type { PlanoSaude } from '@/actions/planos-saude'

type Profissional = { id: string; nome: string; cargo: string }

type HeaderData = {
  nomeUsuario: string
  cargoUsuario: string
  avatarUrl: string
  userRole: string
  userNivelAcesso: string
  modulosLiberados: string[]
  prontuariosPendentes: number
  followUpsPendentes: number
  userEmail: string
  userId: string
}

export function AppShell({
  children,
  profissionais,
  disponibilidades,
  disponibilidadesMensais,
  tiposConsulta,
  protocolosAtendimento,
  planosSaude = [],
  headerData,
}: {
  children: React.ReactNode
  profissionais: Profissional[]
  disponibilidades?: Record<string, Record<number, DisponibilidadeDia>>
  disponibilidadesMensais?: Record<string, Record<string, DisponibilidadeDia | null>>
  tiposConsulta: TipoConsulta[]
  protocolosAtendimento: ProtocoloAtendimento[]
  planosSaude?: PlanoSaude[]
  headerData: HeaderData
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [slideNovoAberto, setSlideNovoAberto] = useState(false)

  return (
    <SlideNovoAgendamentoProvider aberto={slideNovoAberto}>
      <TiposConsultaProvider tiposConsulta={tiposConsulta}>
      <ProtocolosAtendimentoProvider protocolosAtendimento={protocolosAtendimento}>
        <div className="flex min-h-[100dvh] bg-[#f5faf9]">

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
            followUpsPendentes={headerData.followUpsPendentes}
            userEmail={headerData.userEmail}
          />
        </div>

        {/* Conteúdo principal */}
        <div className="flex-1 lg:ml-64 flex flex-col min-h-dvh">

          {/* Topbar mobile */}
          <div className="lg:hidden sticky top-0 z-40 bg-[#f5faf9]/95 backdrop-blur-md border-b border-[#dee3e3]/50" style={{ paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))', paddingBottom: '12px', paddingLeft: '16px', paddingRight: '16px' }}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-xl hover:bg-[#dee3e3] text-[#3d4945] transition-colors"
              >
                <Menu size={22} />
              </button>
              <span className="font-bold text-[#006b5a] text-base tracking-tight flex-1">MedGuia Hub</span>
              <SinoNotificacoes userId={headerData.userId} />
              <Image
                src={headerData.avatarUrl}
                alt={headerData.nomeUsuario}
                width={32}
                height={32}
                className="w-8 h-8 rounded-xl object-cover border border-slate-200"
              />
            </div>
            <div className="mt-2">
              <BuscaGlobalTrigger className="w-full" />
            </div>
          </div>

          {children}
        </div>

        {/* Modal de busca global — renderizado uma vez, ativado via Ctrl+K ou trigger */}
        <BuscaGlobal modulosLiberados={headerData.modulosLiberados} />

        {/* SlideNovoAgendamento fora da div com transform para fixed funcionar corretamente */}
        <SlideNovoAgendamento
          profissionais={profissionais}
          disponibilidades={disponibilidades}
          disponibilidadesMensais={disponibilidadesMensais}
          planos={planosSaude}
          controlledOpen={slideNovoAberto}
          onControlledClose={() => setSlideNovoAberto(false)}
        />
        </div>
      </ProtocolosAtendimentoProvider>
      </TiposConsultaProvider>
    </SlideNovoAgendamentoProvider>
  )
}
