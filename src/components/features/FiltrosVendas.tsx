'use client'

import { Search, X } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

const OPCOES_LIMITE = [10, 25, 50]
const OPCOES_ORIGEM = [
  { value: 'medico', label: 'Médico' },
  { value: 'leads', label: 'Leads' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'renovacao', label: 'Renovação' },
  { value: 'campanha', label: 'Campanha' },
]

export function FiltrosVendas() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const buscaAtual = searchParams.get('busca') || ''
  const origemAtual = searchParams.get('origem') || ''
  const dataInicioAtual = searchParams.get('data_inicio') || ''
  const dataFimAtual = searchParams.get('data_fim') || ''
  const limiteAtual = searchParams.get('limite') || '25'

  const [busca, setBusca] = useState(buscaAtual)
  const montado = useRef(false)

  // Debounce da busca — só dispara após o usuário digitar (não na montagem)
  useEffect(() => {
    if (!montado.current) {
      montado.current = true
      return
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (busca) {
        params.set('busca', busca)
      } else {
        params.delete('busca')
      }
      params.delete('pagina')
      router.replace(`?${params.toString()}`)
    }, 400)

    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca])

  const mudarOrigem = (valor: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (valor) {
      params.set('origem', valor)
    } else {
      params.delete('origem')
    }
    params.delete('pagina')
    router.replace(`?${params.toString()}`)
  }

  const mudarPeriodo = (inicio: string, fim: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (inicio) {
      params.set('data_inicio', inicio)
    } else {
      params.delete('data_inicio')
    }
    if (fim) {
      params.set('data_fim', fim)
    } else {
      params.delete('data_fim')
    }
    params.delete('pagina')
    router.replace(`?${params.toString()}`)
  }

  const mudarLimite = (valor: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('limite', valor)
    params.delete('pagina')
    router.replace(`?${params.toString()}`)
  }

  const limparFiltros = () => {
    setBusca('')
    router.replace('?')
  }

  const temFiltros = busca || origemAtual || dataInicioAtual || dataFimAtual

  return (
    <div className="p-4 space-y-3 border-b border-border">
      {/* Row 1: Busca e Limite */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={18} />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por paciente ou profissional..."
            className="w-full pl-10 pr-4 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-text-secondary font-medium whitespace-nowrap">Mostrar:</span>
          <select
            value={limiteAtual}
            onChange={(e) => mudarLimite(e.target.value)}
            className="bg-input border border-border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
          >
            {OPCOES_LIMITE.map((n) => (
              <option key={n} value={String(n)}>
                {n} por página
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: Origem e Período */}
      <div className="flex items-center gap-4 flex-wrap">
        <select
          value={origemAtual}
          onChange={(e) => mudarOrigem(e.target.value)}
          className="bg-input border border-border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
        >
          <option value="">Todas as origens</option>
          {OPCOES_ORIGEM.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={dataInicioAtual}
          onChange={(e) => mudarPeriodo(e.target.value, dataFimAtual)}
          className="bg-input border border-border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
        />

        <span className="text-text-secondary text-sm">até</span>

        <input
          type="date"
          value={dataFimAtual}
          onChange={(e) => mudarPeriodo(dataInicioAtual, e.target.value)}
          className="bg-input border border-border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
        />

        {temFiltros && (
          <button
            onClick={limparFiltros}
            className="flex items-center gap-1 px-3 py-2 text-sm rounded-md bg-page text-text-secondary hover:bg-page/80 transition-colors"
          >
            <X size={16} />
            Limpar
          </button>
        )}
      </div>
    </div>
  )
}
