'use client'

import { useRealtimeDisponibilidade, type StatusRow } from '@/hooks/useRealtimeDisponibilidade'
import type { StatusDisponibilidade } from '@/actions/status-disponibilidade'
import { estaDentroDaJornadaAgora, getDiaSemanaAtualNaTimezone, type DisponibilidadeDia } from '@/lib/disponibilidade'
import { useEffect, useState } from 'react'

type Profissional = { id: string; nome: string }

type Props = {
  profissionais: Profissional[]
  initialStatuses: StatusRow[]
  disponibilidades?: Record<string, Record<number, DisponibilidadeDia>>
}

const STATUS_CONFIG: Record<StatusDisponibilidade, { label: string; dot: string; bg: string; text: string; border: string }> = {
  disponivel: { label: 'Disponível',  dot: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200' },
  reuniao:    { label: 'Em reunião',  dot: 'bg-amber-400',   bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200'   },
  ocupado:    { label: 'Ocupado',     dot: 'bg-slate-300',   bg: 'bg-slate-50',    text: 'text-slate-500',   border: 'border-slate-200'   },
  ausente:    { label: 'Ausente',     dot: 'bg-slate-200',   bg: 'bg-slate-50',    text: 'text-slate-400',   border: 'border-slate-100'   },
}

function tempoDesde(atualizado_em: string): string {
  const diff = Math.floor((Date.now() - new Date(atualizado_em).getTime()) / 1000)
  if (diff < 60) return 'agora'
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  return `${Math.floor(diff / 3600)}h`
}

function buildNomesExibicao(profissionais: Profissional[]): Map<string, string> {
  const partes = new Map(profissionais.map(p => [p.id, p.nome.trim().split(/\s+/)]))
  const numWords = new Map(profissionais.map(p => {
    const n = p.nome.trim().split(/\s+/).length
    return [p.id, n >= 3 ? 3 : n] // nome + sobrenome composto: pega até a 3ª palavra
  }))

  let changed = true
  while (changed) {
    changed = false
    const seen = new Map<string, string[]>()
    for (const p of profissionais) {
      const key = partes.get(p.id)!.slice(0, numWords.get(p.id)!).join(' ')
      if (!seen.has(key)) seen.set(key, [])
      seen.get(key)!.push(p.id)
    }
    for (const ids of seen.values()) {
      if (ids.length > 1) {
        for (const id of ids) {
          if (numWords.get(id)! < partes.get(id)!.length) {
            numWords.set(id, numWords.get(id)! + 1)
            changed = true
          }
        }
      }
    }
  }

  return new Map(profissionais.map(p => [
    p.id,
    partes.get(p.id)!.slice(0, numWords.get(p.id)!).join(' '),
  ]))
}

export function StatusEquipeRealtime({ profissionais, initialStatuses, disponibilidades }: Props) {
  const statuses = useRealtimeDisponibilidade(initialStatuses)
  const [, setTick] = useState(0)
  const nomesExibicao = buildNomesExibicao(profissionais)

  useEffect(() => {
    const id = setInterval(() => setTick((value) => value + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const diaSemanaAtual = getDiaSemanaAtualNaTimezone()

  const comStatus = profissionais.map(p => {
    const st = statuses.find(s => s.profissional_id === p.id)
    const disponibilidadeHoje = disponibilidades?.[p.id]?.[diaSemanaAtual] ?? null
    const dentroDaJornada = estaDentroDaJornadaAgora(disponibilidadeHoje)
    const statusEfetivo = dentroDaJornada
      ? ((st?.status ?? 'ausente') as StatusDisponibilidade)
      : 'ausente'

    return { ...p, status: statusEfetivo as StatusDisponibilidade, atualizado_em: st?.atualizado_em }
  })

  const livres   = comStatus.filter(p => p.status === 'disponivel')
  const reuniao  = comStatus.filter(p => p.status === 'reuniao')
  const ocupados = comStatus.filter(p => p.status === 'ocupado')
  const ausentes = comStatus.filter(p => p.status === 'ausente')
  const ordenados = [...livres, ...reuniao, ...ocupados, ...ausentes]

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status agora</p>
        <div className="flex items-center gap-2">
          {livres.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              {livres.length} livre{livres.length > 1 ? 's' : ''}
            </span>
          )}
          {reuniao.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {reuniao.length} em reunião
            </span>
          )}
          {ausentes.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">
              {ausentes.length} ausente{ausentes.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {ordenados.map(p => {
          const cfg = STATUS_CONFIG[p.status]
          return (
            <div
              key={p.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${cfg.bg} ${cfg.text} ${cfg.border}`}
            >
              <span className="relative flex h-2 w-2 shrink-0">
                {p.status !== 'ocupado' && (
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.dot} opacity-60`} />
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${cfg.dot}`} />
              </span>
              <span>{nomesExibicao.get(p.id) ?? p.nome.split(' ')[0]}</span>
              {p.status !== 'ocupado' && p.status !== 'ausente' && p.atualizado_em && (
                <span className="opacity-60 font-normal">{tempoDesde(p.atualizado_em)}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
