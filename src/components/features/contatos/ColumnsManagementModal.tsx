'use client'

import { ChevronLeft, ChevronRight, Pencil, Plus, Settings2, Trash2, X } from 'lucide-react'
import { LABEL_POR_STATUS_CONTATO, OPCOES_COR_COLUNA, getVisualColunaContato, type KanbanColunaContato } from '@/lib/contatos-kanban'
import type { StatusContato } from '@/actions/contatos'
import type { ColunaCorContato } from '@/lib/contatos-kanban'
import { ORIGENS_IMPORTACAO_CONTATOS } from '@/lib/contatos-origens-importacao'
import { defaultColumnForm, type ColumnFormState } from './kanban-utils'

type ColumnsManagementModalProps = {
  columns: KanbanColunaContato[]
  columnForm: ColumnFormState
  onColumnFormChange: (form: ColumnFormState | ((prev: ColumnFormState) => ColumnFormState)) => void
  columnSaving: boolean
  columnModalTab: 'lista' | 'form'
  onColumnModalTabChange: (tab: 'lista' | 'form') => void
  columnTotals: Record<string, number>
  onClose: () => void
  onSave: () => void
  onDelete: (column: KanbanColunaContato) => void
  onMove: (column: KanbanColunaContato, direction: 'left' | 'right') => void
  onOpenEditForm: (column: KanbanColunaContato) => void
}

export function ColumnsManagementModal({
  columns, columnForm, onColumnFormChange,
  columnSaving, columnModalTab, onColumnModalTabChange,
  columnTotals,
  onClose, onSave, onDelete, onMove, onOpenEditForm,
}: ColumnsManagementModalProps) {
  const getColumnCardCount = (chave: string) => columnTotals[chave] ?? 0

  return (
    <div
      className="fixed inset-0 z-50 bg-[#171d1c]/45 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      onClick={() => { onClose(); onColumnFormChange(defaultColumnForm()) }}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-3xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-[#dee3e3]" />
        </div>

        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-[#dee3e3] flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#f0fcf9] text-[#006b5a] flex items-center justify-center shrink-0">
            <Settings2 size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-[#083142] text-sm sm:text-base">Gerenciar colunas</h3>
            <p className="text-xs text-[#6d7a75] hidden sm:block">
              Colunas padrao tambem podem mudar de ordem. Apenas colunas customizadas podem ser editadas ou removidas quando estiverem vazias.
            </p>
          </div>
          <button
            onClick={() => { onClose(); onColumnFormChange(defaultColumnForm()) }}
            className="p-1.5 rounded-lg hover:bg-[#f0f5f4] text-[#9BB0AD] shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="sm:hidden px-4 pt-3 shrink-0">
          <div className="grid grid-cols-2 gap-1.5 bg-[#f0f5f4] p-1 rounded-xl">
            <button
              onClick={() => onColumnModalTabChange('lista')}
              className={`py-2.5 rounded-lg text-xs font-semibold transition-colors ${columnModalTab === 'lista' ? 'bg-white text-[#006b5a] shadow-sm' : 'text-[#6d7a75]'}`}
            >
              Colunas ({columns.length})
            </button>
            <button
              onClick={() => onColumnModalTabChange('form')}
              className={`py-2.5 rounded-lg text-xs font-semibold transition-colors ${columnModalTab === 'form' ? 'bg-white text-[#006b5a] shadow-sm' : 'text-[#6d7a75]'}`}
            >
              {columnForm.chave ? 'Editar coluna' : 'Nova coluna'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col sm:grid sm:grid-cols-[1.2fr_0.8fr] min-h-0">
          {/* Column list */}
          <div className={`${columnModalTab === 'lista' ? 'flex' : 'hidden'} sm:flex flex-col p-4 sm:p-5 sm:border-r border-[#dee3e3] gap-2.5 overflow-y-auto`}>
            {columns.map((column, index) => {
              const visual = getVisualColunaContato(column)
              return (
                <div key={column.chave} className="border border-[#dee3e3] rounded-xl p-3 bg-[#f9faf8]">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ backgroundColor: visual.corBg, color: visual.cor }}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-semibold text-[#1A2E2B] text-sm">{column.nome}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${column.tipo === 'sistema' ? 'bg-[#e8ecff] text-[#3730a3]' : 'bg-[#f0fcf9] text-[#006b5a]'}`}>
                          {column.tipo === 'sistema' ? 'Padrao' : 'Custom'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#9BB0AD] mt-0.5 hidden sm:block">Chave: {column.chave}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => onMove(column, 'left')}
                        className="w-8 h-8 rounded-lg bg-white border border-[#dee3e3] hover:border-[#006b5a]/40 text-[#6d7a75] flex items-center justify-center"
                        title="Mover para a esquerda"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        onClick={() => onMove(column, 'right')}
                        className="w-8 h-8 rounded-lg bg-white border border-[#dee3e3] hover:border-[#006b5a]/40 text-[#6d7a75] flex items-center justify-center"
                        title="Mover para a direita"
                      >
                        <ChevronRight size={14} />
                      </button>
                      {column.tipo === 'custom' && (
                        <>
                          <button
                            onClick={() => { onOpenEditForm(column); onColumnModalTabChange('form') }}
                            className="w-8 h-8 rounded-lg bg-white border border-[#dee3e3] hover:border-[#006b5a]/40 text-[#6d7a75] flex items-center justify-center"
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => onDelete(column)}
                            disabled={getColumnCardCount(column.chave) > 0}
                            className="w-8 h-8 rounded-lg bg-white border border-[#dee3e3] hover:border-[#ba1a1a]/40 text-[#ba1a1a] flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                            title={getColumnCardCount(column.chave) > 0 ? 'Esvazie a coluna antes de excluir' : 'Excluir'}
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            <button
              onClick={() => { onColumnFormChange(defaultColumnForm()); onColumnModalTabChange('form') }}
              className="sm:hidden w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-[#dee3e3] text-sm font-semibold text-[#6d7a75] hover:border-[#006b5a]/40 hover:text-[#006b5a] transition-colors"
            >
              <Plus size={15} />
              Nova coluna
            </button>
          </div>

          {/* Column form */}
          <div className={`${columnModalTab === 'form' ? 'flex' : 'hidden'} sm:flex flex-col p-4 sm:p-5 gap-4 overflow-y-auto`}>
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-[#1A2E2B] text-sm">
                {columnForm.chave ? 'Editar coluna' : 'Nova coluna'}
              </h4>
              {columnForm.chave && (
                <button
                  onClick={() => onColumnFormChange(defaultColumnForm())}
                  className="text-xs text-[#006b5a] hover:underline"
                >
                  Criar nova
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#6d7a75] mb-1.5">Nome</label>
              <input
                type="text"
                value={columnForm.nome}
                onChange={(e) => onColumnFormChange((prev) => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: Retorno em 3 dias"
                className="w-full border border-[#dee3e3] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#006b5a]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#6d7a75] mb-1.5">Categoria do Relatorio</label>
              <select
                value={columnForm.statusBase}
                onChange={(e) => onColumnFormChange((prev) => ({ ...prev, statusBase: e.target.value as StatusContato }))}
                className="w-full border border-[#dee3e3] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#006b5a] bg-white"
              >
                {Object.entries(LABEL_POR_STATUS_CONTATO).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <p className="text-[11px] text-[#9BB0AD] mt-1.5">
                Define em qual categoria essa coluna entra nos relatorios e indicadores.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#6d7a75] mb-1.5">Cor da coluna</label>
              <div className="grid grid-cols-2 gap-2">
                {OPCOES_COR_COLUNA.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => onColumnFormChange((prev) => ({ ...prev, corChave: option.key as ColunaCorContato }))}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                      columnForm.corChave === option.key
                        ? 'border-[#006b5a] bg-[#f0fcf9]'
                        : 'border-[#dee3e3] bg-white hover:border-[#bcc9c4]'
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: option.visual.cor }} />
                    <span className="text-[#1A2E2B]">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {!columnForm.chave && (
              <div>
                <label className="block text-xs font-semibold text-[#6d7a75] mb-1.5">Puxar pacientes por origem</label>
                <div className="grid grid-cols-2 gap-2">
                  {ORIGENS_IMPORTACAO_CONTATOS.map((origem) => {
                    const isOrigemSelected = columnForm.origensImportacao.includes(origem)
                    return (
                      <button
                        key={origem}
                        type="button"
                        onClick={() =>
                          onColumnFormChange((prev) => ({
                            ...prev,
                            origensImportacao: isOrigemSelected
                              ? prev.origensImportacao.filter((item) => item !== origem)
                              : [...prev.origensImportacao, origem],
                          }))
                        }
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                          isOrigemSelected
                            ? 'border-[#006b5a] bg-[#f0fcf9] text-[#006b5a]'
                            : 'border-[#dee3e3] bg-white hover:border-[#bcc9c4] text-[#1A2E2B]'
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] font-bold ${
                            isOrigemSelected
                              ? 'border-[#006b5a] bg-[#006b5a] text-white'
                              : 'border-[#bcc9c4] text-transparent'
                          }`}
                        >
                          ✓
                        </span>
                        <span>{origem}</span>
                      </button>
                    )
                  })}
                </div>
                <p className="text-[11px] text-[#9BB0AD] mt-1.5">
                  Ao criar a coluna, o sistema move para ela os pacientes ativos dessas origens que ainda estao nas etapas base do kanban.
                </p>
              </div>
            )}

            <button
              onClick={onSave}
              disabled={columnSaving || !columnForm.nome.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#006b5a] text-white text-sm font-semibold hover:bg-[#004f43] transition-colors disabled:opacity-40 mt-auto"
            >
              <Plus size={14} />
              {columnForm.chave ? 'Salvar alteracoes' : 'Criar coluna'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
