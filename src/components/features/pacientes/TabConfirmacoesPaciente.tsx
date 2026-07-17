'use client'

import { useEffect, useState } from 'react'
import { Loader2, CheckCircle2, XCircle, AlertCircle, Clock, MinusCircle } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { buscarConfirmacoesPaciente, type ConfirmacaoPaciente } from '@/actions/confirmacoes-auditoria'

const CONFIRMACAO_CONFIG: Record<string, { label: string; icon: React.ElementType; cor: string; bg: string }> = {
  confirmou:    { label: 'Confirmou',    icon: CheckCircle2,  cor: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  vai_faltar:   { label: 'Vai Faltar',   icon: AlertCircle,   cor: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200' },
  nao_atendeu:  { label: 'Não Atendeu', icon: XCircle,       cor: 'text-red-500',     bg: 'bg-red-50 border-red-200' },
}

const SEM_RESPOSTA_CONFIG = { label: 'Sem resposta', icon: MinusCircle, cor: 'text-slate-400', bg: 'bg-slate-50 border-slate-200' }

function getCfg(confirmacao: string | null) {
  if (!confirmacao) return SEM_RESPOSTA_CONFIG
  return CONFIRMACAO_CONFIG[confirmacao] ?? SEM_RESPOSTA_CONFIG
}

export function TabConfirmacoesPaciente({ pacienteId }: { pacienteId: string }) {
  const [confirmacoes, setConfirmacoes] = useState<ConfirmacaoPaciente[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    buscarConfirmacoesPaciente(pacienteId).then((data) => {
      setConfirmacoes(data)
      setCarregando(false)
    })
  }, [pacienteId])

  if (carregando) return (
    <div className="flex items-center justify-center py-16 text-sm text-[#6d7a75]">
      <Loader2 size={20} className="animate-spin mr-2" />Carregando...
    </div>
  )

  if (confirmacoes.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <Clock size={32} className="text-slate-200" />
      <p className="text-sm font-semibold text-[#3d4945]">Nenhum agendamento encontrado</p>
    </div>
  )

  const confirmou   = confirmacoes.filter(c => c.contato_confirmacao === 'confirmou').length
  const vaiFaltar   = confirmacoes.filter(c => c.contato_confirmacao === 'vai_faltar').length
  const naoAtendeu  = confirmacoes.filter(c => c.contato_confirmacao === 'nao_atendeu').length
  const semResposta = confirmacoes.filter(c => !c.contato_confirmacao).length

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Confirmou',    value: confirmou,   cor: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Vai Faltar',   value: vaiFaltar,   cor: 'text-amber-600',   bg: 'bg-amber-50' },
          { label: 'Não Atendeu', value: naoAtendeu,  cor: 'text-red-500',     bg: 'bg-red-50' },
          { label: 'Sem Resposta', value: semResposta, cor: 'text-slate-500',   bg: 'bg-slate-50' },
        ].map(({ label, value, cor, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-3 text-center border border-slate-100`}>
            <p className={`text-2xl font-extrabold ${cor}`}>{value}</p>
            <p className="text-[10px] font-semibold text-[#6d7a75] uppercase tracking-wide mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {confirmacoes.map((c) => {
          const cfg = getCfg(c.contato_confirmacao)
          const Icon = cfg.icon
          return (
            <div key={c.id} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${cfg.bg}`}>
              <Icon size={16} className={`${cfg.cor} shrink-0`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#083142] truncate">
                  {c.tipo ?? 'Sessão'}
                  {c.numero_sessao && c.total_sessoes ? ` — Sessão ${c.numero_sessao}/${c.total_sessoes}` : ''}
                </p>
                <p className="text-[10px] text-[#6d7a75]">
                  {format(new Date(c.data_agendamento), "EEEE, dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
              <span className={`text-[10px] font-bold whitespace-nowrap ${cfg.cor}`}>
                {cfg.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
