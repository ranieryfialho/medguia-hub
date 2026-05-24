'use client'

import { useState, useEffect, useTransition } from 'react'
import { Users, ChevronDown, ChevronUp, CircleDot } from 'lucide-react'
import { useRealtimeDisponibilidade, type StatusRow } from '@/hooks/useRealtimeDisponibilidade'
import { setStatusDisponibilidade, type StatusDisponibilidade } from '@/actions/status-disponibilidade'
import { usePathname } from 'next/navigation'
import toast from 'react-hot-toast'
import { estaDentroDaJornadaAgora, getDiaSemanaAtualNaTimezone, type DisponibilidadeDia } from '@/lib/disponibilidade'
import { useSlideNovoAgendamentoAberto } from '@/components/layout/SlideNovoAgendamentoContext'

type Profissional = { id: string; nome: string; cargo: string }

type Props = {
  profissionais: Profissional[]
  initialStatuses: StatusRow[]
  currentUserId: string
  disponibilidades?: Record<string, Record<number, DisponibilidadeDia>>
  disponibilidadesHoje?: Record<string, DisponibilidadeDia | null>
}

const STATUS_CONFIG: Record<StatusDisponibilidade, { label: string; labelCurto: string; dot: string; bg: string; text: string }> = {
  disponivel: { label: 'Disponível',   labelCurto: 'livre',    dot: 'bg-emerald-500', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  reuniao:    { label: 'Em reunião',   labelCurto: 'reunião',  dot: 'bg-amber-400',   bg: 'bg-amber-100',   text: 'text-amber-700'   },
  ocupado:    { label: 'Ocupado',      labelCurto: 'ocupado',  dot: 'bg-slate-300',   bg: 'bg-slate-100',   text: 'text-slate-500'   },
  ausente:    { label: 'Ausente',      labelCurto: 'ausente',  dot: 'bg-slate-200',   bg: 'bg-slate-50',    text: 'text-slate-400'   },
}

const OPCOES: StatusDisponibilidade[] = ['disponivel', 'reuniao', 'ocupado']

function tempoDesde(atualizado_em: string): string {
  const diff = Math.floor((Date.now() - new Date(atualizado_em).getTime()) / 1000)
  if (diff < 60) return 'agora'
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  return `${Math.floor(diff / 3600)}h`
}

function Dot({ status, ping = false }: { status: StatusDisponibilidade; ping?: boolean }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      {ping && status !== 'ocupado' && (
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.dot} opacity-60`} />
      )}
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${cfg.dot}`} />
    </span>
  )
}

export function WidgetDisponibilidade({ profissionais, initialStatuses, currentUserId, disponibilidades, disponibilidadesHoje }: Props) {
  const pathname = usePathname()
  const statuses = useRealtimeDisponibilidade(initialStatuses)
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [, setTick] = useState(0)
  const slideNovoAgendamentoAberto = useSlideNovoAgendamentoAberto()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)')
    const sync = () => setIsMobile(mediaQuery.matches)

    sync()
    mediaQuery.addEventListener('change', sync)
    return () => mediaQuery.removeEventListener('change', sync)
  }, [])

  // No desktop, mantemos oculto em telas de cadastro/edição que já possuem barras fixas no rodapé.
  const isTelaCadastro = pathname?.includes('/novo') || pathname?.includes('/editar') || pathname?.includes('/vendas/nova')

  if (!isMobile && isTelaCadastro) return null
  // No mobile, ocultamos apenas durante o fluxo de agendamento aberto.
  if (isMobile && slideNovoAgendamentoAberto) return null

  const diaSemanaAtual = getDiaSemanaAtualNaTimezone()
  const statusesEfetivos = statuses.map((status) => {
    const disponibilidadeHoje = disponibilidadesHoje?.[status.profissional_id] ?? disponibilidades?.[status.profissional_id]?.[diaSemanaAtual] ?? null
    const dentroDaJornada = estaDentroDaJornadaAgora(disponibilidadeHoje)
    return {
      ...status,
      status: (dentroDaJornada ? status.status : 'ausente') as StatusDisponibilidade,
    }
  })

  const myStatus = (statusesEfetivos.find(s => s.profissional_id === currentUserId)?.status ?? 'ausente') as StatusDisponibilidade
  const podeToggle = profissionais.some(p => p.id === currentUserId)
  const livres = statusesEfetivos.filter(s => s.status === 'disponivel').length
  const total = profissionais.length

  function handleSet(novoStatus: StatusDisponibilidade) {
    if (novoStatus === myStatus) return
    startTransition(async () => {
      const res = await setStatusDisponibilidade(novoStatus)
      if ('error' in res) {
        toast.error(res.error)
      } else {
        toast.success(STATUS_CONFIG[novoStatus].label)
      }
    })
  }

  const fabCfg = livres > 0 ? STATUS_CONFIG.disponivel : STATUS_CONFIG.ocupado

  return (
    <div 
      className="fixed bottom-5 right-5 z-[300] flex flex-col items-end gap-2"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >

      {/* Painel expandido */}
      {open && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-64 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-slate-500" />
              <span className="text-xs font-semibold text-slate-700">Equipe</span>
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              livres > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}>
              {livres}/{total} livres
            </span>
          </div>

          {/* Lista */}
          <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
            {profissionais.length === 0 ? (
              <p className="text-xs text-slate-400 px-4 py-3 text-center">Nenhum profissional</p>
            ) : (
              profissionais.map(p => {
                const st = statusesEfetivos.find(s => s.profissional_id === p.id)
                const status = (st?.status ?? 'ausente') as StatusDisponibilidade
                const cfg = STATUS_CONFIG[status]
                const isMe = p.id === currentUserId
                return (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Dot status={status} ping />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {p.nome}{isMe && <span className="text-slate-400 font-normal"> (você)</span>}
                      </p>
                      <p className={`text-[10px] font-medium ${cfg.text}`}>
                        {status === 'disponivel'
                          ? `livre há ${tempoDesde(st!.atualizado_em)}`
                          : status === 'reuniao'
                          ? `em reunião há ${tempoDesde(st!.atualizado_em)}`
                          : status === 'ausente'
                          ? 'ausente hoje'
                          : 'ocupado'}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Toggle 3 estados — só para quem está na lista */}
          {podeToggle && (
            <div className="px-4 py-3 border-t border-slate-100 space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Meu status</p>
              {OPCOES.map(op => {
                const cfg = STATUS_CONFIG[op]
                const isAtual = myStatus === op
                return (
                  <button
                    key={op}
                    onClick={() => handleSet(op)}
                    disabled={isPending || isAtual}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                      isAtual
                        ? `${cfg.bg} ${cfg.text} cursor-default`
                        : 'hover:bg-slate-50 text-slate-600'
                    } disabled:opacity-50`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                    {cfg.label}
                    {isAtual && <CircleDot size={12} className="ml-auto opacity-60" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-2 pl-3 pr-2.5 py-2.5 rounded-2xl shadow-lg border transition-all ${
          livres > 0
            ? 'bg-emerald-500 border-emerald-600 text-white hover:bg-emerald-600'
            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
        }`}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          {livres > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${livres > 0 ? 'bg-white' : fabCfg.dot}`} />
        </span>
        <span className="text-xs font-bold">
          {livres > 0 ? `${livres} livre${livres > 1 ? 's' : ''}` : 'Todos ocupados'}
        </span>
        {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
    </div>
  )
}
