'use client'

import { useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { BellRing, ChevronRight, X } from 'lucide-react'
import { formatAppDateKey } from '@/lib/datetime'
import { useNotificacoesContext } from './NotificacoesContext'
import { TIPO_CONFIG, ehNotificacaoDerivada } from './notificacoes-tipos'

const MAX_ITENS = 6

/**
 * Resumo das pendências no primeiro acesso do dia (fuso da clínica). Reaproveita
 * os dados do sino — não faz requisição de leitura — e grava uma vez por dia
 * ao ser fechado. Pendências dispensadas em "Limpar" já vêm filtradas.
 */
export function ModalNotificacoesDiarias() {
  const { notificacoes, carregando, modalVistoEm, marcarModalVisto } = useNotificacoesContext()

  const pendencias = useMemo(() => notificacoes.filter((n) => ehNotificacaoDerivada(n.id)), [notificacoes])
  const aberto = !carregando && pendencias.length > 0 && modalVistoEm !== formatAppDateKey(new Date())
  const router = useRouter()

  const visiveis = useMemo(() => pendencias.slice(0, MAX_ITENS), [pendencias])
  const restantes = pendencias.length - visiveis.length

  // Fechar o modal conta como "visto hoje" e marca como lidas as pendências exibidas.
  const fechar = useCallback(() => marcarModalVisto(visiveis.map((n) => n.id)), [marcarModalVisto, visiveis])

  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar() }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [aberto, fechar])

  if (!aberto) return null

  function abrir(link: string | null) {
    fechar()
    if (link) router.push(link)
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) fechar() }}
      role="dialog"
      aria-modal="true"
      aria-label="Pendências do dia"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#cce2da] text-[#006b5a]">
            <BellRing size={18} />
          </span>
          <div className="flex-1">
            <h2 className="text-base font-bold text-[#171d1c]">Pendências de hoje</h2>
            <p className="text-xs text-[#3d4945]/70">
              {pendencias.length} item{pendencias.length !== 1 ? 's' : ''} aguardando sua atenção
            </p>
          </div>
          <button
            onClick={fechar}
            aria-label="Fechar"
            className="p-1.5 rounded-lg hover:bg-slate-100 text-[#3d4945] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <ul className="max-h-[50vh] overflow-y-auto divide-y divide-slate-50">
          {visiveis.map((n) => {
            const cfg = TIPO_CONFIG[n.tipo] ?? { cor: 'bg-slate-100 text-slate-600', label: n.tipo }
            return (
              <li key={n.id}>
                <button
                  onClick={() => abrir(n.link)}
                  className="w-full flex items-start gap-3 px-5 py-3 text-left hover:bg-[#f0f5f4] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${cfg.cor}`}>{cfg.label}</span>
                    <p className="mt-1 text-sm font-semibold text-[#171d1c] leading-snug">{n.titulo}</p>
                    <p className="text-xs text-[#3d4945]/70 leading-snug line-clamp-2">{n.mensagem}</p>
                  </div>
                  {n.link && <ChevronRight size={14} className="shrink-0 mt-5 text-[#3d4945]/30" />}
                </button>
              </li>
            )
          })}
        </ul>

        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-100 bg-[#f8fbfa]">
          <span className="text-xs text-[#3d4945]/60">
            {restantes > 0 ? `+ ${restantes} no sino de notificações` : 'Você verá este resumo de novo amanhã.'}
          </span>
          <button
            onClick={fechar}
            className="rounded-xl bg-[#006b5a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#005646] transition-colors"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  )
}
