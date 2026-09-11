'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { salvarPreferenciaTela } from '@/actions/preferencias'

const TELA = 'confirmacoes_cards'

type Opcao = { valor: string; label: string }

type FiltrosCardsProps = {
  opcoesProfissionais: { id: string; nome: string }[]
  opcoesTipos: string[]
  opcoesPeriodo: Opcao[]
}

const OPCOES_CONTATO: Opcao[] = [
  { valor: 'pendente', label: 'Ainda não contatado' },
  { valor: 'nao_atendeu', label: 'Não atendeu' },
]

export function FiltrosCards({ opcoesProfissionais, opcoesTipos, opcoesPeriodo }: FiltrosCardsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const buscaAtual = searchParams.get('busca') || ''
  const profissionalAtual = searchParams.get('profissional') || ''
  const tipoAtual = searchParams.get('tipo') || ''
  const contatoAtual = searchParams.get('contato') || ''
  const periodoAtual = searchParams.get('periodo') || ''

  const [busca, setBusca] = useState(buscaAtual)
  const montado = useRef(false)

  function atualizar(overrides: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(overrides)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    router.replace(`${pathname}?${params.toString()}`)
    void salvarPreferenciaTela(TELA, Object.fromEntries(params.entries())).catch(() => {})
  }

  useEffect(() => {
    if (!montado.current) {
      montado.current = true
      return
    }
    const timer = setTimeout(() => atualizar({ busca }), 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca])

  function limparFiltros() {
    setBusca('')
    router.replace(pathname)
    void salvarPreferenciaTela(TELA, {}).catch(() => {})
  }

  const temFiltros = !!(buscaAtual || profissionalAtual || tipoAtual || contatoAtual || periodoAtual)

  return (
    <div className="bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100 flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[180px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar paciente..."
          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#006b5a]"
        />
      </div>

      {opcoesProfissionais.length > 0 && (
        <select
          value={profissionalAtual}
          onChange={(e) => atualizar({ profissional: e.target.value })}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#006b5a]"
        >
          <option value="">Todos os profissionais</option>
          {opcoesProfissionais.map((p) => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </select>
      )}

      {opcoesTipos.length > 0 && (
        <select
          value={tipoAtual}
          onChange={(e) => atualizar({ tipo: e.target.value })}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#006b5a]"
        >
          <option value="">Todos os tipos</option>
          {opcoesTipos.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      )}

      <select
        value={contatoAtual}
        onChange={(e) => atualizar({ contato: e.target.value })}
        className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#006b5a]"
      >
        <option value="">Todos os status</option>
        {OPCOES_CONTATO.map((o) => (
          <option key={o.valor} value={o.valor}>{o.label}</option>
        ))}
      </select>

      {opcoesPeriodo.length > 1 && (
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1">
          <button
            type="button"
            onClick={() => atualizar({ periodo: '' })}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              !periodoAtual ? 'bg-[#006b5a] text-white' : 'text-slate-500 hover:text-[#006b5a]'
            }`}
          >
            Todos
          </button>
          {opcoesPeriodo.map((p) => (
            <button
              key={p.valor}
              type="button"
              onClick={() => atualizar({ periodo: p.valor })}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                periodoAtual === p.valor ? 'bg-[#006b5a] text-white' : 'text-slate-500 hover:text-[#006b5a]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {temFiltros && (
        <button
          type="button"
          onClick={limparFiltros}
          className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <X size={14} />
          Limpar
        </button>
      )}
    </div>
  )
}
