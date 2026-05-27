'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  Phone, Mail, Calendar, Clock, ChevronDown,
  CheckCircle, Hourglass, Stethoscope, CheckCheck, XCircle, UserX, RefreshCw, User, CalendarClock, Timer,
  MessageCircle, Pencil, Trash2, MapPin, ClipboardList, Check
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  mudarStatusAgendamento,
  contarAtendimentosPaciente,
  buscarHistoricoPacienteResumo,
  deletarAgendamento,
  deletarAtendimentoPontualDaRecorrencia,
  deletarTodasRecorrencias,
  buscarDetalhesAgendamento,
  buscarAtendimentosPendentesRecorrencia,
  deletarAtendimentosSelecionados,
} from '@/actions/agenda'
import { MenuAcoesAgendamento } from './MenuAcoesAgendamento'
import { SlideNovoAgendamento } from './SlideNovoAgendamento'
import { ProntuarioEvolucao } from '../prontuarios'
import { ModalSessaoReposicao } from '../shared'
import { adicionarSessaoReposicao, criarAtendimentoReagendado, obterProximaData, registrarContato } from '@/actions/confirmacoes'
import { format } from 'date-fns'
import { formatAppDateLabel, formatAppTime } from '@/lib/datetime'
import { getAtendimentoStatusKey, normalizeAtendimentoStatus } from '@/lib/atendimento-status'
import type { PlanoSaude } from '@/actions/planos-saude'
import type { HistoricoPacienteResumo } from '@/actions/agenda'

type Paciente = { id: string; nome: string }
type Profissional = { id: string; nome: string; cargo: string }

export type AgendamentoDetalhe = {
  id: string
  paciente_id: string
  profissional_id?: string | null
  agendamento_id?: string | null
  agendamento_pai?: { plano_saude?: string | null; tipo?: string | null } | null
  data_agendamento: string
  created_at?: string | null
  status: string
  tipo: string
  duracao_minutos?: number | null
  observacoes?: string | null
  numero_sessao?: number | null
  total_sessoes?: number | null
  numero_sessao_tipo?: number | null
  total_sessoes_tipo?: number | null
  marcou_retorno?: boolean | null
  pacientes: { nome: string; telefone?: string | null; email?: string | null } | null
  profissional?: { full_name?: string | null; role?: string | null } | null
  criador?: { full_name?: string | null } | null
}

const STATUS_CONFIG: Record<string, { cardBg: string; border: string; iconText: string; titleText: string; subText: string; badgeBg: string; label: string; Icon: React.ElementType }> = {
  confirmado:          { cardBg: 'bg-green-50',  border: 'border-green-600',  iconText: 'text-green-700',  titleText: 'text-green-900',  subText: 'text-green-800/70',  badgeBg: 'bg-green-600',  label: 'Confirmado',    Icon: User },
  aguardando:          { cardBg: 'bg-amber-50',  border: 'border-amber-500',  iconText: 'text-amber-600',  titleText: 'text-amber-900',  subText: 'text-amber-800/70',  badgeBg: 'bg-amber-500',  label: 'Aguardando',    Icon: Hourglass },
  aguardando_consulta: { cardBg: 'bg-teal-50',   border: 'border-teal-500',   iconText: 'text-teal-600',   titleText: 'text-teal-900',   subText: 'text-teal-800/70',   badgeBg: 'bg-teal-500',   label: 'Ag. Consulta',  Icon: Timer },
  em_atendimento:      { cardBg: 'bg-blue-50',   border: 'border-blue-600',   iconText: 'text-blue-600',   titleText: 'text-blue-900',   subText: 'text-blue-800/70',   badgeBg: 'bg-blue-600',   label: 'Em Atend.',     Icon: Stethoscope },
  concluido:           { cardBg: 'bg-violet-50', border: 'border-violet-600', iconText: 'text-violet-600', titleText: 'text-violet-900', subText: 'text-violet-800/70', badgeBg: 'bg-violet-600', label: 'Concluído',     Icon: CheckCheck },
  cancelado:           { cardBg: 'bg-red-50',    border: 'border-red-600',    iconText: 'text-red-600',    titleText: 'text-red-900',    subText: 'text-red-800/70',    badgeBg: 'bg-red-600',    label: 'Cancelado',     Icon: XCircle },
  falta:               { cardBg: 'bg-gray-100',  border: 'border-gray-500',   iconText: 'text-gray-500',   titleText: 'text-gray-800',   subText: 'text-gray-600/70',   badgeBg: 'bg-gray-500',   label: 'Falta',         Icon: UserX },
  reagendado:          { cardBg: 'bg-orange-50', border: 'border-orange-500', iconText: 'text-orange-600', titleText: 'text-orange-900', subText: 'text-orange-800/70', badgeBg: 'bg-orange-500', label: 'Reagendado',    Icon: CalendarClock },
}
const CONFIG_DEFAULT = { cardBg: 'bg-gray-100', border: 'border-gray-400', iconText: 'text-gray-500', titleText: 'text-gray-800', subText: 'text-gray-600', badgeBg: 'bg-gray-400', label: 'Agendado', Icon: CheckCircle }

const OPCOES_STATUS = [
  { valor: 'Confirmado',          label: 'Confirmado',          Icon: CheckCircle, cor: 'text-[#006b5a]' },
  { valor: 'Aguardando',          label: 'Aguardando',          Icon: Hourglass,   cor: 'text-[#6d7a75]' },
  { valor: 'Aguardando Consulta', label: 'Aguardando Consulta', Icon: Timer,       cor: 'text-teal-600' },
  { valor: 'Em Atendimento',      label: 'Em Atendimento',      Icon: Stethoscope, cor: 'text-[#406375]' },
  { valor: 'Concluído',           label: 'Concluído',           Icon: CheckCheck,  cor: 'text-[#4f625d]' },
  { valor: 'Cancelado',           label: 'Cancelado',           Icon: XCircle,     cor: 'text-[#ba1a1a]' },
  { valor: 'Falta',               label: 'Falta',               Icon: UserX,       cor: 'text-[#3d4945]' },
  { valor: '__reagendar__',       label: 'Reagendar',           Icon: RefreshCw,   cor: 'text-[#779aad]' },
]

function getConfig(status: string) {
  return STATUS_CONFIG[getAtendimentoStatusKey(status)] || CONFIG_DEFAULT
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function formatarTipoComContagem(agendamento: AgendamentoDetalhe) {
  return agendamento.tipo
}

function deveExibirContagemTipoSeparada(agendamento: AgendamentoDetalhe) {
  if (!agendamento.agendamento_pai?.tipo?.trim()) return false
  if (!agendamento.total_sessoes_tipo || agendamento.total_sessoes_tipo <= 1) return false

  const totalGeral = agendamento.total_sessoes ?? null
  const numeroGeral = agendamento.numero_sessao ?? null
  const totalTipo = agendamento.total_sessoes_tipo
  const numeroTipo = agendamento.numero_sessao_tipo ?? null

  return totalGeral !== totalTipo || numeroGeral !== numeroTipo
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarStatusComercial(status: string) {
  if (status === 'orcamento_pendente') return 'Orçamento pendente'
  if (status === 'orcamento_recusado') return 'Orçamento recusado'
  return 'Venda realizada'
}

function formatarEscalaDor(escalaDor: number | null) {
  if (escalaDor === null) return null
  return `EVA ${escalaDor}/10`
}

function getResumoStatusBadgeClass(status: string) {
  switch (getAtendimentoStatusKey(status)) {
    case 'concluido':
      return 'bg-violet-100 text-violet-700'
    case 'cancelado':
      return 'bg-red-100 text-red-700'
    case 'falta':
      return 'bg-slate-200 text-slate-700'
    case 'reagendado':
      return 'bg-orange-100 text-orange-700'
    case 'em_atendimento':
      return 'bg-blue-100 text-blue-700'
    case 'confirmado':
      return 'bg-green-100 text-green-700'
    case 'aguardando_consulta':
      return 'bg-teal-100 text-teal-700'
    case 'aguardando':
      return 'bg-amber-100 text-amber-700'
    default:
      return 'bg-[#f0f5f4] text-[#3d4945]'
  }
}

export function ConfirmacaoFaltaModal({ onConfirmar, onCancelar }: { onConfirmar: (reagendar: boolean) => void; onCancelar: () => void }) {
  const [reagendar, setReagendar] = useState(true)

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
        <h3 className="text-base font-bold text-[#083142] mb-1">Marcar como Falta?</h3>
        <p className="text-sm text-[#6d7a75] mb-5">O status do agendamento será alterado para <strong>Falta</strong>.</p>

        <label className="flex items-center gap-3 p-3 rounded-xl border border-[#bcc9c4] cursor-pointer hover:bg-[#f0f5f4] transition-colors mb-5">
          <input
            type="checkbox"
            checked={reagendar}
            onChange={e => setReagendar(e.target.checked)}
            className="w-4 h-4 accent-[#006b5a] cursor-pointer"
          />
          <div>
            <p className="text-sm font-semibold text-[#171d1c]">Reagendar paciente</p>
            <p className="text-xs text-[#6d7a75]">Abre o formulário de novo agendamento</p>
          </div>
        </label>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancelar}
            className="flex-1 py-2.5 rounded-xl border border-[#bcc9c4] text-sm font-semibold text-[#3d4945] hover:bg-[#f0f5f4] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirmar(reagendar)}
            className="flex-1 py-2.5 rounded-xl bg-gray-500 hover:bg-gray-600 text-white text-sm font-semibold transition-colors"
          >
            Confirmar Falta
          </button>
        </div>
      </div>
    </div>
  )
}

function Modal({
  agendamento,
  onClose,
  onEditar,
  podeVerComercial = false,
}: {
  agendamento: AgendamentoDetalhe
  onClose: () => void
  onEditar: () => void
  podeVerComercial?: boolean
}) {
  const router = useRouter()
  const [status, setStatus] = useState(agendamento.status)
  const [activeTab, setActiveTab] = useState<'detalhes' | 'evolucao' | 'historico'>('detalhes')
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showOpcoes, setShowOpcoes] = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [confirmacaoFalta, setConfirmacaoFalta] = useState(false)
  const [modalSelecao, setModalSelecao] = useState(false)
  const [pendentes, setPendentes] = useState<{ id: string; data_agendamento: string; numero_sessao: number | null; total_sessoes: number | null; status: string }[]>([])
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [loadingPendentes, setLoadingPendentes] = useState(false)
  const [excluindoSelecionados, setExcluindoSelecionados] = useState(false)
  const [modalReagendamento, setModalReagendamento] = useState(false)
  const [reagendamentoData, setReagendamentoData] = useState<string | undefined>()
  const [reagendamentoHora, setReagendamentoHora] = useState<string | undefined>()
  const [statusMenuPos, setStatusMenuPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const [contagem, setContagem] = useState<{ total: number; cancelados: number } | null>(null)
  const [historicoResumo, setHistoricoResumo] = useState<HistoricoPacienteResumo | null>(null)
  const [loadingHistorico, setLoadingHistorico] = useState(false)
  const [falhaHistorico, setFalhaHistorico] = useState<string | null>(null)
  const opcoesRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLDivElement>(null)
  const statusMenuRef = useRef<HTMLDivElement>(null)
  const [detalhesPorAgendamento, setDetalhesPorAgendamento] = useState<Record<string, {
    telefone?: string | null
    email?: string | null
    full_name?: string | null
    role?: string | null
    criador_nome?: string | null
    created_at?: string | null
    plano_saude?: string | null
    duracao_minutos?: number | null
    observacoes?: string | null
  }>>({})
  const [falhasDetalhes, setFalhasDetalhes] = useState<Record<string, true>>({})

  const isRecorrente = !!(agendamento.agendamento_id && (agendamento.total_sessoes ?? 0) > 1)
  const isConcluido = getAtendimentoStatusKey(status) === 'concluido'
  const nomePaciente = agendamento.pacientes?.nome || 'Paciente'
  const inicial = nomePaciente.charAt(0).toUpperCase()
  const dataObj = new Date(agendamento.data_agendamento)
  const detalhesExtras = detalhesPorAgendamento[agendamento.id] ?? null
  const telefone = detalhesExtras?.telefone ?? agendamento.pacientes?.telefone
  const emailPaciente = detalhesExtras?.email ?? agendamento.pacientes?.email
  const nomeProfissional = detalhesExtras?.full_name ?? agendamento.profissional?.full_name
  const roleProfissional = detalhesExtras?.role ?? agendamento.profissional?.role
  const nomeCriador = detalhesExtras?.criador_nome ?? agendamento.criador?.full_name ?? null
  const criadoEm = detalhesExtras?.created_at ?? agendamento.created_at ?? null
  const planoSaude = detalhesExtras?.plano_saude ?? agendamento.agendamento_pai?.plano_saude
  const nomeProtocolo = agendamento.agendamento_pai?.tipo?.trim() ?? ''
  const tituloAtendimento = nomeProtocolo || agendamento.tipo
  const descricaoTipoComContagem = formatarTipoComContagem(agendamento)
  const exibirContagemTipoSeparada = deveExibirContagemTipoSeparada(agendamento)
  const duracaoMinutos = detalhesExtras?.duracao_minutos ?? agendamento.duracao_minutos
  const observacoes = detalhesExtras?.observacoes ?? agendamento.observacoes
  const horaInicio = formatAppTime(dataObj)
  const horaFim = duracaoMinutos ? formatAppTime(new Date(dataObj.getTime() + duracaoMinutos * 60000)) : null
  const dataFormatada = formatAppDateLabel(dataObj)
  const criadoEmFormatado = criadoEm ? format(new Date(criadoEm), "dd/MM/yyyy 'às' HH:mm") : null
  const precisaCarregarDetalhes = telefone == null
    || emailPaciente == null
    || roleProfissional == null
    || nomeCriador == null
    || criadoEm == null
    || planoSaude == null
    || duracaoMinutos == null
    || observacoes == null
  const loadingDetalhes = precisaCarregarDetalhes
    && !(agendamento.id in detalhesPorAgendamento)
    && !falhasDetalhes[agendamento.id]

  useEffect(() => {
    contarAtendimentosPaciente(agendamento.paciente_id).then(setContagem)
  }, [agendamento.paciente_id])

  useEffect(() => {
    if (!loadingDetalhes) return

    let active = true

    buscarDetalhesAgendamento(agendamento.id).then((result) => {
      if (!active) return
      if (!result || 'error' in result || !result.data) {
        setFalhasDetalhes((prev) => ({ ...prev, [agendamento.id]: true }))
        return
      }
      const detalhes = result.data

      const paciente = firstRelation(detalhes.pacientes as AgendamentoDetalhe['pacientes'] | AgendamentoDetalhe['pacientes'][])
      const profissional = firstRelation(detalhes.profissional as AgendamentoDetalhe['profissional'] | AgendamentoDetalhe['profissional'][])

      setDetalhesPorAgendamento((prev) => ({
        ...prev,
        [agendamento.id]: {
          telefone: paciente?.telefone ?? null,
          email: paciente?.email ?? null,
          full_name: profissional?.full_name ?? null,
          role: profissional?.role ?? null,
          criador_nome: (detalhes.criador as { full_name?: string | null } | null)?.full_name ?? null,
          created_at: detalhes.created_at ?? null,
          plano_saude: (detalhes.agendamento as { plano_saude?: string | null } | null)?.plano_saude ?? null,
          duracao_minutos: detalhes.duracao_minutos ?? null,
          observacoes: detalhes.observacoes ?? null,
        },
      }))
    })

    return () => {
      active = false
    }
  }, [agendamento.id, loadingDetalhes])

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

  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
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

  async function handleAbrirHistorico() {
    setActiveTab('historico')

    if (historicoResumo || loadingHistorico) return

    setLoadingHistorico(true)
    setFalhaHistorico(null)
    const result = await buscarHistoricoPacienteResumo(agendamento.paciente_id)

    if (!result || result.error || !result.data) {
      setFalhaHistorico(result?.error ?? 'Não foi possível carregar o histórico.')
      setLoadingHistorico(false)
      return
    }

    setHistoricoResumo(result.data)
    setLoadingHistorico(false)
  }

  async function handleStatusChange(novoStatus: string) {
    setShowStatusMenu(false)

    if (novoStatus === 'Falta') {
      setConfirmacaoFalta(true)
      return
    }

    if (novoStatus === '__reagendar__') {
      const proxima = agendamento.agendamento_id ? await obterProximaData(agendamento.id) : null
      const horaAtual = format(new Date(agendamento.data_agendamento), 'HH:mm')
      setReagendamentoData(proxima?.data ?? undefined)
      setReagendamentoHora(horaAtual)
      setModalReagendamento(true)
      return
    }

    setLoading(true)
    const resultado = await mudarStatusAgendamento(agendamento.id, novoStatus)
    setLoading(false)
    if (resultado?.error) {
      toast.error(resultado.error)
      return
    }
    setStatus(novoStatus)
    router.refresh()
  }

  async function handleConfirmarFalta(reagendar: boolean) {
    setConfirmacaoFalta(false)
    setLoading(true)
    const resultado = await mudarStatusAgendamento(agendamento.id, 'Falta')
    setLoading(false)
    if (resultado?.error) {
      toast.error(resultado.error)
      return
    }
    setStatus('Falta')
    router.refresh()
    if (reagendar) {
      const proxima = agendamento.agendamento_id ? await obterProximaData(agendamento.id) : null
      const horaAtual = format(new Date(agendamento.data_agendamento), 'HH:mm')
      setReagendamentoData(proxima?.data ?? undefined)
      setReagendamentoHora(horaAtual)
      setModalReagendamento(true)
    }
  }

  async function handleExcluir(escopo?: 'unico' | 'todos') {
    if (!confirmandoExclusao) {
      setConfirmandoExclusao(true)
      return
    }

    if (isRecorrente && !escopo) return

    setLoading(true)

    let resultado: { error?: string } | undefined

    if (escopo === 'todos' && agendamento.agendamento_id) {
      resultado = await deletarTodasRecorrencias(agendamento.agendamento_id)
    } else if (isRecorrente && escopo === 'unico') {
      resultado = await deletarAtendimentoPontualDaRecorrencia(agendamento.id)
    } else {
      resultado = await deletarAgendamento(agendamento.id)
    }

    setLoading(false)

    if (resultado?.error) {
      toast.error(resultado.error)
      setConfirmandoExclusao(false)
      return
    }

    router.refresh()
    onClose()
  }

  async function handleAbrirSelecao() {
    if (!agendamento.agendamento_id) return
    setShowOpcoes(false)
    setConfirmandoExclusao(false)
    setLoadingPendentes(true)
    const result = await buscarAtendimentosPendentesRecorrencia(agendamento.agendamento_id)
    setLoadingPendentes(false)
    if ('error' in result) {
      toast.error(result.error ?? 'Erro ao buscar atendimentos.')
      return
    }
    setPendentes(result.data)
    setSelecionados(new Set(result.data.map(a => a.id)))
    setModalSelecao(true)
  }

  async function handleExcluirSelecionados() {
    if (!agendamento.agendamento_id || selecionados.size === 0) return
    setExcluindoSelecionados(true)
    const resultado = await deletarAtendimentosSelecionados(Array.from(selecionados), agendamento.agendamento_id)
    setExcluindoSelecionados(false)
    if (resultado.error) {
      toast.error(resultado.error)
      return
    }
    router.refresh()
    onClose()
  }

  const modalContent = (
    <div className="fixed inset-0 z-[60] overflow-y-auto pointer-events-none">
      <button
        type="button"
        aria-label="Fechar detalhes do agendamento"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto"
      />

      <div
        className="flex min-h-full items-center justify-center px-4 py-5 sm:px-6 sm:py-6"
        style={{
          paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div
          className="relative z-10 flex w-full max-w-[28rem] sm:max-w-md flex-col rounded-2xl bg-white shadow-2xl pointer-events-auto"
          style={{
            maxHeight: 'calc(100svh - 40px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div
            className="rounded-t-2xl px-5 sm:px-6 pt-3 pb-5 bg-white safe-top"
            style={{ paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))' }}
          >
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="h-12 w-12 shrink-0 rounded-full bg-[#006b5a] flex items-center justify-center text-xl sm:h-14 sm:w-14 sm:text-2xl font-bold text-white">
                {inicial}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-lg sm:text-xl font-bold text-[#083142]">{nomePaciente}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] sm:text-xs font-semibold text-[#3d4945]">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    <span className="capitalize">{dataFormatada}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {horaInicio}{horaFim ? ` - ${horaFim}` : ''}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 sm:gap-x-4">
                  <span className="flex items-center gap-1 text-[10px] sm:text-xs text-[#6d7a75]">
                    <Phone size={12} />
                    {loadingDetalhes ? '...' : (telefone || 'N/A')}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] sm:text-xs text-[#6d7a75]">
                    <Mail size={12} />
                    {loadingDetalhes ? '...' : (emailPaciente || 'N/A')}
                  </span>
                </div>
                {contagem !== null && (
                  <p className="mt-1.5 text-[10px] sm:text-xs font-bold text-[#006b5a]">
                    {contagem.total} atendimento{contagem.total !== 1 ? 's' : ''}
                    {contagem.cancelados > 0 && (
                      <span className="font-normal text-slate-400">
                        {' '}· {contagem.cancelados} faltas
                      </span>
                    )}
                  </p>
                )}
                {(loadingDetalhes || nomeCriador || criadoEmFormatado) && (
                  <p className="mt-1.5 text-[10px] sm:text-xs text-[#6d7a75]">
                    {loadingDetalhes
                      ? 'Carregando responsável pelo agendamento...'
                      : `Agendado${nomeCriador ? ` por ${nomeCriador}` : ''}${criadoEmFormatado ? ` em ${criadoEmFormatado}` : ''}`}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => { router.push('/confirmacoes/cards'); onClose() }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#bcc9c4] px-3 py-2.5 text-[11px] sm:text-xs font-semibold text-[#3d4945] hover:bg-[#f0f5f4] transition-colors"
              >
                <MessageCircle size={14} className="text-[#25d366]" />
                <span className="hidden xs:inline">Enviar</span> Lembrete
              </button>

              <div className="relative flex-1" ref={opcoesRef}>
                <button
                  type="button"
                  onClick={() => { setShowOpcoes((prev) => !prev); setConfirmandoExclusao(false) }}
                  className="flex w-full items-center justify-center gap-1 rounded-xl border border-[#bcc9c4] px-3 py-2.5 text-[11px] sm:text-xs font-semibold text-[#3d4945] hover:bg-[#f0f5f4] transition-colors"
                >
                  Opções
                  <ChevronDown size={14} />
                </button>

                {showOpcoes && (
                  <div className="absolute right-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-xl border border-[#bcc9c4]/40 bg-white py-1.5 shadow-lg">
                    <button
                      type="button"
                      onClick={() => { setShowOpcoes(false); onEditar() }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#171d1c] hover:bg-[#f0f5f4] transition-colors"
                    >
                      <Pencil size={15} className="text-[#3d4945]" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => { router.push(`/pacientes/${agendamento.paciente_id}`); setShowOpcoes(false) }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[#171d1c] hover:bg-[#f0f5f4] transition-colors"
                    >
                      <User size={15} className="text-[#3d4945]" />
                      Ver jornada do paciente
                    </button>

                    <div className="my-1 h-px bg-[#bcc9c4]/30" />

                    {isConcluido ? (
                      <div className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-400 cursor-not-allowed select-none">
                        <Trash2 size={15} />
                        Concluído — não pode excluir
                      </div>
                    ) : confirmandoExclusao && isRecorrente ? (
                      <div className="space-y-1 px-3 py-2">
                        <p className="px-1 pb-1 text-[11px] font-bold text-slate-400">Excluir:</p>
                        <button
                          type="button"
                          onClick={() => handleExcluir('unico')}
                          disabled={loading}
                          className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[#ba1a1a] hover:bg-[#fbeaea] transition-colors disabled:opacity-50"
                        >
                          Apenas este agendamento
                        </button>
                        <button
                          type="button"
                          onClick={handleAbrirSelecao}
                          disabled={loading || loadingPendentes}
                          className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[#ba1a1a] hover:bg-[#fbeaea] transition-colors disabled:opacity-50"
                        >
                          {loadingPendentes ? 'Carregando...' : 'Selecionar atendimentos'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setConfirmandoExclusao(false) }}
                          className="w-full py-1.5 text-center text-xs text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleExcluir()}
                        disabled={loading}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-semibold text-[#ba1a1a] hover:bg-[#fbeaea] transition-colors disabled:opacity-50"
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

          <div className="flex shrink-0 border-y border-[#bcc9c4]/30 bg-[#f5faf9]">
            <button
              type="button"
              onClick={() => setActiveTab('detalhes')}
              className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
                activeTab === 'detalhes'
                  ? 'border-b-2 border-[#006b5a] bg-white text-[#006b5a]'
                  : 'text-[#6d7a75] hover:text-[#3d4945]'
              }`}
            >
              Detalhes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('evolucao')}
              className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-colors ${
                activeTab === 'evolucao'
                  ? 'border-b-2 border-[#006b5a] bg-white text-[#006b5a]'
                  : 'text-[#6d7a75] hover:text-[#3d4945]'
              }`}
            >
              <ClipboardList size={13} />
              Evolucao
            </button>
            <button
              type="button"
              onClick={handleAbrirHistorico}
              className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-colors ${
                activeTab === 'historico'
                  ? 'border-b-2 border-[#006b5a] bg-white text-[#006b5a]'
                  : 'text-[#6d7a75] hover:text-[#3d4945]'
              }`}
            >
              <Clock size={13} />
              Histórico
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 sm:py-6 space-y-4">
            {activeTab === 'evolucao' ? (
              <ProntuarioEvolucao atendimentoId={agendamento.id} pacienteId={agendamento.paciente_id} />
            ) : activeTab === 'historico' ? (
              <>
                {loadingHistorico ? (
                  <div className="flex items-center justify-center py-10 text-sm font-medium text-[#6d7a75]">
                    Carregando histórico...
                  </div>
                ) : falhaHistorico ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {falhaHistorico}
                  </div>
                ) : historicoResumo ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-[#f0f5f4] p-3">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[#6d7a75]">Consultas</p>
                        <p className="mt-1 text-lg font-extrabold text-[#083142]">{historicoResumo.metricas.consultas_total}</p>
                        <p className="text-xs text-[#6d7a75]">{historicoResumo.metricas.consultas_concluidas} concluídas</p>
                      </div>
                      {podeVerComercial ? (
                        <div className="rounded-xl bg-[#f0f5f4] p-3">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-[#6d7a75]">Comercial</p>
                          <p className="mt-1 text-lg font-extrabold text-[#083142]">{historicoResumo.metricas.vendas_realizadas}</p>
                          <p className="text-xs text-[#6d7a75]">{historicoResumo.metricas.orcamentos_passados} orçamento(s)</p>
                        </div>
                      ) : null}
                      <div className="rounded-xl bg-white border border-[#bcc9c4]/40 p-3">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[#6d7a75]">Não efetivas</p>
                        <p className="mt-1 text-lg font-extrabold text-[#083142]">{historicoResumo.metricas.consultas_nao_efetivas}</p>
                        <p className="text-xs text-[#6d7a75]">faltas, cancelamentos e reagendamentos</p>
                      </div>
                      {podeVerComercial ? (
                        <div className="rounded-xl bg-white border border-[#bcc9c4]/40 p-3">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-[#6d7a75]">Valor vendido</p>
                          <p className="mt-1 text-lg font-extrabold text-[#083142]">{formatarMoeda(historicoResumo.metricas.valor_total_vendas)}</p>
                          <p className="text-xs text-[#6d7a75]">somente vendas confirmadas</p>
                        </div>
                      ) : null}
                    </div>

                    {historicoResumo.resumo_tipos.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-[#6d7a75]">Resumo por tipo</h4>
                          <span className="text-[11px] text-[#6d7a75]">
                            {historicoResumo.resumo_tipos.length} tipo{historicoResumo.resumo_tipos.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {historicoResumo.resumo_tipos.map((item) => (
                            <div key={item.tipo} className="rounded-xl border border-[#bcc9c4]/30 bg-[#fcfdfd] px-3 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-[#171d1c]">{item.tipo}</p>
                                  <p className="text-xs text-[#6d7a75]">
                                    {item.total} agendamento{item.total !== 1 ? 's' : ''}
                                  </p>
                                </div>
                                <span className="shrink-0 rounded-full bg-[#f0f5f4] px-2 py-0.5 text-[10px] font-bold text-[#3d4945]">
                                  Total {item.total}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {item.statuses.map((statusItem) => (
                                  <span
                                    key={`${item.tipo}-${statusItem.status}`}
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getResumoStatusBadgeClass(statusItem.status)}`}
                                  >
                                    {statusItem.total} {statusItem.status}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#6d7a75]">Últimas consultas</h4>
                        <button
                          type="button"
                          onClick={() => { router.push(`/pacientes/${agendamento.paciente_id}`); onClose() }}
                          className="text-[11px] font-semibold text-[#006b5a] hover:underline"
                        >
                          Ver jornada completa
                        </button>
                      </div>

                      {historicoResumo.consultas.length > 0 ? (
                        <div className="space-y-2">
                          {historicoResumo.consultas.map((consulta) => (
                            <div key={consulta.id} className="rounded-xl border border-[#bcc9c4]/30 bg-white px-3 py-2.5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-[#171d1c] truncate">{consulta.tipo?.trim() || 'Sessão'}</p>
                                  <p className="text-xs text-[#6d7a75]">
                                    {format(new Date(consulta.data_agendamento), "dd/MM/yyyy 'às' HH:mm")}
                                  </p>
                                  {consulta.profissional_nome ? (
                                    <p className="text-xs text-[#6d7a75]">
                                      Profissional: {consulta.profissional_nome}
                                    </p>
                                  ) : null}
                                </div>
                                <span className="shrink-0 rounded-full bg-[#f0f5f4] px-2 py-0.5 text-[10px] font-bold text-[#3d4945]">
                                  {normalizeAtendimentoStatus(consulta.status)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl bg-[#f0f5f4] px-4 py-3 text-sm text-[#6d7a75]">
                          Nenhuma consulta registrada para este paciente.
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#6d7a75]">Evoluções concluídas</h4>
                      {historicoResumo.evolucoes.length > 0 ? (
                        <div className="space-y-2">
                          {historicoResumo.evolucoes.map((item) => (
                            <div key={item.atendimento_id} className="rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-[#171d1c]">{item.tipo?.trim() || 'Sessão'}</p>
                                  <p className="text-xs text-[#6d7a75]">
                                    {format(new Date(item.data_agendamento), "dd/MM/yyyy 'às' HH:mm")}
                                  </p>
                                  {item.profissional_nome ? (
                                    <p className="text-xs text-[#6d7a75]">
                                      Profissional: {item.profissional_nome}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                                    Concluído
                                  </span>
                                  {formatarEscalaDor(item.escala_dor) ? (
                                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-[#5a6a65] border border-violet-200">
                                      {formatarEscalaDor(item.escala_dor)}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <div className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-[#3d4945]">
                                {item.evolucao ? (
                                  <p>
                                    <span className="font-semibold text-[#083142]">Evolução: </span>
                                    {item.evolucao}
                                  </p>
                                ) : null}
                                {item.procedimentos ? (
                                  <p>
                                    <span className="font-semibold text-[#083142]">Procedimentos: </span>
                                    {item.procedimentos}
                                  </p>
                                ) : null}
                                {item.observacoes ? (
                                  <p>
                                    <span className="font-semibold text-[#083142]">Observações: </span>
                                    {item.observacoes}
                                  </p>
                                ) : null}
                                {item.updated_at ? (
                                  <p className="pt-0.5 text-[10px] text-[#6d7a75]">
                                    Atualizado em {format(new Date(item.updated_at), "dd/MM/yyyy 'às' HH:mm")}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl bg-[#f0f5f4] px-4 py-3 text-sm text-[#6d7a75]">
                          Nenhuma evolução encontrada em atendimentos concluídos.
                        </div>
                      )}
                    </div>

                    {podeVerComercial ? (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#6d7a75]">Histórico comercial</h4>
                        {historicoResumo.comercial.length > 0 ? historicoResumo.comercial.map((item) => (
                          <div key={item.id} className="rounded-xl border border-[#bcc9c4]/30 bg-[#fcfdfd] px-3 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-[#171d1c]">{formatarStatusComercial(item.status)}</p>
                                <p className="text-xs text-[#6d7a75]">
                                  {format(new Date(item.data_venda), 'dd/MM/yyyy')}
                                  {item.profissional_nome ? ` · ${item.profissional_nome}` : ''}
                                </p>
                              </div>
                              <span className="shrink-0 text-sm font-bold text-[#006b5a]">{formatarMoeda(item.total)}</span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {item.origem ? (
                                <span className="rounded-full bg-[#f0f5f4] px-2 py-0.5 text-[10px] font-semibold text-[#5a6a65]">
                                  {item.origem}
                                </span>
                              ) : null}
                              {item.itens_resumo.map((nome) => (
                                <span key={nome} className="rounded-full border border-[#bcc9c4]/40 bg-white px-2 py-0.5 text-[10px] font-medium text-[#3d4945]">
                                  {nome}
                                </span>
                              ))}
                            </div>
                          </div>
                        )) : (
                          <div className="rounded-xl bg-[#f0f5f4] px-4 py-3 text-sm text-[#6d7a75]">
                            Nenhuma venda ou orçamento encontrado para este paciente.
                          </div>
                        )}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <MapPin size={16} className="shrink-0 text-[#006b5a]" />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-[#3d4945]">{tituloAtendimento}</span>
                    {agendamento.total_sessoes && agendamento.total_sessoes > 1 && (
                      <span className="rounded-full bg-[#006b5a]/10 px-2 py-0.5 text-xs font-bold text-[#006b5a]">
                        Sessao {agendamento.numero_sessao}/{agendamento.total_sessoes}
                      </span>
                    )}
                    {nomeProtocolo && exibirContagemTipoSeparada && (
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-[#5a6a65] border border-[#bcc9c4]">
                        {agendamento.numero_sessao_tipo ?? 0}/{agendamento.total_sessoes_tipo} em {agendamento.tipo}
                      </span>
                    )}
                  </div>
                </div>
                {nomeProtocolo && (
                  <div className="pl-7 -mt-2">
                    <span className="text-xs font-medium text-[#6d7a75]">
                      {exibirContagemTipoSeparada ? descricaoTipoComContagem : agendamento.tipo}
                    </span>
                  </div>
                )}

                {nomeProfissional && (
                  <div className="flex items-center gap-3">
                    <User size={16} className="shrink-0 text-[#006b5a]" />
                    <span className="text-sm font-medium text-[#3d4945]">
                      {nomeProfissional}
                      {roleProfissional && <span className="ml-1 text-[#6d7a75]">· {roleProfissional}</span>}
                    </span>
                  </div>
                )}

                {planoSaude ? (
                  <div className="flex items-center gap-3">
                    <ClipboardList size={16} className="shrink-0 text-[#006b5a]" />
                    <span className="text-sm font-medium text-[#3d4945]">Plano de saúde: {planoSaude}</span>
                  </div>
                ) : null}

                <div className="flex items-start gap-3">
                  <Calendar size={16} className="mt-0.5 shrink-0 text-[#006b5a]" />
                  <div>
                    <p className="text-sm font-semibold capitalize text-[#171d1c]">{dataFormatada}</p>
                    <p className="text-base font-bold text-[#083142]">
                      {horaInicio}{horaFim ? ` - ${horaFim}` : ''}
                    </p>
                  </div>
                </div>

                {duracaoMinutos ? (
                  <div className="flex items-center gap-3">
                    <Clock size={16} className="shrink-0 text-[#006b5a]" />
                    <span className="text-sm font-medium text-[#3d4945]">{duracaoMinutos} minutos</span>
                  </div>
                ) : null}

                {observacoes ? (
                  <div className="rounded-xl bg-[#f0f5f4] p-4">
                    <p className="mb-1 text-xs font-semibold text-[#6d7a75]">Observacoes</p>
                    <p className="text-sm text-[#3d4945]">{observacoes}</p>
                  </div>
                ) : null}

                <div className="relative" ref={statusRef}>
                  <label className="mb-2 block text-xs font-bold text-[#6d7a75]">Status</label>
                  <button
                    type="button"
                    onClick={toggleStatusMenu}
                    disabled={loading}
                    className="flex w-full items-center justify-between rounded-xl border border-[#bcc9c4] px-4 py-2.5 text-sm font-semibold text-[#3d4945] hover:bg-[#f0f5f4] transition-colors"
                  >
                    <span>{status || 'Agendado'}</span>
                    <ChevronDown size={14} />
                  </button>
                </div>
              </>
            )}
          </div>

          <div
            className="flex justify-center sm:justify-end rounded-b-2xl border-t border-[#bcc9c4]/20 bg-white px-5 sm:px-6 pt-3 pb-5"
            style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="min-w-32 rounded-xl border border-[#bcc9c4] bg-white px-5 py-2.5 text-sm font-bold text-[#3d4945] hover:bg-[#dee3e3] transition-colors"
            >
              Fechar
            </button>
          </div>

          {modalSelecao && (
            <div className="absolute inset-0 z-20 flex flex-col rounded-2xl bg-white overflow-hidden">
              <div
                className="border-b border-[#bcc9c4]/30 px-5 pb-4"
                style={{ paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))' }}
              >
                <h4 className="font-bold text-[#083142]">Selecionar para excluir</h4>
                <p className="mt-0.5 text-xs text-[#6d7a75]">Apenas atendimentos não concluídos são exibidos</p>
              </div>

              {pendentes.length === 0 ? (
                <div className="flex flex-1 items-center justify-center p-6">
                  <p className="text-sm text-slate-400">Nenhum atendimento pendente nesta recorrência</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-5 py-2 border-b border-[#bcc9c4]/20">
                    <span className="text-xs text-[#6d7a75]">{selecionados.size} de {pendentes.length} selecionados</span>
                    <button
                      type="button"
                      onClick={() => setSelecionados(
                        selecionados.size === pendentes.length
                          ? new Set()
                          : new Set(pendentes.map(a => a.id))
                      )}
                      className="text-xs font-semibold text-[#006b5a]"
                    >
                      {selecionados.size === pendentes.length ? 'Desmarcar todos' : 'Selecionar todos'}
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
                    {pendentes.map((a) => {
                      const dataAppt = new Date(a.data_agendamento)
                      const isSel = selecionados.has(a.id)
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setSelecionados(prev => {
                            const next = new Set(prev)
                            if (next.has(a.id)) next.delete(a.id)
                            else next.add(a.id)
                            return next
                          })}
                          className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                            isSel ? 'bg-red-50' : 'hover:bg-[#f0f5f4]'
                          }`}
                        >
                          <div className={`h-5 w-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                            isSel ? 'border-[#ba1a1a] bg-[#ba1a1a]' : 'border-[#bcc9c4]'
                          }`}>
                            {isSel && <Check size={12} className="text-white" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-[#171d1c]">
                              {formatAppDateLabel(dataAppt)} · {formatAppTime(dataAppt)}
                            </p>
                            {a.numero_sessao != null && (
                              <p className="text-xs text-[#6d7a75]">
                                Sessão {a.numero_sessao}{a.total_sessoes != null ? ` de ${a.total_sessoes}` : ''}
                              </p>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              <div
                className="border-t border-[#bcc9c4]/30 px-4 pt-3 pb-5 space-y-2"
                style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}
              >
                <button
                  type="button"
                  onClick={handleExcluirSelecionados}
                  disabled={selecionados.size === 0 || excluindoSelecionados}
                  className="w-full rounded-xl bg-[#ba1a1a] py-2.5 text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
                >
                  {excluindoSelecionados
                    ? 'Excluindo...'
                    : `Excluir ${selecionados.size} atendimento${selecionados.size !== 1 ? 's' : ''}`}
                </button>
                <button
                  type="button"
                  onClick={() => setModalSelecao(false)}
                  className="w-full py-2 text-sm text-[#6d7a75] hover:text-[#3d4945] transition-colors"
                >
                  Voltar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {typeof document !== 'undefined' && showStatusMenu && statusMenuPos && createPortal(
        <div
          ref={statusMenuRef}
          style={{
            position: 'fixed',
            top: statusMenuPos.top,
            left: statusMenuPos.left,
            width: Math.max(statusMenuPos.width, 190),
            zIndex: 9999,
            transform: 'translateY(-100%)',
          }}
          className="overflow-hidden rounded-xl border border-[#bcc9c4] bg-white shadow-lg"
        >
          {OPCOES_STATUS.map(({ valor, label, Icon, cor }) => (
            <button
              key={valor}
              type="button"
              onClick={() => handleStatusChange(valor)}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium text-[#3d4945] hover:bg-[#f0f5f4] transition-colors"
            >
              <Icon size={14} className={cor} />
              {label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )

  if (typeof document === 'undefined') return null

  return (
    <>
      {createPortal(modalContent, document.body)}
      {typeof document !== 'undefined' && confirmacaoFalta && createPortal(
        <ConfirmacaoFaltaModal
          onConfirmar={handleConfirmarFalta}
          onCancelar={() => setConfirmacaoFalta(false)}
        />,
        document.body
      )}
      {modalReagendamento && createPortal(
        <ModalSessaoReposicao
          pacienteNome={nomePaciente}
          defaultData={reagendamentoData}
          defaultHora={reagendamentoHora}
          onClose={() => setModalReagendamento(false)}
          onSaved={async () => {
            setModalReagendamento(false)
            const res = await registrarContato(agendamento.id, 'reagendou')
            if (!res.error) router.refresh()
          }}
          onSalvarCustom={
            agendamento.agendamento_id
              ? (data, hora) => adicionarSessaoReposicao(agendamento.agendamento_id!, agendamento.id, data, hora)
              : (data, hora) => criarAtendimentoReagendado(agendamento.id, data, hora)
          }
        />,
        document.body
      )}
    </>
  )
}

export function AgendamentoItemDia({
  agendamento,
  pacientes,
  profissionais,
  planos = [],
  podeVerComercial = false,
}: {
  agendamento: AgendamentoDetalhe
  pacientes: Paciente[]
  profissionais: Profissional[]
  planos?: PlanoSaude[]
  podeVerComercial?: boolean
}) {
  const [modalAberto, setModalAberto] = useState(false)
  const [slideEditarAberto, setSlideEditarAberto] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const config = getConfig(agendamento.status)
  const Icone = config.Icon
  const hora = formatAppTime(agendamento.data_agendamento)
  const nomePaciente = agendamento.pacientes?.nome || 'Paciente não identificado'
  const descricaoTipoComContagem = formatarTipoComContagem(agendamento)
  const exibirContagemTipoSeparada = deveExibirContagemTipoSeparada(agendamento)

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
                <div className="flex flex-wrap items-start gap-1.5 sm:items-center sm:gap-2">
                  <p className={`text-sm font-bold ${config.titleText}`}>{nomePaciente}</p>
                  {agendamento.total_sessoes && agendamento.total_sessoes > 1 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-white/60 text-[#006b5a] rounded-full border border-[#006b5a]/20 whitespace-nowrap">
                      {agendamento.numero_sessao}/{agendamento.total_sessoes}
                    </span>
                  )}
                  {agendamento.marcou_retorno && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[#e0e7ff] text-[#3730a3] rounded-full border border-[#c7d2fe] whitespace-nowrap">
                      Retorno
                    </span>
                  )}
                </div>
                <p className={`text-[11px] ${config.subText} mt-1 font-medium italic`}>{agendamento.agendamento_pai?.tipo?.trim() || agendamento.tipo}</p>
                {agendamento.agendamento_pai?.tipo?.trim() && (
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <p className={`text-[11px] ${config.subText} font-medium`}>
                      {descricaoTipoComContagem}
                    </p>
                    {exibirContagemTipoSeparada && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-white/60 text-[#5a6a65] rounded-full border border-[#bcc9c4] whitespace-nowrap">
                        {agendamento.numero_sessao_tipo ?? 0}/{agendamento.total_sessoes_tipo}
                      </span>
                    )}
                  </div>
                )}
                {agendamento.profissional?.full_name && (
                  <p className={`text-[11px] ${config.subText} mt-0.5 font-medium flex items-center gap-1`}>
                    <User size={10} className="shrink-0" />
                    {agendamento.profissional.full_name}
                  </p>
                )}
                {agendamento.observacoes && (
                  <p className={`text-[11px] ${config.subText} mt-0.5 truncate max-w-[220px]`}>
                    {agendamento.observacoes}
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
          podeVerComercial={podeVerComercial}
          onClose={() => setModalAberto(false)}
          onEditar={() => { setModalAberto(false); setSlideEditarAberto(true) }}
        />
      )}

      <SlideNovoAgendamento
        pacientes={pacientes}
        profissionais={profissionais}
        planos={planos}
        controlledOpen={slideEditarAberto}
        onControlledClose={() => setSlideEditarAberto(false)}
        atendimentoParaEditar={slideEditarAberto ? agendamento : undefined}
      />

    </>
  )
}

export function AgendamentoItemSemana({
  agendamento,
  pacientes,
  profissionais,
  planos = [],
  podeVerComercial = false,
}: {
  agendamento: AgendamentoDetalhe
  pacientes: Paciente[]
  profissionais: Profissional[]
  planos?: PlanoSaude[]
  podeVerComercial?: boolean
}) {
  const [modalAberto, setModalAberto] = useState(false)
  const [slideEditarAberto, setSlideEditarAberto] = useState(false)
  const config = getConfig(agendamento.status)
  const primeiroNome = (agendamento.pacientes?.nome || 'Paciente').split(' ')[0]
  const descricaoTipoComContagem = formatarTipoComContagem(agendamento)
  const exibirContagemTipoSeparada = deveExibirContagemTipoSeparada(agendamento)

  return (
    <>
      <div
        onClick={() => setModalAberto(true)}
        className={`${config.cardBg} border-l-4 ${config.border} p-2 rounded-lg mb-1 shadow-sm cursor-pointer hover:scale-[1.02] transition-transform`}
      >
        <div className="flex items-center gap-1 flex-wrap">
          <p className={`text-[10px] font-bold ${config.titleText} truncate`}>{primeiroNome}</p>
          {agendamento.marcou_retorno && (
            <span className="text-[9px] font-bold px-1 py-0.5 bg-[#e0e7ff] text-[#3730a3] rounded whitespace-nowrap">↩ Ret.</span>
          )}
        </div>
        <p className={`text-[9px] ${config.subText} truncate`}>
          {agendamento.agendamento_pai?.tipo?.trim()
            ? `${agendamento.agendamento_pai.tipo.trim()} - ${exibirContagemTipoSeparada ? descricaoTipoComContagem : agendamento.tipo}`
            : (exibirContagemTipoSeparada ? descricaoTipoComContagem : agendamento.tipo)}
        </p>
        {agendamento.profissional?.full_name && (
          <p className={`text-[9px] ${config.subText} truncate opacity-80`}>
            {agendamento.profissional.full_name.split(' ')[0]}
          </p>
        )}
      </div>

      {modalAberto && (
        <Modal
          agendamento={agendamento}
          podeVerComercial={podeVerComercial}
          onClose={() => setModalAberto(false)}
          onEditar={() => { setModalAberto(false); setSlideEditarAberto(true) }}
        />
      )}

      <SlideNovoAgendamento
        pacientes={pacientes}
        profissionais={profissionais}
        planos={planos}
        controlledOpen={slideEditarAberto}
        onControlledClose={() => setSlideEditarAberto(false)}
        atendimentoParaEditar={slideEditarAberto ? agendamento : undefined}
      />

    </>
  )
}
