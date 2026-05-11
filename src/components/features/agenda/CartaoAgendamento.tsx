'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  CalendarDays, ChevronDown, ChevronUp, RefreshCw, Calendar,
  CheckCircle, Hourglass, Stethoscope, CheckCheck, XCircle, UserX, CalendarClock, ClipboardList, Layers, StickyNote, Timer
} from 'lucide-react'
import {
  getAtendimentoStatusKey,
  isStatusConcluido,
  normalizeAtendimentoStatus,
} from '@/lib/atendimento-status'

type ProntuarioResumo = {
  evolucao: string | null
  escala_dor: number | null
  queixa_principal: string | null
  procedimentos?: string | null
  observacoes?: string | null
  updated_at?: string | null
}

type Sessao = {
  id: string
  data_agendamento: string
  status: string
  observacoes?: string | null
  duracao_minutos?: number | null
  prontuario?: ProntuarioResumo | null
}

type AgendamentoComSessoes = {
  agendamento_id: string | null
  tipo: string
  is_recorrente: boolean
  sessoes: Sessao[]
}

const STATUS_CONFIG: Record<string, { label: string; cor: string; bg: string; border: string; Icon: React.ElementType }> = {
  confirmado:          { label: 'Confirmado',     cor: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-500',  Icon: CheckCircle  },
  aguardando:          { label: 'Aguardando',     cor: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-500',  Icon: Hourglass    },
  aguardando_consulta: { label: 'Ag. Consulta',  cor: 'text-teal-600',   bg: 'bg-teal-50',   border: 'border-teal-500',   Icon: Timer        },
  em_atendimento:      { label: 'Em Atendimento',cor: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-500',   Icon: Stethoscope  },
  concluido:           { label: 'Concluído',      cor: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-500', Icon: CheckCheck   },
  cancelado:           { label: 'Cancelado',      cor: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-500',    Icon: XCircle      },
  falta:               { label: 'Falta',          cor: 'text-gray-500',   bg: 'bg-gray-100',  border: 'border-gray-400',   Icon: UserX        },
  reagendado:          { label: 'Reagendado',     cor: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-500', Icon: CalendarClock },
}

function getStatusConfig(status: string) {
  return STATUS_CONFIG[getAtendimentoStatusKey(status)] ?? { label: normalizeAtendimentoStatus(status), cor: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-300', Icon: CheckCircle }
}

function dorBadgeClass(n: number): string {
  if (n === 0)  return 'bg-emerald-100 text-emerald-700'
  if (n <= 3)   return 'bg-lime-100    text-lime-700'
  if (n <= 6)   return 'bg-amber-100   text-amber-700'
  return              'bg-red-100     text-red-700'
}

function calcularStatusGeral(sessoes: Sessao[]): string {
  const contagem: Record<string, number> = {}
  for (const s of sessoes) {
    const key = getAtendimentoStatusKey(s.status)
    contagem[key] = (contagem[key] || 0) + 1
  }
  const ordem = ['em_atendimento', 'aguardando_consulta', 'aguardando', 'confirmado', 'concluido', 'falta', 'reagendado', 'cancelado']
  for (const status of ordem) {
    if (contagem[status]) return status
  }
  return sessoes[0]?.status ?? 'confirmado'
}

export function CartaoAgendamento({ grupo }: { grupo: AgendamentoComSessoes }) {
  const [expandido, setExpandido] = useState(false)

  const { sessoes, tipo, is_recorrente } = grupo
  const statusGeral = calcularStatusGeral(sessoes)
  const config = getStatusConfig(statusGeral)

  const sessoesOrdenadas = [...sessoes].sort(
    (a, b) => new Date(a.data_agendamento).getTime() - new Date(b.data_agendamento).getTime()
  )
  const primeiraSessao = sessoesOrdenadas[0]
  const ultimaSessao = sessoesOrdenadas[sessoesOrdenadas.length - 1]

  const concluidas = sessoes.filter(s => isStatusConcluido(s.status)).length
  const canceladas = sessoes.filter(s => ['cancelado', 'falta', 'reagendado'].includes(getAtendimentoStatusKey(s.status))).length
  const pendentes = sessoes.length - concluidas - canceladas

  return (
    <div className="relative mb-8 last:mb-0 animate-in fade-in duration-300">
      {/* Ícone na timeline */}
      <div className={`absolute -left-[10px] top-0 w-10 h-10 rounded-full ${config.bg} flex items-center justify-center border-4 border-white z-10 shadow-md ring-2 ring-white/50`}>
        {is_recorrente
          ? <RefreshCw size={18} className={config.cor} />
          : <Calendar size={18} className={config.cor} />
        }
      </div>

      {/* Stack wrapper */}
      <div className="relative ml-14 md:ml-16">
        {/* Camada 3 — mais atrás (para 3+ sessões) */}
        {!expandido && sessoes.length > 2 && (
          <div className="absolute inset-x-6 -bottom-6 h-16 bg-slate-200 rounded-xl border border-slate-300 shadow-md" style={{ zIndex: 1 }} />
        )}

        {/* Camada 2 — meio (para 2+ sessões) */}
        {!expandido && sessoes.length > 1 && (
          <div className="absolute inset-x-3 -bottom-3 h-12 bg-slate-50 rounded-xl border border-slate-200 shadow-sm" style={{ zIndex: 2 }} />
        )}

        {/* Card principal */}
        <div style={{ zIndex: 3 }} className={`relative bg-white rounded-xl ${expandido ? 'shadow-sm' : 'shadow-md'} border border-slate-100 border-l-4 ${config.border} transition-all duration-300`}>
        {/* Cabeçalho do card */}
        <div className="p-4 bg-gradient-to-b from-slate-50/40 to-transparent">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 ${config.bg} ${config.cor} text-[10px] font-extrabold rounded uppercase tracking-wider`}>
                {config.label}
              </span>
              {is_recorrente && (
                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded uppercase tracking-wider flex items-center gap-1">
                  <RefreshCw size={10} /> Recorrente
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                <CalendarDays size={12} />
                {format(new Date(primeiraSessao.data_agendamento), "dd MMM yyyy", { locale: ptBR })}
                {sessoes.length > 1 && (
                  <> → {format(new Date(ultimaSessao.data_agendamento), "dd MMM yyyy", { locale: ptBR })}</>
                )}
              </span>
            </div>
          </div>

          <h5 className="font-bold text-slate-900 text-[15px] mb-1">{tipo}</h5>

          {/* Barra de progresso das sessões */}
          {sessoes.length > 1 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">{sessoes.length} sessões</span>
                <div className="flex items-center gap-3 text-[11px] font-semibold">
                  <span className="text-[#006b5a]">{concluidas} concluídas</span>
                  {canceladas > 0 && <span className="text-red-500">{canceladas} faltas/canceladas/reagendadas</span>}
                  {pendentes > 0 && <span className="text-slate-400">{pendentes} pendentes</span>}
                </div>
              </div>
              <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-slate-100/80">
                {sessoesOrdenadas.map((s) => {
                  const c = getStatusConfig(s.status)
                  const statusKey = getAtendimentoStatusKey(s.status)
                  const bgBar = statusKey === 'concluido' ? 'bg-violet-500'
                    : statusKey === 'cancelado' ? 'bg-red-500'
                    : statusKey === 'falta' ? 'bg-gray-400'
                    : statusKey === 'confirmado' ? 'bg-green-500'
                    : statusKey === 'em_atendimento' ? 'bg-blue-500'
                    : statusKey === 'reagendado' ? 'bg-orange-500'
                    : statusKey === 'aguardando_consulta' ? 'bg-teal-400'
                    : statusKey === 'aguardando' ? 'bg-amber-400'
                    : 'bg-slate-200'
                  return <div key={s.id} className={`flex-1 ${bgBar} rounded-full transition-colors`} title={`${format(new Date(s.data_agendamento), "dd/MM/yyyy")} — ${c.label}`} />
                })}
              </div>
            </div>
          )}
        </div>

        {/* Botão expandir */}
        <button
          onClick={() => setExpandido(!expandido)}
          className="w-full px-4 py-2 flex items-center justify-between border-t border-slate-50 text-xs font-semibold text-slate-400 hover:text-[#006b5a] hover:bg-slate-50 transition-colors rounded-b-xl"
        >
          <span>{expandido ? 'Ocultar sessões' : `Ver ${sessoes.length} sessão(ões)`}</span>
          {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {/* Lista expandida de sessões */}
        {expandido && (
          <div className="px-4 pb-4 space-y-2 animate-in slide-in-from-top-2 duration-200">
            <div className="h-px bg-slate-100 mb-3" />
            {sessoesOrdenadas.map((sessao, idx) => {
              const sc = getStatusConfig(sessao.status)
              const SessaoIcon = sc.Icon
              const p = sessao.prontuario
              const temProntuario = p && (
                p.evolucao ||
                p.escala_dor !== null ||
                p.queixa_principal ||
                p.procedimentos ||
                p.observacoes
              )
              return (
                <div key={sessao.id} className={`rounded-lg border border-current/10 overflow-hidden ${sc.bg}`}>
                  <div className="flex items-center gap-3 p-2.5">
                    <span className="text-[11px] font-bold text-slate-400 w-5 text-center shrink-0">{idx + 1}</span>
                    <SessaoIcon size={14} className={`${sc.cor} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-slate-700">
                        {format(new Date(sessao.data_agendamento), "EEEE, dd MMM yyyy • HH:mm", { locale: ptBR })}
                      </span>
                      {sessao.observacoes && (
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">{sessao.observacoes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {temProntuario && (
                        <ClipboardList size={12} className="text-[#006b5a]" />
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${sc.bg} ${sc.cor} border border-current/20`}>
                        {sc.label}
                      </span>
                    </div>
                  </div>
                  {temProntuario && (
                    <div className="px-3 pb-2.5 pt-0 space-y-1">
                      <div className="h-px bg-current/10 mb-2" />
                      <div className="flex items-center gap-2 flex-wrap">
                        <ClipboardList size={11} className="text-[#006b5a] shrink-0" />
                        <span className="text-[10px] font-bold text-[#006b5a] uppercase tracking-wide">Evolução</span>
                        {p!.escala_dor !== null && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${dorBadgeClass(p!.escala_dor!)}`}>
                            EVA {p!.escala_dor}
                          </span>
                        )}
                        {p!.updated_at && (
                          <span className="text-[10px] text-slate-400">
                            Atualizado em {format(new Date(p!.updated_at), "dd/MM/yyyy 'às' HH:mm")}
                          </span>
                        )}
                      </div>
                      {p!.queixa_principal && (
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          <span className="font-semibold">Queixa: </span>{p!.queixa_principal}
                        </p>
                      )}
                      {p!.evolucao && (
                        <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-3">{p!.evolucao}</p>
                      )}
                      {p!.procedimentos && (
                        <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-3 flex gap-1">
                          <Layers size={12} className="text-slate-400 shrink-0 mt-0.5" />
                          <span><span className="font-semibold">Procedimentos: </span>{p!.procedimentos}</span>
                        </p>
                      )}
                      {p!.observacoes && (
                        <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-3 flex gap-1">
                          <StickyNote size={12} className="text-slate-400 shrink-0 mt-0.5" />
                          <span><span className="font-semibold">Observações: </span>{p!.observacoes}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
