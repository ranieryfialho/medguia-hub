'use client'

import { Trash2, LoaderCircle } from 'lucide-react'
import { deletarVenda } from '@/actions/vendas'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  id: string
  status?: string | null
}

export function BtnDeletarVenda({ id, status }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const isOrcamento = status === 'orcamento_pendente' || status === 'orcamento_recusado'
  const label = isOrcamento ? 'orçamento' : 'venda'

  const handleDelete = () => {
    if (!confirm(`Tem certeza que deseja deletar este ${label}?`)) return

    startTransition(async () => {
      const result = await deletarVenda(id)
      if (result?.error) {
        setError(result.error)
        setTimeout(() => setError(null), 4000)
      } else {
        router.push('/vendas')
      }
    })
  }

  return (
    <>
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="p-2 text-text-secondary hover:text-red-500 hover:bg-page rounded transition-colors disabled:opacity-50"
        title={`Deletar ${label}`}
      >
        {isPending ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
      </button>

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-md text-sm z-50 max-w-xs">
          {error}
        </div>
      )}
    </>
  )
}
