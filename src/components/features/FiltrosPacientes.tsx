'use client'

import { Search } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

const OPCOES_LIMITE = [10, 50, 100, 1000]

export function FiltrosPacientes() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const showInativos = searchParams.get('inativos') === 'true'
  const limiteAtual = searchParams.get('limite') || '50'
  const buscaAtual = searchParams.get('busca') || ''

  const [busca, setBusca] = useState(buscaAtual)

  // Debounce da busca: aguarda 400ms após o usuário parar de digitar
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (busca) {
        params.set('busca', busca)
      } else {
        params.delete('busca')
      }
      params.delete('pagina') // reset para página 1
      router.push(`?${params.toString()}`)
    }, 400)

    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca])

  const toggleInativos = (checked: boolean) => {
    const params = new URLSearchParams(searchParams.toString())
    if (checked) {
      params.set('inativos', 'true')
    } else {
      params.delete('inativos')
    }
    params.delete('pagina')
    router.push(`?${params.toString()}`)
  }

  const mudarLimite = (valor: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('limite', valor)
    params.delete('pagina')
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="p-4 flex items-center gap-4 border-b border-border flex-wrap">
      {/* Busca */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={18} />
        <input
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome, CPF ou telefone..."
          className="w-full pl-10 pr-4 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500 transition-colors"
        />
      </div>

      {/* Registros por página */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm text-text-secondary font-medium whitespace-nowrap">Mostrar:</span>
        <select
          value={limiteAtual}
          onChange={e => mudarLimite(e.target.value)}
          className="bg-input border border-border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
        >
          {OPCOES_LIMITE.map(n => (
            <option key={n} value={String(n)}>{n} por página</option>
          ))}
        </select>
      </div>

      {/* Exibir inativos */}
      <label className="flex items-center gap-2 text-sm text-text-secondary shrink-0 cursor-pointer">
        <input
          type="checkbox"
          checked={showInativos}
          onChange={e => toggleInativos(e.target.checked)}
          className="rounded border-border-input text-primary-500 focus:ring-primary-500 cursor-pointer"
        />
        Exibir inativos
      </label>
    </div>
  )
}