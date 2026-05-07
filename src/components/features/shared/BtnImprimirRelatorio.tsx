'use client'

import { useState } from 'react'
import { Printer } from 'lucide-react'
import type { KPIsProfissional } from '@/lib/relatorios/kpis-tempo-fabril'
import { gerarPdfTempoFabril } from '@/lib/relatorios/pdf-tempo-fabril'

type BtnImprimirRelatorioProps = {
  periodoLabel: string
  kpisEquipe: KPIsProfissional[]
  profFiltro: string
}

export function BtnImprimirRelatorio({
  periodoLabel,
  kpisEquipe,
  profFiltro,
}: BtnImprimirRelatorioProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleGerarPdf = async () => {
    try {
      setIsLoading(true)
      await gerarPdfTempoFabril({
        periodoLabel,
        kpisEquipe,
        profFiltro,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleGerarPdf}
      disabled={isLoading}
      className="flex items-center gap-2 px-5 py-2.5 bg-[#006b5a] text-white rounded-xl font-bold hover:bg-[#005548] transition-colors print:hidden"
    >
      <Printer size={18} />
      {isLoading ? 'Gerando PDF...' : 'Gerar PDF'}
    </button>
  )
}
