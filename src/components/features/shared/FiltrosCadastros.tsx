'use client'

import Link from 'next/link'
import { useState } from 'react'

type TipoFiltro = '12meses' | 'mes' | 'semana' | 'personalizado'

type Props = {
  tipo: TipoFiltro
  mes: string
  semana: string
  inicio: string
  fim: string
}

export function FiltrosCadastros({ tipo: tipoInicial, mes, semana, inicio, fim }: Props) {
  const [tipo, setTipo] = useState<TipoFiltro>(tipoInicial)
  const isFiltered = tipoInicial !== '12meses'

  return (
    <form method="get" className="bg-surface rounded-lg border border-border p-4">
      <h2 className="text-sm font-semibold text-text-primary mb-3">Filtros</h2>
      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <label className="block text-xs text-text-secondary uppercase mb-1">Período</label>
          <select
            name="tipo"
            value={tipo}
            onChange={e => setTipo(e.target.value as TipoFiltro)}
            className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
          >
            <option value="12meses">Últimos 12 meses</option>
            <option value="mes">Mês específico</option>
            <option value="semana">Semana específica</option>
            <option value="personalizado">Período personalizado</option>
          </select>
        </div>

        {tipo === 'mes' && (
          <div>
            <label className="block text-xs text-text-secondary uppercase mb-1">Mês</label>
            <input
              type="month"
              name="mes"
              defaultValue={mes}
              className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
            />
          </div>
        )}

        {tipo === 'semana' && (
          <div>
            <label className="block text-xs text-text-secondary uppercase mb-1">Qualquer dia da semana</label>
            <input
              type="date"
              name="semana"
              defaultValue={semana}
              className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
            />
          </div>
        )}

        {tipo === 'personalizado' && (
          <>
            <div>
              <label className="block text-xs text-text-secondary uppercase mb-1">De</label>
              <input
                type="date"
                name="inicio"
                defaultValue={inicio}
                className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary uppercase mb-1">Até</label>
              <input
                type="date"
                name="fim"
                defaultValue={fim}
                className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
          </>
        )}

        <button
          type="submit"
          className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-md text-sm font-medium transition-colors"
        >
          Filtrar
        </button>
        {isFiltered && (
          <Link
            href="/pacientes/relatorio-cadastros"
            className="px-4 py-2 bg-page hover:bg-page/80 border border-border text-text-secondary rounded-md text-sm transition-colors"
          >
            Limpar
          </Link>
        )}
      </div>
    </form>
  )
}
