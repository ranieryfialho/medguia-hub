'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  X, Phone, Mail, Calendar, Clock, ChevronDown,
  CheckCircle, Hourglass, Stethoscope, CheckCheck, XCircle, UserX, RefreshCw, User, CalendarClock,
  MessageCircle, Pencil, Trash2, MapPin
} from 'lucide-react'
import {
  mudarStatusAgendamento,
  contarAtendimentosPaciente,
  deletarAgendamento,
  deletarAtendimentoPontualDaRecorrencia,
  deletarTodasRecorrencias,
} from '@/actions/agenda'
import { MenuAcoesAgendamento } from './MenuAcoesAgendamento'
import { SlideNovoAgendamento } from './SlideNovoAgendamento'
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
  'cancelado':      { cardBg: 'bg-red-50',     border: 'border-red-600',    iconText: 'text-red-600',    titleText: 'text-red-900',    subText: 'text-red-800/70',    badgeBg: 'bg-red-600',    label: 'Cancelado',   Icon: XCircle },
  'falta':          { cardBg: 'bg-gray-100',   border: 'border-gray-500',   iconText: 'text-gray-500',   titleText: 'text-gray-800',   subText: 'text-gray-600/70',   badgeBg: 'bg-gray-500',   label: 'Falta',       Icon: UserX },
  'reposição':      { cardBg: 'bg-cyan-50',    border: 'border-cyan-600',   iconText: 'text-cyan-600',   titleText: 'text-cyan-900',   subText: 'text-cyan-800/70',   badgeBg: 'bg-cyan-600',   label: 'Reposição',   Icon: RefreshCw },
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

function Modal({ agendamento, onClose, onEditar }: { agendamento: AgendamentoDetalhe; onClose: () => void; onEditar: () => void }) {
  const router = useRouter()
  const [status, setStatus] = useState(agendamento.status)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showOpcoes, setShowOpcoes] = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [contagem, setContagem] = useState<{ total: number; cancelados: number } | null>(null)
  const opcoesRef = useRef<HTMLDivElement>(null)

  const isRecorrente = !!(agendamento.agendamento_id && (agendamento.total_sessoes ?? 0) > 1)

  const nomePaciente = agendamento.pacientes?.nome || 'Paciente'
  const inicial = nomePaciente.charAt(0).toUpperCase()
  const dataObj = new Date(agendamento.data_agendamento)
  const horaInicio = formatAppTime(dataObj)
  const horaFim = agendamento.duracao_minutos
    ? formatAppTime(new Date(dataObj.getTime() + agendamento.duracao_minutos * 60000))
    : null
  const dataFormatada = formatAppDateLabel(dataObj)

  const telefone = agendamento.pacientes?.telefone
  const nomeProfissional = agendamento.profissional?.full_name
  const roleProfissional = agendamento.profissional?.role

  useEffect(() => {
    contarAtendimentosPaciente(agendamento.paciente_id).then(setContagem)
  }, [agendamento.paciente_id])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (opcoesRef.current && !opcoesRef.current.contains(e.target as Node)) {
        setShowOpcoes(false)
        setConfirmandoExclusao(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

    // Para recorrente, aguarda escolha explícita do escopo
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
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
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
                  {telefone || 'Sem informação'}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-[#6d7a75]">
                  <Mail size={12} />
                  {agendamento.pacientes?.email || 'Sem informação'}
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
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#f0f5f4] text-[#3d4945] transition-colors shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          {/* Ações rápidas */}
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => { router.push('/confirmacoes/cards'); onClose() }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#bcc9c4] text-sm font-semibold text-[#3d4945] hover:bg-[#f0f5f4] transition-colors"
            >
              <MessageCircle size={15} className="text-[#25d366]" />
              Enviar lembrete – WhatsApp
            </button>

            <div className="relative ml-auto" ref={opcoesRef}>
              <button
                onClick={() => { setShowOpcoes(prev => !prev); setConfirmandoExclusao(false) }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#bcc9c4] text-sm font-semibold text-[#3d4945] hover:bg-[#f0f5f4] transition-colors"
              >
                Opções
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
                        Toda a recorrência
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

        <div className="h-px bg-[#bcc9c4]/30 mx-6" />

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Tipo + Sessão */}
          <div className="flex items-center gap-3">
            <MapPin size={16} className="text-[#006b5a] shrink-0" />
            <span className="text-sm font-medium text-[#3d4945]">{agendamento.tipo}</span>
            {agendamento.total_sessoes && agendamento.total_sessoes > 1 && (
              <span className="text-xs font-bold px-2 py-0.5 bg-[#006b5a]/10 text-[#006b5a] rounded-full">
                Sessão {agendamento.numero_sessao}/{agendamento.total_sessoes}
              </span>
            )}
          </div>

          {/* Profissional */}
          {nomeProfissional && (
            <div className="flex items-center gap-3">
              <User size={16} className="text-[#006b5a] shrink-0" />
              <span className="text-sm font-medium text-[#3d4945]">
                {nomeProfissional}
                {roleProfissional && <span className="text-[#6d7a75] ml-1">· {roleProfissional}</span>}
              </span>
            </div>
          )}

          {/* Data e hora */}
          <div className="flex items-start gap-3">
            <Calendar size={16} className="text-[#006b5a] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#171d1c] capitalize">{dataFormatada}</p>
              <p className="text-base font-bold text-[#083142]">
                {horaInicio}{horaFim ? ` – ${horaFim}` : ''}
              </p>
            </div>
          </div>

          {/* Duração */}
          {agendamento.duracao_minutos ? (
            <div className="flex items-center gap-3">
              <Clock size={16} className="text-[#006b5a] shrink-0" />
              <span className="text-sm font-medium text-[#3d4945]">{agendamento.duracao_minutos} minutos</span>
            </div>
          ) : null}

          {/* Observações */}
          {agendamento.observacoes ? (
            <div className="bg-[#f0f5f4] rounded-xl p-3">
              <p className="text-xs font-semibold text-[#6d7a75] mb-1">Observações</p>
              <p className="text-sm text-[#3d4945]">{agendamento.observacoes}</p>
            </div>
          ) : null}

          {/* Status */}
          <div className="relative">
            <button
              onClick={() => setShowStatusMenu(prev => !prev)}
              disabled={loading}
              className="flex items-center gap-2 border border-[#bcc9c4] rounded-xl px-4 py-2 text-sm font-semibold text-[#3d4945] hover:bg-[#f0f5f4] transition-colors"
            >
              <span>{status || 'Agendado'}</span>
              <ChevronDown size={14} />
            </button>
            {showStatusMenu && (
              <div className="absolute bottom-full left-0 mb-1 bg-white border border-[#bcc9c4] rounded-xl shadow-lg z-20 overflow-hidden min-w-[190px]">
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
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#bcc9c4]/30 bg-[#f5faf9] flex justify-end gap-3 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-bold text-[#3d4945] bg-white border border-[#bcc9c4] hover:bg-[#dee3e3] transition-colors text-sm"
          >
            Fechar
          </button>
          <button
            onClick={() => handleStatusChange('Confirmado')}
            disabled={loading || status?.toLowerCase() === 'confirmado'}
            className="px-5 py-2.5 rounded-xl font-bold text-white bg-[#006b5a] hover:bg-[#004f43] transition-colors text-sm disabled:opacity-50"
          >
            Confirmar paciente
          </button>
        </div>
      </div>
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
      <div className="grid grid-cols-[72px_1fr] gap-3 group">
        <div className="text-sm font-bold text-[#3d4945]/60 flex items-start justify-end pt-2">{hora}</div>
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
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 ${config.badgeBg} text-white text-[10px] font-bold rounded-full uppercase tracking-widest`}>
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
