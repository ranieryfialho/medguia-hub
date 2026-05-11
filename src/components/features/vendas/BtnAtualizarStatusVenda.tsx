'use client'

import { useState, useTransition } from 'react'
import { CheckCircle, XCircle, Clock, LoaderCircle } from 'lucide-react'
import { atualizarStatusVenda } from '@/actions/vendas'

interface Props {
  vendaId: string
  statusAtual: string
}

export function BtnAtualizarStatusVenda({ vendaId, statusAtual }: Props) {
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState('')

  const atualizar = (novoStatus: string) => {
    setErro('')
    startTransition(async () => {
      const result = await atualizarStatusVenda(vendaId, novoStatus)
      if (result.error) setErro(result.error)
    })
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-text-secondary uppercase font-semibold mb-2">Alterar status</p>
      <div className="flex flex-wrap gap-2">
        {statusAtual !== 'venda_confirmada' && (
          <button
            onClick={() => atualizar('venda_confirmada')}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
          >
            {isPending ? <LoaderCircle size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            Confirmar venda
          </button>
        )}

        {statusAtual !== 'orcamento_pendente' && (
          <button
            onClick={() => atualizar('orcamento_pendente')}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors disabled:opacity-60"
          >
            {isPending ? <LoaderCircle size={14} className="animate-spin" /> : <Clock size={14} />}
            Marcar como pendente
          </button>
        )}

        {statusAtual !== 'orcamento_recusado' && (
          <button
            onClick={() => atualizar('orcamento_recusado')}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-60"
          >
            {isPending ? <LoaderCircle size={14} className="animate-spin" /> : <XCircle size={14} />}
            Marcar como recusado
          </button>
        )}
      </div>
      {erro && <p className="text-xs text-red-600 mt-1">{erro}</p>}
    </div>
  )
}