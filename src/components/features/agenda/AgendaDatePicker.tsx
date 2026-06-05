'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type AgendaDatePickerProps = {
  dataAtual: string
  baseParams: string
}

export function AgendaDatePicker({ dataAtual, baseParams }: AgendaDatePickerProps) {
  const router = useRouter()
  const [value, setValue] = useState(dataAtual)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const novaData = e.target.value
    setValue(novaData)
    if (novaData.length === 10) {
      const params = new URLSearchParams(baseParams)
      params.set('data', novaData)
      router.push(`?${params.toString()}`)
    }
  }

  return (
    <input
      type="date"
      value={value}
      onChange={handleChange}
      className="bg-transparent border-none text-[#3d4945] font-bold text-sm uppercase tracking-widest focus:outline-none cursor-pointer [color-scheme:light]"
    />
  )
}
