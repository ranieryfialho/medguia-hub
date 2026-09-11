'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ArrowDownAZ, ArrowUpDown, Clock } from 'lucide-react'
import { salvarPreferenciaTela } from '@/actions/preferencias'

export type OrdemCards = 'data_asc' | 'data_desc' | 'nome_asc'

const TELA = 'confirmacoes_cards'

const OPCOES: { valor: OrdemCards; label: string; Icon: React.ElementType; title: string }[] = [
  { valor: 'data_asc',  label: 'Horário ↑', title: 'Ordenar por horário crescente', Icon: Clock },
  { valor: 'data_desc', label: 'Horário ↓', title: 'Ordenar por horário decrescente', Icon: ArrowUpDown },
  { valor: 'nome_asc',  label: 'A → Z',     title: 'Ordenar por nome', Icon: ArrowDownAZ },
]

export function OrdenacaoCards({ ordemAtual }: { ordemAtual: OrdemCards }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function mudarOrdem(valor: OrdemCards) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('ordem', valor)
    router.replace(`${pathname}?${params.toString()}`)
    void salvarPreferenciaTela(TELA, Object.fromEntries(params.entries())).catch(() => {})
  }

  return (
    <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
      {OPCOES.map(({ valor, label, title, Icon }) => (
        <button
          key={valor}
          onClick={() => mudarOrdem(valor)}
          title={title}
          className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            ordemAtual === valor
              ? 'bg-[#006b5a] text-white shadow-sm'
              : 'text-slate-500 hover:text-[#006b5a] hover:bg-[#006b5a]/5'
          }`}
        >
          <Icon size={13} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  )
}
