'use client'

import { useState } from 'react'
import { Printer } from 'lucide-react'
import type { GerarPdfConferenciaInput } from '@/lib/relatorios/pdf-conferencia-agendamentos'
import { gerarPdfConferenciaAgendamentos } from '@/lib/relatorios/pdf-conferencia-agendamentos'

export function BtnGerarPdfConferencia(props: GerarPdfConferenciaInput) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    try {
      setLoading(true)
      await gerarPdfConferenciaAgendamentos(props)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading || props.totalGeralSessoes === 0}
      title={props.totalGeralSessoes === 0 ? 'Nenhum atendimento no período' : 'Exportar PDF'}
      className="flex items-center gap-2 px-4 py-2.5 bg-[#006b5a] text-white rounded-xl font-bold hover:bg-[#005548] transition-colors disabled:opacity-50"
    >
      <Printer size={17} />
      {loading ? 'Gerando...' : 'PDF'}
    </button>
  )
}