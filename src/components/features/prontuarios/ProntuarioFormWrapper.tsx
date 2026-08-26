'use client'

import { useRouter } from 'next/navigation'
import { ProntuarioEvolucao } from './ProntuarioEvolucao'
import { useProntuarioDirty } from './ProntuarioDirtyGuard'

interface Props {
  atendimentoId: string
  pacienteId: string
}

export function ProntuarioFormWrapper({ atendimentoId, pacienteId }: Props) {
  const router = useRouter()
  const { setDirty } = useProntuarioDirty()
  return (
    <ProntuarioEvolucao
      atendimentoId={atendimentoId}
      pacienteId={pacienteId}
      onDirtyChange={setDirty}
      onSuccess={() => router.push('/prontuarios')}
    />
  )
}
