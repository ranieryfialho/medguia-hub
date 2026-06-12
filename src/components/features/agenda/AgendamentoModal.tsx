'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Calendar, ChevronDown, ClipboardList, Clock, FolderOpen,
  Mail, MessageCircle, Pencil, Phone, Timer, Trash2, User,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  buscarAtendimentosPendentesRecorrencia,
  buscarDetalhesAgendamento,
  contarAtendimentosPaciente,
  deletarAgendamento,
  deletarAtendimentoPontualDaRecorrencia,
  deletarTodasRecorrencias,
  mudarStatusAgendamento,
} from '@/actions/agenda'
import { adicionarSessaoReposicao, criarAtendimentoReagendado, obterProximaData, registrarContato } from '@/actions/confirmacoes'
import { format } from 'date-fns'
import { formatAppDateLabel, formatAppTime } from '@/lib/datetime'
import { getAtendimentoStatusKey, TRANSICOES_VALIDAS, getPreRequisitoTransicao } from '@/lib/atendimento-status'
import { ProntuarioEvolucao } from '../prontuarios'
import { ModalSessaoReposicao } from '../shared'
import { ConfirmacaoFaltaModal } from './AgendamentoItem'
import { TabMidia } from './TabMidia'
import { TabHistorico } from './TabHistorico'
import { ModalSelecaoExclusao } from './ModalSelecaoExclusao'
import { TabFollowUp } from '../follow-ups/TabFollowUp'
import {
  CONFIG_DEFAULT, OPCOES_STATUS, STATUS_CONFIG,
  deveExibirContagemTipoSeparada, firstRelation, formatarTipoComContagem,
  type AgendamentoDetalhe,
} from './agendamento-item-utils'
import { useTempoEspera } from '@/hooks/useTempoEspera'

type AgendamentoModalProps = {
  agendamento: AgendamentoDetalhe
  onClose: () => void
  onEditar: () => void
  onConcluido?: (pacienteId: string, atendimentoId: string) => void
  profissionais?: { id: string; full_name: string }[]
  initialTab?: 'detalhes' | 'evolucao' | 'historico' | 'midia' | 'followup'
  podeVerComercial?: boolean
}

export function AgendamentoModal({ agendamento, onClose, onEditar, onConcluido, profissionais = [], initialTab = 'detalhes', podeVerComercial = false }: AgendamentoModalProps) {
  const router = useRouter()
  const [status, setStatus] = useState(agendamento.status)
  const [activeTab, setActiveTab] = useState<'detalhes' | 'evolucao' | 'historico' | 'midia' | 'followup'>(initialTab)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showOpcoes, setShowOpcoes] = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [confirmacaoFalta, setConfirmacaoFalta] = useState(false)
  const [modalSelecao, setModalSelecao] = useState(false)
  const [modalReagendamento, setModalReagendamento] = useState(false)
  const [reagendamentoData, setReagendamentoData] = useState<string | undefined>()
  const [reagendamentoHora, setReagendamentoHora] = useState<string | undefined>()
  const [contagem, setContagem] = useState<{ total: number; cancelados: number } | null>(null)
  const [statusMenuPos, setStatusMenuPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const [detalhesPorAgendamento, setDetalhesPorAgendamento] = useState<Record<string, {
    telefone?: string | null; email?: string | null; full_name?: string | null; role?: string | null
    criador_nome?: string | null; created_at?: string | null; plano_saude?: string | null
    duracao_minutos?: number | null; observacoes?: string | null
  }>>({})
  const [falhasDetalhes, setFalhasDetalhes] = useState<Record<string, true>>({})
  const opcoesRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLDivElement>(null)
  const statusMenuRef = useRef<HTMLDivElement>(null)

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
  const tempoEspera = useTempoEspera(agendamento.id, agendamento.aguardando_desde, agendamento.em_atendimento_desde, () => router.refresh())
  const observacoes = detalhesExtras?.observacoes ?? agendamento.observacoes
  const horaInicio = formatAppTime(dataObj)
  const horaFim = duracaoMinutos ? formatAppTime(new Date(dataObj.getTime() + duracaoMinutos * 60000)) : null
  const dataFormatada = formatAppDateLabel(dataObj)
  const criadoEmFormatado = criadoEm ? format(new Date(criadoEm), "dd/MM/yyyy 'às' HH:mm") : null
  const precisaCarregarDetalhes = telefone == null || emailPaciente == null || roleProfissional == null
    || nomeCriador == null || criadoEm == null || planoSaude == null || duracaoMinutos == null || observacoes == null
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
    return () => { active = false }
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
    return () => { document.body.style.overflow = originalOverflow }
  }, [])

  function toggleStatusMenu() {
    if (!showStatusMenu && statusRef.current) {
      const rect = statusRef.current.getBoundingClientRect()
      setStatusMenuPos({ top: Math.max(8, rect.top - 6), left: rect.left, width: rect.width })
    }
    setShowStatusMenu((prev) => !prev)
  }

  async function handleStatusChange(novoStatus: string) {
    setShowStatusMenu(false)
    if (novoStatus === 'Falta') {
      setConfirmacaoFalta(true)
      return
    }
    if (novoStatus === '__reagendar__') {
      const proxima = agendamento.agendamento_id ? await obterProximaData(agendamento.id) : null
      setReagendamentoData(proxima?.data ?? undefined)
      setReagendamentoHora(format(new Date(agendamento.data_agendamento), 'HH:mm'))
      setModalReagendamento(true)
      return
    }
    setLoading(true)
    const resultado = await mudarStatusAgendamento(agendamento.id, novoStatus)
    setLoading(false)
    if (resultado?.error) { toast.error(resultado.error); return }
    setStatus(novoStatus)

    if (getAtendimentoStatusKey(novoStatus) === 'concluido') {
      setActiveTab('followup')
    } else {
      router.refresh()
    }
  }

  async function handleConfirmarFalta(reagendar: boolean) {
    setConfirmacaoFalta(false)
    setLoading(true)
    const resultado = await mudarStatusAgendamento(agendamento.id, 'Falta')
    setLoading(false)
    if (resultado?.error) { toast.error(resultado.error); return }
    setStatus('Falta')
    router.refresh()
    if (reagendar) {
      const proxima = agendamento.agendamento_id ? await obterProximaData(agendamento.id) : null
      setReagendamentoData(proxima?.data ?? undefined)
      setReagendamentoHora(format(new Date(agendamento.data_agendamento), 'HH:mm'))
      setModalReagendamento(true)
    }
  }

  async function handleExcluir(escopo?: 'unico' | 'todos') {
    if (!confirmandoExclusao) { setConfirmandoExclusao(true); return }
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
    if (resultado?.error) { toast.error(resultado.error); setConfirmandoExclusao(false); return }
    router.refresh()
    onClose()
  }

  function handleAbrirSelecao() {
    if (!agendamento.agendamento_id) return
    setShowOpcoes(false)
    setConfirmandoExclusao(false)
    setModalSelecao(true)
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
        style={{ paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}
      >
        <div
          className="relative z-10 flex w-full max-w-[28rem] sm:max-w-md lg:max-w-4xl flex-col lg:flex-row rounded-2xl bg-white shadow-2xl pointer-events-auto overflow-hidden"
          style={{ maxHeight: 'calc(100svh - 40px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* LEFT PANEL */}
          <div className="flex flex-col lg:w-80 xl:w-96 lg:shrink-0 lg:border-r lg:border-[#bcc9c4]/30 relative">
          <Link
            href={`/pacientes/${agendamento.paciente_id}/editar`}
            title="Editar paciente"
            className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-300 hover:text-[#006b5a] hover:bg-[#f0f5f4] transition-colors z-10"
          >
            <Pencil size={15} />
          </Link>

          {/* Header */}
          <div
            className="px-5 sm:px-6 pt-3 pb-5 bg-white"
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
                      <span className="font-normal text-slate-400"> · {contagem.cancelados} faltas</span>
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
                          onClick={() => void handleExcluir('unico')}
                          disabled={loading}
                          className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[#ba1a1a] hover:bg-[#fbeaea] transition-colors disabled:opacity-50"
                        >
                          Apenas este agendamento
                        </button>
                        <button
                          type="button"
                          onClick={handleAbrirSelecao}
                          disabled={loading}
                          className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[#ba1a1a] hover:bg-[#fbeaea] transition-colors disabled:opacity-50"
                        >
                          Selecionar atendimentos
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmandoExclusao(false)}
                          className="w-full py-1.5 text-center text-xs text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleExcluir()}
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

          </div>

          {/* RIGHT PANEL */}
          <div className="flex flex-col flex-1 min-h-0 min-w-0 border-t lg:border-t-0 border-[#bcc9c4]/30">
          {/* Tabs */}
          <div className="flex shrink-0 border-b border-[#bcc9c4]/30 bg-[#f5faf9]">
            {[
              { key: 'detalhes', label: 'Detalhes', icon: null },
              { key: 'evolucao', label: 'Evolucao', icon: <ClipboardList size={13} /> },
              { key: 'historico', label: 'Histórico', icon: <Clock size={13} /> },
              { key: 'midia', label: 'Mídia', icon: <FolderOpen size={13} /> },
              { key: 'followup', label: 'Follow-up', icon: null },
            ].map(({ key, label, icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key as typeof activeTab)}
                className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-colors ${
                  activeTab === key
                    ? 'border-b-2 border-[#006b5a] bg-white text-[#006b5a]'
                    : 'text-[#6d7a75] hover:text-[#3d4945]'
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 sm:py-6 space-y-4">
            <TabMidia
              agendamentoId={agendamento.id}
              pacienteId={agendamento.paciente_id}
              nomePaciente={nomePaciente}
              dataAgendamento={agendamento.data_agendamento}
              tipo={agendamento.tipo}
              googleDrivePastaUrl={agendamento.google_drive_pasta_url}
              isActive={activeTab === 'midia'}
            />

            {activeTab === 'evolucao' && (
              <ProntuarioEvolucao atendimentoId={agendamento.id} pacienteId={agendamento.paciente_id} />
            )}

            <TabHistorico
              pacienteId={agendamento.paciente_id}
              agendamentoId={agendamento.id}
              podeVerComercial={podeVerComercial}
              isActive={activeTab === 'historico'}
              onVerJornada={() => { router.push(`/pacientes/${agendamento.paciente_id}`); onClose() }}
            />

            <TabFollowUp
              pacienteId={agendamento.paciente_id}
              atendimentoId={agendamento.id}
              profissionais={profissionais}
              isActive={activeTab === 'followup'}
              onSuccess={() => { onConcluido?.(agendamento.paciente_id, agendamento.id); router.refresh() }}
            />

            {activeTab === 'detalhes' && (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-[#006b5a]">📍</span>
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
                    {tempoEspera?.tipo === 'aguardando' && (
                      <span className="rounded-full flex items-center gap-1 bg-teal-50 px-2 py-0.5 text-xs font-bold text-teal-700 border border-teal-200">
                        <Timer size={11} />
                        {tempoEspera.tempo}
                      </span>
                    )}
                    {tempoEspera?.tipo === 'esperou' && (
                      <span className="rounded-full flex items-center gap-1 bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500 border border-slate-300">
                        <Timer size={11} />
                        Esperou {tempoEspera.tempo}
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
                {planoSaude && (
                  <div className="flex items-center gap-3">
                    <ClipboardList size={16} className="shrink-0 text-[#006b5a]" />
                    <span className="text-sm font-medium text-[#3d4945]">Plano de saúde: {planoSaude}</span>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <Calendar size={16} className="mt-0.5 shrink-0 text-[#006b5a]" />
                  <div>
                    <p className="text-sm font-semibold capitalize text-[#171d1c]">{dataFormatada}</p>
                    <p className="text-base font-bold text-[#083142]">{horaInicio}{horaFim ? ` - ${horaFim}` : ''}</p>
                  </div>
                </div>
                {duracaoMinutos && (
                  <div className="flex items-center gap-3">
                    <Clock size={16} className="shrink-0 text-[#006b5a]" />
                    <span className="text-sm font-medium text-[#3d4945]">{duracaoMinutos} minutos</span>
                  </div>
                )}
                {observacoes && (
                  <div className="rounded-xl bg-[#f0f5f4] p-4">
                    <p className="mb-1 text-xs font-semibold text-[#6d7a75]">Observacoes</p>
                    <p className="text-sm text-[#3d4945]">{observacoes}</p>
                  </div>
                )}
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

          {/* Footer */}
          <div
            className="flex justify-center sm:justify-end border-t border-[#bcc9c4]/20 bg-white px-5 sm:px-6 pt-3 pb-5"
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
          </div>

          {modalSelecao && agendamento.agendamento_id && (
            <ModalSelecaoExclusao
              agendamentoPaiId={agendamento.agendamento_id}
              onClose={() => setModalSelecao(false)}
              onExcluido={onClose}
            />
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
          {OPCOES_STATUS.map(({ valor, label, Icon, cor }) => {
            const statusAtualKey = getAtendimentoStatusKey(status)
            const opcaoKey       = getAtendimentoStatusKey(valor)
            const isAtivo        = valor !== '__reagendar__' && status.toLowerCase() === valor.toLowerCase()
            const validas        = statusAtualKey !== 'desconhecido' ? TRANSICOES_VALIDAS[statusAtualKey] : null
            const isBloqueado    = !isAtivo && valor !== '__reagendar__' && validas !== null && !validas.includes(opcaoKey)
            const prereq         = isBloqueado ? getPreRequisitoTransicao(statusAtualKey, opcaoKey) : null

            return (
              <button
                key={valor}
                type="button"
                onClick={() => { if (!isBloqueado) void handleStatusChange(valor) }}
                disabled={isAtivo || isBloqueado}
                title={prereq ? `Passe primeiro por: ${prereq}` : undefined}
                className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                  isAtivo
                    ? 'bg-[#f0f5f4] text-[#171d1c] cursor-default'
                    : isBloqueado
                    ? 'text-[#bcc9c4] cursor-not-allowed'
                    : 'text-[#3d4945] hover:bg-[#f0f5f4]'
                }`}
              >
                <Icon size={14} className={isBloqueado ? 'opacity-30' : cor} />
                <span className="flex-1">{label}</span>
                {isBloqueado && prereq && (
                  <span className="text-[10px] font-semibold text-[#bcc9c4] whitespace-nowrap">
                    após {prereq.split(' → ')[0]}
                  </span>
                )}
              </button>
            )
          })}
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
