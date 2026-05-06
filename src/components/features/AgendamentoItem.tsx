'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  Phone, Mail, Calendar, Clock, ChevronDown,
  CheckCircle, Hourglass, Stethoscope, CheckCheck, XCircle, UserX, RefreshCw, User, CalendarClock,
  MessageCircle, Pencil, Trash2, MapPin, ClipboardList
} from 'lucide-react'
import {
  mudarStatusAgendamento,
  contarAtendimentosPaciente,
  deletarAgendamento,
  deletarAtendimentoPontualDaRecorrencia,
  deletarTodasRecorrencias,
  buscarDetalhesAgendamento,
} from '@/actions/agenda'
import { MenuAcoesAgendamento } from './MenuAcoesAgendamento'
import { SlideNovoAgendamento } from './SlideNovoAgendamento'
import { ProntuarioEvolucao } from './ProntuarioEvolucao'
import { formatAppDateLabel, formatAppTime } from '@/lib/datetime'

type Paciente = { id: string; nome: string }
type Profissional = { id: string; nome: string; cargo: string }

export type AgendamentoDetalhe = {
  id: string
  paciente_id: string
  profissional_id?: string | null
  agendamento_id?: string | null
  data_agendamento: string
  status: string
  tipo: string
  duracao_minutos?: number | null
  observacoes?: string | null
  numero_sessao?: number | null
  total_sessoes?: number | null
  pacientes: { nome: string; telefone?: string | null; email?: string | null } | null
  profissional?: { full_name?: string | null; role?: string | null } | null
}

const STATUS_CONFIG: Record<string, { cardBg: string; border: string; iconText: string; titleText: string; subText: string; badgeBg: string; label: string; Icon: React.ElementType }> = {
  'confirmado':     { cardBg: 'bg-green-50',   border: 'border-green-600',  iconText: 'text-green-700',  titleText: 'text-green-900',  subText: 'text-green-800/70',  badgeBg: 'bg-green-600',  label: 'Confirmado',  Icon: User },
  'aguardando':     { cardBg: 'bg-amber-50',   border: 'border-amber-500',  iconText: 'text-amber-600',  titleText: 'text-amber-900',  subText: 'text-amber-800/70',  badgeBg: 'bg-amber-500',  label: 'Aguardando',  Icon: Hourglass },
  'em atendimento': { cardBg: 'bg-blue-50',    border: 'border-blue-600',   iconText: 'text-blue-600',   titleText: 'text-blue-900',   subText: 'text-blue-800/70',   badgeBg: 'bg-blue-600',   label: 'Em Atend.',   Icon: Stethoscope },
  'concluído':      { cardBg: 'bg-violet-50',  border: 'border-violet-600', iconText: 'text-violet-600', titleText: 'text-violet-900', subText: 'text-violet-800/70', badgeBg: 'bg-violet-600', label: 'Concluído',   Icon: CheckCheck },
  'concluÃ­do':      { cardBg: 'bg-violet-50',  border: 'border-violet-600', iconText: 'text-violet-600', titleText: 'text-violet-900', subText: 'text-violet-800/70', badgeBg: 'bg-violet-600', label: 'Concluído',   Icon: CheckCheck },
  'cancelado':      { cardBg: 'bg-red-50',     border: 'border-red-600',    iconText: 'text-red-600',    titleText: 'text-red-900',    subText: 'text-red-800/70',    badgeBg: 'bg-red-600',    label: 'Cancelado',   Icon: XCircle },
  'falta':          { cardBg: 'bg-gray-100',   border: 'border-gray-500',   iconText: 'text-gray-500',   titleText: 'text-gray-800',   subText: 'text-gray-600/70',   badgeBg: 'bg-gray-500',   label: 'Falta',       Icon: UserX },
  'reposição':      { cardBg: 'bg-cyan-50',    border: 'border-cyan-600',   iconText: 'text-cyan-600',   titleText: 'text-cyan-900',   subText: 'text-cyan-800/70',   badgeBg: 'bg-cyan-600',   label: 'Reposição',   Icon: RefreshCw },
  'reposiÃ§Ã£o':      { cardBg: 'bg-cyan-50',    border: 'border-cyan-600',   iconText: 'text-cyan-600',   titleText: 'text-cyan-900',   subText: 'text-cyan-800/70',   badgeBg: 'bg-cyan-600',   label: 'Reposição',   Icon: RefreshCw },
  'reagendado':     { cardBg: 'bg-orange-50',  border: 'border-orange-500', iconText: 'text-orange-600', titleText: 'text-orange-900', subText: 'text-orange-800/70', badgeBg: 'bg-orange-500', label: 'Reagendado',  Icon: CalendarClock },
}
const CONFIG_DEFAULT = { cardBg: 'bg-gray-100', border: 'border-gray-400', iconText: 'text-gray-500', titleText: 'text-gray-800', subText: 'text-gray-600', badgeBg: 'bg-gray-400', label: 'Agendado', Icon: CheckCircle }

const OPCOES_STATUS = [
  { valor: 'Confirmado', Icon: CheckCircle, cor: 'text-[#006b5a]' },
  { valor: 'Aguardando', Icon: Hourglass, cor: 'text-[#6d7a75]' },
  { valor: 'Em Atendimento', Icon: Stethoscope, cor: 'text-[#406375]' },
  { valor: 'Concluído', Icon: CheckCheck, cor: 'text-[#4f625d]' },
  { valor: 'Cancelado', Icon: XCircle, cor: 'text-[#ba1a1a]' },
  { valor: 'Falta', Icon: UserX, cor: 'text-[#3d4945]' },
  { valor: 'Reposição', Icon: RefreshCw, cor: 'text-[#779aad]' },
]

function getConfig(status: string) {
  return STATUS_CONFIG[status?.toLowerCase()] || CONFIG_DEFAULT
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function Modal({ agendamento, onClose, onEditar }: { agendamento: AgendamentoDetalhe; onClose: () => void; onEditar: () => void }) {
  const router = useRouter()
  const [status, setStatus] = useState(agendamento.status)
  const [activeTab, setActiveTab] = useState<'detalhes' | 'evolucao'>('detalhes')
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showOpcoes, setShowOpcoes] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [statusMenuPos, setStatusMenuPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const [contagem, setContagem] = useState<{ total: number; cancelados: number } | null>(null)
  const opcoesRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLDivElement>(null)
  const statusMenuRef = useRef<HTMLDivElement>(null)
  const [detalhesExtras, setDetalhesExtras] = useState<{
    telefone?: string | null
    email?: string | null
    full_name?: string | null
    role?: string | null
    duracao_minutos?: number | null
    observacoes?: string | null
  } | null>(null)

  const isRecorrente = !!(agendamento.agendamento_id && (agendamento.total_sessoes ?? 0) > 1)
  const nomePaciente = agendamento.pacientes?.nome || 'Paciente'
  const inicial = nomePaciente.charAt(0).toUpperCase()
  const dataObj = new Date(agendamento.data_agendamento)
  const telefone = detalhesExtras?.telefone ?? agendamento.pacientes?.telefone
  const emailPaciente = detalhesExtras?.email ?? agendamento.pacientes?.email
  const nomeProfissional = detalhesExtras?.full_name ?? agendamento.profissional?.full_name
  const roleProfissional = detalhesExtras?.role ?? agendamento.profissional?.role
  const duracaoMinutos = detalhesExtras?.duracao_minutos ?? agendamento.duracao_minutos
  const observacoes = detalhesExtras?.observacoes ?? agendamento.observacoes
  const horaInicio = formatAppTime(dataObj)
  const horaFim = duracaoMinutos ? formatAppTime(new Date(dataObj.getTime() + duracaoMinutos * 60000)) : null
  const dataFormatada = formatAppDateLabel(dataObj)
  const precisaCarregarDetalhes = telefone == null
    && emailPaciente == null
    && roleProfissional == null
    && duracaoMinutos == null
    && observacoes == null

  useEffect(() => {
    contarAtendimentosPaciente(agendamento.paciente_id).then(setContagem)
  }, [agendamento.paciente_id])

  useEffect(() => {
    setDetalhesExtras(null)
  }, [agendamento.id])

  useEffect(() => {
    if (!precisaCarregarDetalhes) return

    let active = true
    setLoadingDetalhes(true)

    buscarDetalhesAgendamento(agendamento.id).then((result) => {
      if (!active) return
      if (!result || 'error' in result || !result.data) {
        setLoadingDetalhes(false)
        return
      }

      const paciente = firstRelation(result.data.pacientes as AgendamentoDetalhe['pacientes'] | AgendamentoDetalhe['pacientes'][])
      const profissional = firstRelation(result.data.profissional as AgendamentoDetalhe['profissional'] | AgendamentoDetalhe['profissional'][])

      setDetalhesExtras({
        telefone: paciente?.telefone ?? null,
        email: paciente?.email ?? null,
        full_name: profissional?.full_name ?? null,
        role: profissional?.role ?? null,
        duracao_minutos: result.data.duracao_minutos ?? null,
        observacoes: result.data.observacoes ?? null,
      })
      setLoadingDetalhes(false)
    })

    return () => {
      active = false
    }
  }, [agendamento.id, precisaCarregarDetalhes])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (opcoesRef.current && !opcoesRef.current.contains(e.target as Node)) {
        setShowOpcoes(false)
        setConfirmandoExclusao(false)
      }

      if (
        statusRef.current && !statusRef.current.contains(e.target as Node) &&
        statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)
      ) {
        setShowStatusMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function toggleStatusMenu() {
    if (!showStatusMenu && statusRef.current) {
      const rect = statusRef.current.getBoundingClientRect()
      setStatusMenuPos({
        top: Math.max(8, rect.top - 6),
        left: rect.left,
        width: rect.width,
      })
    }

    setShowStatusMenu((prev) => !prev)
  }

  async function handleStatusChange(novoStatus: string) {
    setLoading(true)
    setShowStatusMenu(false)
    await mudarStatusAgendamento(agendamento.id, novoStatus)
    setStatus(novoStatus)
    setLoading(false)
    router.refresh()
  }

  async function handleExcluir(escopo?: 'unico' | 'todos') {
    if (!confirmandoExclusao) {
      setConfirmandoExclusao(true)
      return
    }

    if (isRecorrente && !escopo) return

    setLoading(true)

    if (escopo === 'todos' && agendamento.agendamento_id) {
      await deletarTodasRecorrencias(agendamento.agendamento_id)
    } else if (isRecorrente && escopo === 'unico') {
      await deletarAtendimentoPontualDaRecorrencia(agendamento.id)
    } else {
      await deletarAgendamento(agendamento.id)
    }

    router.refresh()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 flex flex-col max-h-[90dvh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-[#006b5a] flex items-center justify-center text-white text-2xl font-bold shrink-0">
              {inicial}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-[#083142]">{nomePaciente}</h3>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                <span className="flex items-center gap-1.5 text-xs text-[#6d7a75]">
                  <Phone size={12} />
                  {loadingDetalhes ? 'Carregando...' : (telefone || 'Sem informacao')}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-[#6d7a75]">
                  <Mail size={12} />
                  {loadingDetalhes ? 'Carregando...' : (emailPaciente || 'Sem informacao')}
                </span>
              </div>
              {contagem !== null && (
                <p className="text-xs font-bold text-[#006b5a] mt-1.5">
                  {contagem.total} atendimento{contagem.total !== 1 ? 's' : ''} no total
                  {contagem.cancelados > 0 && (
                    <span className="text-slate-400 font-normal">
                      {' '}· {contagem.cancelados} falta{contagem.cancelados !== 1 ? 's' : ''}/cancelamento{contagem.cancelados !== 1 ? 's' : ''}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => { router.push('/confirmacoes/cards'); onClose() }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-[#bcc9c4] text-xs font-semibold text-[#3d4945] hover:bg-[#f0f5f4] transition-colors"
            >
              <MessageCircle size={14} className="text-[#25d366]" />
              Enviar Lembrete
            </button>

            <div className="relative flex-1" ref={opcoesRef}>
              <button
                onClick={() => { setShowOpcoes((prev) => !prev); setConfirmandoExclusao(false) }}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-[#bcc9c4] text-sm font-semibold text-[#3d4945] hover:bg-[#f0f5f4] transition-colors"
              >
                Opcoes
                <ChevronDown size={14} />
              </button>
              {showOpcoes && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-[#bcc9c4]/40 rounded-xl shadow-lg py-1.5 z-30">
                  <button
                    onClick={() => { setShowOpcoes(false); onEditar() }}
                    className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-[#171d1c] hover:bg-[#f0f5f4] transition-colors"
                  >
                    <Pencil size={15} className="text-[#3d4945]" />
                    Editar
                  </button>
                  <button
                    onClick={() => { router.push(`/pacientes/${agendamento.paciente_id}`); setShowOpcoes(false) }}
                    className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-[#171d1c] hover:bg-[#f0f5f4] transition-colors"
                  >
                    <User size={15} className="text-[#3d4945]" />
                    Ver jornada do paciente
                  </button>

                  <div className="h-px bg-[#bcc9c4]/30 my-1" />

                  {confirmandoExclusao && isRecorrente ? (
                    <div className="px-3 py-2 space-y-1">
                      <p className="text-[11px] font-bold text-slate-400 px-1 pb-1">Excluir:</p>
                      <button
                        onClick={() => handleExcluir('unico')}
                        disabled={loading}
                        className="w-full px-3 py-2.5 text-sm font-medium text-[#ba1a1a] hover:bg-[#fbeaea] transition-colors rounded-lg text-left disabled:opacity-50"
                      >
                        Apenas este agendamento
                      </button>
                      <button
                        onClick={() => handleExcluir('todos')}
                        disabled={loading}
                        className="w-full px-3 py-2.5 text-sm font-semibold text-[#ba1a1a] hover:bg-[#fbeaea] transition-colors rounded-lg text-left disabled:opacity-50"
                      >
                        Toda a recorrencia
                      </button>
                      <button
                        onClick={() => { setConfirmandoExclusao(false) }}
                        className="w-full px-3 py-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors text-center"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleExcluir()}
                      disabled={loading}
                      className="w-full px-4 py-2.5 flex items-center gap-3 text-sm font-semibold text-[#ba1a1a] hover:bg-[#fbeaea] transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={15} />
                      {confirmandoExclusao ? 'Clique para confirmar' : 'Excluir agendamento'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex border-y border-[#bcc9c4]/30 bg-[#f5faf9] shrink-0">
          <button
            onClick={() => setActiveTab('detalhes')}
            className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
              activeTab === 'detalhes'
                ? 'text-[#006b5a] border-b-2 border-[#006b5a] bg-white'
                : 'text-[#6d7a75] hover:text-[#3d4945]'
            }`}
          >
            Detalhes
          </button>
          <button
            onClick={() => setActiveTab('evolucao')}
            className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'evolucao'
                ? 'text-[#006b5a] border-b-2 border-[#006b5a] bg-white'
                : 'text-[#6d7a75] hover:text-[#3d4945]'
            }`}
          >
            <ClipboardList size={13} />
            Evolucao
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {activeTab === 'evolucao' ? (
            <ProntuarioEvolucao atendimentoId={agendamento.id} pacienteId={agendamento.paciente_id} />
          ) : (
            <>
              <div className="flex items-center gap-3">
                <MapPin size={16} className="text-[#006b5a] shrink-0" />
                <span className="text-sm font-medium text-[#3d4945]">{agendamento.tipo}</span>
                {agendamento.total_sessoes && agendamento.total_sessoes > 1 && (
                  <span className="text-xs font-bold px-2 py-0.5 bg-[#006b5a]/10 text-[#006b5a] rounded-full">
                    Sessao {agendamento.numero_sessao}/{agendamento.total_sessoes}
                  </span>
                )}
              </div>

              {nomeProfissional && (
                <div className="flex items-center gap-3">
                  <User size={16} className="text-[#006b5a] shrink-0" />
                  <span className="text-sm font-medium text-[#3d4945]">
                    {nomeProfissional}
                    {roleProfissional && <span className="text-[#6d7a75] ml-1">· {roleProfissional}</span>}
                  </span>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Calendar size={16} className="text-[#006b5a] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[#171d1c] capitalize">{dataFormatada}</p>
                  <p className="text-base font-bold text-[#083142]">
                    {horaInicio}{horaFim ? ` - ${horaFim}` : ''}
                  </p>
                </div>
              </div>

              {duracaoMinutos ? (
                <div className="flex items-center gap-3">
                  <Clock size={16} className="text-[#006b5a] shrink-0" />
                  <span className="text-sm font-medium text-[#3d4945]">{duracaoMinutos} minutos</span>
                </div>
              ) : null}

              {observacoes ? (
                <div className="bg-[#f0f5f4] rounded-xl p-3">
                  <p className="text-xs font-semibold text-[#6d7a75] mb-1">Observacoes</p>
                  <p className="text-sm text-[#3d4945]">{observacoes}</p>
                </div>
              ) : null}

              <div className="relative" ref={statusRef}>
                <label className="block text-xs font-bold text-[#6d7a75] mb-2">Status</label>
                <button
                  onClick={toggleStatusMenu}
                  disabled={loading}
                  className="w-full flex items-center justify-between border border-[#bcc9c4] rounded-xl px-4 py-2 text-sm font-semibold text-[#3d4945] hover:bg-[#f0f5f4] transition-colors"
                >
                  <span>{status || 'Agendado'}</span>
                  <ChevronDown size={14} />
                </button>
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#bcc9c4]/30 bg-[#f5faf9] flex justify-end rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-bold text-[#3d4945] bg-white border border-[#bcc9c4] hover:bg-[#dee3e3] transition-colors text-sm"
          >
            Fechar
          </button>
        </div>
      </div>

      {typeof document !== 'undefined' && showStatusMenu && statusMenuPos && createPortal(
        <div
          style={{
            position: 'fixed',
            top: statusMenuPos.top,
            left: statusMenuPos.left,
            width: Math.max(statusMenuPos.width, 190),
            zIndex: 9999,
            transform: 'translateY(-100%)',
          }}
          className="bg-white border border-[#bcc9c4] rounded-xl shadow-lg overflow-hidden"
          ref={statusMenuRef}
        >
          {OPCOES_STATUS.map(({ valor, Icon, cor }) => (
            <button
              key={valor}
              onClick={() => handleStatusChange(valor)}
              className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 text-sm font-medium text-[#3d4945] hover:bg-[#f0f5f4] transition-colors"
            >
              <Icon size={14} className={cor} />
              {valor}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

export function AgendamentoItemDia({ agendamento, pacientes, profissionais }: { agendamento: AgendamentoDetalhe; pacientes: Paciente[]; profissionais: Profissional[] }) {
  const [modalAberto, setModalAberto] = useState(false)
  const [slideEditarAberto, setSlideEditarAberto] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const config = getConfig(agendamento.status)
  const Icone = config.Icon
  const hora = formatAppTime(agendamento.data_agendamento)
  const nomePaciente = agendamento.pacientes?.nome || 'Paciente não identificado'

  return (
    <>
      <div className="grid grid-cols-[50px_1fr] sm:grid-cols-[72px_1fr] gap-2 sm:gap-3 group">
        <div className="text-xs sm:text-sm font-bold text-[#3d4945]/60 flex items-start justify-end pt-2">{hora}</div>
        <div className="relative py-3 border-t border-dashed border-[#bcc9c4]/50 flex items-center">
          <div
            onClick={() => setModalAberto(true)}
            className={`${config.cardBg} border-l-4 ${config.border} p-3 rounded-xl w-full flex items-center justify-between transition-transform cursor-pointer ${!isMenuOpen ? 'hover:scale-[1.01]' : ''}`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm ${config.iconText}`}>
                <Icone size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2 leading-none">
                  <p className={`text-sm font-bold ${config.titleText}`}>{nomePaciente}</p>
                  {agendamento.total_sessoes && agendamento.total_sessoes > 1 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-white/60 text-[#006b5a] rounded-full border border-[#006b5a]/20 whitespace-nowrap">
                      {agendamento.numero_sessao}/{agendamento.total_sessoes}
                    </span>
                  )}
                </div>
                <p className={`text-[11px] ${config.subText} mt-1 font-medium italic`}>{agendamento.tipo}</p>
                {agendamento.profissional?.full_name && (
                  <p className={`text-[11px] ${config.subText} mt-0.5 font-medium flex items-center gap-1`}>
                    <User size={10} className="shrink-0" />
                    {agendamento.profissional.full_name}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <span className={`hidden sm:inline-block px-3 py-1 ${config.badgeBg} text-white text-[10px] font-bold rounded-full uppercase tracking-widest`}>
                {config.label}
              </span>
              <div onClick={e => e.stopPropagation()}>
                <MenuAcoesAgendamento
                  id={agendamento.id}
                  statusAtual={agendamento.status}
                  onOpenChange={setIsMenuOpen}
                  atendimentoId={agendamento.id}
                  agendamentoId={agendamento.agendamento_id || undefined}
                  pacienteNome={nomePaciente}
                  dataAgendamento={agendamento.data_agendamento}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {modalAberto && (
        <Modal
          agendamento={agendamento}
          onClose={() => setModalAberto(false)}
          onEditar={() => { setModalAberto(false); setSlideEditarAberto(true) }}
        />
      )}

      <SlideNovoAgendamento
        pacientes={pacientes}
        profissionais={profissionais}
        controlledOpen={slideEditarAberto}
        onControlledClose={() => setSlideEditarAberto(false)}
        atendimentoParaEditar={slideEditarAberto ? agendamento : undefined}
      />
    </>
  )
}

export function AgendamentoItemSemana({ agendamento, pacientes, profissionais }: { agendamento: AgendamentoDetalhe; pacientes: Paciente[]; profissionais: Profissional[] }) {
  const [modalAberto, setModalAberto] = useState(false)
  const [slideEditarAberto, setSlideEditarAberto] = useState(false)
  const config = getConfig(agendamento.status)
  const primeiroNome = (agendamento.pacientes?.nome || 'Paciente').split(' ')[0]

  return (
    <>
      <div
        onClick={() => setModalAberto(true)}
        className={`${config.cardBg} border-l-4 ${config.border} p-2 rounded-lg mb-1 shadow-sm cursor-pointer hover:scale-[1.02] transition-transform`}
      >
        <p className={`text-[10px] font-bold ${config.titleText} truncate`}>{primeiroNome}</p>
        <p className={`text-[9px] ${config.subText} truncate`}>{agendamento.tipo}</p>
        {agendamento.profissional?.full_name && (
          <p className={`text-[9px] ${config.subText} truncate opacity-80`}>
            {agendamento.profissional.full_name.split(' ')[0]}
          </p>
        )}
      </div>

      {modalAberto && (
        <Modal
          agendamento={agendamento}
          onClose={() => setModalAberto(false)}
          onEditar={() => { setModalAberto(false); setSlideEditarAberto(true) }}
        />
      )}

      <SlideNovoAgendamento
        pacientes={pacientes}
        profissionais={profissionais}
        controlledOpen={slideEditarAberto}
        onControlledClose={() => setSlideEditarAberto(false)}
        atendimentoParaEditar={slideEditarAberto ? agendamento : undefined}
      />
    </>
  )
}
