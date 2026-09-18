'use client'

import Link from 'next/link'
import { useState } from 'react'
import { SelectCheckbox } from './SelectCheckbox'

type TipoFiltro = '12meses' | 'mes' | 'semana' | 'personalizado'
type CategoriaProfissional = 'fisioterapia' | 'medicos'

type ProfissionalOpcao = { id: string; nome: string }

type Props = {
  tipo: TipoFiltro
  mes: string
  semana: string
  inicio: string
  fim: string
  origens?: string[]
  selectedOrigems?: string[]
  action?: string
  limparHref?: string
  tipoLabels?: Partial<Record<TipoFiltro, string>>
  /** Mostra o filtro de categoria (Fisioterapeuta/Médico) + profissional — só faz sentido para gestor/master. */
  categoriaAtual?: CategoriaProfissional
  profissionalIdAtual?: string
  fisioterapeutas?: ProfissionalOpcao[]
  medicos?: ProfissionalOpcao[]
}

export function FiltrosCadastros({
  tipo: tipoInicial,
  mes,
  semana,
  inicio,
  fim,
  origens = [],
  selectedOrigems = [],
  action,
  limparHref = '/pacientes/relatorio-cadastros',
  tipoLabels = {},
  categoriaAtual,
  profissionalIdAtual = '',
  fisioterapeutas,
  medicos,
}: Props) {
  const [tipo, setTipo] = useState<TipoFiltro>(tipoInicial)
  const [categoria, setCategoria] = useState<CategoriaProfissional>(categoriaAtual ?? 'fisioterapia')
  const mostrarFiltroProfissional = fisioterapeutas !== undefined && medicos !== undefined
  const opcoesProfissionais = categoria === 'medicos' ? medicos ?? [] : fisioterapeutas ?? []
  const isFiltered = tipoInicial !== '12meses' || selectedOrigems.length > 0 || !!profissionalIdAtual

  return (
    <form method="get" action={action} className="bg-surface rounded-lg border border-border p-4">
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
            <option value="12meses">{tipoLabels['12meses'] ?? 'Últimos 12 meses'}</option>
            <option value="mes">{tipoLabels.mes ?? 'Mês específico'}</option>
            <option value="semana">{tipoLabels.semana ?? 'Semana específica'}</option>
            <option value="personalizado">{tipoLabels.personalizado ?? 'Período personalizado'}</option>
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

        {mostrarFiltroProfissional && (
          <>
            <div>
              <label className="block text-xs text-text-secondary uppercase mb-1">Categoria</label>
              <select
                name="categoria"
                value={categoria}
                onChange={e => setCategoria(e.target.value as CategoriaProfissional)}
                className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
              >
                <option value="fisioterapia">Fisioterapeuta</option>
                <option value="medicos">Médico</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-secondary uppercase mb-1">Profissional</label>
              <select
                name="profissional_id"
                key={categoria}
                defaultValue={categoria === categoriaAtual ? profissionalIdAtual : ''}
                className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500 min-w-[180px]"
              >
                <option value="">Todos</option>
                {opcoesProfissionais.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {origens.length > 0 && (
          <div className="min-w-[220px]">
            <SelectCheckbox
              name="detalhe_origem"
              label="Filtrar por origem"
              options={origens}
              selectedValues={selectedOrigems}
            />
          </div>
        )}

        <button
          type="submit"
          className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-md text-sm font-medium transition-colors"
        >
          Filtrar
        </button>
        {isFiltered && (
          <Link
            href={limparHref}
            className="px-4 py-2 bg-page hover:bg-page/80 border border-border text-text-secondary rounded-md text-sm transition-colors"
          >
            Limpar
          </Link>
        )}
      </div>
    </form>
  )
}
