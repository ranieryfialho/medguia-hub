import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  criarColunaKanbanContato,
  editarColunaKanbanContato,
  moverColunaKanbanContato,
  removerColunaKanbanContato,
} from '@/actions/contatos'
import { LABEL_POR_STATUS_CONTATO, type KanbanColunaContato } from '@/lib/contatos-kanban'
import type { ContatoPaciente } from '@/lib/contatos-kanban-data'
import { defaultColumnForm, sortColumns, type ColumnFormState } from '../kanban-utils'

type UseKanbanColumnsParams = {
  initialColumns: KanbanColunaContato[]
  columnTotals: Record<string, number>
  setContatos: React.Dispatch<React.SetStateAction<ContatoPaciente[]>>
  setSelected: React.Dispatch<React.SetStateAction<ContatoPaciente | null>>
  setColumnTotals: React.Dispatch<React.SetStateAction<Record<string, number>>>
  setColumnOffsets: React.Dispatch<React.SetStateAction<Record<string, number>>>
  setActiveColuna: React.Dispatch<React.SetStateAction<string>>
  canManageColumns: boolean
}

export function useKanbanColumns({
  initialColumns,
  columnTotals,
  setContatos,
  setSelected,
  setColumnTotals,
  setColumnOffsets,
  setActiveColuna,
  canManageColumns,
}: UseKanbanColumnsParams) {
  const [columns, setColumns] = useState<KanbanColunaContato[]>(initialColumns)
  const [columnForm, setColumnForm] = useState<ColumnFormState>(() => defaultColumnForm())
  const [columnSaving, setColumnSaving] = useState(false)
  const [columnsModalOpen, setColumnsModalOpen] = useState(false)
  const [columnModalTab, setColumnModalTab] = useState<'lista' | 'form'>('lista')
  const router = useRouter()

  useEffect(() => {
    setColumns(initialColumns)
  }, [initialColumns])

  useEffect(() => {
    if (!columns.length) return
    setActiveColuna((prev) => {
      if (!columns.some((col) => col.chave === prev)) return columns[0].chave
      return prev
    })
  }, [columns, setActiveColuna])

  function getColumnByKey(chave: string) {
    return columns.find((col) => col.chave === chave) ?? null
  }

  function getColumnCardCount(chave: string) {
    return columnTotals[chave] ?? 0
  }

  function openCreateColumnModal() {
    setColumnForm(defaultColumnForm())
    setColumnModalTab('form')
    setColumnsModalOpen(true)
  }

  function openEditColumnModal(column: KanbanColunaContato) {
    setColumnForm({
      chave: column.chave,
      nome: column.nome,
      statusBase: column.status_base,
      corChave: column.cor_chave,
      origensImportacao: [],
    })
    setColumnModalTab('form')
    setColumnsModalOpen(true)
  }

  async function handleSaveColumn() {
    if (!canManageColumns || !columnForm.nome.trim()) return

    setColumnSaving(true)

    const payload = {
      nome: columnForm.nome,
      statusBase: columnForm.statusBase,
      corChave: columnForm.corChave,
      origensImportacao: columnForm.chave ? [] : columnForm.origensImportacao,
    }

    const result = columnForm.chave
      ? await editarColunaKanbanContato({ chave: columnForm.chave, ...payload })
      : await criarColunaKanbanContato(payload)

    if (result?.error) {
      setColumnSaving(false)
      return
    }

    if (columnForm.chave) {
      setColumns((prev) =>
        prev.map((col) =>
          col.chave === columnForm.chave
            ? { ...col, nome: payload.nome.trim(), status_base: payload.statusBase, cor_chave: payload.corChave }
            : col
        )
      )
      setContatos((prev) =>
        prev.map((contato) =>
          contato.kanban_coluna_chave === columnForm.chave
            ? { ...contato, status: payload.statusBase }
            : contato
        )
      )
      setSelected((prev) =>
        prev?.kanban_coluna_chave === columnForm.chave
          ? { ...prev, status: payload.statusBase }
          : prev
      )
    } else if ('chave' in result && typeof result.chave === 'string' && result.chave) {
      const createdKey = result.chave
      const nextOrder = columns.reduce((max, col) => Math.max(max, col.ordem), 0) + 1
      setColumns((prev) => [
        ...prev,
        {
          chave: createdKey,
          nome: payload.nome.trim(),
          tipo: 'custom',
          status_base: payload.statusBase,
          cor_chave: payload.corChave,
          ordem: nextOrder,
        },
      ])
      setColumnTotals((prev) => ({ ...prev, [createdKey]: 0 }))
      setColumnOffsets((prev) => ({ ...prev, [createdKey]: 0 }))
    }

    setColumnSaving(false)
    setColumnsModalOpen(false)
    setColumnForm(defaultColumnForm())
    router.refresh()
  }

  async function handleDeleteColumn(column: KanbanColunaContato) {
    if (!canManageColumns || column.tipo !== 'custom') return
    const cardCount = getColumnCardCount(column.chave)
    if (cardCount > 0) return
    if (!window.confirm(`Excluir a coluna "${column.nome}"? Os contatos dela voltarao para ${LABEL_POR_STATUS_CONTATO[column.status_base]}.`)) {
      return
    }

    const result = await removerColunaKanbanContato(column.chave)
    if (result?.error) return

    setColumns((prev) => prev.filter((item) => item.chave !== column.chave))
    setColumnTotals((prev) => {
      const next = { ...prev }
      delete next[column.chave]
      return next
    })
    setColumnOffsets((prev) => {
      const next = { ...prev }
      delete next[column.chave]
      return next
    })
    setContatos((prev) =>
      prev.map((contato) =>
        contato.kanban_coluna_chave === column.chave
          ? { ...contato, kanban_coluna_chave: column.status_base, status: column.status_base }
          : contato
      )
    )
    setSelected((prev) =>
      prev?.kanban_coluna_chave === column.chave
        ? { ...prev, kanban_coluna_chave: column.status_base, status: column.status_base }
        : prev
    )
    setActiveColuna((prev) => (prev === column.chave ? column.status_base : prev))
    router.refresh()
  }

  async function handleMoveColumn(column: KanbanColunaContato, direction: 'left' | 'right') {
    if (!canManageColumns) return

    const result = await moverColunaKanbanContato(column.chave, direction)
    if (result?.error) return

    setColumns((prev) => {
      const next = [...prev].sort((a, b) => a.ordem - b.ordem)
      const currentIndex = next.findIndex((item) => item.chave === column.chave)
      const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1

      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= next.length) return prev

      const current = next[currentIndex]
      const target = next[targetIndex]
      next[currentIndex] = { ...target, ordem: current.ordem }
      next[targetIndex] = { ...current, ordem: target.ordem }
      return next.sort((a, b) => a.ordem - b.ordem)
    })

    router.refresh()
  }

  return {
    columns,
    setColumns,
    columnForm,
    setColumnForm,
    columnSaving,
    columnsModalOpen,
    setColumnsModalOpen,
    columnModalTab,
    setColumnModalTab,
    getColumnByKey,
    getColumnCardCount,
    openCreateColumnModal,
    openEditColumnModal,
    handleSaveColumn,
    handleDeleteColumn,
    handleMoveColumn,
    sortColumns,
  }
}
