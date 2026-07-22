'use client'

import { useState } from 'react'
import { Printer } from 'lucide-react'
import type { GerarPdfFollowUpsInput } from '@/lib/relatorios/pdf-follow-ups'
import { gerarPdfFollowUps } from '@/lib/relatorios/pdf-follow-ups'

export function BtnGerarPdfFollowUps(props: GerarPdfFollowUpsInput) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    try {
      setLoading(true)
      await gerarPdfFollowUps(props)
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
