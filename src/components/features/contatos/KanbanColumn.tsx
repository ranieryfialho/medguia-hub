'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react'
import { LABEL_POR_STATUS_CONTATO, getVisualColunaContato, type KanbanColunaContato } from '@/lib/contatos-kanban'
import type { ContatoPaciente } from '@/lib/contatos-kanban-data'
import { KanbanCard } from './KanbanCard'

type KanbanColumnProps = {
  column: KanbanColunaContato
  colIdx: number
  columnsLength: number
  cards: ContatoPaciente[]
  totalCards: number
  loadingBoard: boolean
  loadingColumn: boolean
  canManageColumns: boolean
  onMoveColumn: (column: KanbanColunaContato, direction: 'left' | 'right') => void
  onEditColumn: (column: KanbanColunaContato) => void
  onDeleteColumn: (column: KanbanColunaContato) => void
  onLoadMore: (columnKey: string) => void
  onSelectContato: (contato: ContatoPaciente) => void
  onMoveLeft: (id: string, columnKey: string) => void
  onMoveRight: (id: string, columnKey: string) => void
  getColumnCardCount: (chave: string) => number
  isDesktop: boolean
  onDropContato: (id: string) => void
}

export function KanbanColumn({
  column, colIdx, columnsLength,
  cards, totalCards,
  loadingBoard, loadingColumn,
  canManageColumns,
  onMoveColumn, onEditColumn, onDeleteColumn,
  onLoadMore, onSelectContato, onMoveLeft, onMoveRight,
  getColumnCardCount,
  isDesktop, onDropContato,
}: KanbanColumnProps) {
  const hiddenCount = Math.max(0, totalCards - cards.length)
  const visual = getVisualColunaContato(column)
  const [isDragOver, setIsDragOver] = useState(false)

  return (
    <div
      id={`col-${column.chave}`}
      className="group/col w-[85vw] sm:w-[360px] lg:w-[320px] flex-none snap-center lg:snap-align-none flex flex-col h-full max-h-full"
    >
      <div
        className="flex items-center gap-2 px-4 py-3 rounded-t-2xl border border-b-0 shadow-sm z-10"
        style={{ borderColor: visual.cor + '30', backgroundColor: visual.corBg }}
      >
        <span className="w-2.5 h-2.5 rounded-full flex-none shadow-sm" style={{ backgroundColor: visual.cor }} />
        <span className="font-bold text-sm lg:text-base flex-1" style={{ color: visual.cor }}>
          {column.nome}
        </span>
        {column.tipo === 'custom' && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/70 text-[#3d4945] font-semibold hidden sm:inline-block">
            {LABEL_POR_STATUS_CONTATO[column.status_base]}
          </span>
        )}
        <span
          className="text-xs font-extrabold px-2.5 py-0.5 rounded-full shadow-sm"
          style={{ backgroundColor: visual.corBadgeBg, color: visual.corBadgeText }}
        >
          {totalCards}
        </span>
      </div>

      <div
        className={`border border-t-0 rounded-b-2xl p-2.5 sm:p-3 space-y-3 overflow-y-auto flex-1 flex flex-col hide-scrollbar transition-colors ${
          isDragOver ? 'ring-2 ring-inset' : ''
        }`}
        style={{
          borderColor: visual.cor + '30',
          backgroundColor: isDragOver ? visual.cor + '22' : visual.corBg + 'AA',
          ...(isDragOver ? { ['--tw-ring-color' as string]: visual.cor } : {}),
        }}
        onDragOver={(e) => {
          if (!isDesktop) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          if (!isDragOver) setIsDragOver(true)
        }}
        onDragLeave={(e) => {
          if (!isDesktop) return
          if (e.currentTarget.contains(e.relatedTarget as Node)) return
          setIsDragOver(false)
        }}
        onDrop={(e) => {
          if (!isDesktop) return
          e.preventDefault()
          setIsDragOver(false)
          const id = e.dataTransfer.getData('text/plain')
          if (id) onDropContato(id)
        }}
      >
        {canManageColumns && (
          <div className="flex items-center justify-end gap-1.5 pb-2 lg:opacity-0 lg:group-hover/col:opacity-100 transition-opacity duration-150">
            <div className="flex items-center rounded-full border border-[#e2e8e6] bg-white shadow-sm overflow-hidden">
              <button
                onClick={() => onMoveColumn(column, 'left')}
                className="w-6 h-6 flex items-center justify-center text-[#b0bfbb] hover:bg-[#f0f5f4] hover:text-[#006b5a] transition-colors"
                title="Mover coluna para a esquerda"
              >
                <ChevronLeft size={11} />
              </button>
              <div className="w-px h-3 bg-[#e2e8e6]" />
              <button
                onClick={() => onMoveColumn(column, 'right')}
                className="w-6 h-6 flex items-center justify-center text-[#b0bfbb] hover:bg-[#f0f5f4] hover:text-[#006b5a] transition-colors"
                title="Mover coluna para a direita"
              >
                <ChevronRight size={11} />
              </button>
            </div>
            {column.tipo === 'custom' && (
              <>
                <button
                  onClick={() => onEditColumn(column)}
                  className="w-6 h-6 rounded-full border border-[#e2e8e6] bg-white shadow-sm text-[#b0bfbb] hover:bg-[#f0f5f4] hover:text-[#406375] hover:border-[#c3d0cd] transition-all flex items-center justify-center"
                  title="Editar coluna"
                >
                  <Pencil size={11} />
                </button>
                <button
                  onClick={() => onDeleteColumn(column)}
                  disabled={getColumnCardCount(column.chave) > 0}
                  className="w-6 h-6 rounded-full border border-[#e2e8e6] bg-white shadow-sm text-[#b0bfbb] hover:bg-red-50 hover:text-[#ba1a1a] hover:border-red-200 transition-all flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                  title={getColumnCardCount(column.chave) > 0 ? 'Esvazie a coluna antes de excluir' : 'Excluir coluna'}
                >
                  <Trash2 size={11} />
                </button>
              </>
            )}
          </div>
        )}

        {cards.length === 0 ? (
          <div className="flex items-center justify-center h-16 text-xs text-[#9BB0AD]">
            {loadingBoard ? 'Carregando...' : 'Vazio'}
          </div>
        ) : (
          cards.map((contato) => (
            <KanbanCard
              key={contato.id}
              contato={contato}
              colIdx={colIdx}
              columnsLength={columnsLength}
              onSelect={onSelectContato}
              onMoveLeft={onMoveLeft}
              onMoveRight={onMoveRight}
              draggable={isDesktop}
            />
          ))
        )}

        {hiddenCount > 0 && (
          <button
            onClick={() => onLoadMore(column.chave)}
            disabled={loadingColumn}
            className="w-full mt-1 py-2 text-xs font-semibold rounded-lg border border-dashed transition-colors"
            style={{ borderColor: visual.cor + '60', color: visual.cor, backgroundColor: visual.corBg }}
          >
            {loadingColumn ? 'Carregando...' : `Ver mais ${hiddenCount} ->`}
          </button>
        )}
      </div>
    </div>
  )
}
