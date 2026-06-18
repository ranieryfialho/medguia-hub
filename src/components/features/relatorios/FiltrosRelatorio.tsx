'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatAppDateKey } from '@/lib/datetime'
import { Search, Loader2 } from 'lucide-react'

type FiltrosRelatorioProps = {
  profissionais: { id: string; nome: string }[]
  isGestor: boolean
  paramsAtuais: Record<string, string | string[] | undefined>
}

const PERIODOS = [
  { valor: 'esta-semana', label: 'Esta semana' },
  { valor: 'este-mes',    label: 'Este mês' },
  { valor: 'mes-passado', label: 'Mês passado' },
  { valor: 'personalizado', label: 'Personalizado' },
]

const INPUT = 'px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#006b5a]/30 focus:border-[#006b5a] transition-colors'

export function FiltrosRelatorio({ profissionais, isGestor, paramsAtuais }: FiltrosRelatorioProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const hoje = formatAppDateKey(new Date())

  const [periodo,      setPeriodo]      = useState(typeof paramsAtuais.periodo      === 'string' ? paramsAtuais.periodo      : 'este-mes')
  const [profissional, setProfissional] = useState(typeof paramsAtuais.profissional === 'string' ? paramsAtuais.profissional : 'todos')
  const [de,           setDe]           = useState(typeof paramsAtuais.de           === 'string' ? paramsAtuais.de           : hoje)
  const [ate,          setAte]          = useState(typeof paramsAtuais.ate          === 'string' ? paramsAtuais.ate          : hoje)

  function navegar(opts: { periodo?: string; profissional?: string; de?: string; ate?: string }) {
    const p   = opts.periodo      ?? periodo
    const prf = opts.profissional ?? profissional
    const d   = opts.de           ?? de
    const a   = opts.ate          ?? ate

    const params = new URLSearchParams()
    params.set('periodo', p)
    if (p === 'personalizado') {
      params.set('de', d)
      params.set('ate', a)
    }
    if (isGestor) params.set('profissional', prf)

    startTransition(() => {
      router.push(`/relatorios/tempo-fabril?${params.toString()}`)
    })
  }

  function handlePeriodo(valor: string) {
    setPeriodo(valor)
    if (valor !== 'personalizado') navegar({ periodo: valor })
  }

  function handleProfissional(valor: string) {
    setProfissional(valor)
    navegar({ profissional: valor })
  }

  function handleAplicar() {
    navegar({ periodo: 'personalizado', de, ate })
  }

  return (
    <div className={`bg-white rounded-xl border shadow-sm p-4 print:hidden space-y-4 transition-opacity ${isPending ? 'opacity-60 pointer-events-none border-[#006b5a]/40' : 'border-slate-100'}`}>

      {/* Linha 1: período + profissional + spinner */}
      <div className="flex flex-wrap items-center gap-3">

        {/* Chips de período */}
        <div className="flex flex-wrap gap-1.5">
          {PERIODOS.map(p => (
            <button
              key={p.valor}
              onClick={() => handlePeriodo(p.valor)}
              disabled={isPending}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                periodo === p.valor
                  ? 'bg-[#006b5a] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Separador visual */}
        {isGestor && <div className="hidden sm:block h-6 w-px bg-slate-200" />}

        {/* Profissional */}
        {isGestor && (
          <select
            value={profissional}
            onChange={e => handleProfissional(e.target.value)}
            disabled={isPending}
            className={`${INPUT} disabled:cursor-not-allowed`}
          >
            <option value="todos">Todos os profissionais</option>
            {profissionais.map(p => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        )}

        {/* Spinner de carregamento */}
        {isPending && (
          <div className="flex items-center gap-1.5 text-[#006b5a] text-xs font-medium ml-auto">
            <Loader2 size={14} className="animate-spin" />
            Carregando...
          </div>
        )}
      </div>

      {/* Linha 2: datas personalizadas — só aparece quando selecionado */}
      {periodo === 'personalizado' && (
        <div className="flex flex-wrap items-end gap-3 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">De</label>
            <input
              type="date"
              value={de}
              max={ate}
              onChange={e => setDe(e.target.value)}
              className={INPUT}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Até</label>
            <input
              type="date"
              value={ate}
              min={de}
              onChange={e => setAte(e.target.value)}
              className={INPUT}
            />
          </div>
          <button
            onClick={handleAplicar}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 bg-[#006b5a] hover:bg-[#005548] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Aplicar
          </button>
        </div>
      )}
    </div>
  )
}
