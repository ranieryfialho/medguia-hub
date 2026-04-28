'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, X, MessageCircle, ChevronLeft, ChevronRight,
  Send, Clock, Calendar, UserCircle2, StickyNote, ChevronDown,
  ExternalLink,
} from 'lucide-react'
import {
  atualizarStatusContato,
  atualizarResponsavelContato,
  adicionarNota,
  buscarNotas,
} from '@/actions/contatos'
import type { StatusContato } from '@/actions/contatos'
import type { ContatoPaciente, ProfileSimples } from '@/app/(painel)/contatos/page'
import { format, differenceInCalendarDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
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

const INITIAL_PER_COLUMN = 50

// ─── Column config ───────────────────────────────────────────────────────────

type ColunaConfig = {
  status: StatusContato
  label: string
  cor: string
  corBg: string
  corBadgeBg: string
  corBadgeText: string
}

const COLUNAS: ColunaConfig[] = [
  {
    status: 'a_contactar',
    label: 'A Contatar',
    cor: '#6d7a75',
    corBg: '#f0f5f4',
    corBadgeBg: '#dee3e3',
    corBadgeText: '#3d4945',
  },
  {
    status: 'recuperacao_base',
    label: 'Recuperação de Base',
    cor: '#4f46e5',
    corBg: '#f5f3ff',
    corBadgeBg: '#ddd6fe',
    corBadgeText: '#3730a3',
  },
  {
    status: 'tentativa',
    label: 'Tentativa',
    cor: '#b45309',
    corBg: '#fffbeb',
    corBadgeBg: '#fef3c7',
    corBadgeText: '#92400e',
  },
  {
    status: 'em_conversa',
    label: 'Em Conversa',
    cor: '#006b5a',
    corBg: '#f0fcf9',
    corBadgeBg: '#c3ede6',
    corBadgeText: '#004f43',
  },
  {
    status: 'sem_interesse',
    label: 'Sem Interesse',
    cor: '#ba1a1a',
    corBg: '#fff5f5',
    corBadgeBg: '#fecaca',
    corBadgeText: '#991b1b',
  },
  {
    status: 'agendou',
    label: 'Agendou',
    cor: '#1AAF9A',
    corBg: '#f0fdf9',
    corBadgeBg: '#99f6e4',
    corBadgeText: '#0f766e',
  },
]

// ─── Main component ──────────────────────────────────────────────────────────

export function KanbanContatos({
  contatos: initialContatos,
  profiles,
  templates,
}: {
  contatos: ContatoPaciente[]
  profiles: ProfileSimples[]
  templates: Template[]
}) {
  const [contatos, setContatos] = useState<ContatoPaciente[]>(initialContatos)
  const [search, setSearch] = useState('')
  const [responsavelFilter, setResponsavelFilter] = useState<string | null>(null)
  const [activeColuna, setActiveColuna] = useState<StatusContato>('a_contactar')
  const [visibleCount, setVisibleCount] = useState<Record<StatusContato, number>>(
    () => Object.fromEntries(COLUNAS.map(c => [c.status, INITIAL_PER_COLUMN])) as Record<StatusContato, number>
  )
  const [selected, setSelected] = useState<ContatoPaciente | null>(null)
const [notas, setNotas] = useState<Nota[]>([])
  const [loadingNotas, setLoadingNotas] = useState(false)
  const [novaNotaTexto, setNovaNotaTexto] = useState('')
  const [templatePickerOpen, setTemplatePickerOpen] = useState(true)
  const [, startTransition] = useTransition()

  const router = useRouter()

  // Sincroniza estado local quando o servidor retorna dados novos (após router.refresh)
  useEffect(() => {
    setContatos(initialContatos)
  }, [initialContatos])

  // Refresh silencioso a cada 30s para evitar dois usuários atendendo o mesmo card
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh()
    }, 5_000)
    return () => clearInterval(interval)
  }, [router])

  // Carrega notas quando abre modal
  useEffect(() => {
    if (!selected) return
    setLoadingNotas(true)
    setNotas([])
    setTemplatePickerOpen(true)
    buscarNotas(selected.id).then(data => {
      setNotas(data as Nota[])
      setLoadingNotas(false)
    })
  }, [selected?.id])

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(Object.fromEntries(COLUNAS.map(c => [c.status, INITIAL_PER_COLUMN])) as Record<StatusContato, number>)
  }, [search, responsavelFilter])

  // Filtragem
  const filtered = contatos.filter(c => {
    if (search && !c.nome.toLowerCase().includes(search.toLowerCase())) return false
    if (responsavelFilter === '__none__' && c.responsavel_id !== null) return false
    if (responsavelFilter && responsavelFilter !== '__none__' && c.responsavel_id !== responsavelFilter) return false
    return true
  })

  // Todos os profiles com contagem de cards
  const profilesComContagem = profiles.map(p => ({
    ...p,
    count: contatos.filter(c => c.responsavel_id === p.id).length,
  }))
  const semResponsavelCount = contatos.filter(c => c.responsavel_id === null).length

  // ── Handlers ──

  function moverStatus(pacienteId: string, novoStatus: StatusContato) {
    setContatos(prev =>
      prev.map(c => c.id === pacienteId ? { ...c, status: novoStatus } : c)
    )
    if (selected?.id === pacienteId) {
      setSelected(prev => prev ? { ...prev, status: novoStatus } : null)
    }
    startTransition(async () => {
      await atualizarStatusContato(pacienteId, novoStatus)
    })
  }

  function moverEsquerda(pacienteId: string, status: StatusContato) {
    const idx = COLUNAS.findIndex(c => c.status === status)
    if (idx > 0) moverStatus(pacienteId, COLUNAS[idx - 1].status)
  }

  function moverDireita(pacienteId: string, status: StatusContato) {
    const idx = COLUNAS.findIndex(c => c.status === status)
    if (idx < COLUNAS.length - 1) moverStatus(pacienteId, COLUNAS[idx + 1].status)
  }

  async function handleResponsavelChange(responsavelId: string) {
    if (!selected) return
    const nomeResponsavel = responsavelId
      ? profiles.find(p => p.id === responsavelId)?.full_name ?? null
      : null
    const update = { responsavel_id: responsavelId || null, responsavel_nome: nomeResponsavel }
    setContatos(prev => prev.map(c => c.id === selected.id ? { ...c, ...update } : c))
    setSelected(prev => prev ? { ...prev, ...update } : null)
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

  const colConfig = selected ? COLUNAS.find(c => c.status === selected.status) : null

  return (
    <div className="space-y-4">
      {/* ── Filter bar ── */}
      <div className="bg-white rounded-xl border border-[#dee3e3] px-4 py-3 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BB0AD]" />
          <input
            type="text"
            placeholder="Buscar paciente pelo nome..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-[#dee3e3] rounded-lg text-sm focus:outline-none focus:border-[#006b5a] text-[#1A2E2B] bg-[#f0f5f4]/50"
          />
        </div>

        {profiles.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[#9BB0AD] font-medium whitespace-nowrap">Responsáveis</span>
            <div className="flex gap-1 flex-wrap">
              {/* Sem responsável */}
              <button
                onClick={() => setResponsavelFilter(responsavelFilter === '__none__' ? null : '__none__')}
                className={`relative w-8 h-8 rounded-full border-2 border-dashed flex items-center justify-center transition-all ${
                  responsavelFilter === '__none__'
                    ? 'border-[#006b5a] bg-[#f0fcf9] scale-110 ring-2 ring-offset-1 ring-[#006b5a]'
                    : 'border-[#bcc9c4] hover:border-[#9BB0AD]'
                }`}
                title="Sem responsável"
              >
                <UserCircle2 size={14} className="text-[#9BB0AD]" />
                {semResponsavelCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-[#dee3e3] text-[#3d4945] text-[9px] font-bold rounded-full flex items-center justify-center">
                    {semResponsavelCount > 99 ? '99+' : semResponsavelCount}
                  </span>
                )}
              </button>

              {profilesComContagem.map(p => (
                <button
                  key={p.id}
                  onClick={() => setResponsavelFilter(responsavelFilter === p.id ? null : p.id)}
                  style={{ backgroundColor: getAvatarColor(p.full_name) }}
                  className={`relative w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold transition-all ${
                    responsavelFilter === p.id
                      ? 'ring-2 ring-offset-2 ring-[#006b5a] scale-110'
                      : p.count === 0 ? 'opacity-30 hover:opacity-60' : 'opacity-80 hover:opacity-100'
                  }`}
                  title={`${p.full_name} (${p.count})`}
                >
                  {getInitials(p.full_name)}
                  {p.count > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-white/90 text-[#1A2E2B] text-[9px] font-bold rounded-full flex items-center justify-center shadow-sm">
                      {p.count > 99 ? '99+' : p.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {(search || responsavelFilter) && (
          <button
            onClick={() => { setSearch(''); setResponsavelFilter(null) }}
            className="flex items-center gap-1.5 text-xs text-[#6d7a75] hover:text-[#ba1a1a] transition-colors px-3 py-2 rounded-lg border border-[#dee3e3] hover:border-[#ba1a1a]/30"
          >
            <X size={12} />
            Limpar
          </button>
        )}

        <div className="ml-auto hidden lg:flex items-center gap-3">
          {COLUNAS.map(col => {
            const count = filtered.filter(c => c.status === col.status).length
            return (
              <span key={col.status} className="text-xs font-semibold" style={{ color: col.cor }}>
                {count}
              </span>
            )
          })}
          <span className="text-xs text-[#9BB0AD]">total: {filtered.length}</span>
        </div>
      </div>

      {/* ── Tabs mobile ── */}
      <div className="flex lg:hidden gap-1 overflow-x-auto pb-1 hide-scrollbar">
        {COLUNAS.map(col => {
          const count = filtered.filter(c => c.status === col.status).length
          return (
            <button
              key={col.status}
              onClick={() => setActiveColuna(col.status)}
              className={`flex-none flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeColuna === col.status
                  ? 'text-white shadow-sm'
                  : 'bg-white border border-[#dee3e3] text-[#6d7a75]'
              }`}
              style={activeColuna === col.status ? { backgroundColor: col.cor } : {}}
            >
              {col.label}
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={activeColuna === col.status
                  ? { backgroundColor: 'rgba(255,255,255,0.25)', color: 'white' }
                  : { backgroundColor: col.corBadgeBg, color: col.corBadgeText }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Kanban board (desktop: todas colunas / mobile: coluna ativa) ── */}
      <div className="flex gap-3 overflow-x-auto pb-4 items-start">
        {COLUNAS.map((col, colIdx) => {
          const cards = filtered.filter(c => c.status === col.status)
          const limit = search || responsavelFilter ? cards.length : visibleCount[col.status]
          const visibleCards = cards.slice(0, limit)
          const hiddenCount = cards.length - visibleCards.length
          const isMobileHidden = col.status !== activeColuna

          return (
            <div
              key={col.status}
              className={`flex-none w-full lg:w-[290px] ${isMobileHidden ? 'hidden lg:block' : ''}`}
            >
              {/* Column header */}
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-t-xl border border-b-0"
                style={{ borderColor: col.cor + '30', backgroundColor: col.corBg }}
              >
                <span
                  className="w-2 h-2 rounded-full flex-none"
                  style={{ backgroundColor: col.cor }}
                />
                <span className="font-bold text-sm flex-1" style={{ color: col.cor }}>
                  {col.label}
                </span>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: col.corBadgeBg, color: col.corBadgeText }}
                >
                  {cards.length}
                </span>
              </div>

              {/* Cards list */}
              <div
                className="border border-t-0 rounded-b-xl p-2 space-y-2 overflow-y-auto"
                style={{
                  borderColor: col.cor + '30',
                  backgroundColor: col.corBg + 'CC',
                  minHeight: '120px',
                  maxHeight: 'calc(100vh - 300px)',
                }}
              >
                {cards.length === 0 ? (
                  <div className="flex items-center justify-center h-16 text-xs text-[#9BB0AD]">
                    Vazio
                  </div>
                ) : (
                  visibleCards.map(contato => {
                    const dias = diasDesde(contato.ultimo_atendimento_data)
                    const cor = dias !== null ? diasCor(dias) : '#9BB0AD'

                    return (
                      <div
                        key={contato.id}
                        onClick={() => setSelected(contato)}
                        className="bg-white rounded-lg border border-[#dee3e3] p-3.5 cursor-pointer hover:border-[#006b5a]/40 hover:shadow-sm transition-all group"
                      >
                        {/* Avatar + Nome + WhatsApp */}
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
                              onClick={e => e.stopPropagation()}
                              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/25 transition-colors opacity-0 group-hover:opacity-100"
                              title="Abrir WhatsApp"
                            >
                              <MessageCircle size={13} />
                            </a>
                          )}
                        </div>

                        {/* Telefone */}
                        {contato.telefone && (
                          <div className="flex items-center gap-1.5 text-xs text-[#6d7a75] mb-2.5">
                            <MessageCircle size={11} className="shrink-0 text-[#25D366]" />
                            <span>{contato.telefone}</span>
                          </div>
                        )}

                        {/* Último atendimento + dias */}
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

                        {/* Responsável + mover */}
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

                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {colIdx > 0 && (
                              <button
                                onClick={e => { e.stopPropagation(); moverEsquerda(contato.id, contato.status) }}
                                className="w-5 h-5 flex items-center justify-center rounded bg-[#f0f5f4] hover:bg-[#dee3e3] text-[#6d7a75] transition-colors"
                                title="Mover para coluna anterior"
                              >
                                <ChevronLeft size={11} />
                              </button>
                            )}
                            {colIdx < COLUNAS.length - 1 && (
                              <button
                                onClick={e => { e.stopPropagation(); moverDireita(contato.id, contato.status) }}
                                className="w-5 h-5 flex items-center justify-center rounded bg-[#f0f5f4] hover:bg-[#dee3e3] text-[#6d7a75] transition-colors"
                                title="Mover para próxima coluna"
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
                    onClick={() => setVisibleCount(prev => ({ ...prev, [col.status]: prev[col.status] + INITIAL_PER_COLUMN }))}
                    className="w-full mt-1 py-2 text-xs font-semibold rounded-lg border border-dashed transition-colors"
                    style={{ borderColor: col.cor + '60', color: col.cor, backgroundColor: col.corBg }}
                  >
                    Ver mais {hiddenCount} →
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Modal ── */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-[#171d1c]/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-7xl max-h-[95vh] flex flex-col lg:flex-row overflow-hidden"
            onClick={e => e.stopPropagation()}
          >

            {/* Left: notas */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              {/* Modal header */}
              <div className="px-5 py-4 border-b border-[#dee3e3] flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ backgroundColor: getAvatarColor(selected.nome) }}
                >
                  {getInitials(selected.nome)}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-[#083142] truncate">{selected.nome}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {colConfig && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ color: colConfig.cor, backgroundColor: colConfig.corBadgeBg }}
                      >
                        {colConfig.label}
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

              {/* Notas */}
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
                  notas.map(nota => (
                    <div key={nota.id} className="bg-[#f0f5f4] rounded-xl px-4 py-3">
                      <p className="text-sm text-[#1A2E2B] whitespace-pre-wrap">{nota.texto}</p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-[11px] text-[#9BB0AD]">
                          {format(new Date(nota.criado_em), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
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

              {/* Add nota */}
              <div className="px-5 py-3 border-t border-[#dee3e3] flex gap-2">
                <input
                  type="text"
                  value={novaNotaTexto}
                  onChange={e => setNovaNotaTexto(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddNota() } }}
                  placeholder="Adicionar nota de contato..."
                  className="flex-1 border border-[#dee3e3] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#006b5a] bg-[#f0f5f4]/50"
                />
                <button
                  onClick={handleAddNota}
                  disabled={!novaNotaTexto.trim()}
                  className="px-3 py-2 bg-[#006b5a] text-white rounded-lg hover:bg-[#004f43] transition-colors disabled:opacity-40 flex items-center gap-1.5 text-sm font-semibold"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>

            {/* Right: details panel */}
            <div className="lg:w-96 flex-none border-t lg:border-t-0 lg:border-l border-[#dee3e3] bg-[#f0f5f4]/40 p-4 lg:p-5 space-y-4 lg:space-y-5 overflow-y-auto max-h-[45vh] lg:max-h-none">

              {/* Status */}
              <div>
                <p className="text-[10px] text-[#9BB0AD] font-semibold uppercase tracking-wider mb-1.5">Status</p>
                <select
                  value={selected.status}
                  onChange={e => moverStatus(selected.id, e.target.value as StatusContato)}
                  className="w-full border border-[#dee3e3] rounded-lg px-2.5 py-2 text-sm text-[#1A2E2B] focus:outline-none focus:border-[#006b5a] bg-white"
                >
                  {COLUNAS.map(col => (
                    <option key={col.status} value={col.status}>{col.label}</option>
                  ))}
                </select>
              </div>

              {/* Responsável */}
              <div>
                <p className="text-[10px] text-[#9BB0AD] font-semibold uppercase tracking-wider mb-1.5">Responsável</p>
                <select
                  value={selected.responsavel_id ?? ''}
                  onChange={e => handleResponsavelChange(e.target.value)}
                  className="w-full border border-[#dee3e3] rounded-lg px-2.5 py-2 text-sm text-[#1A2E2B] focus:outline-none focus:border-[#006b5a] bg-white"
                >
                  <option value="">Sem responsável</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
              </div>

              {/* Último atendimento */}
              <div>
                <p className="text-[10px] text-[#9BB0AD] font-semibold uppercase tracking-wider mb-1.5">Último atendimento</p>
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

              {/* Contato rápido */}
              {selected.telefone && (
                <div>
                  <p className="text-[10px] text-[#9BB0AD] font-semibold uppercase tracking-wider mb-2">Contato rápido</p>
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

              {/* Mensagens prontas */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] text-[#9BB0AD] font-semibold uppercase tracking-wider">Mensagem Pronta</p>
                  <a
                    href="/confirmacoes/mensagens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-0.5 text-[10px] text-[#006b5a] hover:underline"
                    onClick={e => e.stopPropagation()}
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
                      onClick={() => setTemplatePickerOpen(v => !v)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-white border border-[#dee3e3] rounded-lg text-xs font-medium text-[#1A2E2B] hover:border-[#006b5a]/40 transition-colors"
                    >
                      <span>Escolher modelo</span>
                      <ChevronDown size={13} className={`transition-transform ${templatePickerOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {templatePickerOpen && selected.telefone && (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {templates.map(t => (
                          <div
                            key={t.id}
                            className="bg-white border border-[#dee3e3] rounded-lg p-3 hover:border-[#25D366]/50 hover:bg-[#f0fdf9] transition-colors cursor-pointer"
                          >
                            <a
                              href={whatsappLinkComMsg(selected.telefone, interpolarTemplate(t.conteudo, selected))}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
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

              {/* Email */}
              {selected.email && (
                <div>
                  <p className="text-[10px] text-[#9BB0AD] font-semibold uppercase tracking-wider mb-1.5">Email</p>
                  <p className="text-xs text-[#1A2E2B] break-all">{selected.email}</p>
                </div>
              )}

              {/* Sem contato */}
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
    </div>
  )
}