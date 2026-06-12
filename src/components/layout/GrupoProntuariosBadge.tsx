'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { contarFollowUpsPendentes } from '@/actions/follow-ups'
import { contarProntuariosPendentes } from '@/actions/prontuarios'

export function GrupoProntuariosBadge({
  initialProntuarios,
  initialFollowUps,
}: {
  initialProntuarios: number
  initialFollowUps: number
}) {
  const [prontuarios, setProntuarios] = useState(initialProntuarios)
  const [followUps, setFollowUps] = useState(initialFollowUps)
  const pathname = usePathname()

  useEffect(() => {
    Promise.all([
      contarProntuariosPendentes().then(setProntuarios),
      contarFollowUpsPendentes().then(setFollowUps),
    ])
  }, [pathname])

  const total = prontuarios + followUps
  if (total <= 0) return null

  return (
    <span className="bg-[#006b5a] text-white text-xs font-bold px-2 py-1 rounded-full">
      {total}
    </span>
  )
}
