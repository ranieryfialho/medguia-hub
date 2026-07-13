'use client'

import { useRealtimeDisponibilidade, type StatusRow } from '@/hooks/useRealtimeDisponibilidade'
import { useEffect, useState, useMemo } from 'react'
import { getCorConfig, DEFAULT_OPCOES, type OpcaoStatus } from '@/lib/status-disponibilidade-cores'

type Profissional = { id: string; nome: string }

type Props = {
  profissionais: Profissional[]
  initialStatuses: StatusRow[]
  disponibilidades?: Record<string, Record<number, unknown>>
  disponibilidadesHoje?: Record<string, unknown>
  opcoes?: OpcaoStatus[]
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
    return [p.id, n >= 3 ? 3 : n]
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

export function StatusEquipeRealtime({ profissionais, initialStatuses, opcoes: opcoesProp }: Props) {
  const opcoes = opcoesProp ?? DEFAULT_OPCOES
  const profissionalIds = useMemo(() => profissionais.map(p => p.id), [profissionais])
  const statuses = useRealtimeDisponibilidade(initialStatuses, profissionalIds)
  const [, setTick] = useState(0)
  const nomesExibicao = buildNomesExibicao(profissionais)

  useEffect(() => {
    const id = setInterval(() => setTick((value) => value + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const cfgPorSlug = Object.fromEntries(
    opcoes.map(o => [o.slug, { ...getCorConfig(o.cor), label: o.label, isManual: !o.sistema && o.slug !== 'ocupado' }])
  )

  const comStatus = profissionais.map(p => {
    const st = statuses.find(s => s.profissional_id === p.id)
    return { ...p, status: st?.status ?? 'ausente', atualizado_em: st?.atualizado_em }
  })

  const livres   = comStatus.filter(p => p.status === 'disponivel')
  const ausentes = comStatus.filter(p => p.status === 'ausente')
  // Todos os outros status (ocupado + manuais + customizados), ordenados por ordem da opcao
  const outros = comStatus
    .filter(p => p.status !== 'disponivel' && p.status !== 'ausente')
    .sort((a, b) => {
      const oa = opcoes.find(o => o.slug === a.status)?.ordem ?? 50
      const ob = opcoes.find(o => o.slug === b.status)?.ordem ?? 50
      return oa - ob
    })

  const ordenados = [...livres, ...outros, ...ausentes]

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status agora</p>
        <div className="flex items-center gap-2 flex-wrap">
          {livres.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              {livres.length} livre{livres.length > 1 ? 's' : ''}
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
          const opcao = opcoes.find(o => o.slug === p.status)
          const cfg = cfgPorSlug[p.status] ?? { ...getCorConfig('slate'), label: p.status, isManual: false }
          const isManual = cfg.isManual
          return (
            <div
              key={p.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${cfg.bg} ${cfg.text} ${cfg.border}`}
            >
              <span className="relative flex h-2 w-2 shrink-0">
                {isManual && (
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${getCorConfig(opcao?.cor ?? 'slate').dot} opacity-60`} />
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${getCorConfig(opcao?.cor ?? 'slate').dot}`} />
              </span>
              <span>{nomesExibicao.get(p.id) ?? p.nome.split(' ')[0]}</span>
              {isManual && p.atualizado_em && (
                <span className="opacity-60 font-normal">{tempoDesde(p.atualizado_em)}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}