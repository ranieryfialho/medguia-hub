'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { contarProntuariosPendentes } from '@/actions/prontuarios'

export function ProntuariosBadge({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount)
  const pathname = usePathname()

  useEffect(() => {
    contarProntuariosPendentes().then(setCount)
  }, [pathname])

  if (count <= 0) return null

  return (
    <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
      {count}
    </span>
  )
}
