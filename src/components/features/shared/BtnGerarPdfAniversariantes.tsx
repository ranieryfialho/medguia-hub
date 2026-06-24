'use client'

import { useState } from 'react'
import { Printer } from 'lucide-react'
import type { GerarPdfAniversariantesInput } from '@/lib/relatorios/pdf-aniversariantes'
import { gerarPdfAniversariantes } from '@/lib/relatorios/pdf-aniversariantes'

export function BtnGerarPdfAniversariantes(props: GerarPdfAniversariantesInput) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    try {
      setLoading(true)
      await gerarPdfAniversariantes(props)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-2 px-5 py-2.5 bg-[#006b5a] text-white rounded-xl font-bold hover:bg-[#005548] transition-colors disabled:opacity-60"
    >
      <Printer size={18} />
      {loading ? 'Gerando PDF...' : 'Gerar PDF'}
    </button>
  )
}