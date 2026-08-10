'use client'

import { useEffect, useMemo, useState } from 'react'
import { Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getCorConfig } from '@/lib/status-disponibilidade-cores'
import {
  montarCardsStatus,
  type ProfissionalCardInput,
  type DeclaracaoStatusInput,
  type OpcaoCatalogoInput,
} from '@/lib/status-card-agenda'

export type StatusEquipeDeclaracaoRow = {
  profissional_id: string
  status: string
  observacao: string | null
  atualizado_em: string
}

type Props = {
  profissionais: ProfissionalCardInput[]
  declaracoesIniciais: StatusEquipeDeclaracaoRow[]
  emAtendimentoIdsIniciais: string[]
  opcoes: OpcaoCatalogoInput[]
  slugsDeSistema: string[]
}

function formatarTempoDecorrido(minutos: number): string {
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const min = minutos % 60
  return min === 0 ? `${horas}h` : `${horas}h${min}min`
}

/**
 * Card de status ao vivo da equipe na rota de agendamento (US-003).
 * A resolução de precedência/observação/tempo vem de `montarCardsStatus`
 * (src/lib/status-card-agenda.ts) — este componente só percorre o resultado
 * e assina o realtime da tabela `status_disponibilidade`, já habilitado
 * para o widget de disponibilidade.
 */
export function CardStatusEquipe({
  profissionais,
  declaracoesIniciais,
  emAtendimentoIdsIniciais,
  opcoes,
  slugsDeSistema,
}: Props) {
  const [declaracoesRows, setDeclaracoesRows] = useState<StatusEquipeDeclaracaoRow[]>(declaracoesIniciais)
  const [emAtendimentoIds, setEmAtendimentoIds] = useState<Set<string>>(() => new Set(emAtendimentoIdsIniciais))
  const [agora, setAgora] = useState(() => new Date())

  useEffect(() => {
    setDeclaracoesRows(declaracoesIniciais)
  }, [declaracoesIniciais])

  useEffect(() => {
    setEmAtendimentoIds(new Set(emAtendimentoIdsIniciais))
  }, [emAtendimentoIdsIniciais])

  // Recalcula o tempo decorrido (AC-008/AC-009) sem depender de um novo evento.
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    let active = true
    const channelName = `status_card_agenda:${crypto.randomUUID()}`

    const subscribe = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return null
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token)
      }

      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'status_disponibilidade' },
          (payload) => {
            if (!active) return
            const row = payload.new as StatusEquipeDeclaracaoRow | undefined
            if (!row?.profissional_id) return
            setDeclaracoesRows((prev) => {
              const idx = prev.findIndex((d) => d.profissional_id === row.profissional_id)
              if (idx === -1) return [...prev, row]
              const next = [...prev]
              next[idx] = row
              return next
            })
          },
        )
        .subscribe()

      return channel
    }

    const channelPromise = subscribe()

    return () => {
      active = false
      void channelPromise.then((channel) => {
        if (channel) supabase.removeChannel(channel)
      })
    }
  }, [])

  const declaracoes = useMemo<DeclaracaoStatusInput[]>(() => {
    const sistema = new Set(slugsDeSistema)
    return declaracoesRows
      .filter((row) => !sistema.has(row.status))
      .map((row) => ({
        profissionalId: row.profissional_id,
        slug: row.status,
        observacao: row.observacao,
        iniciadoEm: new Date(row.atualizado_em),
      }))
  }, [declaracoesRows, slugsDeSistema])

  const cards = montarCardsStatus(profissionais, declaracoes, emAtendimentoIds, opcoes, agora)

  if (cards.length === 0) return null

  return (
    <div className="flex-shrink-0 bg-white rounded-3xl border border-[#bcc9c4]/30 px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 mb-2.5">
        <Users size={14} className="text-[#6d7a75]" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#6d7a75]">Status da equipe</span>
      </div>
      <div className="space-y-2 max-h-56 overflow-y-auto">
        {cards.map((card) => {
          const cor = getCorConfig(card.statusPrincipal.cor)
          return (
            <div key={card.profissionalId} className="flex items-start gap-2.5 px-2.5 py-2 rounded-xl bg-[#f9fbfb]">
              <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${cor.dot}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[#171d1c] truncate">{card.nome}</p>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${cor.bg} ${cor.text}`}>
                    {card.statusPrincipal.label}
                  </span>
                </div>
                {/* AC-020: com atendimento em curso, o status declarado sai do lugar
                    principal — sem exibi-lo aqui, a observação abaixo pareceria
                    descrever o atendimento, e não a reunião que o profissional declarou. */}
                {card.declaracao && (
                  <p className="text-[10px] text-[#6d7a75] mt-0.5">
                    declarou{' '}
                    <span className={`font-semibold ${getCorConfig(card.declaracao.cor).text}`}>
                      {card.declaracao.label}
                    </span>
                  </p>
                )}
                {card.observacao && (
                  <p className="text-[11px] text-[#3d4945] truncate mt-0.5">{card.observacao}</p>
                )}
                <p className="text-[10px] text-[#6d7a75] mt-0.5">
                  {formatarTempoDecorrido(card.tempoDecorridoMin)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
