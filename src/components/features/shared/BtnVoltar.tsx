'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const BTN_CLASS = 'p-2 hover:bg-slate-100 rounded-full transition-all text-slate-600'

export function BtnVoltar({ href }: { href?: string } = {}) {
  const router = useRouter()

  if (href) {
    return (
      <Link href={href} className={BTN_CLASS} aria-label="Voltar">
        <ArrowLeft size={24} />
      </Link>
    )
  }

  return (
    <button onClick={() => router.back()} className={BTN_CLASS} aria-label="Voltar">
      <ArrowLeft size={24} />
    </button>
  )
}
