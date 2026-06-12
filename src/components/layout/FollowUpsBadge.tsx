'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { contarFollowUpsPendentes } from '@/actions/follow-ups'

export function FollowUpsBadge({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount)
  const pathname = usePathname()

  useEffect(() => {
    contarFollowUpsPendentes().then(setCount)
  }, [pathname])

  if (count <= 0) return null

  return (
    <span className="bg-[#006b5a] text-white text-xs font-bold px-2 py-1 rounded-full">
      {count}
    </span>
  )
}
