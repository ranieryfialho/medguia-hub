'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  paginaAtual: number
  totalPaginas: number
  total: number
  limite: number
  offset: number
}

export function PaginacaoPacientes({ paginaAtual, totalPaginas, total, limite, offset }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const irParaPagina = (p: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (p === 1) {
      params.delete('pagina')
    } else {
      params.set('pagina', String(p))
    }
    router.push(`?${params.toString()}`)
  }

  const ini = offset + 1
  const fim = Math.min(offset + limite, total)

  if (totalPaginas <= 1) {
    return (
      <div className="px-6 py-3 border-t border-border text-xs text-text-secondary">
        {total} {total === 1 ? 'paciente' : 'pacientes'}
      </div>
    )
  }

  // Calcula quais páginas mostrar (janela de 5 ao redor da página atual)
  const paginas: (number | '...')[] = []
  if (totalPaginas <= 7) {
    for (let i = 1; i <= totalPaginas; i++) paginas.push(i)
  } else {
    paginas.push(1)
    if (paginaAtual > 4) paginas.push('...')
    for (let i = Math.max(2, paginaAtual - 2); i <= Math.min(totalPaginas - 1, paginaAtual + 2); i++) {
      paginas.push(i)
    }
    if (paginaAtual < totalPaginas - 3) paginas.push('...')
    paginas.push(totalPaginas)
  }

  return (
    <div className="px-6 py-3 border-t border-border flex items-center justify-between gap-4 flex-wrap">
      <p className="text-xs text-text-secondary">
        Mostrando <span className="font-semibold">{ini}–{fim}</span> de{' '}
        <span className="font-semibold">{total}</span> pacientes
      </p>

      <div className="flex items-center gap-1">
        <button
          onClick={() => irParaPagina(paginaAtual - 1)}
          disabled={paginaAtual === 1}
          className="p-1.5 rounded hover:bg-border disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Página anterior"
        >
          <ChevronLeft size={16} />
        </button>

        {paginas.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-text-secondary text-sm">…</span>
          ) : (
            <button
              key={p}
              onClick={() => irParaPagina(p as number)}
              className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                p === paginaAtual
                  ? 'bg-[#0A4D68] text-white'
                  : 'hover:bg-border text-text-secondary'
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => irParaPagina(paginaAtual + 1)}
          disabled={paginaAtual === totalPaginas}
          className="p-1.5 rounded hover:bg-border disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Próxima página"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}