'use client'

import { useState } from 'react'
import { Printer } from 'lucide-react'
import type { GerarPdfContatosInput } from '@/lib/relatorios/pdf-contatos'
import { gerarPdfContatos } from '@/lib/relatorios/pdf-contatos'

export function BtnGerarPdfContatos(props: GerarPdfContatosInput) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    try {
      setLoading(true)
      await gerarPdfContatos(props)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2.5 bg-[#006b5a] text-white rounded-xl font-bold hover:bg-[#005548] transition-colors disabled:opacity-60"
    >
      <Printer size={18} />
      {loading ? 'Gerando PDF...' : 'Gerar PDF'}
    </button>
  )
}
