'use client'

import { useState, useEffect, useTransition, useMemo } from 'react'
import { Users, ChevronDown, ChevronUp } from 'lucide-react'
import { useRealtimeDisponibilidade, type StatusRow } from '@/hooks/useRealtimeDisponibilidade'
import { setStatusDisponibilidade } from '@/actions/status-disponibilidade'
import { usePathname } from 'next/navigation'
import toast from 'react-hot-toast'
import { useSlideNovoAgendamentoAberto } from '@/components/layout/SlideNovoAgendamentoContext'
import { getCorConfig, DEFAULT_OPCOES, type OpcaoStatus } from '@/lib/status-disponibilidade-cores'
import {
  opcoesSelecionaveis,
  validarObservacao,
  tempoRestanteBlocoMs,
  formatarContagemRegressiva,
} from '@/lib/status-disponibilidade-regras'

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
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)
  const [observacaoInput, setObservacaoInput] = useState('')
  const [agora, setAgora] = useState(() => new Date())

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)')
    const sync = () => setIsMobile(mediaQuery.matches)
    sync()
    mediaQuery.addEventListener('change', sync)
    return () => mediaQuery.removeEventListener('change', sync)
  }, [])

  // Relógio do contador regressivo (AC-022/AC-026). Só bate com o painel aberto:
  // o FAB fica montado em todas as rotas, e um setInterval de 1s permanente
  // atrás de um painel fechado é custo puro.
  useEffect(() => {
    if (!open) return
    const id = setInterval(() => setAgora(new Date()), 1_000)
    return () => clearInterval(id)
  }, [open])

  const isTelaCadastro = pathname?.includes('/novo') || pathname?.includes('/editar') || pathname?.includes('/vendas/nova')
  if (!isMobile && isTelaCadastro) return null
  if (isMobile && slideNovoAgendamentoAberto) return null

  // Status selecionáveis manualmente (AC-011: status de sistema, como "Em atendimento", não entram)
  const opcoesParaEscolha = opcoesSelecionaveis(opcoes).sort((a, b) => a.ordem - b.ordem)

  // Config rápida por slug
  const cfgPorSlug = Object.fromEntries(opcoes.map(o => [o.slug, { ...getCorConfig(o.cor), label: o.label, labelCurto: o.label_curto }]))

  const getStatus = (slug: string) => cfgPorSlug[slug] ?? { ...getCorConfig('slate'), label: slug, labelCurto: slug }

  const myStatus = statuses.find(s => s.profissional_id === currentUserId)?.status ?? 'ausente'
  const podeToggle = profissionais.some(p => p.id === currentUserId)
  const livres = statuses.filter(s => s.status === 'disponivel').length
  const total = profissionais.length

  function handleSet(novoStatus: string, observacao?: string) {
    if (novoStatus === myStatus) return
    startTransition(async () => {
      const res = await setStatusDisponibilidade(novoStatus, observacao)
      if ('error' in res) {
        toast.error(res.error)
      } else {
        toast.success(getStatus(novoStatus).label)
        setPendingStatus(null)
        setObservacaoInput('')
      }
    })
  }

  // AC-001: status que exige observação abre confirmação com campo de texto em vez de trocar direto.
  function handleSelecionarOpcao(op: OpcaoStatus) {
    if (op.slug === myStatus) return
    if (op.observacao_obrigatoria) {
      setPendingStatus(op.slug)
      setObservacaoInput('')
      return
    }
    handleSet(op.slug)
  }

  function handleConfirmarObservacao() {
    const op = opcoes.find(o => o.slug === pendingStatus)
    if (!op) return
    const validacao = validarObservacao(op, observacaoInput)
    if (!validacao.valido) {
      toast.error(validacao.mensagem)
      return
    }
    handleSet(op.slug, observacaoInput)
  }

  function handleCancelarObservacao() {
    setPendingStatus(null)
    setObservacaoInput('')
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

                // AC-022/AC-023/AC-024: o prazo só existe para status declarado
                // pelo profissional. 'disponivel', 'ausente' e 'ocupado' são
                // derivados do sistema e não expiram — contar as 2h neles seria
                // prometer um vencimento que nunca vem.
                const opcaoDoStatus = opcoes.find(o => o.slug === slug)
                const ehDeclarado = opcaoDoStatus ? !opcaoDoStatus.sistema && slug !== 'ocupado' : false
                const restanteMs = ehDeclarado && st?.atualizado_em
                  ? tempoRestanteBlocoMs(new Date(st.atualizado_em), agora)
                  : null

                return (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Dot cor={opcaoDoStatus?.cor ?? 'slate'} ping />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {p.nome}{isMe && <span className="text-slate-400 font-normal"> (você)</span>}
                      </p>
                      <p className={`text-[10px] font-medium ${cfg.text}`}>
                        {cfg.labelCurto}
                        {restanteMs !== null && (
                          <span
                            className={`ml-1.5 font-semibold tabular-nums ${
                              restanteMs <= 0 ? 'text-rose-600' : 'text-slate-400'
                            }`}
                            title={
                              restanteMs <= 0
                                ? 'Passou das 2h — volta para Disponível no próximo ciclo (até 10 min)'
                                : `${isMe ? 'Você volta' : 'Volta'} para Disponível quando zerar`
                            }
                          >
                            {restanteMs <= 0 ? 'expirado' : formatarContagemRegressiva(restanteMs)}
                          </span>
                        )}
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
              {opcoesParaEscolha.map(op => {
                const cfg = getCorConfig(op.cor)
                const isAtual = myStatus === op.slug

                if (pendingStatus === op.slug) {
                  return (
                    <div key={op.slug} className="rounded-xl border border-slate-200 p-2 space-y-1.5">
                      <p className="text-[11px] font-semibold text-slate-600">{op.label} — observação obrigatória</p>
                      <textarea
                        autoFocus
                        rows={2}
                        value={observacaoInput}
                        onChange={e => setObservacaoInput(e.target.value)}
                        placeholder="Descreva o motivo..."
                        className="w-full text-xs rounded-lg border border-slate-200 px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-slate-300"
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={handleCancelarObservacao}
                          disabled={isPending}
                          className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 px-2 py-1 disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleConfirmarObservacao}
                          disabled={isPending}
                          className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${cfg.bg} ${cfg.text} disabled:opacity-50`}
                        >
                          Confirmar
                        </button>
                      </div>
                    </div>
                  )
                }

                return (
                  <button
                    key={op.slug}
                    onClick={() => handleSelecionarOpcao(op)}
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