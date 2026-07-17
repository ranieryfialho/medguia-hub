'use client'

import { useState } from 'react'
import { CalendarDays, ShoppingBag, Images, MessageSquare, CheckCircle2, ClipboardList, StickyNote } from 'lucide-react'
import { TabMidiasPaciente } from './TabMidiasPaciente'
import { TabContatosPaciente } from './TabContatosPaciente'
import { TabConfirmacoesPaciente } from './TabConfirmacoesPaciente'
import { TabObservacoesPaciente } from './TabObservacoesPaciente'
import { ObservacoesTagSection } from './ObservacoesTagSection'

type Tab = 'agendamentos' | 'comercial' | 'midias' | 'observacoes' | 'contatos' | 'confirmacoes' | 'followups'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'agendamentos',  label: 'Agendamentos', icon: CalendarDays  },
  { id: 'comercial',     label: 'Comercial',    icon: ShoppingBag   },
  { id: 'confirmacoes',  label: 'Confirmações', icon: CheckCircle2  },
  { id: 'contatos',      label: 'Contatos',     icon: MessageSquare },
  { id: 'followups',     label: 'Follow-ups',   icon: ClipboardList },
  { id: 'midias',        label: 'Mídias',       icon: Images        },
  { id: 'observacoes',   label: 'Observações',  icon: StickyNote    },
]

type Props = {
  pacienteId: string
  nomePaciente: string
  agendamentosSlot: React.ReactNode
  comercialSlot: React.ReactNode
  followUpsSlot: React.ReactNode
}

export function PacienteTabsClient({ pacienteId, nomePaciente, agendamentosSlot, comercialSlot, followUpsSlot }: Props) {
  const [tab, setTab] = useState<Tab>('agendamentos')

  return (
    <div className="flex flex-col bg-white rounded-xl shadow-sm border border-slate-100">
      {/* Tab bar — scrollable on small screens */}
      <div className="flex overflow-x-auto overflow-y-hidden scrollbar-none border-b border-slate-100 px-3 sm:px-6 pt-3 sm:pt-4 gap-0.5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`
              whitespace-nowrap flex-shrink-0 flex items-center gap-1.5
              px-3 py-2 text-xs sm:text-sm font-semibold rounded-t-lg
              transition-colors border-b-2 -mb-px
              ${tab === id
                ? 'text-[#006b5a] border-[#006b5a] bg-[#f0faf8]'
                : 'text-[#6d7a75] border-transparent hover:text-[#3d4945] hover:bg-[#f5faf9]'
              }
            `}
          >
            <Icon size={13} className="shrink-0" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6 md:p-8">
        {tab === 'agendamentos'  && <>{agendamentosSlot}<ObservacoesTagSection pacienteId={pacienteId} tag="agendamentos" /></>}
        {tab === 'comercial'     && <>{comercialSlot}<ObservacoesTagSection pacienteId={pacienteId} tag="comercial" /></>}
        {tab === 'midias'        && <TabMidiasPaciente pacienteId={pacienteId} nomePaciente={nomePaciente} />}
        {tab === 'observacoes'   && <TabObservacoesPaciente pacienteId={pacienteId} nomePaciente={nomePaciente} />}
        {tab === 'contatos'      && <TabContatosPaciente pacienteId={pacienteId} />}
        {tab === 'confirmacoes'  && <TabConfirmacoesPaciente pacienteId={pacienteId} />}
        {tab === 'followups'     && <>{followUpsSlot}<ObservacoesTagSection pacienteId={pacienteId} tag="followups" /></>}
      </div>
    </div>
  )
}