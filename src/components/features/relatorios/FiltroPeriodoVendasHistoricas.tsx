'use client'

import { useState } from 'react'

interface Props {
  defaultPeriodo: string
  defaultDataInicio: string
  defaultDataFim: string
}

export function FiltroPeriodoVendasHistoricas({ defaultPeriodo, defaultDataInicio, defaultDataFim }: Props) {
  const [periodo, setPeriodo] = useState(defaultPeriodo)

  return (
    <>
      <div>
        <label className="block text-xs text-text-secondary uppercase mb-1">Período</label>
        <select
          name="periodo"
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
        >
          <option value="6m">Últimos 6 meses</option>
          <option value="12m">Últimos 12 meses</option>
          <option value="24m">Últimos 24 meses</option>
          <option value="ytd">Ano vigente (YTD)</option>
          <option value="personalizado">Personalizado</option>
        </select>
      </div>
      {periodo === 'personalizado' && (
        <>
          <div>
            <label className="block text-xs text-text-secondary uppercase mb-1">Data Início</label>
            <input
              type="date"
              name="data_inicio"
              defaultValue={defaultDataInicio}
              className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary uppercase mb-1">Data Fim</label>
            <input
              type="date"
              name="data_fim"
              defaultValue={defaultDataFim}
              className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
            />
          </div>
        </>
      )}
    </>
  )
}
