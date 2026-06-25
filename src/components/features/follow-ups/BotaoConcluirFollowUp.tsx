'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { concluirFollowUp } from '@/actions/follow-ups'

export function BotaoConcluirFollowUp({
  id,
  onSuccess,
}: {
  id: string
  onSuccess?: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleConcluir() {
    startTransition(async () => {
      const result = await concluirFollowUp(id)
      if (result.error) { toast.error(result.error); return }
      toast.success('Follow-up concluído!')
      onSuccess?.()
      router.refresh()
    })
  }

  return (
    <button
      onClick={handleConcluir}
      disabled={isPending}
      className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2 py-1 rounded-lg transition-colors disabled:opacity-50 shrink-0"
    >
      <CheckCircle2 size={13} />
      {isPending ? 'Concluindo...' : 'Concluir'}
    </button>
  )
}
