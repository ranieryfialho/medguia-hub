'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Radio } from 'lucide-react'
import { useRealtimeDisponibilidade, type StatusRow } from '@/hooks/useRealtimeDisponibilidade'
import { listarDeclaracoesStatus } from '@/actions/status-disponibilidade'
import { getCorConfig, DEFAULT_OPCOES, type OpcaoStatus } from '@/lib/status-disponibilidade-cores'
import { formatarContagemRegressiva } from '@/lib/status-disponibilidade-regras'
import { agruparPainelEquipe, type ItemCompacto } from '@/lib/status-painel-equipe'

type Profissional = { id: string; nome: string }

type Props = {
  profissionais: Profissional[]
  initialStatuses: StatusRow[]
  disponibilidades?: Record<string, Record<number, unknown>>
  disponibilidadesHoje?: Record<string, unknown>
  opcoes?: OpcaoStatus[]
}

function formatarDesde(ms: number): string {
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min}min`
  const horas = Math.floor(min / 60)
  const resto = min % 60
  return resto === 0 ? `há ${horas}h` : `há ${horas}h${String(resto).padStart(2, '0')}`
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

/** Grupo compacto: um rótulo e os nomes em pílulas. Estados que não pedem ação. */
function GrupoCompacto({
  titulo,
  itens,
  nomesExibicao,
  corTexto,
  corFundo,
}: {
  titulo: string
  itens: ItemCompacto[]
  nomesExibicao: Map<string, string>
  corTexto: string
  corFundo: string
}) {
  if (itens.length === 0) return null

  return (
    <div className="flex items-start gap-2.5">
      <span className={`shrink-0 text-[11px] font-bold uppercase tracking-wider pt-1 ${corTexto}`}>
        {titulo}
        <span className="ml-1 opacity-60">{itens.length}</span>
      </span>
      <div className="flex flex-wrap gap-1.5">
        {itens.map(item => (
          <span
            key={item.id}
            title={item.nome}
            className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${corFundo} ${corTexto}`}
          >
            {nomesExibicao.get(item.id) ?? item.nome.split(' ')[0]}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Painel "Status agora" — Configurações → Disponibilidade.
 *
 * O agrupamento vem de `agruparPainelEquipe` (src/lib/status-painel-equipe.ts);
 * aqui só se desenha. A hierarquia é a mensagem: quem declarou um status ganha
 * linha inteira com motivo e prazo, porque é o único estado que pode exigir
 * ação de alguém. Livre, ausente e em atendimento viram pílulas — são
 * informação de contexto, não de decisão.
 */
export function StatusEquipeRealtime({ profissionais, initialStatuses, opcoes: opcoesProp }: Props) {
  const opcoes = opcoesProp ?? DEFAULT_OPCOES
  const profissionalIds = useMemo(() => profissionais.map(p => p.id), [profissionais])
  const statuses = useRealtimeDisponibilidade(initialStatuses, profissionalIds)
  const [agora, setAgora] = useState(() => new Date())
  const [observacoes, setObservacoes] = useState<Record<string, string | null>>({})
  const nomesExibicao = useMemo(() => buildNomesExibicao(profissionais), [profissionais])

  // Contador regressivo (AC-022): cadência de 1s. Com 30s, como era antes, o
  // número pularia de 47:05 para 46:35.
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 1_000)
    return () => clearInterval(id)
  }, [])

  // O motivo declarado (AC-032) não vem de `fn_status_equipe_agora`, que devolve
  // só o status resolvido. Vem da declaração crua, na mesma cadência do polling
  // do hook.
  const idsRef = useRef(profissionalIds)
  useEffect(() => {
    idsRef.current = profissionalIds
  })

  const carregarObservacoes = useCallback(async () => {
    const ids = idsRef.current
    if (ids.length === 0) return
    const linhas = await listarDeclaracoesStatus(ids)
    setObservacoes(Object.fromEntries(linhas.map(l => [l.profissional_id, l.observacao])))
  }, [])

  useEffect(() => {
    void carregarObservacoes()
    const id = setInterval(() => { void carregarObservacoes() }, 60_000)
    return () => clearInterval(id)
  }, [carregarObservacoes])

  const painel = agruparPainelEquipe(profissionais, statuses, opcoes, observacoes, agora)
  const { declarados, emAtendimento, livres, ausentes } = painel

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Radio size={15} className="text-[#006b5a]" />
          <h3 className="text-sm font-bold text-slate-800">Status agora</h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
            {livres.length} livre{livres.length === 1 ? '' : 's'}
          </span>
          {declarados.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
              {declarados.length} em status
            </span>
          )}
        </div>
      </div>

      {/* Declarados — linha inteira, com motivo e prazo */}
      {declarados.length > 0 && (
        <ul className="divide-y divide-slate-50">
          {declarados.map(item => {
            const cor = getCorConfig(item.cor)
            return (
              <li key={item.id} className="flex items-start gap-3 px-5 py-3">
                <span className="relative flex h-2.5 w-2.5 shrink-0 mt-1.5">
                  {!item.vencido && (
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cor.dot} opacity-60`} />
                  )}
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${item.vencido ? 'bg-rose-500' : cor.dot}`} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800">{item.nome}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${cor.bg} ${cor.text}`}>
                      {item.label}
                    </span>
                    <span className="text-xs text-slate-400">{formatarDesde(item.desdeMs)}</span>
                  </div>
                  {item.observacao && (
                    <p className="text-xs text-slate-600 mt-1 break-words">{item.observacao}</p>
                  )}
                </div>

                {/* Contador regressivo (AC-023/AC-024) */}
                <div className="shrink-0 text-right">
                  {item.vencido ? (
                    <>
                      <p className="text-xs font-bold text-rose-600">expirado</p>
                      <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                        volta em até 10min
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-slate-700 tabular-nums leading-none">
                        {formatarContagemRegressiva(item.restanteMs)}
                      </p>
                      <p className="text-[10px] text-slate-400 leading-tight mt-1">restante</p>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Compactos — contexto, não decisão */}
      {(emAtendimento.length > 0 || livres.length > 0 || ausentes.length > 0) && (
        <div className={`px-5 py-3 space-y-2.5 ${declarados.length > 0 ? 'border-t border-slate-100 bg-slate-50/50' : ''}`}>
          <GrupoCompacto
            titulo="Em atendimento"
            itens={emAtendimento}
            nomesExibicao={nomesExibicao}
            corTexto="text-slate-600"
            corFundo="bg-slate-200/70"
          />
          <GrupoCompacto
            titulo="Livres"
            itens={livres}
            nomesExibicao={nomesExibicao}
            corTexto="text-emerald-700"
            corFundo="bg-emerald-100"
          />
          <GrupoCompacto
            titulo="Ausentes"
            itens={ausentes}
            nomesExibicao={nomesExibicao}
            corTexto="text-slate-400"
            corFundo="bg-slate-100"
          />
        </div>
      )}

      {profissionais.length === 0 && (
        <p className="px-5 py-6 text-sm text-slate-400 text-center">Nenhum profissional na equipe</p>
      )}
    </div>
  )
}
