'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { User, Pencil, Timer, Stethoscope, Loader2, Megaphone, CheckCheck } from 'lucide-react'
import type { PlanoSaude } from '@/actions/planos-saude'
import { formatAppTime } from '@/lib/datetime'
import { mudarStatusAgendamento, chamarPaciente } from '@/actions/agenda'
import { createClient } from '@/lib/supabase/client'
import { getAtendimentoStatusKey } from '@/lib/atendimento-status'
import { useTempoEspera } from '@/hooks/useTempoEspera'
import { MenuAcoesAgendamento } from './MenuAcoesAgendamento'
import { SlideNovoAgendamento } from './SlideNovoAgendamento'
import { AgendamentoModal } from './AgendamentoModal'
import {
  getConfig,
  deveExibirContagemTipoSeparada,
  formatarTipoComContagem,
  type AgendamentoDetalhe,
} from './agendamento-item-utils'
import toast from 'react-hot-toast'


export type { AgendamentoDetalhe }

type Paciente = { id: string; nome: string }
type Profissional = { id: string; nome: string; cargo: string }

export function ConfirmacaoFaltaModal({
  onConfirmar,
  onCancelar,
}: {
  onConfirmar: (reagendar: boolean) => void
  onCancelar: () => void
}) {
  const [reagendar, setReagendar] = useState(true)

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
        <h3 className="text-base font-bold text-[#083142] mb-1">Marcar como Falta?</h3>
        <p className="text-sm text-[#6d7a75] mb-5">
          O status do agendamento será alterado para <strong>Falta</strong>.
        </p>
        <label className="flex items-center gap-3 p-3 rounded-xl border border-[#bcc9c4] cursor-pointer hover:bg-[#f0f5f4] transition-colors mb-5">
          <input
            type="checkbox"
            checked={reagendar}
            onChange={(e) => setReagendar(e.target.checked)}
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
  const [statusLoading, setStatusLoading] = useState<string | null>(null)
  const router = useRouter()
  const config = getConfig(agendamento.status)
  const Icone = config.Icon
  const hora = formatAppTime(agendamento.data_agendamento)
  const nomePaciente = agendamento.pacientes?.nome || 'Paciente não identificado'
  const descricaoTipoComContagem = formatarTipoComContagem(agendamento)
  const exibirContagemTipoSeparada = deveExibirContagemTipoSeparada(agendamento)
  const statusKey = getAtendimentoStatusKey(agendamento.status)
  const mostrarChegou         = ['confirmado', 'aguardando'].includes(statusKey)
  const mostrarEmAtendimento  = ['aguardando', 'aguardando_consulta'].includes(statusKey)
  const mostrarChamar                     = statusKey === 'aguardando_consulta'
  const [chamarLoading, setChamarLoading] = useState(false)
  const [chamadoAs, setChamadoAs]         = useState<string | null>(null)
  const tempoEspera = useTempoEspera(agendamento.id, agendamento.aguardando_desde, agendamento.em_atendimento_desde, () => router.refresh())

  async function handleMudarStatus(novoStatus: string) {
    setStatusLoading(novoStatus)
    const result = await mudarStatusAgendamento(agendamento.id, novoStatus)
    setStatusLoading(null)
    if (result?.error) {
      toast.error(result.error)
    } else {
      router.refresh()
    }
  }

  async function handleChamar() {
    setChamarLoading(true)
    const result = await chamarPaciente(agendamento.id)
    setChamarLoading(false)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    setChamadoAs(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))

    // Broadcast direto para o painel TV — aguarda SUBSCRIBED antes de enviar
    const nomeProfissional = agendamento.profissional?.full_name ?? 'Profissional'
    const supabase = createClient()
    const ch = supabase.channel('painel-chamadas')
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => { supabase.removeChannel(ch); resolve() }, 3000)
      ch.subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        clearTimeout(timeout)
        ch.send({
          type: 'broadcast',
          event: 'chamar',
          payload: { profissional: nomeProfissional, paciente: nomePaciente },
        }).finally(() => { supabase.removeChannel(ch); resolve() })
      })
    })

  }

  return (
    <>
      <div className="grid grid-cols-[38px_1fr] sm:grid-cols-[72px_1fr] gap-2 sm:gap-3 group">
        <div className="text-[10px] sm:text-sm font-bold text-[#3d4945]/60 flex items-start justify-end pt-1">{hora}</div>
        <div className="relative pt-1 pb-3 sm:py-3 border-t border-dashed border-[#bcc9c4]/50 flex items-center">
          <div
            onClick={() => setModalAberto(true)}
            className={`${config.cardBg} border-l-4 ${config.border} p-2.5 sm:p-3 rounded-xl w-full transition-transform cursor-pointer ${!isMenuOpen ? 'hover:scale-[1.01]' : ''}`}
          >
            {/* Grid principal: conteúdo + ícones de ação */}
            <div className="grid grid-cols-[1fr_auto] items-center gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 shrink-0 rounded-full bg-white flex items-center justify-center shadow-sm ${config.iconText}`}>
                  <Icone size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className={`text-sm font-bold truncate min-w-0 flex-1 ${config.titleText}`}>{nomePaciente}</p>
                    {agendamento.total_sessoes && agendamento.total_sessoes > 1 && (
                      <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 bg-white/60 text-[#006b5a] rounded-full border border-[#006b5a]/20 whitespace-nowrap">
                        {agendamento.numero_sessao}/{agendamento.total_sessoes}
                      </span>
                    )}
                    {agendamento.marcou_retorno && (
                      <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 bg-[#e0e7ff] text-[#3730a3] rounded-full border border-[#c7d2fe] whitespace-nowrap">
                        Retorno
                      </span>
                    )}
                    {tempoEspera?.tipo === 'aguardando' && statusKey === 'aguardando_consulta' && (
                      <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded-full border border-teal-300 whitespace-nowrap">
                        <Timer size={9} />
                        {tempoEspera.tempo}
                      </span>
                    )}
                    {tempoEspera?.tipo === 'esperou' && (
                      <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full border border-slate-300 whitespace-nowrap">
                        <Timer size={9} />
                        Esperou {tempoEspera.tempo}
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] ${config.subText} mt-1 font-medium italic`}>
                    {agendamento.agendamento_pai?.tipo?.trim() || agendamento.tipo}
                  </p>
                  {agendamento.agendamento_pai?.tipo?.trim() && (
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <p className={`text-[11px] ${config.subText} font-medium`}>{descricaoTipoComContagem}</p>
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
              {/* Coluna direita: só ícones pequenos — não infla a largura no mobile */}
              <div className="flex items-center gap-2 sm:gap-3 justify-end">
                {agendamento.google_drive_pasta_url && (
                  <a
                    href={agendamento.google_drive_pasta_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title="Abrir pasta no Google Drive"
                    className="text-slate-400 hover:text-[#006b5a] transition-colors"
                  >
                    📂
                  </a>
                )}
                <Link
                  href={`/pacientes/${agendamento.paciente_id}`}
                  onClick={(e) => e.stopPropagation()}
                  title="Ver jornada do paciente"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[#3d4945]/50 hover:text-[#006b5a] hover:bg-[#dee3e3] transition-colors"
                >
                  <User size={15} />
                </Link>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setSlideEditarAberto(true) }}
                  title="Editar agendamento"
                  className="hidden sm:flex w-7 h-7 items-center justify-center rounded-lg text-[#3d4945]/50 hover:text-[#006b5a] hover:bg-[#dee3e3] transition-colors"
                >
                  <Pencil size={14} />
                </button>
                {(mostrarChegou || mostrarEmAtendimento) && (
                  <div className="hidden sm:flex items-center gap-2">
                    <span className="text-[#bcc9c4] select-none">|</span>
                    {mostrarChegou && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleMudarStatus('Aguardando Consulta') }}
                        disabled={!!statusLoading}
                        title="Paciente chegou — marcar como Aguardando Consulta"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-teal-600 hover:bg-teal-50 transition-colors disabled:opacity-40"
                      >
                        {statusLoading === 'Aguardando Consulta'
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Timer size={14} />}
                      </button>
                    )}
                    {mostrarEmAtendimento && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleMudarStatus('Em Atendimento') }}
                        disabled={!!statusLoading}
                        title="Iniciar atendimento — marcar como Em Atendimento"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-40"
                      >
                        {statusLoading === 'Em Atendimento'
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Stethoscope size={14} />}
                      </button>
                    )}
                    {mostrarChamar && (
                      chamadoAs ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setChamadoAs(null); handleChamar() }}
                          title="Chamar novamente"
                          className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-green-100 border border-green-300 text-green-700 text-[10px] font-bold hover:bg-green-200 transition-colors"
                        >
                          <CheckCheck size={11} />
                          {chamadoAs}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleChamar() }}
                          disabled={chamarLoading}
                          title="Chamar paciente no painel da sala de espera"
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-orange-500 hover:bg-orange-50 transition-colors disabled:opacity-40"
                        >
                          {chamarLoading ? <Loader2 size={14} className="animate-spin" /> : <Megaphone size={14} />}
                        </button>
                      )
                    )}
                  </div>
                )}
                <span className={`hidden sm:inline-block px-3 py-1 ${config.badgeBg} text-white text-[10px] font-bold rounded-full uppercase tracking-widest`}>
                  {config.label}
                </span>
                <div onClick={(e) => e.stopPropagation()}>
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
            {/* Botões de ação rápida — mobile: abaixo do grid, fora da coluna auto */}
            {(mostrarChegou || mostrarEmAtendimento || mostrarChamar) && (
              <div className="sm:hidden mt-2 pl-12 flex flex-col gap-1.5">
                {mostrarChegou && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleMudarStatus('Aguardando Consulta') }}
                    disabled={!!statusLoading}
                    className="flex items-center justify-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 transition-colors disabled:opacity-40"
                  >
                    {statusLoading === 'Aguardando Consulta' ? <Loader2 size={11} className="animate-spin" /> : <Timer size={11} />}
                    Paciente chegou
                  </button>
                )}
                {mostrarEmAtendimento && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleMudarStatus('Em Atendimento') }}
                    disabled={!!statusLoading}
                    className="flex items-center justify-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors disabled:opacity-40"
                  >
                    {statusLoading === 'Em Atendimento' ? <Loader2 size={11} className="animate-spin" /> : <Stethoscope size={11} />}
                    Iniciar atendimento
                  </button>
                )}
                {mostrarChamar && (
                  chamadoAs ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setChamadoAs(null); handleChamar() }}
                      className="flex items-center justify-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg text-green-700 bg-green-50 border border-green-300 hover:bg-green-100 transition-colors"
                    >
                      <CheckCheck size={11} />
                      Chamado às {chamadoAs}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleChamar() }}
                      disabled={chamarLoading}
                      className="flex items-center justify-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg text-orange-600 bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors disabled:opacity-40"
                    >
                      {chamarLoading ? <Loader2 size={11} className="animate-spin" /> : <Megaphone size={11} />}
                      Chamar no painel
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {modalAberto && (
        <AgendamentoModal
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
        <AgendamentoModal
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
