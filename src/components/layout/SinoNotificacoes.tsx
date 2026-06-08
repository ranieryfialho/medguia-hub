'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, CheckCheck, X, ChevronRight, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useNotificacoes } from '@/hooks/useNotificacoes'
import type { Notificacao } from '@/actions/notificacoes'

const TIPO_CONFIG: Record<string, { cor: string; label: string }> = {
  agenda_confirmou:      { cor: 'bg-emerald-100 text-emerald-700', label: 'Agenda'      },
  agenda_vai_faltar:     { cor: 'bg-amber-100 text-amber-700',     label: 'Agenda'      },
  agenda_nao_atendeu:    { cor: 'bg-slate-100 text-slate-600',     label: 'Confirmação' },
  agenda_falta:          { cor: 'bg-red-100 text-red-700',         label: 'Agenda'      },
  prontuario_pendente:   { cor: 'bg-orange-100 text-orange-700',   label: 'Prontuário'  },
  prontuario_dor_alta:   { cor: 'bg-red-100 text-red-700',         label: 'Prontuário'  },
  acesso_alterado:       { cor: 'bg-blue-100 text-blue-700',       label: 'Acesso'      },
}

export function SinoNotificacoes({ userId }: { userId: string }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { notificacoes, naoLidas, carregando, marcarComoLida, marcarTodasComoLidas, limpar } = useNotificacoes(userId)

  useEffect(() => {
    function onClickFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    if (aberto) document.addEventListener('mousedown', onClickFora)
    return () => document.removeEventListener('mousedown', onClickFora)
  }, [aberto])

  function handleClickNotif(n: Notificacao) {
    marcarComoLida(n.id)
    if (n.link) {
      setAberto(false)
      router.push(n.link)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        className="relative p-2 rounded-full hover:bg-[#dee3e3] transition-colors text-[#3d4945]"
        aria-label="Notificações"
      >
        <Bell size={20} />
        {naoLidas > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full bg-red-500 border-2 border-[#f5faf9] flex items-center justify-center text-[9px] font-bold text-white px-0.5 leading-none">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-bold text-[#171d1c]">Notificações</span>
            <div className="flex items-center gap-1">
              {naoLidas > 0 && (
                <button
                  onClick={marcarTodasComoLidas}
                  title="Marcar todas como lidas"
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-[#3d4945] transition-colors"
                >
                  <CheckCheck size={15} />
                </button>
              )}
              {notificacoes.length > 0 && (
                <button
                  onClick={() => limpar(notificacoes)}
                  title="Limpar notificações"
                  className="p-1.5 rounded-lg hover:bg-red-50 text-[#3d4945] hover:text-red-500 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              )}
              <button
                onClick={() => setAberto(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-[#3d4945] transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-50">
            {carregando ? (
              <p className="py-10 text-center text-sm text-[#3d4945]/50">Carregando...</p>
            ) : notificacoes.length === 0 ? (
              <p className="py-10 text-center text-sm text-[#3d4945]/50">Nenhuma notificação</p>
            ) : (
              notificacoes.map((n) => {
                const cfg = TIPO_CONFIG[n.tipo] ?? { cor: 'bg-slate-100 text-slate-600', label: n.tipo }
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClickNotif(n)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#f0f5f4] ${!n.lida ? 'bg-[#f8fbfa]' : ''}`}
                  >
                    <span className={`mt-1.5 shrink-0 w-2 h-2 rounded-full ${!n.lida ? 'bg-[#006b5a]' : 'bg-transparent'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cfg.cor}`}>
                          {cfg.label}
                        </span>
                        <span className="text-[10px] text-[#3d4945]/40">
                          {formatDistanceToNow(new Date(n.criado_em), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-[#171d1c] leading-snug">{n.titulo}</p>
                      <p className="text-xs text-[#3d4945]/70 leading-snug mt-0.5 line-clamp-2">{n.mensagem}</p>
                    </div>
                    {n.link && <ChevronRight size={14} className="shrink-0 mt-1.5 text-[#3d4945]/30" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
