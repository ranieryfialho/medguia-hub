'use client'

import { useState } from 'react'
import { Receipt, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import type { GerarPdfReciboInput } from '@/lib/relatorios/pdf-recibo-venda'

type Props = {
  dados: GerarPdfReciboInput
}

export function BtnImprimirRecibo({ dados }: Props) {
  const [carregando, setCarregando] = useState(false)

  const handleImprimir = async () => {
    setCarregando(true)
    try {
      const { gerarPdfReciboVenda } = await import('@/lib/relatorios/pdf-recibo-venda')
      const blob = await gerarPdfReciboVenda(dados)
      const url = URL.createObjectURL(blob)
      const w = window.open(url, '_blank')
      if (w) setTimeout(() => w.print(), 800)
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch {
      toast.error('Erro ao gerar o recibo.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <button
      onClick={handleImprimir}
      disabled={carregando}
      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-border hover:bg-page text-text-primary rounded-md font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {carregando
        ? <Loader2 size={15} className="animate-spin" />
        : <Receipt size={15} />
      }
      Recibo
    </button>
  )
}