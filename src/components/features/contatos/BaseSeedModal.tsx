'use client'

import { Plus, Search, X } from 'lucide-react'
import { getVisualColunaContato, type KanbanColunaContato } from '@/lib/contatos-kanban'
import type { BaseSeedModalState } from './kanban-utils'

type BaseSeedModalProps = {
  state: BaseSeedModalState
  search: string
  onSearchChange: (v: string) => void
  availableBaseTotals: Record<string, number>
  baseSeedColumns: KanbanColunaContato[]
  activeBaseSeedColumn: KanbanColunaContato | null
  onClose: () => void
  onConfirm: () => void
  onToggleSelection: (id: string) => void
  onToggleAll: () => void
  onLoadPreview: (columnKey: string, search: string) => void
}

export function BaseSeedModal({
  state, search, onSearchChange,
  availableBaseTotals, baseSeedColumns, activeBaseSeedColumn,
  onClose, onConfirm, onToggleSelection, onToggleAll, onLoadPreview,
}: BaseSeedModalProps) {
  if (!state.open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-[#171d1c]/45 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-[#dee3e3]" />
        </div>

        <div className="px-4 sm:px-5 py-4 border-b border-[#dee3e3] flex items-start gap-3 shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-[#f0fcf9] text-[#006b5a] flex items-center justify-center shrink-0">
            <Plus size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-[#083142] text-base sm:text-lg">Adicionar cards da base</h3>
            <p className="text-xs sm:text-sm text-[#6d7a75] mt-1">
              Revise a lista antes de confirmar. Serao adicionados apenas pacientes que ainda nao possuem card no kanban.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#f0f5f4] text-[#9BB0AD] shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="px-4 sm:px-5 py-4 border-b border-[#dee3e3] shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {baseSeedColumns.map((column) => {
              const visual = getVisualColunaContato(column)
              const isActive = column.chave === state.columnKey
              const availableCount = availableBaseTotals[column.chave] ?? 0

              return (
                <button
                  key={column.chave}
                  onClick={() => onLoadPreview(column.chave, search)}
                  className={`rounded-2xl border px-4 py-3 text-left transition-colors ${isActive ? 'shadow-sm' : 'hover:border-[#bcc9c4]'}`}
                  style={{
                    borderColor: isActive ? visual.cor : '#dee3e3',
                    backgroundColor: isActive ? visual.corBg : '#ffffff',
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm" style={{ color: visual.cor }}>{column.nome}</p>
                      <p className="text-xs text-[#6d7a75] mt-1">{availableCount} disponiveis para virar card</p>
                    </div>
                    <span
                      className="text-xs font-extrabold px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: visual.corBadgeBg, color: visual.corBadgeText }}
                    >
                      {availableCount}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-3 bg-[#f8faf9]">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BB0AD] pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar paciente por nome..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              disabled={state.confirming}
              className="w-full pl-9 pr-3 py-2 border border-[#dee3e3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#006b5a]/20 focus:border-[#006b5a] bg-white transition-all disabled:opacity-50"
            />
            {search && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-[#9BB0AD] hover:text-[#6d7a75]"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#1A2E2B]">{activeBaseSeedColumn?.nome ?? 'Base selecionada'}</p>
              <p className="text-xs text-[#6d7a75] mt-1">
                {state.loading
                  ? 'Buscando pacientes...'
                  : `${state.preview.length} encontrado${state.preview.length === 1 ? '' : 's'} — ${state.selectedIds.size} selecionado${state.selectedIds.size === 1 ? '' : 's'}`}
              </p>
            </div>
            {!state.loading && (
              <div className="flex items-center gap-3">
                {state.preview.length > 0 && (
                  <button
                    onClick={onToggleAll}
                    disabled={state.confirming}
                    className="text-xs font-semibold text-[#006b5a] hover:underline disabled:opacity-40"
                  >
                    {state.preview.every((p) => state.selectedIds.has(p.id)) ? 'Desmarcar todos' : 'Selecionar todos'}
                  </button>
                )}
                <button
                  onClick={() => onLoadPreview(state.columnKey, search)}
                  className="text-xs font-semibold text-[#9BB0AD] hover:underline"
                >
                  Atualizar lista
                </button>
              </div>
            )}
          </div>

          {state.loading ? (
            <div className="rounded-2xl border border-[#dee3e3] bg-white px-4 py-8 text-sm text-[#6d7a75] text-center">
              Carregando pacientes disponiveis...
            </div>
          ) : state.preview.length === 0 ? (
            <div className="rounded-2xl border border-[#dee3e3] bg-white px-4 py-8 text-sm text-[#6d7a75] text-center">
              {search.trim()
                ? `Nenhum paciente encontrado para "${search.trim()}".`
                : 'Nenhum paciente disponivel nesta base no momento.'}
            </div>
          ) : (
            <div className="rounded-2xl border border-[#dee3e3] bg-white overflow-hidden">
              <div className="max-h-[45vh] overflow-y-auto divide-y divide-[#eef2f1]">
                {state.preview.map((paciente) => {
                  const isSelected = state.selectedIds.has(paciente.id)
                  return (
                    <button
                      key={paciente.id}
                      type="button"
                      disabled={state.confirming}
                      onClick={() => onToggleSelection(paciente.id)}
                      className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors disabled:cursor-not-allowed ${
                        isSelected ? 'bg-[#f0f9f7]' : 'hover:bg-[#fafcfc]'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? 'bg-[#006b5a] border-[#006b5a]' : 'border-[#dee3e3] bg-white'
                        }`}
                      >
                        {isSelected && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold ${isSelected ? 'text-[#1A2E2B]' : 'text-[#4a5a55]'}`}>{paciente.nome}</p>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[#6d7a75]">
                          <span>{paciente.telefone || 'Sem telefone'}</span>
                          <span>{paciente.email || 'Sem email'}</span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 sm:px-5 py-4 border-t border-[#dee3e3] flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 shrink-0 bg-white">
          <p className="text-xs text-[#9BB0AD]">
            {state.selectedIds.size > 0
              ? `${state.selectedIds.size} de ${state.preview.length} paciente${state.preview.length === 1 ? '' : 's'} selecionado${state.selectedIds.size === 1 ? '' : 's'}.`
              : 'Selecione ao menos um paciente para continuar.'}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={state.confirming}
              className="px-4 py-2.5 rounded-xl border border-[#dee3e3] text-sm font-semibold text-[#6d7a75] hover:bg-[#f8faf9] transition-colors disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={state.loading || state.confirming || state.selectedIds.size === 0}
              className="px-4 py-2.5 rounded-xl bg-[#006b5a] text-white text-sm font-semibold hover:bg-[#004f43] transition-colors disabled:opacity-40"
            >
              {state.confirming
                ? 'Adicionando...'
                : `Adicionar ${state.selectedIds.size} card${state.selectedIds.size === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
