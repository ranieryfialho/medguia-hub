'use client'

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  adicionarNota,
  atualizarColunaContato,
  atualizarResponsavelContato,
  buscarNotas,
  listarPreviewPacientesBaseContato,
  materializarPacientesBaseContatoPorIds,
  type PreviewPacienteBaseContato,
} from '@/actions/contatos'
import { getVisualColunaContato, type KanbanColunaContato } from '@/lib/contatos-kanban'
import {
  CONTATOS_KANBAN_PAGE_SIZE,
  type ContatoPaciente,
  type ContatosKanbanBoardData,
  type ContatosKanbanColumnPage,
  type ProfileSimples,
} from '@/lib/contatos-kanban-data'
import {
  listarUltimosAtendimentosPorPacientes,
  type UltimoAtendimentoClient,
} from '@/lib/ultimo-atendimento'
import toast from 'react-hot-toast'

import { KanbanToolbar } from './KanbanToolbar'
import { KanbanColumn } from './KanbanColumn'
import { BaseSeedModal } from './BaseSeedModal'
import { ContatoDetailModal } from './ContatoDetailModal'
import { ColumnsManagementModal } from './ColumnsManagementModal'
import { useKanbanColumns } from './hooks/useKanbanColumns'
import {
  ATTENDANCE_BATCH_SIZE,
  HISTORICO_ATENDIMENTOS_ANOS,
  isBaseSeedColumn,
  type BaseSeedModalState,
  type ContatoBaseRealtimeRow,
  type KanbanColunaRealtimeRow,
  type Nota,
  type NotaContatoRealtimeRow,
  type Template,
} from './kanban-utils'

export function KanbanContatos({
  initialBoard,
  profiles,
  responsavelCounts,
  semResponsavelCount,
  templates,
  columns: initialColumns,
  userNivelAcesso,
}: {
  initialBoard: ContatosKanbanBoardData
  profiles: ProfileSimples[]
  responsavelCounts: Record<string, number>
  semResponsavelCount: number
  templates: Template[]
  columns: KanbanColunaContato[]
  userNivelAcesso: string
}) {
  // Board state
  const [contatos, setContatos] = useState<ContatoPaciente[]>(initialBoard.contatos)
  const [columnTotals, setColumnTotals] = useState<Record<string, number>>(initialBoard.columnTotals)
  const [columnOffsets, setColumnOffsets] = useState<Record<string, number>>(initialBoard.columnOffsets)
  const [availableBaseTotals, setAvailableBaseTotals] = useState<Record<string, number>>(initialBoard.availableBaseTotals)
  const [totalFiltered, setTotalFiltered] = useState(initialBoard.totalFiltered)
  const [loadingBoard, setLoadingBoard] = useState(false)
  const [loadingColumns, setLoadingColumns] = useState<Record<string, boolean>>({})

  // UI state
  const [search, setSearch] = useState('')
  const [responsavelFilter, setResponsavelFilter] = useState<string | null>(null)
  const [activeColuna, setActiveColuna] = useState<string>(initialColumns[0]?.chave ?? 'a_contactar')
  const [selected, setSelected] = useState<ContatoPaciente | null>(null)
  const [teamFilterOpen, setTeamFilterOpen] = useState(false)
  const [mobileModalTab, setMobileModalTab] = useState<'detalhes' | 'notas'>('detalhes')
  const [templatePickerOpen, setTemplatePickerOpen] = useState(true)
  const [localTemplates, setLocalTemplates] = useState<Template[]>(templates)

  // Notes state
  const [notas, setNotas] = useState<Nota[]>([])
  const [loadingNotas, setLoadingNotas] = useState(false)
  const [novaNotaTexto, setNovaNotaTexto] = useState('')

  // Base seed modal state
  const [baseSeedModal, setBaseSeedModal] = useState<BaseSeedModalState>({
    open: false,
    columnKey: 'a_contactar',
    preview: [],
    selectedIds: new Set<string>(),
    loading: false,
    confirming: false,
  })
  const [baseSeedSearch, setBaseSeedSearch] = useState('')
  const [loadingBaseBatches, setLoadingBaseBatches] = useState<Record<string, boolean>>({})

  const [, startTransition] = useTransition()
  const [supabase] = useState(createClient)
  const contatosRef = useRef<ContatoPaciente[]>(initialBoard.contatos)
  const attendanceLoadedIdsRef = useRef<Set<string>>(new Set())
  const attendanceLoadingIdsRef = useRef<Set<string>>(new Set())
  const didHydrateFiltersRef = useRef(false)
  const boardRefreshTimeoutRef = useRef<number | null>(null)
  const baseSeedRefreshTimeoutRef = useRef<number | null>(null)
  const baseSeedSearchTimeoutRef = useRef<number | null>(null)

  const router = useRouter()
  const canManageColumns = userNivelAcesso === 'gestor' || userNivelAcesso === 'master'
  const selectedId = selected?.id

  // Column management hook
  const {
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
  } = useKanbanColumns({
    initialColumns,
    columnTotals,
    setContatos,
    setSelected,
    setColumnTotals,
    setColumnOffsets,
    setActiveColuna,
    canManageColumns,
  })

  // Derived
  const totalAvailableBaseCards =
    (availableBaseTotals.a_contactar ?? 0) + (availableBaseTotals.recuperacao_base ?? 0)

  function getFallbackStatus(contato: ContatoPaciente) {
    return contato.recuperacao_base ? 'recuperacao_base' : 'a_contactar'
  }

  const applyContatoRealtime = useEffectEvent((row: ContatoBaseRealtimeRow) => {
    const previousContato = contatosRef.current.find((c) => c.id === row.paciente_id)
    const previousColumnKey = previousContato?.kanban_coluna_chave ?? null

    setContatos((prev) =>
      prev.map((c) =>
        c.id === row.paciente_id
          ? {
              ...c,
              status: row.status,
              kanban_coluna_chave: row.kanban_coluna_chave,
              responsavel_id: row.responsavel_id,
              responsavel_nome: row.responsavel_id
                ? profiles.find((p) => p.id === row.responsavel_id)?.full_name ?? null
                : null,
            }
          : c
      )
    )

    setSelected((prev) =>
      prev?.id === row.paciente_id
        ? {
            ...prev,
            status: row.status,
            kanban_coluna_chave: row.kanban_coluna_chave,
            responsavel_id: row.responsavel_id,
            responsavel_nome: row.responsavel_id
              ? profiles.find((p) => p.id === row.responsavel_id)?.full_name ?? null
              : null,
          }
        : prev
    )

    if (previousColumnKey && previousColumnKey !== row.kanban_coluna_chave) {
      setColumnTotals((prev) => ({
        ...prev,
        [previousColumnKey]: Math.max(0, (prev[previousColumnKey] ?? 0) - 1),
        [row.kanban_coluna_chave]: (prev[row.kanban_coluna_chave] ?? 0) + 1,
      }))
    }
  })

  const reloadNotas = useCallback(async (pacienteId: string) => {
    setLoadingNotas(true)
    const data = await buscarNotas(pacienteId)
    setNotas(data as Nota[])
    setLoadingNotas(false)
  }, [])

  // Sync board data from server
  useEffect(() => {
    contatosRef.current = contatos
  }, [contatos])

  useEffect(() => {
    setContatos(initialBoard.contatos)
    setColumnTotals(initialBoard.columnTotals)
    setColumnOffsets(initialBoard.columnOffsets)
    setAvailableBaseTotals(initialBoard.availableBaseTotals)
    setTotalFiltered(initialBoard.totalFiltered)
  }, [initialBoard])

  useEffect(() => {
    attendanceLoadedIdsRef.current = new Set(
      initialBoard.contatos
        .filter((c) => c.ultimo_atendimento_data !== null)
        .map((c) => c.id)
    )
    attendanceLoadingIdsRef.current = new Set()
  }, [initialBoard])

  // Supabase realtime
  useEffect(() => {
    let active = true
    const channelName = `kanban-contatos:${crypto.randomUUID()}`

    const subscribe = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return

      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token)
      }

      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'contatos_base' },
          (payload) => {
            if (payload.eventType === 'DELETE') {
              const row = payload.old as Partial<ContatoBaseRealtimeRow>
              if (!row.paciente_id) return

              setContatos((prev) =>
                prev.map((c) => {
                  if (c.id !== row.paciente_id) return c
                  const fallbackStatus = getFallbackStatus(c)
                  return { ...c, status: fallbackStatus, kanban_coluna_chave: fallbackStatus, responsavel_id: null, responsavel_nome: null }
                })
              )

              const previousContato = contatosRef.current.find((c) => c.id === row.paciente_id)
              const previousColumnKey = previousContato?.kanban_coluna_chave ?? null
              const fallbackColumnKey = previousContato ? getFallbackStatus(previousContato) : null

              if (previousColumnKey && fallbackColumnKey && previousColumnKey !== fallbackColumnKey) {
                setColumnTotals((prev) => ({
                  ...prev,
                  [previousColumnKey]: Math.max(0, (prev[previousColumnKey] ?? 0) - 1),
                  [fallbackColumnKey]: (prev[fallbackColumnKey] ?? 0) + 1,
                }))
              }

              setSelected((prev) => {
                if (!prev || prev.id !== row.paciente_id) return prev
                const fallbackStatus = getFallbackStatus(prev)
                return { ...prev, status: fallbackStatus, kanban_coluna_chave: fallbackStatus, responsavel_id: null, responsavel_nome: null }
              })

              scheduleBoardRefresh(true)
              if (baseSeedModal.open && !baseSeedModal.confirming) {
                scheduleBaseSeedPreviewRefresh(baseSeedModal.columnKey)
              }
              return
            }

            if (payload.new && typeof payload.new === 'object') {
              const row = payload.new as ContatoBaseRealtimeRow
              const alreadyLoaded = contatosRef.current.some((c) => c.id === row.paciente_id)

              if (alreadyLoaded) {
                applyContatoRealtime(row)
              }

              scheduleBoardRefresh(true)
              if (baseSeedModal.open && !baseSeedModal.confirming && isBaseSeedColumn(row.kanban_coluna_chave)) {
                scheduleBaseSeedPreviewRefresh(row.kanban_coluna_chave)
              }
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'kanban_colunas_contatos' },
          (payload) => {
            if (payload.eventType === 'DELETE') {
              const row = payload.old as Partial<KanbanColunaRealtimeRow>
              if (!row.chave) return
              setColumns((prev) => prev.filter((c) => c.chave !== row.chave))
              return
            }

            if (!payload.new || typeof payload.new !== 'object') return

            const nextColumn = payload.new as KanbanColunaRealtimeRow
            setColumns((prev) => {
              const withoutCurrent = prev.filter((c) => c.chave !== nextColumn.chave)
              return [...withoutCurrent, nextColumn].sort((a, b) => a.ordem - b.ordem)
            })
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notas_contato' },
          (payload) => {
            const row =
              payload.eventType === 'DELETE'
                ? (payload.old as Partial<NotaContatoRealtimeRow>)
                : (payload.new as Partial<NotaContatoRealtimeRow>)

            if (!row.paciente_id || row.paciente_id !== selectedId) return
            void reloadNotas(row.paciente_id)
          }
        )
        .subscribe()

      return channel
    }

    const currentChannelPromise = subscribe()
    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token)
      }
    })

    return () => {
      active = false
      authListener.subscription.unsubscribe()
      void currentChannelPromise.then((channel) => {
        if (channel) supabase.removeChannel(channel)
      })
    }
  }, [
    baseSeedModal.columnKey,
    baseSeedModal.confirming,
    baseSeedModal.open,
    profiles,
    reloadNotas,
    selectedId,
    setColumns,
    supabase,
  ])

  // Notes reset when selected changes
  useEffect(() => {
    if (!selected) return
    setNotas([])
    setTemplatePickerOpen(true)
    setMobileModalTab('detalhes')
    void reloadNotas(selected.id)
  }, [reloadNotas, selected, selectedId])

  // Template order from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('medguia_template_order')
      if (!stored) return
      const order: string[] = JSON.parse(stored)
      setLocalTemplates((prev) => {
        const sorted = [...prev].sort((a, b) => {
          const ai = order.indexOf(a.id)
          const bi = order.indexOf(b.id)
          if (ai === -1 && bi === -1) return 0
          if (ai === -1) return 1
          if (bi === -1) return -1
          return ai - bi
        })
        return sorted
      })
    } catch {}
  }, [])

  function moveTemplate(id: string, dir: 'up' | 'down') {
    setLocalTemplates((prev) => {
      const idx = prev.findIndex((t) => t.id === id)
      if (idx === -1) return prev
      const newIdx = dir === 'up' ? idx - 1 : idx + 1
      if (newIdx < 0 || newIdx >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
      try {
        localStorage.setItem('medguia_template_order', JSON.stringify(next.map((t) => t.id)))
      } catch {}
      return next
    })
  }

  const visibleAttendanceIds = useMemo(() => {
    const ids = contatos.map((c) => c.id)
    if (selectedId && !ids.includes(selectedId)) ids.push(selectedId)
    return ids
  }, [contatos, selectedId])

  const profilesComContagem = useMemo(
    () => profiles.map((p) => ({ ...p, count: responsavelCounts[p.id] ?? 0 })),
    [profiles, responsavelCounts]
  )

  const contatosByColumn = useMemo(() => {
    const grouped = new Map<string, ContatoPaciente[]>()
    for (const c of contatos) {
      const list = grouped.get(c.kanban_coluna_chave)
      if (list) list.push(c)
      else grouped.set(c.kanban_coluna_chave, [c])
    }
    return grouped
  }, [contatos])

  const refreshBoard = useCallback(async (
    nextSearch: string,
    nextResponsavelFilter: string | null,
    options?: { preserveSelected?: boolean }
  ) => {
    const params = new URLSearchParams()
    const trimmedSearch = nextSearch.trim()
    if (trimmedSearch) params.set('search', trimmedSearch)
    if (nextResponsavelFilter) params.set('responsavel', nextResponsavelFilter)
    params.set('limit', String(CONTATOS_KANBAN_PAGE_SIZE))

    setLoadingBoard(true)
    try {
      const response = await fetch(`/api/contatos/kanban?${params.toString()}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Erro ao atualizar kanban.')

      const data = (await response.json()) as ContatosKanbanBoardData
      setContatos(data.contatos)
      setColumnTotals(data.columnTotals)
      setColumnOffsets(data.columnOffsets)
      setAvailableBaseTotals(data.availableBaseTotals)
      setTotalFiltered(data.totalFiltered)
      if (!options?.preserveSelected) setSelected(null)
    } catch {
      toast.error('Nao foi possivel atualizar os contatos.')
    } finally {
      setLoadingBoard(false)
    }
  }, [])

  const scheduleBoardRefresh = useEffectEvent((preserveSelected = true) => {
    if (boardRefreshTimeoutRef.current !== null) window.clearTimeout(boardRefreshTimeoutRef.current)
    boardRefreshTimeoutRef.current = window.setTimeout(() => {
      boardRefreshTimeoutRef.current = null
      void refreshBoard(search, responsavelFilter, { preserveSelected })
    }, 350)
  })

  const scheduleBaseSeedPreviewRefresh = useEffectEvent((columnKey: string) => {
    if (baseSeedRefreshTimeoutRef.current !== null) window.clearTimeout(baseSeedRefreshTimeoutRef.current)
    baseSeedRefreshTimeoutRef.current = window.setTimeout(() => {
      baseSeedRefreshTimeoutRef.current = null
      void loadBaseSeedPreview(columnKey, baseSeedSearch)
    }, 350)
  })

  const triggerBaseSeedSearchRefresh = useEffectEvent(() => {
    if (!baseSeedModal.open || baseSeedModal.confirming) return
    void loadBaseSeedPreview(baseSeedModal.columnKey, baseSeedSearch)
  })

  // Debounce search + filter changes
  useEffect(() => {
    if (!didHydrateFiltersRef.current) {
      didHydrateFiltersRef.current = true
      return
    }
    const id = window.setTimeout(() => void refreshBoard(search, responsavelFilter), 250)
    return () => window.clearTimeout(id)
  }, [refreshBoard, responsavelFilter, search])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (boardRefreshTimeoutRef.current !== null) window.clearTimeout(boardRefreshTimeoutRef.current)
      if (baseSeedRefreshTimeoutRef.current !== null) window.clearTimeout(baseSeedRefreshTimeoutRef.current)
      if (baseSeedSearchTimeoutRef.current !== null) window.clearTimeout(baseSeedSearchTimeoutRef.current)
    }
  }, [])

  // Debounce base seed search
  useEffect(() => {
    if (baseSeedSearchTimeoutRef.current !== null) window.clearTimeout(baseSeedSearchTimeoutRef.current)
    baseSeedSearchTimeoutRef.current = window.setTimeout(() => {
      baseSeedSearchTimeoutRef.current = null
      triggerBaseSeedSearchRefresh()
    }, 300)
  }, [baseSeedSearch])

  async function handleLoadMore(columnKey: string) {
    const currentOffset = columnOffsets[columnKey] ?? 0
    const total = columnTotals[columnKey] ?? 0
    if (loadingColumns[columnKey] || currentOffset >= total) return

    setLoadingColumns((prev) => ({ ...prev, [columnKey]: true }))
    try {
      const params = new URLSearchParams({
        columnKey,
        offset: String(currentOffset),
        limit: String(CONTATOS_KANBAN_PAGE_SIZE),
      })
      const trimmedSearch = search.trim()
      if (trimmedSearch) params.set('search', trimmedSearch)
      if (responsavelFilter) params.set('responsavel', responsavelFilter)

      const response = await fetch(`/api/contatos/kanban?${params.toString()}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Erro ao carregar mais contatos.')

      const page = (await response.json()) as ContatosKanbanColumnPage
      setContatos((prev) => {
        const existingIds = new Set(prev.map((c) => c.id))
        const merged = [...prev]
        for (const c of page.items) {
          if (!existingIds.has(c.id)) merged.push(c)
        }
        return merged
      })
      setColumnTotals((prev) => ({ ...prev, [columnKey]: page.total }))
      setColumnOffsets((prev) => ({ ...prev, [columnKey]: page.nextOffset }))
    } catch {
      toast.error('Nao foi possivel carregar mais contatos.')
    } finally {
      setLoadingColumns((prev) => ({ ...prev, [columnKey]: false }))
    }
  }

  // Load attendance data for visible contacts
  useEffect(() => {
    const idsToLoad = visibleAttendanceIds.filter(
      (id) => !attendanceLoadedIdsRef.current.has(id) && !attendanceLoadingIdsRef.current.has(id)
    )
    if (!idsToLoad.length) return

    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - HISTORICO_ATENDIMENTOS_ANOS)
    const cutoffIso = cutoff.toISOString()
    let cancelled = false

    for (const id of idsToLoad) attendanceLoadingIdsRef.current.add(id)

    const chunks: string[][] = []
    for (let i = 0; i < idsToLoad.length; i += ATTENDANCE_BATCH_SIZE) {
      chunks.push(idsToLoad.slice(i, i + ATTENDANCE_BATCH_SIZE))
    }

    const loadAttendance = async () => {
      try {
        const results = await Promise.all(
          chunks.map((ids) =>
            listarUltimosAtendimentosPorPacientes(
              supabase as unknown as UltimoAtendimentoClient,
              ids,
              cutoffIso
            )
          )
        )
        if (cancelled) return

        const attendanceMap = new Map(
          results.flat().map((a) => [
            a.paciente_id,
            { ultimo_atendimento_data: a.data_agendamento, ultimo_atendimento_tipo: a.tipo },
          ])
        )

        setContatos((prev) =>
          prev.map((c) => {
            const a = attendanceMap.get(c.id)
            return a ? { ...c, ...a } : c
          })
        )
        setSelected((prev) => {
          if (!prev) return prev
          const a = attendanceMap.get(prev.id)
          return a ? { ...prev, ...a } : prev
        })

        for (const id of idsToLoad) {
          attendanceLoadingIdsRef.current.delete(id)
          attendanceLoadedIdsRef.current.add(id)
        }
      } catch {
        for (const id of idsToLoad) attendanceLoadingIdsRef.current.delete(id)
      }
    }

    void loadAttendance()
    return () => { cancelled = true }
  }, [supabase, visibleAttendanceIds])

  async function moveContato(pacienteId: string, columnKey: string) {
    const targetColumn = getColumnByKey(columnKey)
    if (!targetColumn) return

    const currentContato = contatos.find((c) => c.id === pacienteId)
    const previousColumnKey = currentContato?.kanban_coluna_chave ?? null

    setContatos((prev) =>
      prev.map((c) =>
        c.id === pacienteId
          ? { ...c, kanban_coluna_chave: targetColumn.chave, status: targetColumn.status_base }
          : c
      )
    )

    if (previousColumnKey && previousColumnKey !== targetColumn.chave) {
      setColumnTotals((prev) => ({
        ...prev,
        [previousColumnKey]: Math.max(0, (prev[previousColumnKey] ?? 0) - 1),
        [targetColumn.chave]: (prev[targetColumn.chave] ?? 0) + 1,
      }))
    }

    if (selected?.id === pacienteId) {
      setSelected((prev) =>
        prev ? { ...prev, kanban_coluna_chave: targetColumn.chave, status: targetColumn.status_base } : null
      )
    }

    const result = await atualizarColunaContato(pacienteId, columnKey)
    if (result?.error) {
      toast.error('Sem permissão para alterar o status. Contate o gestor.')
      router.refresh()
    }
  }

  function moverEsquerda(pacienteId: string, colunaChave: string) {
    const idx = columns.findIndex((c) => c.chave === colunaChave)
    if (idx > 0) void moveContato(pacienteId, columns[idx - 1].chave)
  }

  function moverDireita(pacienteId: string, colunaChave: string) {
    const idx = columns.findIndex((c) => c.chave === colunaChave)
    if (idx >= 0 && idx < columns.length - 1) void moveContato(pacienteId, columns[idx + 1].chave)
  }

  async function handleResponsavelChange(responsavelId: string) {
    if (!selected) return
    const nomeResponsavel = responsavelId
      ? profiles.find((p) => p.id === responsavelId)?.full_name ?? null
      : null
    const update = { responsavel_id: responsavelId || null, responsavel_nome: nomeResponsavel }
    setContatos((prev) => prev.map((c) => (c.id === selected.id ? { ...c, ...update } : c)))
    setSelected((prev) => (prev ? { ...prev, ...update } : null))
    await atualizarResponsavelContato(selected.id, responsavelId || null)
  }

  async function handleAddNota() {
    if (!novaNotaTexto.trim() || !selected) return
    const texto = novaNotaTexto.trim()
    setNovaNotaTexto('')
    const res = await adicionarNota(selected.id, texto)
    if (!res.error) await reloadNotas(selected.id)
  }

  // Base seed modal handlers
  async function loadBaseSeedPreview(columnKey: string, searchStr = '') {
    if (!isBaseSeedColumn(columnKey)) return

    const isColumnChange = (prev: BaseSeedModalState) => prev.columnKey !== columnKey
    setBaseSeedModal((prev) => ({
      ...prev,
      open: true,
      columnKey,
      loading: true,
      preview: isColumnChange(prev) ? [] : prev.preview,
      selectedIds: isColumnChange(prev) ? new Set<string>() : prev.selectedIds,
    }))

    const result = await listarPreviewPacientesBaseContato(columnKey, 50, searchStr || undefined)

    if (result?.error) {
      setBaseSeedModal((prev) => ({ ...prev, open: true, columnKey, loading: false, preview: [], selectedIds: new Set<string>() }))
      toast.error('Nao foi possivel listar os pacientes disponiveis.')
      return
    }

    const items = result.items ?? []
    setBaseSeedModal((prev) => ({
      ...prev,
      open: true,
      columnKey,
      loading: false,
      preview: items,
      selectedIds: new Set(items.map((p: PreviewPacienteBaseContato) => p.id)),
    }))
  }

  function openBaseSeedModal(columnKey?: string) {
    const fallbackKey =
      columnKey ??
      ((availableBaseTotals.a_contactar ?? 0) >= (availableBaseTotals.recuperacao_base ?? 0)
        ? 'a_contactar'
        : 'recuperacao_base')
    void loadBaseSeedPreview(fallbackKey)
  }

  async function handleAddBaseBatch(columnKey: string) {
    if (!isBaseSeedColumn(columnKey)) return
    setLoadingBaseBatches((prev) => ({ ...prev, [columnKey]: true }))
    openBaseSeedModal(columnKey)
    setLoadingBaseBatches((prev) => ({ ...prev, [columnKey]: false }))
  }

  async function handleConfirmBaseSeed() {
    if (!isBaseSeedColumn(baseSeedModal.columnKey) || baseSeedModal.confirming) return
    const pacienteIds = [...baseSeedModal.selectedIds]
    if (!pacienteIds.length) {
      toast('Selecione ao menos um paciente para adicionar.')
      return
    }

    setBaseSeedModal((prev) => ({ ...prev, confirming: true }))
    try {
      const result = await materializarPacientesBaseContatoPorIds(baseSeedModal.columnKey, pacienteIds)
      if (result?.error) {
        toast.error('Nao foi possivel adicionar os pacientes na base.')
        return
      }

      const inserted = result?.inserted ?? 0
      if (inserted === 0) {
        toast('Os pacientes desta lista ja foram adicionados por outra atualizacao.')
      } else {
        toast.success(`${inserted} paciente${inserted > 1 ? 's' : ''} adicionado${inserted > 1 ? 's' : ''}.`)
      }

      setBaseSeedModal((prev) => ({ ...prev, open: false, preview: [] }))
      await refreshBoard(search, responsavelFilter)
    } finally {
      setBaseSeedModal((prev) => ({ ...prev, confirming: false }))
    }
  }

  function closeBaseSeedModal() {
    setBaseSeedSearch('')
    setBaseSeedModal((prev) => ({
      ...prev,
      open: false,
      preview: [],
      selectedIds: new Set<string>(),
      loading: false,
      confirming: false,
    }))
  }

  function toggleBaseSeedSelection(id: string) {
    setBaseSeedModal((prev) => {
      const next = new Set(prev.selectedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...prev, selectedIds: next }
    })
  }

  function toggleAllBaseSeedSelection() {
    setBaseSeedModal((prev) => {
      const allIds = prev.preview.map((p) => p.id)
      const allSelected = allIds.every((id) => prev.selectedIds.has(id))
      return { ...prev, selectedIds: allSelected ? new Set<string>() : new Set(allIds) }
    })
  }

  // Derived
  const selectedColumn = selected ? getColumnByKey(selected.kanban_coluna_chave) ?? getColumnByKey(selected.status) : null
  const baseSeedColumns = columns.filter((c) => isBaseSeedColumn(c.chave))
  const activeBaseSeedColumn = baseSeedColumns.find((c) => c.chave === baseSeedModal.columnKey) ?? null

  return (
    <div className="space-y-4 w-full">
      <KanbanToolbar
        search={search}
        onSearchChange={setSearch}
        responsavelFilter={responsavelFilter}
        onResponsavelFilterChange={setResponsavelFilter}
        teamFilterOpen={teamFilterOpen}
        onTeamFilterOpenChange={setTeamFilterOpen}
        profiles={profiles}
        profilesComContagem={profilesComContagem}
        semResponsavelCount={semResponsavelCount}
        columns={columns}
        columnTotals={columnTotals}
        totalFiltered={totalFiltered}
        contatosCount={contatos.length}
        loadingBoard={loadingBoard}
        loadingBaseBatches={loadingBaseBatches}
        totalAvailableBaseCards={totalAvailableBaseCards}
        baseSeedColumnKey={baseSeedModal.columnKey}
        canManageColumns={canManageColumns}
        onAddBaseBatch={handleAddBaseBatch}
        onOpenCreateColumnModal={openCreateColumnModal}
      />

      {/* Mobile column tabs */}
      <div className="flex lg:hidden gap-2 overflow-x-auto pb-2 hide-scrollbar snap-x snap-mandatory">
        {columns.map((column) => {
          const count = columnTotals[column.chave] ?? 0
          const visual = getVisualColunaContato(column)
          return (
            <button
              id={`tab-${column.chave}`}
              key={column.chave}
              onClick={() => {
                setActiveColuna(column.chave)
                document.getElementById(`col-${column.chave}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
              }}
              className={`flex-none snap-start flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap shadow-sm border ${
                activeColuna === column.chave
                  ? 'text-white border-transparent scale-105'
                  : 'bg-white border-[#dee3e3] text-[#6d7a75] hover:bg-[#f8faf9]'
              }`}
              style={activeColuna === column.chave ? { backgroundColor: visual.cor } : {}}
            >
              {column.nome}
              <span
                className="text-[11px] font-extrabold px-2 py-0.5 rounded-full"
                style={activeColuna === column.chave
                  ? { backgroundColor: 'rgba(255,255,255,0.25)', color: 'white' }
                  : { backgroundColor: visual.corBadgeBg, color: visual.corBadgeText }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Kanban board */}
      <div
        className="flex gap-4 lg:gap-5 overflow-x-auto pb-6 pt-2 lg:pt-0 snap-x snap-mandatory hide-scrollbar items-start h-[calc(100svh-230px)] lg:h-[calc(100vh-140px)] min-h-[500px]"
        onScroll={(e) => {
          if (window.innerWidth >= 1024) return
          const container = e.currentTarget
          const scrollLeft = container.scrollLeft
          const children = Array.from(container.children) as HTMLElement[]
          if (!children.length) return
          let closest = children[0]
          let minDistance = Infinity
          const center = scrollLeft + container.clientWidth / 2
          children.forEach((child) => {
            const childCenter = child.offsetLeft + child.clientWidth / 2 - container.offsetLeft
            const distance = Math.abs(childCenter - center)
            if (distance < minDistance) { minDistance = distance; closest = child }
          })
          const newActive = closest.id.replace('col-', '')
          if (newActive !== activeColuna) {
            setActiveColuna(newActive)
            document.getElementById(`tab-${newActive}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
          }
        }}
      >
        {columns.map((column, colIdx) => (
          <KanbanColumn
            key={column.chave}
            column={column}
            colIdx={colIdx}
            columnsLength={columns.length}
            cards={contatosByColumn.get(column.chave) ?? []}
            totalCards={columnTotals[column.chave] ?? 0}
            loadingBoard={loadingBoard}
            loadingColumn={loadingColumns[column.chave] ?? false}
            canManageColumns={canManageColumns}
            onMoveColumn={(col, dir) => void handleMoveColumn(col, dir)}
            onEditColumn={openEditColumnModal}
            onDeleteColumn={(col) => void handleDeleteColumn(col)}
            onLoadMore={(key) => void handleLoadMore(key)}
            onSelectContato={setSelected}
            onMoveLeft={moverEsquerda}
            onMoveRight={moverDireita}
            getColumnCardCount={getColumnCardCount}
          />
        ))}
      </div>

      <BaseSeedModal
        state={baseSeedModal}
        search={baseSeedSearch}
        onSearchChange={setBaseSeedSearch}
        availableBaseTotals={availableBaseTotals}
        baseSeedColumns={baseSeedColumns}
        activeBaseSeedColumn={activeBaseSeedColumn}
        onClose={closeBaseSeedModal}
        onConfirm={() => void handleConfirmBaseSeed()}
        onToggleSelection={toggleBaseSeedSelection}
        onToggleAll={toggleAllBaseSeedSelection}
        onLoadPreview={loadBaseSeedPreview}
      />

      {selected && (
        <ContatoDetailModal
          selected={selected}
          selectedColumn={selectedColumn}
          notas={notas}
          loadingNotas={loadingNotas}
          novaNotaTexto={novaNotaTexto}
          onNovaNotaTextoChange={setNovaNotaTexto}
          mobileModalTab={mobileModalTab}
          onMobileModalTabChange={setMobileModalTab}
          columns={columns}
          profiles={profiles}
          localTemplates={localTemplates}
          templatePickerOpen={templatePickerOpen}
          onTemplatePickerOpenChange={setTemplatePickerOpen}
          onClose={() => setSelected(null)}
          onMoveContato={(pacienteId, columnKey) => {
            startTransition(() => { void moveContato(pacienteId, columnKey) })
          }}
          onResponsavelChange={(id) => void handleResponsavelChange(id)}
          onAddNota={() => void handleAddNota()}
          onMoveTemplate={moveTemplate}
        />
      )}

      {canManageColumns && columnsModalOpen && (
        <ColumnsManagementModal
          columns={columns}
          columnForm={columnForm}
          onColumnFormChange={setColumnForm}
          columnSaving={columnSaving}
          columnModalTab={columnModalTab}
          onColumnModalTabChange={setColumnModalTab}
          columnTotals={columnTotals}
          onClose={() => setColumnsModalOpen(false)}
          onSave={() => void handleSaveColumn()}
          onDelete={(col) => void handleDeleteColumn(col)}
          onMove={(col, dir) => void handleMoveColumn(col, dir)}
          onOpenEditForm={openEditColumnModal}
        />
      )}
    </div>
  )
}
