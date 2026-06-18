'use client'

import { useEffect, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { buscarAuditoriaPorPaciente } from '@/actions/confirmacoes-auditoria'
import type { EventoAuditoria } from '@/actions/confirmacoes-auditoria'
import { AuditoriaTimeline } from './AuditoriaTimeline'

export function SecaoAuditoriaPaciente({ pacienteId }: { pacienteId: string }) {
  const [eventos, setEventos] = useState<EventoAuditoria[]>([])
  const [carregando, setCarregando] = useState(true)
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setCarregando(true)
    buscarAuditoriaPorPaciente(pacienteId).then(data => {
      setEventos(data)
      setCarregando(false)
    })
  }, [aberto, pacienteId])

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
      <button
        onClick={() => setAberto(v => !v)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-2 text-[#006b5a]">
          <ClipboardList size={16} />
          <span className="text-sm font-bold uppercase tracking-wide">Histórico de confirmações</span>
        </div>
        <span className="text-xs text-slate-400">{aberto ? '▲' : '▼'}</span>
      </button>

      {aberto && (
        <div className="mt-4">
          {carregando ? (
            <p className="text-sm text-slate-400 italic">Carregando...</p>
          ) : (
            <AuditoriaTimeline eventos={eventos} compact />
          )}
        </div>
      )}
    </div>
  )
}