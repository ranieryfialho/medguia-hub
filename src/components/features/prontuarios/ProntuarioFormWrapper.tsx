'use client'

import { useRouter } from 'next/navigation'
import { ProntuarioEvolucao } from './ProntuarioEvolucao'

interface Props {
  atendimentoId: string
  pacienteId: string
}

export function ProntuarioFormWrapper({ atendimentoId, pacienteId }: Props) {
  const router = useRouter()
  return (
    <ProntuarioEvolucao
      atendimentoId={atendimentoId}
      pacienteId={pacienteId}
      onSuccess={() => router.push('/prontuarios')}
    />
  )
}