'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  CalendarDays, ChevronDown, ChevronUp, RefreshCw, Calendar,
  CheckCircle, Hourglass, Stethoscope, CheckCheck, XCircle, UserX, CalendarClock
} from 'lucide-react'

type Sessao = {
  id: string
  data_agendamento: string
  status: string
  observacoes?: string | null
  duracao_minutos?: number | null
}

type AgendamentoComSessoes = {
  agendamento_id: string | null
  tipo: string
  is_recorrente: boolean
  sessoes: Sessao[]
}

const STATUS_CONFIG: Record<string, { label: string; cor: string; bg: string; Icon: any }> = {
  'Confirmado':      { label: 'Confirmado',      cor: 'text-green-700',   bg: 'bg-green-50',   Icon: CheckCircle },
  'Aguardando':      { label: 'Aguardando',      cor: 'text-amber-600',   bg: 'bg-amber-50',   Icon: Hourglass },
  'Em Atendimento':  { label: 'Em Atendimento',  cor: 'text-blue-600',    bg: 'bg-blue-50',    Icon: Stethoscope },
  'Concluído':       { label: 'Concluído',       cor: 'text-violet-600',  bg: 'bg-violet-50',  Icon: CheckCheck },
  'Cancelado':       { label: 'Cancelado',       cor: 'text-red-600',     bg: 'bg-red-50',     Icon: XCircle },
  'Falta':           { label: 'Falta',           cor: 'text-gray-500',    bg: 'bg-gray-100',   Icon: UserX },
  'Reposição':       { label: 'Reposição',       cor: 'text-cyan-600',    bg: 'bg-cyan-50',    Icon: RefreshCw },
  'Reagendado':      { label: 'Reagendado',      cor: 'text-orange-600',  bg: 'bg-orange-50',  Icon: CalendarClock },
}

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? { label: status, cor: 'text-slate-500', bg: 'bg-slate-100', Icon: CheckCircle }
}

function calcularStatusGeral(sessoes: Sessao[]): string {
  const contagem: Record<string, number> = {}
  for (const s of sessoes) {
    contagem[s.status] = (contagem[s.status] || 0) + 1
  }
  const ordem = ['Em Atendimento', 'Aguardando', 'Confirmado', 'Reposição', 'Concluído', 'Falta', 'Reagendado', 'Cancelado']
  for (const status of ordem) {
    if (contagem[status]) return status
  }
  return sessoes[0]?.status ?? 'Confirmado'
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

  const concluidas = sessoes.filter(s => s.status === 'Concluído').length
  const canceladas = sessoes.filter(s => s.status === 'Cancelado' || s.status === 'Falta' || s.status === 'Reagendado').length
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
        <div style={{ zIndex: 3 }} className={`relative bg-white rounded-xl ${expandido ? 'shadow-sm' : 'shadow-md'} border border-slate-100 border-l-4 ${config.cor.replace('text-', 'border-')} transition-all duration-300`}>
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
                  const bgBar = s.status === 'Concluído' ? 'bg-violet-500'
                    : s.status === 'Cancelado' ? 'bg-red-500'
                    : s.status === 'Falta' ? 'bg-gray-400'
                    : s.status === 'Confirmado' ? 'bg-green-500'
                    : s.status === 'Em Atendimento' ? 'bg-blue-500'
                    : s.status === 'Reposição' ? 'bg-cyan-500'
                    : s.status === 'Reagendado' ? 'bg-orange-500'
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
              return (
                <div key={sessao.id} className={`flex items-center gap-3 p-2.5 rounded-lg border border-current/10 ${sc.bg}`}>
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
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${sc.bg} ${sc.cor} border border-current/20`}>
                    {sc.label}
                  </span>
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
