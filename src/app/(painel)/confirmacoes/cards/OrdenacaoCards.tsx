'use client'

import { useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ArrowDownAZ, ArrowUpDown, Clock } from 'lucide-react'

export type OrdemCards = 'data_asc' | 'data_desc' | 'nome_asc'

const STORAGE_KEY = 'confirmacoes_cards_ordem'

const OPCOES: { valor: OrdemCards; label: string; Icon: React.ElementType }[] = [
  { valor: 'data_asc', label: 'Horário ↑', Icon: Clock },
  { valor: 'data_desc', label: 'Horário ↓', Icon: ArrowUpDown },
  { valor: 'nome_asc', label: 'A → Z', Icon: ArrowDownAZ },
]

export function OrdenacaoCards({ ordemAtual }: { ordemAtual: OrdemCards }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Na primeira visita sem param, aplica a preferência salva
  useEffect(() => {
    if (searchParams.get('ordem')) return
    try {
      const salva = localStorage.getItem(STORAGE_KEY) as OrdemCards | null
      if (salva && salva !== 'data_asc') {
        const params = new URLSearchParams(searchParams.toString())
        params.set('ordem', salva)
        router.replace(`${pathname}?${params.toString()}`)
      }
    } catch {}
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  function mudarOrdem(valor: OrdemCards) {
    try {
      localStorage.setItem(STORAGE_KEY, valor)
    } catch {}
    const params = new URLSearchParams(searchParams.toString())
    params.set('ordem', valor)
    router.replace(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
      {OPCOES.map(({ valor, label, Icon }) => (
        <button
          key={valor}
          onClick={() => mudarOrdem(valor)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            ordemAtual === valor
              ? 'bg-[#006b5a] text-white shadow-sm'
              : 'text-slate-500 hover:text-[#006b5a] hover:bg-[#006b5a]/5'
          }`}
        >
          <Icon size={12} />
          {label}
        </button>
      ))}
    </div>
  )
}
