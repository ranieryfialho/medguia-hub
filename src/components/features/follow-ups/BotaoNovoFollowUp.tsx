'use client'

import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { ModalFollowUp } from './ModalFollowUp'
import type { FollowUpTipo } from '@/actions/follow-ups'

type Profissional = { id: string; full_name: string }

export function BotaoNovoFollowUp({
  tipos,
  profissionais,
}: {
  tipos: Pick<FollowUpTipo, 'id' | 'nome'>[]
  profissionais: Profissional[]
}) {
  const router = useRouter()

  return (
    <ModalFollowUp
      tipos={tipos}
      profissionais={profissionais}
      onSuccess={() => router.refresh()}
      trigger={
        <button className="flex items-center gap-1.5 px-4 py-2 bg-[#006b5a] hover:bg-[#005a4b] text-white rounded-lg text-sm font-semibold transition-colors shrink-0">
          <Plus size={15} />
          Novo Follow-up
        </button>
      }
    />
  )
}
