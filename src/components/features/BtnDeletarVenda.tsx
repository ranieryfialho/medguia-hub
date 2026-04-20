'use client'

import { Trash2 } from 'lucide-react'
import { deletarVenda } from '@/actions/vendas'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export function BtnDeletarVenda({ id }: { id: string }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleDelete = () => {
    if (!confirm('Tem certeza que deseja deletar esta venda?')) return

    startTransition(async () => {
      const result = await deletarVenda(id)
      if (result?.error) {
        setError(result.error)
        setTimeout(() => setError(null), 4000)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <>
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="p-2 text-text-secondary hover:text-red-500 hover:bg-page rounded transition-colors disabled:opacity-50"
        title="Deletar"
      >
        <Trash2 size={16} />
      </button>

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-md text-sm z-50 max-w-xs">
          {error}
        </div>
      )}
    </>
  )
}
