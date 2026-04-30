'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Send,
  Settings2,
  StickyNote,
  Trash2,
  UserCircle2,
  X,
  Clock,
} from 'lucide-react'
import {
  adicionarNota,
  atualizarColunaContato,
  atualizarResponsavelContato,
  buscarNotas,
  criarColunaKanbanContato,
  editarColunaKanbanContato,
  moverColunaKanbanContato,
  removerColunaKanbanContato,
  type StatusContato,
} from '@/actions/contatos'
import type { ContatoPaciente, ProfileSimples } from '@/app/(painel)/contatos/page'
import {
  LABEL_POR_STATUS_CONTATO,
  getVisualColunaContato,
  OPCOES_COR_COLUNA,
  type ColunaCorContato,
  type KanbanColunaContato,
} from '@/lib/contatos-kanban'
import { differenceInCalendarDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Nota = {
  id: string
  texto: string
  criado_em: string
  autor_id: string | null
  autor_nome?: string | null
}

type Template = {
  id: string
  nome: string
  conteudo: string
  criado_por: string | null
}

type ColumnFormState = {
  chave: string | null
  nome: string
  statusBase: StatusContato
  corChave: ColunaCorContato
}

const INITIAL_PER_COLUMN = 50

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

const AVATAR_PALETTE = ['#006b5a', '#406375', '#779aad', '#637370', '#2CBFAB', '#b45309', '#7c3aed']

function getAvatarColor(name: string): string {
  let h = 0
  for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h)
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}

function diasDesde(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = differenceInCalendarDays(new Date(), new Date(dateStr))
  return Math.max(0, diff)
}

function labelDias(dias: number): string {
  if (dias === 0) return 'Hoje'
  if (dias === 1) return 'Ontem'
  return `${dias}d`
}

function whatsappLink(tel: string): string {
  const n = tel.replace(/\D/g, '')
  return `https://wa.me/${n.startsWith('55') ? n : '55' + n}`
}

function whatsappLinkComMsg(tel: string, msg: string): string {
  const n = tel.replace(/\D/g, '')
  const phone = n.startsWith('55') ? n : '55' + n
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
}

function diasCor(dias: number): string {
  if (dias < 30) return '#006b5a'
  if (dias < 90) return '#b45309'
  return '#ba1a1a'
}

function interpolarTemplate(conteudo: string, contato: ContatoPaciente): string {
  const dias = diasDesde(contato.ultimo_atendimento_data)
  const dataUltimo = contato.ultimo_atendimento_data
    ? format(new Date(contato.ultimo_atendimento_data), 'dd/MM/yyyy', { locale: ptBR })
    : ''

  return conteudo
    .replace(/\{\{nome\}\}/g, contato.nome)
    .replace(/\{\{dias\}\}/g, dias !== null ? String(dias) : '')
    .replace(/\{\{data_ultimo\}\}/g, dataUltimo)
    .replace(/\{\{ultimo_tipo\}\}/g, contato.ultimo_atendimento_tipo ?? '')
    .replace(/\{\{data\}\}/g, '')
    .replace(/\{\{hora\}\}/g, '')
    .replace(/\{\{profissional\}\}/g, '')
    .replace(/\{\{tipo\}\}/g, '')
    .replace(/\{\{sessao\}\}/g, '')
}

function createVisibleCount(columns: KanbanColunaContato[]) {
  return Object.fromEntries(columns.map((column) => [column.chave, INITIAL_PER_COLUMN])) as Record<string, number>
}

function defaultColumnForm(): ColumnFormState {
  return {
    chave: null,
    nome: '',
    statusBase: 'a_contactar',
    corChave: 'a_contactar',
  }
}

export function KanbanContatos({
  contatos: initialContatos,
  profiles,
  templates,
  columns: initialColumns,
  userRole,
}: {
  contatos: ContatoPaciente[]
  profiles: ProfileSimples[]
  templates: Template[]
  columns: KanbanColunaContato[]
  userRole: string
}) {
  const [contatos, setContatos] = useState<ContatoPaciente[]>(initialContatos)
  const [columns, setColumns] = useState<KanbanColunaContato[]>(initialColumns)
  const [search, setSearch] = useState('')
  const [responsavelFilter, setResponsavelFilter] = useState<string | null>(null)
  const [activeColuna, setActiveColuna] = useState<string>(initialColumns[0]?.chave ?? 'a_contactar')
  const [visibleCount, setVisibleCount] = useState<Record<string, number>>(() => createVisibleCount(initialColumns))
  const [selected, setSelected] = useState<ContatoPaciente | null>(null)
  const [notas, setNotas] = useState<Nota[]>([])
  const [loadingNotas, setLoadingNotas] = useState(false)
  const [novaNotaTexto, setNovaNotaTexto] = useState('')
  const [templatePickerOpen, setTemplatePickerOpen] = useState(true)
  const [columnsModalOpen, setColumnsModalOpen] = useState(false)
  const [columnForm, setColumnForm] = useState<ColumnFormState>(() => defaultColumnForm())
  const [columnSaving, setColumnSaving] = useState(false)
  const [mobileModalTab, setMobileModalTab] = useState<'detalhes' | 'notas'>('detalhes')
  const [teamFilterOpen, setTeamFilterOpen] = useState(false)
  const [columnModalTab, setColumnModalTab] = useState<'lista' | 'form'>('lista')
  const [, startTransition] = useTransition()

  const router = useRouter()
  const canManageColumns = userRole === 'gestor' || userRole === 'master'
  const selectedId = selected?.id

  useEffect(() => {
    setContatos(initialContatos)
  }, [initialContatos])

  useEffect(() => {
    setColumns(initialColumns)
  }, [initialColumns])

  useEffect(() => {
    if (!columns.length) return

    if (!columns.some((column) => column.chave === activeColuna)) {
      setActiveColuna(columns[0].chave)
    }

    setVisibleCount((prev) => {
      const next = createVisibleCount(columns)
      for (const key of Object.keys(next)) {
        if (prev[key]) next[key] = prev[key]
      }
      return next
    })
  }, [columns, activeColuna])

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh()
    }, 5_000)

    return () => clearInterval(interval)
  }, [router])

  useEffect(() => {
    if (!selected) return
    setLoadingNotas(true)
    setNotas([])
    setTemplatePickerOpen(true)
    setMobileModalTab('detalhes')
    buscarNotas(selected.id).then((data) => {
      setNotas(data as Nota[])
      setLoadingNotas(false)
    })
  }, [selected, selectedId])

  useEffect(() => {
    setVisibleCount(createVisibleCount(columns))
  }, [search, responsavelFilter, columns])

  const filtered = contatos.filter((c) => {
    if (search && !c.nome.toLowerCase().includes(search.toLowerCase())) return false
    if (responsavelFilter === '__none__' && c.responsavel_id !== null) return false
    if (responsavelFilter && responsavelFilter !== '__none__' && c.responsavel_id !== responsavelFilter) return false
    return true
  })

  const profilesComContagem = profiles.map((p) => ({
    ...p,
    count: contatos.filter((c) => c.responsavel_id === p.id).length,
  }))
  const semResponsavelCount = contatos.filter((c) => c.responsavel_id === null).length

  function getColumnByKey(chave: string) {
    return columns.find((column) => column.chave === chave) ?? null
  }

  function getColumnCardCount(chave: string) {
    return contatos.filter((contato) => contato.kanban_coluna_chave === chave).length
  }

  async function moveContato(pacienteId: string, columnKey: string) {
    const targetColumn = getColumnByKey(columnKey)
    if (!targetColumn) return

    setContatos((prev) =>
      prev.map((contato) =>
        contato.id === pacienteId
          ? { ...contato, kanban_coluna_chave: targetColumn.chave, status: targetColumn.status_base }
          : contato
      )
    )

    if (selected?.id === pacienteId) {
      setSelected((prev) =>
        prev ? { ...prev, kanban_coluna_chave: targetColumn.chave, status: targetColumn.status_base } : null
      )
    }

    const result = await atualizarColunaContato(pacienteId, columnKey)
    if (result?.error) {
      router.refresh()
    }
  }

  function moverEsquerda(pacienteId: string, colunaChave: string) {
    const idx = columns.findIndex((column) => column.chave === colunaChave)
    if (idx > 0) {
      void moveContato(pacienteId, columns[idx - 1].chave)
    }
  }

  function moverDireita(pacienteId: string, colunaChave: string) {
    const idx = columns.findIndex((column) => column.chave === colunaChave)
    if (idx >= 0 && idx < columns.length - 1) {
      void moveContato(pacienteId, columns[idx + 1].chave)
    }
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

    if (!res.error) {
      const data = await buscarNotas(selected.id)
      setNotas(data as Nota[])
    }
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
        prev.map((column) =>
          column.chave === columnForm.chave
            ? { ...column, nome: payload.nome.trim(), status_base: payload.statusBase, cor_chave: payload.corChave }
            : column
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
      const nextOrder = columns.reduce((max, column) => Math.max(max, column.ordem), 0) + 1
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
    setContatos((prev) =>
      prev.map((contato) =>
        contato.kanban_coluna_chave === column.chave
          ? {
              ...contato,
              kanban_coluna_chave: column.status_base,
              status: column.status_base,
            }
          : contato
      )
    )
    setSelected((prev) =>
      prev?.kanban_coluna_chave === column.chave
        ? { ...prev, kanban_coluna_chave: column.status_base, status: column.status_base }
        : prev
    )

    if (activeColuna === column.chave) {
      setActiveColuna(column.status_base)
    }

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

      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= next.length) {
        return prev
      }

      const current = next[currentIndex]
      const target = next[targetIndex]

      next[currentIndex] = { ...target, ordem: current.ordem }
      next[targetIndex] = { ...current, ordem: target.ordem }

      return next.sort((a, b) => a.ordem - b.ordem)
    })

    router.refresh()
  }

  const selectedColumn = selected ? getColumnByKey(selected.kanban_coluna_chave) ?? getColumnByKey(selected.status) : null

  return (
    <div className="space-y-4 w-full">
      <div className="bg-white rounded-2xl border border-[#dee3e3] p-3 sm:p-4 shadow-sm flex flex-col gap-2.5 sm:gap-3">
        {/* Linha 1: busca + botões de ação */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BB0AD] pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar paciente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 border border-[#dee3e3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#006b5a]/20 focus:border-[#006b5a] bg-[#f8faf9] transition-all"
            />
          </div>

          {/* Botão filtro equipe — só mobile */}
          {profiles.length > 0 && (
            <button
              onClick={() => setTeamFilterOpen((v) => !v)}
              className={`sm:hidden relative shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border transition-all ${
                teamFilterOpen || responsavelFilter
                  ? 'bg-[#006b5a] border-[#006b5a] text-white'
                  : 'bg-white border-[#dee3e3] text-[#6d7a75]'
              }`}
              title="Filtrar por responsavel"
            >
              <UserCircle2 size={18} />
              {responsavelFilter && !teamFilterOpen && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-white border border-[#006b5a]" />
              )}
            </button>
          )}

          {/* Limpar filtros — ícone compacto quando há filtro ativo */}
          {(search || responsavelFilter) && (
            <button
              onClick={() => { setSearch(''); setResponsavelFilter(null); setTeamFilterOpen(false) }}
              className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl text-[#ba1a1a] bg-[#ba1a1a]/8 hover:bg-[#ba1a1a]/15 border border-[#ba1a1a]/20 transition-colors"
              title="Limpar filtros"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          )}

          {/* Nova coluna */}
          {canManageColumns && (
            <button
              onClick={openCreateColumnModal}
              className="shrink-0 w-10 h-10 sm:w-auto sm:px-4 flex items-center justify-center gap-2 rounded-xl bg-[#006b5a] text-white text-sm font-bold hover:bg-[#004f43] transition-all shadow-sm active:scale-95"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span className="hidden sm:inline">Nova coluna</span>
            </button>
          )}

          {/* Contadores — só desktop */}
          <div className="hidden lg:flex items-center gap-2.5 border-l border-[#dee3e3] pl-3 shrink-0">
            {columns.map((column) => {
              const count = filtered.filter((c) => c.kanban_coluna_chave === column.chave).length
              const visual = getVisualColunaContato(column)
              return (
                <span key={column.chave} className="text-[11px] font-bold" style={{ color: visual.cor }}>
                  {count}
                </span>
              )
            })}
            <span className="text-[11px] font-bold text-[#9BB0AD] bg-[#f0f5f4] px-2 py-1 rounded-lg border border-[#dee3e3]">
              {filtered.length} total
            </span>
          </div>
        </div>

        {/* Linha 2: filtro de equipe
            - Mobile: só aparece quando teamFilterOpen = true
            - Desktop (sm+): sempre visível */}
        {profiles.length > 0 && (
          <div className={`${teamFilterOpen ? 'flex' : 'hidden'} sm:flex items-center gap-2 sm:gap-3`}>
            <span className="text-[10px] text-[#9BB0AD] font-bold uppercase tracking-wider shrink-0 hidden sm:block">
              Equipe
            </span>

            {/* Container scrollável com fade hint na borda direita */}
            <div className="relative flex-1 min-w-0">
              <div className="flex gap-2 overflow-x-auto hide-scrollbar snap-x py-1 pr-6">
                <button
                  onClick={() => setResponsavelFilter(responsavelFilter === '__none__' ? null : '__none__')}
                  className={`relative shrink-0 snap-start w-9 h-9 rounded-full border-2 border-dashed flex items-center justify-center transition-all ${
                    responsavelFilter === '__none__'
                      ? 'border-[#006b5a] bg-[#f0fcf9] ring-2 ring-offset-1 ring-[#006b5a] z-10'
                      : 'border-[#bcc9c4] hover:border-[#9BB0AD] bg-white'
                  }`}
                  title="Sem responsavel"
                >
                  <UserCircle2 size={15} className="text-[#9BB0AD]" />
                  {semResponsavelCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-[#dee3e3] text-[#3d4945] text-[9px] font-extrabold rounded-full flex items-center justify-center">
                      {semResponsavelCount > 99 ? '99+' : semResponsavelCount}
                    </span>
                  )}
                </button>

                {profilesComContagem.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setResponsavelFilter(responsavelFilter === p.id ? null : p.id)}
                    style={{ backgroundColor: getAvatarColor(p.full_name) }}
                    className={`relative shrink-0 snap-start w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-bold transition-all shadow-sm ${
                      responsavelFilter === p.id
                        ? 'ring-2 ring-offset-2 ring-[#006b5a] scale-110 z-10'
                        : p.count === 0 ? 'opacity-35 hover:opacity-60' : 'opacity-90 hover:opacity-100 hover:scale-105'
                    }`}
                    title={`${p.full_name} (${p.count})`}
                  >
                    {getInitials(p.full_name)}
                    {p.count > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-white/95 text-[#1A2E2B] text-[9px] font-extrabold rounded-full flex items-center justify-center border border-[#f0f5f4]">
                        {p.count > 99 ? '99+' : p.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {/* Fade hint indicando que há mais avatares para a direita */}
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none" />
            </div>

            {/* Limpar filtros — texto completo no desktop */}
            {(search || responsavelFilter) && (
              <button
                onClick={() => { setSearch(''); setResponsavelFilter(null) }}
                className="hidden sm:flex items-center gap-1 text-xs text-[#ba1a1a] hover:text-[#ba1a1a] bg-[#ba1a1a]/8 hover:bg-[#ba1a1a]/15 font-bold transition-colors px-3 py-1.5 rounded-lg border border-[#ba1a1a]/20 shrink-0 whitespace-nowrap"
              >
                <X size={12} strokeWidth={2.5} />
                Limpar
              </button>
            )}
          </div>
        )}

        {/* Info strip mobile — compacto, sem linha extra desnecessária */}
        <div className="flex items-center gap-2 sm:hidden">
          <span className="text-[11px] text-[#9BB0AD] font-medium">
            {filtered.length} de {contatos.length} pacientes
          </span>
          {responsavelFilter && (
            <button
              onClick={() => setResponsavelFilter(null)}
              className="flex items-center gap-1 text-[11px] font-bold text-[#006b5a] bg-[#f0fcf9] px-2 py-0.5 rounded-full border border-[#c3ede6]"
            >
              Equipe ativa
              <X size={9} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      <div className="flex lg:hidden gap-2 overflow-x-auto pb-2 hide-scrollbar snap-x snap-mandatory">
        {columns.map((column) => {
          const count = filtered.filter((c) => c.kanban_coluna_chave === column.chave).length
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

      <div 
        className="flex gap-4 lg:gap-5 overflow-x-auto pb-6 pt-2 lg:pt-0 snap-x snap-mandatory hide-scrollbar items-start h-[calc(100svh-230px)] lg:h-[calc(100vh-140px)] min-h-[500px]"
        onScroll={(e) => {
          if (window.innerWidth >= 1024) return;
          const container = e.currentTarget;
          const scrollLeft = container.scrollLeft;
          const children = Array.from(container.children) as HTMLElement[];
          if (!children.length) return;
          let closest = children[0];
          let minDistance = Infinity;
          const center = scrollLeft + container.clientWidth / 2;
          
          children.forEach(child => {
            const childCenter = child.offsetLeft + child.clientWidth / 2 - container.offsetLeft;
            const distance = Math.abs(childCenter - center);
            if (distance < minDistance) {
              minDistance = distance;
              closest = child;
            }
          });
          
          const newActive = closest.id.replace('col-', '');
          if (newActive !== activeColuna) {
            setActiveColuna(newActive);
            const tab = document.getElementById(`tab-${newActive}`);
            if (tab) {
               tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
          }
        }}
      >
        {columns.map((column, colIdx) => {
          const cards = filtered.filter((c) => c.kanban_coluna_chave === column.chave)
          const limit = search || responsavelFilter ? cards.length : visibleCount[column.chave] ?? INITIAL_PER_COLUMN
          const visibleCards = cards.slice(0, limit)
          const hiddenCount = cards.length - visibleCards.length
          const visual = getVisualColunaContato(column)

          return (
            <div
              id={`col-${column.chave}`}
              key={column.chave}
              className="w-[85vw] sm:w-[360px] lg:w-[320px] flex-none snap-center lg:snap-align-none flex flex-col h-full max-h-full"
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
                  {cards.length}
                </span>
              </div>

              <div
                className="border border-t-0 rounded-b-2xl p-2.5 sm:p-3 space-y-3 overflow-y-auto flex-1 flex flex-col hide-scrollbar"
                style={{
                  borderColor: visual.cor + '30',
                  backgroundColor: visual.corBg + 'AA',
                }}
              >
                {canManageColumns && (
                  <div className="flex items-center justify-end gap-1 pb-1">
                    <button
                      onClick={() => void handleMoveColumn(column, 'left')}
                      className="w-7 h-7 rounded bg-white/80 hover:bg-white text-[#6d7a75] flex items-center justify-center"
                      title="Mover coluna para a esquerda"
                    >
                      <ChevronLeft size={12} />
                    </button>
                    <button
                      onClick={() => void handleMoveColumn(column, 'right')}
                      className="w-7 h-7 rounded bg-white/80 hover:bg-white text-[#6d7a75] flex items-center justify-center"
                      title="Mover coluna para a direita"
                    >
                      <ChevronRight size={12} />
                    </button>
                    {column.tipo === 'custom' && (
                      <>
                        <button
                          onClick={() => openEditColumnModal(column)}
                          className="w-7 h-7 rounded bg-white/80 hover:bg-white text-[#6d7a75] flex items-center justify-center"
                          title="Editar coluna"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => void handleDeleteColumn(column)}
                          disabled={getColumnCardCount(column.chave) > 0}
                          className="w-7 h-7 rounded bg-white/80 hover:bg-white text-[#ba1a1a] flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                          title={getColumnCardCount(column.chave) > 0 ? 'Esvazie a coluna antes de excluir' : 'Excluir coluna'}
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                  </div>
                )}

                {cards.length === 0 ? (
                  <div className="flex items-center justify-center h-16 text-xs text-[#9BB0AD]">
                    Vazio
                  </div>
                ) : (
                  visibleCards.map((contato) => {
                    const dias = diasDesde(contato.ultimo_atendimento_data)
                    const cor = dias !== null ? diasCor(dias) : '#9BB0AD'

                    return (
                      <div
                        key={contato.id}
                        onClick={() => setSelected(contato)}
                        className="bg-white rounded-lg border border-[#dee3e3] p-3.5 cursor-pointer hover:border-[#006b5a]/40 hover:shadow-sm transition-all group"
                      >
                        <div className="flex items-start gap-2.5 mb-2.5">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 mt-0.5"
                            style={{ backgroundColor: getAvatarColor(contato.nome) }}
                          >
                            {getInitials(contato.nome)}
                          </div>
                          <span className="font-semibold text-[#1A2E2B] text-sm leading-snug flex-1 line-clamp-2">
                            {contato.nome}
                          </span>
                          {contato.telefone && (
                            <a
                              href={whatsappLink(contato.telefone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/25 transition-colors opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                              title="Abrir WhatsApp"
                            >
                              <MessageCircle size={13} />
                            </a>
                          )}
                        </div>

                        {contato.telefone && (
                          <div className="flex items-center gap-1.5 text-xs text-[#6d7a75] mb-2.5">
                            <MessageCircle size={11} className="shrink-0 text-[#25D366]" />
                            <span>{contato.telefone}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          {contato.ultimo_atendimento_data ? (
                            <div className="flex items-center gap-1 text-xs text-[#9BB0AD]">
                              <Calendar size={11} />
                              <span>{format(new Date(contato.ultimo_atendimento_data), 'dd/MM/yy')}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-[#9BB0AD]">Sem atendimento</span>
                          )}

                          {dias !== null && (
                            <div
                              className="flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ color: cor, backgroundColor: cor + '18' }}
                            >
                              <Clock size={10} />
                              <span>{labelDias(dias)}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#dee3e3]">
                          {contato.responsavel_nome ? (
                            <div className="flex items-center gap-1.5">
                              <div
                                className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                                style={{ backgroundColor: getAvatarColor(contato.responsavel_nome) }}
                                title={contato.responsavel_nome}
                              >
                                {getInitials(contato.responsavel_nome)}
                              </div>
                              <span className="text-[11px] text-[#6d7a75] truncate max-w-[100px]">
                                {contato.responsavel_nome.split(' ')[0]}
                              </span>
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full border border-dashed border-[#bcc9c4] flex items-center justify-center">
                              <span className="text-[8px] text-[#9BB0AD]">?</span>
                            </div>
                          )}

                          <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                            {colIdx > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  moverEsquerda(contato.id, contato.kanban_coluna_chave)
                                }}
                                className="w-7 h-7 lg:w-5 lg:h-5 flex items-center justify-center rounded bg-[#f0f5f4] hover:bg-[#dee3e3] text-[#6d7a75] transition-colors"
                                title="Mover para coluna anterior"
                              >
                                <ChevronLeft size={11} />
                              </button>
                            )}
                            {colIdx < columns.length - 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  moverDireita(contato.id, contato.kanban_coluna_chave)
                                }}
                                className="w-7 h-7 lg:w-5 lg:h-5 flex items-center justify-center rounded bg-[#f0f5f4] hover:bg-[#dee3e3] text-[#6d7a75] transition-colors"
                                title="Mover para proxima coluna"
                              >
                                <ChevronRight size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}

                {hiddenCount > 0 && (
                  <button
                    onClick={() =>
                      setVisibleCount((prev) => ({
                        ...prev,
                        [column.chave]: (prev[column.chave] ?? INITIAL_PER_COLUMN) + INITIAL_PER_COLUMN,
                      }))
                    }
                    className="w-full mt-1 py-2 text-xs font-semibold rounded-lg border border-dashed transition-colors"
                    style={{ borderColor: visual.cor + '60', color: visual.cor, backgroundColor: visual.corBg }}
                  >
                    Ver mais {hiddenCount} -&gt;
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 bg-[#171d1c]/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-7xl max-h-[95vh] flex flex-col lg:flex-row overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full border-b border-[#dee3e3] bg-white/95 backdrop-blur-sm lg:hidden rounded-t-2xl sm:rounded-none">
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-12 h-1.5 rounded-full bg-[#dee3e3]"></div>
              </div>
              <div className="px-4 pb-4 flex items-start gap-3 mt-1">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ backgroundColor: getAvatarColor(selected.nome) }}
                >
                  {getInitials(selected.nome)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-[#083142] truncate">{selected.nome}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {selectedColumn && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{
                          color: getVisualColunaContato(selectedColumn).cor,
                          backgroundColor: getVisualColunaContato(selectedColumn).corBadgeBg,
                        }}
                      >
                        {selectedColumn.nome}
                      </span>
                    )}
                    {selected.telefone && (
                      <span className="text-xs text-[#6d7a75] truncate">{selected.telefone}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="p-1.5 rounded-lg hover:bg-[#f0f5f4] text-[#9BB0AD] hover:text-[#3d4945] transition-colors shrink-0"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="px-4 pb-4">
                <div className="grid grid-cols-2 gap-2 bg-[#f0f5f4] p-1 rounded-xl">
                  <button
                    onClick={() => setMobileModalTab('detalhes')}
                    className={`px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${mobileModalTab === 'detalhes' ? 'bg-white text-[#006b5a] shadow-sm' : 'text-[#6d7a75]'}`}
                  >
                    Detalhes
                  </button>
                  <button
                    onClick={() => setMobileModalTab('notas')}
                    className={`px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${mobileModalTab === 'notas' ? 'bg-white text-[#006b5a] shadow-sm' : 'text-[#6d7a75]'}`}
                  >
                    Notas
                  </button>
                </div>
              </div>
            </div>

            <div className={`${mobileModalTab === 'notas' ? 'flex' : 'hidden'} lg:flex flex-1 flex-col min-w-0 min-h-0`}>
              <div className="hidden lg:flex px-5 py-4 border-b border-[#dee3e3] items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ backgroundColor: getAvatarColor(selected.nome) }}
                >
                  {getInitials(selected.nome)}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-[#083142] truncate">{selected.nome}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {selectedColumn && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{
                          color: getVisualColunaContato(selectedColumn).cor,
                          backgroundColor: getVisualColunaContato(selectedColumn).corBadgeBg,
                        }}
                      >
                        {selectedColumn.nome}
                      </span>
                    )}
                    {selected.telefone && (
                      <span className="text-xs text-[#6d7a75]">{selected.telefone}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="ml-auto p-1.5 rounded-lg hover:bg-[#f0f5f4] text-[#9BB0AD] hover:text-[#3d4945] transition-colors shrink-0"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {loadingNotas ? (
                  <div className="flex items-center justify-center h-24 text-sm text-[#9BB0AD]">
                    Carregando notas...
                  </div>
                ) : notas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 gap-2 text-[#9BB0AD]">
                    <StickyNote size={28} strokeWidth={1.5} />
                    <p className="text-sm">Nenhuma nota ainda. Adicione a primeira abaixo.</p>
                  </div>
                ) : (
                  notas.map((nota) => (
                    <div key={nota.id} className="bg-[#f0f5f4] rounded-xl px-4 py-3">
                      <p className="text-sm text-[#1A2E2B] whitespace-pre-wrap">{nota.texto}</p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-[11px] text-[#9BB0AD]">
                          {format(new Date(nota.criado_em), "dd 'de' MMM 'as' HH:mm", { locale: ptBR })}
                        </p>
                        {nota.autor_nome && (
                          <p className="text-[10px] font-semibold text-[#006b5a] bg-white px-2 py-1 rounded">
                            {nota.autor_nome}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="px-5 py-3 border-t border-[#dee3e3] flex gap-2">
                <input
                  type="text"
                  value={novaNotaTexto}
                  onChange={(e) => setNovaNotaTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void handleAddNota()
                    }
                  }}
                  placeholder="Adicionar nota de contato..."
                  className="flex-1 border border-[#dee3e3] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#006b5a] bg-[#f0f5f4]/50"
                />
                <button
                  onClick={() => void handleAddNota()}
                  disabled={!novaNotaTexto.trim()}
                  className="px-3 py-2 bg-[#006b5a] text-white rounded-lg hover:bg-[#004f43] transition-colors disabled:opacity-40 flex items-center gap-1.5 text-sm font-semibold"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>

            <div className={`${mobileModalTab === 'detalhes' ? 'block' : 'hidden'} lg:block lg:w-96 flex-none border-t lg:border-t-0 lg:border-l border-[#dee3e3] bg-[#f0f5f4]/40 p-4 lg:p-5 space-y-4 lg:space-y-5 overflow-y-auto max-h-[95vh] lg:max-h-none`}>
              <div>
                <p className="text-[10px] text-[#9BB0AD] font-semibold uppercase tracking-wider mb-1.5">Etapa</p>
                <select
                  value={selected.kanban_coluna_chave}
                  onChange={(e) => {
                    const nextKey = e.target.value
                    setSelected((prev) => {
                      if (!prev) return null
                      const targetColumn = getColumnByKey(nextKey)
                      if (!targetColumn) return prev
                      return {
                        ...prev,
                        kanban_coluna_chave: targetColumn.chave,
                        status: targetColumn.status_base,
                      }
                    })
                    startTransition(async () => {
                      await moveContato(selected.id, nextKey)
                    })
                  }}
                  className="w-full border border-[#dee3e3] rounded-lg px-2.5 py-2 text-sm text-[#1A2E2B] focus:outline-none focus:border-[#006b5a] bg-white"
                >
                  {columns.map((column) => (
                    <option key={column.chave} value={column.chave}>
                      {column.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-[10px] text-[#9BB0AD] font-semibold uppercase tracking-wider mb-1.5">Responsavel</p>
                <select
                  value={selected.responsavel_id ?? ''}
                  onChange={(e) => void handleResponsavelChange(e.target.value)}
                  className="w-full border border-[#dee3e3] rounded-lg px-2.5 py-2 text-sm text-[#1A2E2B] focus:outline-none focus:border-[#006b5a] bg-white"
                >
                  <option value="">Sem responsavel</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-[10px] text-[#9BB0AD] font-semibold uppercase tracking-wider mb-1.5">Ultimo atendimento</p>
                {selected.ultimo_atendimento_data ? (
                  <>
                    <p className="text-sm font-semibold text-[#1A2E2B]">
                      {format(new Date(selected.ultimo_atendimento_data), "dd 'de' MMM, yyyy", { locale: ptBR })}
                    </p>
                    {selected.ultimo_atendimento_tipo && (
                      <p className="text-xs text-[#6d7a75] mt-0.5">{selected.ultimo_atendimento_tipo}</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-[#9BB0AD]">Nenhum registro</p>
                )}
              </div>

              {selected.telefone && (
                <div>
                  <p className="text-[10px] text-[#9BB0AD] font-semibold uppercase tracking-wider mb-2">Contato rapido</p>
                  <a
                    href={whatsappLink(selected.telefone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 w-full px-3 py-2 bg-[#25D366] text-white rounded-lg text-xs font-bold hover:bg-[#1da851] transition-colors"
                  >
                    <MessageCircle size={13} />
                    WhatsApp
                  </a>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] text-[#9BB0AD] font-semibold uppercase tracking-wider">Mensagem pronta</p>
                  <a
                    href="/confirmacoes/mensagens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-0.5 text-[10px] text-[#006b5a] hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Gerenciar
                    <ExternalLink size={9} />
                  </a>
                </div>

                {templates.length === 0 ? (
                  <p className="text-xs text-[#9BB0AD]">Nenhum template cadastrado.</p>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={() => setTemplatePickerOpen((value) => !value)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-white border border-[#dee3e3] rounded-lg text-xs font-medium text-[#1A2E2B] hover:border-[#006b5a]/40 transition-colors"
                    >
                      <span>Escolher modelo</span>
                      <ChevronDown size={13} className={`transition-transform ${templatePickerOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {templatePickerOpen && selected.telefone && (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {templates.map((t) => (
                          <div
                            key={t.id}
                            className="bg-white border border-[#dee3e3] rounded-lg p-3 hover:border-[#25D366]/50 hover:bg-[#f0fdf9] transition-colors cursor-pointer"
                          >
                            <a
                              href={whatsappLinkComMsg(selected.telefone, interpolarTemplate(t.conteudo, selected))}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-start gap-2"
                            >
                              <MessageCircle size={14} className="shrink-0 mt-1 text-[#25D366]" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-[#1A2E2B]">{t.nome}</p>
                                <p className="text-[10px] text-[#9BB0AD] mt-1.5 whitespace-pre-wrap leading-relaxed line-clamp-4">
                                  {interpolarTemplate(t.conteudo, selected)}
                                </p>
                              </div>
                            </a>
                          </div>
                        ))}
                      </div>
                    )}

                    {templatePickerOpen && !selected.telefone && (
                      <p className="text-xs text-[#9BB0AD] px-1">Paciente sem telefone cadastrado.</p>
                    )}
                  </div>
                )}
              </div>

              {selected.email && (
                <div>
                  <p className="text-[10px] text-[#9BB0AD] font-semibold uppercase tracking-wider mb-1.5">Email</p>
                  <p className="text-xs text-[#1A2E2B] break-all">{selected.email}</p>
                </div>
              )}

              {!selected.telefone && !selected.email && (
                <div className="flex flex-col items-center gap-2 py-4 text-[#9BB0AD]">
                  <UserCircle2 size={28} strokeWidth={1.5} />
                  <p className="text-xs text-center">Nenhum contato cadastrado</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {canManageColumns && columnsModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#171d1c]/45 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => {
            setColumnsModalOpen(false)
            setColumnForm(defaultColumnForm())
          }}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-3xl max-h-[92vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle — mobile only */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
              <div className="w-10 h-1 rounded-full bg-[#dee3e3]" />
            </div>

            {/* Header */}
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-[#dee3e3] flex items-center gap-3 shrink-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#f0fcf9] text-[#006b5a] flex items-center justify-center shrink-0">
                <Settings2 size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-[#083142] text-sm sm:text-base">Gerenciar colunas</h3>
                <p className="text-xs text-[#6d7a75] hidden sm:block">Colunas padrao tambem podem mudar de ordem. Apenas colunas customizadas podem ser editadas ou removidas quando estiverem vazias.</p>
              </div>
              <button
                onClick={() => {
                  setColumnsModalOpen(false)
                  setColumnForm(defaultColumnForm())
                }}
                className="p-1.5 rounded-lg hover:bg-[#f0f5f4] text-[#9BB0AD] shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {/* Tabs — mobile only */}
            <div className="sm:hidden px-4 pt-3 shrink-0">
              <div className="grid grid-cols-2 gap-1.5 bg-[#f0f5f4] p-1 rounded-xl">
                <button
                  onClick={() => setColumnModalTab('lista')}
                  className={`py-2.5 rounded-lg text-xs font-semibold transition-colors ${columnModalTab === 'lista' ? 'bg-white text-[#006b5a] shadow-sm' : 'text-[#6d7a75]'}`}
                >
                  Colunas ({columns.length})
                </button>
                <button
                  onClick={() => setColumnModalTab('form')}
                  className={`py-2.5 rounded-lg text-xs font-semibold transition-colors ${columnModalTab === 'form' ? 'bg-white text-[#006b5a] shadow-sm' : 'text-[#6d7a75]'}`}
                >
                  {columnForm.chave ? 'Editar coluna' : 'Nova coluna'}
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-hidden flex flex-col sm:grid sm:grid-cols-[1.2fr_0.8fr] min-h-0">
              {/* Lista de colunas */}
              <div className={`${columnModalTab === 'lista' ? 'flex' : 'hidden'} sm:flex flex-col p-4 sm:p-5 sm:border-r border-[#dee3e3] gap-2.5 overflow-y-auto`}>
                {columns.map((column, index) => {
                  const visual = getVisualColunaContato(column)
                  return (
                    <div key={column.chave} className="border border-[#dee3e3] rounded-xl p-3 bg-[#f9faf8]">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: visual.corBg, color: visual.cor }}>
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
                            onClick={() => void handleMoveColumn(column, 'left')}
                            className="w-8 h-8 rounded-lg bg-white border border-[#dee3e3] hover:border-[#006b5a]/40 text-[#6d7a75] flex items-center justify-center"
                            title="Mover para a esquerda"
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <button
                            onClick={() => void handleMoveColumn(column, 'right')}
                            className="w-8 h-8 rounded-lg bg-white border border-[#dee3e3] hover:border-[#006b5a]/40 text-[#6d7a75] flex items-center justify-center"
                            title="Mover para a direita"
                          >
                            <ChevronRight size={14} />
                          </button>
                          {column.tipo === 'custom' && (
                            <>
                              <button
                                onClick={() => { openEditColumnModal(column); setColumnModalTab('form') }}
                                className="w-8 h-8 rounded-lg bg-white border border-[#dee3e3] hover:border-[#006b5a]/40 text-[#6d7a75] flex items-center justify-center"
                                title="Editar"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => void handleDeleteColumn(column)}
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

                {/* Botão nova coluna — no final da lista, só mobile */}
                <button
                  onClick={() => { setColumnForm(defaultColumnForm()); setColumnModalTab('form') }}
                  className="sm:hidden w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-[#dee3e3] text-sm font-semibold text-[#6d7a75] hover:border-[#006b5a]/40 hover:text-[#006b5a] transition-colors"
                >
                  <Plus size={15} />
                  Nova coluna
                </button>
              </div>

              {/* Formulário */}
              <div className={`${columnModalTab === 'form' ? 'flex' : 'hidden'} sm:flex flex-col p-4 sm:p-5 gap-4 overflow-y-auto`}>
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-[#1A2E2B] text-sm">
                    {columnForm.chave ? 'Editar coluna' : 'Nova coluna'}
                  </h4>
                  {columnForm.chave && (
                    <button
                      onClick={() => { setColumnForm(defaultColumnForm()) }}
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
                    onChange={(e) => setColumnForm((prev) => ({ ...prev, nome: e.target.value }))}
                    placeholder="Ex: Retorno em 3 dias"
                    className="w-full border border-[#dee3e3] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#006b5a]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#6d7a75] mb-1.5">Categoria do Relatorio</label>
                  <select
                    value={columnForm.statusBase}
                    onChange={(e) => setColumnForm((prev) => ({ ...prev, statusBase: e.target.value as StatusContato }))}
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
                        onClick={() => setColumnForm((prev) => ({ ...prev, corChave: option.key }))}
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

                <button
                  onClick={() => void handleSaveColumn()}
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
      )}
    </div>
  )
}
