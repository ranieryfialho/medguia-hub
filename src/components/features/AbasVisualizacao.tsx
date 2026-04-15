'use client'

import { BarChart3, Users } from 'lucide-react'

type AbsVisualizacaoProps = {
  visaoAtiva: 'geral' | 'individual'
  onChangeVisao: (visao: 'geral' | 'individual') => void
  mostrarIndividual: boolean
}

export function AbasVisualizacao({
  visaoAtiva,
  onChangeVisao,
  mostrarIndividual,
}: AbsVisualizacaoProps) {
  return (
    <div className="flex gap-2 print:hidden border-b border-[#bcc9c4]/30">
      {/* Aba Geral */}
      <button
        onClick={() => onChangeVisao('geral')}
        className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm transition-all border-b-2 ${
          visaoAtiva === 'geral'
            ? 'text-[#006b5a] border-b-[#006b5a]'
            : 'text-[#3d4945] border-b-transparent hover:text-[#006b5a]'
        }`}
      >
        <BarChart3 size={18} />
        Visão Geral
      </button>

      {/* Aba Individual - desabilitada se não há dados */}
      <button
        onClick={() => {
          if (mostrarIndividual) onChangeVisao('individual')
        }}
        disabled={!mostrarIndividual}
        className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm transition-all border-b-2 ${
          mostrarIndividual
            ? visaoAtiva === 'individual'
              ? 'text-[#006b5a] border-b-[#006b5a] cursor-pointer'
              : 'text-[#3d4945] border-b-transparent hover:text-[#006b5a] cursor-pointer'
            : 'text-[#bcc9c4] border-b-transparent cursor-not-allowed opacity-50'
        }`}
      >
        <Users size={18} />
        Detalhes
      </button>
    </div>
  )
}
