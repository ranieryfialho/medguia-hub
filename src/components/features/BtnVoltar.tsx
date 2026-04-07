'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export function BtnVoltar() {
  const router = useRouter()

  return (
    <button
      onClick={() => router.back()}
      className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-600"
      aria-label="Voltar"
    >
      <ArrowLeft size={24} />
    </button>
  )
}
