'use client'

import { useState } from 'react'

type Props = {
  mesSelecionado: number
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function FiltroAniversariantes({ mesSelecionado }: Props) {
  const [mes, setMes] = useState(String(mesSelecionado))

  return (
    <form method="get" className="bg-surface rounded-lg border border-border p-4">
      <h2 className="text-sm font-semibold text-text-primary mb-3">Filtros</h2>
      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <label htmlFor="filtro-mes" className="block text-xs text-text-secondary uppercase mb-1">Mês</label>
          <select
            id="filtro-mes"
            name="mes"
            value={mes}
            onChange={e => setMes(e.target.value)}
            className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
          >
            {MESES.map((nome, i) => (
              <option key={i + 1} value={String(i + 1)}>
                {nome}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-md text-sm font-medium transition-colors"
        >
          Filtrar
        </button>
      </div>
    </form>
  )
}