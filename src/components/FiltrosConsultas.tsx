'use client'

import Link from 'next/link'
import { SelectCheckbox } from './SelectCheckbox'

type FiltrosConsultasProps = {
  dataInicio: string
  dataFim: string
  dataInicioPadrao: string
  dataFimPadrao: string
  profissionalId: string
  tiposFiltro: string[]
  statusFiltro: string
  profissionais: Array<{ id: string; nome: string }>
  opcoesTipos: string[]
  opcoesStatus: string[]
  isGestorOuMaster: boolean
}

export function FiltrosConsultas({
  dataInicio,
  dataFim,
  dataInicioPadrao,
  dataFimPadrao,
  profissionalId,
  tiposFiltro,
  statusFiltro,
  profissionais,
  opcoesTipos,
  opcoesStatus,
  isGestorOuMaster,
}: FiltrosConsultasProps) {
  return (
    <form method="get" className="bg-surface rounded-lg border border-border p-4">
      <h2 className="text-sm font-semibold text-text-primary mb-3">Filtros</h2>
      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <label className="block text-xs text-text-secondary uppercase mb-1">Data Início</label>
          <input
            type="date"
            name="data_inicio"
            defaultValue={dataInicio}
            className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary uppercase mb-1">Data Fim</label>
          <input
            type="date"
            name="data_fim"
            defaultValue={dataFim}
            className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
          />
        </div>
        {isGestorOuMaster && (
          <div>
            <label className="block text-xs text-text-secondary uppercase mb-1">Fisioterapeuta</label>
            <select
              name="profissional_id"
              defaultValue={profissionalId}
              className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
            >
              <option value="">Todos</option>
              {profissionais.map((profissional) => (
                <option key={profissional.id} value={profissional.id}>{profissional.nome}</option>
              ))}
            </select>
          </div>
        )}
        <div className="w-48">
          <SelectCheckbox
            name="tipo"
            label="Tipo"
            options={opcoesTipos}
            selectedValues={tiposFiltro}
          />
        </div>
        <div>
          <label className="block text-xs text-text-secondary uppercase mb-1">Status do Atendimento</label>
          <select
            name="status"
            defaultValue={statusFiltro}
            className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
          >
            <option value="">Todos</option>
            {opcoesStatus.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-md text-sm font-medium transition-colors"
        >
          Filtrar
        </button>
        {(dataInicio !== dataInicioPadrao || dataFim !== dataFimPadrao || profissionalId || tiposFiltro.length > 0 || statusFiltro) && (
          <Link
            href="/pacientes/relatorio-consultas"
            className="px-4 py-2 bg-page hover:bg-page/80 border border-border text-text-secondary rounded-md text-sm transition-colors"
          >
            Limpar
          </Link>
        )}
      </div>
    </form>
  )
}
