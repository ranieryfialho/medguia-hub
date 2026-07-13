'use client'

import { useState, useEffect, useTransition, useMemo } from 'react'
import { Users, ChevronDown, ChevronUp } from 'lucide-react'
import { useRealtimeDisponibilidade, type StatusRow } from '@/hooks/useRealtimeDisponibilidade'
import { setStatusDisponibilidade } from '@/actions/status-disponibilidade'
import { usePathname } from 'next/navigation'
import toast from 'react-hot-toast'
import { useSlideNovoAgendamentoAberto } from '@/components/layout/SlideNovoAgendamentoContext'
import { getCorConfig, DEFAULT_OPCOES, type OpcaoStatus } from '@/lib/status-disponibilidade-cores'

type Profissional = { id: string; nome: string; cargo: string }

type Props = {
  profissionais: Profissional[]
  initialStatuses: StatusRow[]
  currentUserId: string
  disponibilidades?: Record<string, Record<number, unknown>>
  disponibilidadesHoje?: Record<string, unknown>
  opcoes?: OpcaoStatus[]
}

function Dot({ cor, ping = false }: { cor: string; ping?: boolean }) {
  const cfg = getCorConfig(cor)
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      {ping && (
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.dot} opacity-60`} />
      )}
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${cfg.dot}`} />
    </span>
  )
}

export function WidgetDisponibilidade({ profissionais, initialStatuses, currentUserId, opcoes: opcoesProp }: Props) {
  const pathname = usePathname()
  const opcoes = opcoesProp ?? DEFAULT_OPCOES
  const profissionalIds = useMemo(() => profissionais.map(p => p.id), [profissionais])
  const statuses = useRealtimeDisponibilidade(initialStatuses, profissionalIds)
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const slideNovoAgendamentoAberto = useSlideNovoAgendamentoAberto()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)')
    const sync = () => setIsMobile(mediaQuery.matches)
    sync()
    mediaQuery.addEventListener('change', sync)
    return () => mediaQuery.removeEventListener('change', sync)
  }, [])

  const isTelaCadastro = pathname?.includes('/novo') || pathname?.includes('/editar') || pathname?.includes('/vendas/nova')
  if (!isMobile && isTelaCadastro) return null
  if (isMobile && slideNovoAgendamentoAberto) return null

  // Status selecionáveis manualmente (não-sistema, ordenados)
  const opcoesSelectionaveis = opcoes.filter(o => !o.sistema).sort((a, b) => a.ordem - b.ordem)

  // Config rápida por slug
  const cfgPorSlug = Object.fromEntries(opcoes.map(o => [o.slug, { ...getCorConfig(o.cor), label: o.label, labelCurto: o.label_curto }]))

  const getStatus = (slug: string) => cfgPorSlug[slug] ?? { ...getCorConfig('slate'), label: slug, labelCurto: slug }

  const myStatus = statuses.find(s => s.profissional_id === currentUserId)?.status ?? 'ausente'
  const podeToggle = profissionais.some(p => p.id === currentUserId)
  const livres = statuses.filter(s => s.status === 'disponivel').length
  const total = profissionais.length

  function handleSet(novoStatus: string) {
    if (novoStatus === myStatus) return
    startTransition(async () => {
      const res = await setStatusDisponibilidade(novoStatus)
      if ('error' in res) {
        toast.error(res.error)
      } else {
        toast.success(getStatus(novoStatus).label)
      }
    })
  }

  const fabCfg = livres > 0 ? getCorConfig('emerald') : getCorConfig('slate')

  return (
    <div
      className="fixed bottom-5 right-5 z-[300] flex flex-col items-end gap-2"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {open && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-64 overflow-hidden">
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

          <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
            {profissionais.length === 0 ? (
              <p className="text-xs text-slate-400 px-4 py-3 text-center">Nenhum profissional</p>
            ) : (
              profissionais.map(p => {
                const st = statuses.find(s => s.profissional_id === p.id)
                const slug = st?.status ?? 'ausente'
                const cfg = getStatus(slug)
                const isMe = p.id === currentUserId
                return (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Dot cor={opcoes.find(o => o.slug === slug)?.cor ?? 'slate'} ping />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {p.nome}{isMe && <span className="text-slate-400 font-normal"> (você)</span>}
                      </p>
                      <p className={`text-[10px] font-medium ${cfg.text}`}>
                        {cfg.labelCurto}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {podeToggle && (
            <div className="px-4 py-3 border-t border-slate-100 space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Meu status</p>
              {opcoesSelectionaveis.map(op => {
                const cfg = getCorConfig(op.cor)
                const isAtual = myStatus === op.slug
                return (
                  <button
                    key={op.slug}
                    onClick={() => handleSet(op.slug)}
                    disabled={isPending || isAtual}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                      isAtual
                        ? `${cfg.bg} ${cfg.text} cursor-default`
                        : 'hover:bg-slate-50 text-slate-600'
                    } disabled:opacity-50`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                    {op.label}
                    {isAtual && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-current opacity-60" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

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