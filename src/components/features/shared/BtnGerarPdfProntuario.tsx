'use client'

import { useState } from 'react'
import { FileDown } from 'lucide-react'
import type { GerarPdfProntuarioInput } from '@/lib/relatorios/pdf-prontuario'
import { gerarPdfProntuario } from '@/lib/relatorios/pdf-prontuario'

export function BtnGerarPdfProntuario(props: GerarPdfProntuarioInput) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    try {
      setLoading(true)
      await gerarPdfProntuario(props)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 bg-[#006b5a] text-white rounded-xl font-bold text-sm hover:bg-[#005548] transition-colors disabled:opacity-60 cursor-pointer shadow-sm"
    >
      <FileDown size={16} />
      {loading ? 'Gerando PDF...' : 'Gerar PDF'}
    </button>
  )
}
