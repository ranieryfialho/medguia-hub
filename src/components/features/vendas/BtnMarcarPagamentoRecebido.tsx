'use client'

import { CheckCircle2, LoaderCircle } from 'lucide-react'
import { marcarPagamentoRecebido } from '@/actions/vendas'
import { useState, useTransition } from 'react'

interface Props {
  pagamentoId: string
  vendaId: string
}

export function BtnMarcarPagamentoRecebido({ pagamentoId, vendaId }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    if (!confirm('Confirmar que este valor foi recebido?')) return

    startTransition(async () => {
      const result = await marcarPagamentoRecebido(pagamentoId, vendaId)
      if (result?.error) {
        setError(result.error)
        setTimeout(() => setError(null), 4000)
      }
    })
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-medium transition-colors disabled:opacity-50"
        title="Marcar como recebido"
      >
        {isPending ? <LoaderCircle size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
        Marcar como recebido
      </button>

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-md text-sm z-50 max-w-xs">
          {error}
        </div>
      )}
    </>
  )
}
