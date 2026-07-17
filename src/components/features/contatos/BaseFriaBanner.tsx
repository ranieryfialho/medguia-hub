'use client'

import { useState } from 'react'
import { Flame, Info, X } from 'lucide-react'

const TOOLTIP = `Critérios para considerar um contato frio:
• Tentativa — sem atividade há 3+ dias
• A Contatar / Recuperação de Base / Em Conversa — sem atividade há 7+ dias

"Atividade" = nota adicionada ao card ou mudança de coluna.`

export type ContatoFrio = {
  paciente_id: string
  nome: string
  status: string
  dias_sem_atividade: number
}

export function BaseFriaBanner({
  contatos,
  filtrandoFrios,
  onVerQuais,
}: {
  contatos: ContatoFrio[]
  filtrandoFrios: boolean
  onVerQuais: () => void
}) {
  const [dispensado, setDispensado] = useState(false)

  if (contatos.length === 0 || dispensado) return null

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-sm">
      <Flame size={15} className="text-amber-500 shrink-0" />
      <span className="flex-1 text-amber-800">
        <span className="font-semibold">{contatos.length} contato{contatos.length !== 1 ? 's' : ''}</span>
        {' '}sem atividade recente — revise a base para mantê-la aquecida.
      </span>
      <span className="relative group shrink-0">
        <Info size={14} className="text-amber-400 cursor-help" />
        <span className="pointer-events-none absolute right-0 top-6 z-50 w-64 rounded-xl bg-[#171d1c] text-white text-xs p-3 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity whitespace-pre-line shadow-xl">
          {TOOLTIP}
        </span>
      </span>
      <button
        onClick={onVerQuais}
        className={`text-xs font-medium transition-colors shrink-0 px-2.5 py-1 rounded-lg border ${
          filtrandoFrios
            ? 'bg-amber-500 border-amber-500 text-white'
            : 'border-amber-300 text-amber-600 hover:bg-amber-100'
        }`}
      >
        {filtrandoFrios ? 'Mostrar todos' : 'Filtrar no kanban'}
      </button>
      <button
        onClick={() => setDispensado(true)}
        className="p-1 rounded-lg hover:bg-amber-200 text-amber-400 transition-colors shrink-0"
        title="Dispensar"
      >
        <X size={13} />
      </button>
    </div>
  )
}