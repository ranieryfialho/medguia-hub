'use client'

import { Search } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export function FiltrosEquipe() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const buscaAtual = searchParams.get('busca') || ''
  const [busca, setBusca] = useState(buscaAtual)

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (busca) {
        params.set('busca', busca)
      } else {
        params.delete('busca')
      }
      router.push(`?${params.toString()}`)
    }, 400)

    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca])

  return (
    <div className="relative flex-1">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#3d4945]/50">
        <Search size={18} />
      </div>
      <input
        type="text"
        value={busca}
        onChange={e => setBusca(e.target.value)}
        placeholder="Buscar por nome, e-mail ou cargo..."
        className="w-full bg-[#f0f5f4] border-transparent rounded-xl pl-11 pr-4 py-3 text-[#171d1c] placeholder:text-[#3d4945]/50 focus:outline-none focus:ring-2 focus:ring-[#006b5a]/50 transition-all font-medium"
      />
    </div>
  )
}