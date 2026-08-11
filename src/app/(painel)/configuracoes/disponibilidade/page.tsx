import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  format, startOfWeek, endOfWeek, addDays, subWeeks, addWeeks,
  parseISO, isValid, isSameDay,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Clock, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'
import { formatAppDateKey, getAppDayRangeUTC, getAppHour, parseAppDate } from '@/lib/datetime'
import { BtnCopiarDisponibilidade } from '@/components/features/configuracoes'
import { normalizarDisponibilidade, type DisponibilidadeDia } from '@/lib/disponibilidade'
import { obterIntervalosJornada, toHora, toMin } from '@/lib/jornada'
import { buildMapaMensalPorProfissional, resolverJornadaDoDia } from '@/lib/jornada-planejada'
import { StatusEquipeRealtime } from '@/components/features/equipe'
import { listarStatusDisponibilidade } from '@/actions/status-disponibilidade'
import { listarStatusOpcoesParaExibicao } from '@/actions/status-disponibilidade-config'
import type { OpcaoStatus } from '@/lib/status-disponibilidade-cores'
import { requireModulo } from '@/lib/guard'
import { podeGerirEquipe } from '@/lib/permissoes'
import { podeEntrarNaAgendaOuRelatorio } from '@/lib/profissionais'
import { STATUS_NAO_BLOQUEIAM_RAW_SQL } from '@/lib/atendimento-status'

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

type IntervaloBloqueado = { inicio: number; fim: number }
type SlotLivre = { inicio: string; fim: string; duracaoMin: number }

function calcularSlotsLivres(
  jornada: DisponibilidadeDia,
  ocupados: IntervaloBloqueado[],
): SlotLivre[] {
  const sorted = [...ocupados].sort((a, b) => a.inicio - b.inicio)
  const livres: SlotLivre[] = []

  for (const intervalo of obterIntervalosJornada(jornada)) {
    let cursor = intervalo.inicio

    for (const occ of sorted) {
      const occInicio = Math.max(occ.inicio, intervalo.inicio)
      const occFim = Math.min(occ.fim, intervalo.fim)
      if (occFim <= occInicio) continue

      if (occInicio > cursor) {
        livres.push({ inicio: toHora(cursor), fim: toHora(occInicio), duracaoMin: occInicio - cursor })
      }
      cursor = Math.max(cursor, occFim)
    }

    if (cursor < intervalo.fim) {
      livres.push({ inicio: toHora(cursor), fim: toHora(intervalo.fim), duracaoMin: intervalo.fim - cursor })
    }
  }

  return livres
}

function buildNomesExibicao(profissionais: { id: string; nome: string }[]): Map<string, string> {
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
      const key = partes.get(p.id)!.slice(0, numWords.get(p.id)!).join(' ').toUpperCase()
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
    partes.get(p.id)!.slice(0, numWords.get(p.id)!).join(' ').toUpperCase(),
  ]))
}

/**
 * Navegação de semana, compartilhada pelas duas visões.
 *
 * Existia duplicada, com marcações levemente diferentes. Ganhou também o atalho
 * "Hoje": sem ele, quem navegava três semanas à frente só voltava clicando três
 * vezes na seta.
 */
function SeletorSemana({
  semanaLabel,
  hrefAnterior,
  hrefProxima,
  hrefHoje,
}: {
  semanaLabel: string
  hrefAnterior: string
  hrefProxima: string
  hrefHoje: string
}) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <Link
        href={hrefHoje}
        className="px-3 py-1.5 mr-1 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-[#006b5a] transition-colors"
      >
        Hoje
      </Link>
      <Link
        href={hrefAnterior}
        aria-label="Semana anterior"
        className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600"
      >
        <ChevronLeft size={17} />
      </Link>
      <span className="text-sm font-bold text-slate-700 min-w-[170px] text-center capitalize px-1">
        {semanaLabel}
      </span>
      <Link
        href={hrefProxima}
        aria-label="Próxima semana"
        className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600"
      >
        <ChevronRight size={17} />
      </Link>
    </div>
  )
}

// ─── Visão Individual (fisioterapeuta ou drill-down gestor) ──────────────────

async function ViewIndividual({
  targetId,
  nomeProfissional,
  isGestor,
  profissionais,
  paramProfId,
  dataParam,
  initialStatuses,
  opcoesStatus,
}: {
  targetId: string
  nomeProfissional: string
  isGestor: boolean
  profissionais: { id: string; nome: string }[]
  paramProfId: string | null
  dataParam: string | undefined
  initialStatuses: Awaited<ReturnType<typeof listarStatusDisponibilidade>>
  opcoesStatus: OpcaoStatus[]
}) {
  const supabase = await createClient()

  let dataSelecionada = new Date()
  if (dataParam) {
    const parsed = parseISO(dataParam)
    if (isValid(parsed)) dataSelecionada = parsed
  }

  const inicioDaSemana = startOfWeek(dataSelecionada, { weekStartsOn: 0 })
  const fimDaSemana = endOfWeek(dataSelecionada, { weekStartsOn: 0 })
  // Normalizar para meio-dia UTC: evita offset de 1 dia quando o servidor roda em UTC
  // (midnight UTC = 21h Fortaleza do dia anterior, causando formatAppDateKey errado)
  const diasDaSemana = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(inicioDaSemana, i)
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0))
  })

  const semanaLabel = `${format(inicioDaSemana, "d 'De' MMM", { locale: ptBR })} – ${format(fimDaSemana, "d 'De' MMM", { locale: ptBR })}`
  const prevData = format(subWeeks(dataSelecionada, 1), 'yyyy-MM-dd')
  const nextData = format(addWeeks(dataSelecionada, 1), 'yyyy-MM-dd')

  const buildUrl = (data: string) => {
    const base = `/configuracoes/disponibilidade?data=${data}`
    return isGestor && paramProfId ? `${base}&profissional=${paramProfId}` : base
  }

  const { data: jornada } = await supabase
    .from('disponibilidade_profissional')
    .select('dia_semana, jornada_inicio, jornada_fim, intervalo_inicio, intervalo_fim, ativo')
    .eq('profissional_id', targetId)
    .eq('ativo', true)

  const jornadaMap = new Map(
    (jornada ?? []).map(j => [j.dia_semana, normalizarDisponibilidade(j)])
  )

  const inicioKey = formatAppDateKey(diasDaSemana[0])
  const fimKey = formatAppDateKey(diasDaSemana[6])

  const { data: jornadasMensais } = await supabase
    .from('jornada_mensal_profissional')
    .select('profissional_id, data, jornada_inicio, jornada_fim, intervalo_inicio, intervalo_fim, ativo')
    .eq('profissional_id', targetId)
    .gte('data', inicioKey)
    .lte('data', fimKey)

  const jornadaMensalMap = buildMapaMensalPorProfissional((jornadasMensais ?? []) as Array<{
    profissional_id: string
    data: string
    jornada_inicio: string | null
    jornada_fim: string | null
    intervalo_inicio?: string | null
    intervalo_fim?: string | null
    ativo: boolean
  }>).get(targetId)

  const { data: agendamentos } = await supabase
    .from('atendimentos')
    .select('data_agendamento, duracao_minutos')
    .eq('profissional_id', targetId)
    .gte('data_agendamento', getAppDayRangeUTC(inicioKey).start)
    .lte('data_agendamento', getAppDayRangeUTC(fimKey).end)
    .not('status', 'in', STATUS_NAO_BLOQUEIAM_RAW_SQL)

  const { data: bloqueiosSemana } = await supabase
    .from('jornada_mensal_bloqueio')
    .select('data, hora_inicio, hora_fim')
    .eq('profissional_id', targetId)
    .gte('data', inicioKey)
    .lte('data', fimKey)

  const bloqueiosPorData = new Map<string, IntervaloBloqueado[]>()
  for (const b of bloqueiosSemana ?? []) {
    const doDia = bloqueiosPorData.get(b.data) ?? []
    doDia.push({ inicio: toMin(b.hora_inicio), fim: toMin(b.hora_fim) })
    bloqueiosPorData.set(b.data, doDia)
  }

  type DiaDados = {
    dia: Date
    trabalha: boolean
    jornadaInicio?: string
    jornadaFim?: string
    almocoInicio?: string | null
    almocoFim?: string | null
    livres: SlotLivre[]
    totalOcupado: number
    totalLivre: number
  }

  const dadosPorDia: DiaDados[] = diasDaSemana.map(dia => {
    const jornDia = resolverJornadaDoDia(dia, jornadaMap, jornadaMensalMap)
    if (!jornDia) return { dia, trabalha: false, livres: [], totalOcupado: 0, totalLivre: 0 }

    const diaKey = formatAppDateKey(dia)
    const agsDoDia = (agendamentos ?? []).filter(a => formatAppDateKey(new Date(a.data_agendamento)) === diaKey)
    const ocupados: IntervaloBloqueado[] = [
      ...agsDoDia.map(a => {
        const d = new Date(a.data_agendamento)
        const horaMin = getAppHour(d) * 60 + parseInt(format(d, 'mm'))
        return { inicio: horaMin, fim: horaMin + (a.duracao_minutos ?? 60) }
      }),
      ...(bloqueiosPorData.get(diaKey) ?? []),
    ]

    const livres = calcularSlotsLivres(jornDia, ocupados)
    const intervalosJornada = obterIntervalosJornada(jornDia)
    const totalJornada = intervalosJornada.reduce((acc, intervalo) => acc + (intervalo.fim - intervalo.inicio), 0)
    const totalOcupado = ocupados.reduce((acc, o) => {
      return acc + intervalosJornada.reduce((subtotal, intervalo) => {
        const ci = Math.max(o.inicio, intervalo.inicio)
        const cf = Math.min(o.fim, intervalo.fim)
        return subtotal + Math.max(0, cf - ci)
      }, 0)
    }, 0)

    return {
      dia,
      trabalha: true,
      jornadaInicio: jornDia.jornada_inicio,
      jornadaFim: jornDia.jornada_fim,
      almocoInicio: jornDia.intervalo_inicio,
      almocoFim: jornDia.intervalo_fim,
      livres,
      totalOcupado,
      totalLivre: totalJornada - totalOcupado,
    }
  })

  const totalLivreSemana = dadosPorDia.reduce((acc, d) => acc + d.totalLivre, 0)
  const totalOcupadoSemana = dadosPorDia.reduce((acc, d) => acc + d.totalOcupado, 0)

  return (
    <div className="space-y-6 px-6">
      {/* Status em tempo real */}
      {isGestor && profissionais.length > 0 && (
        <StatusEquipeRealtime
          profissionais={profissionais}
          initialStatuses={initialStatuses}
          opcoes={opcoesStatus}
          disponibilidades={{ [targetId]: Object.fromEntries(jornadaMap.entries()) }}
          disponibilidadesHoje={{
            [targetId]: resolverJornadaDoDia(parseAppDate(formatAppDateKey(new Date())), jornadaMap, jornadaMensalMap) ?? null,
          }}
        />
      )}

      {/* Cabeçalho: título, troca de profissional e navegação de semana */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="min-w-0">
            {isGestor && (
              <Link
                href="/configuracoes/disponibilidade?visao=geral"
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#006b5a] transition-colors mb-1.5"
              >
                <ChevronLeft size={13} /> Visão geral da equipe
              </Link>
            )}
            <h2 className="text-2xl font-bold text-slate-900 leading-tight">{nomeProfissional}</h2>
            <p className="text-sm text-slate-500 mt-1">
              Horários livres na semana — jornada menos agendamentos e bloqueios
            </p>
          </div>

          <SeletorSemana
            semanaLabel={semanaLabel}
            hrefAnterior={buildUrl(prevData)}
            hrefProxima={buildUrl(nextData)}
            hrefHoje={buildUrl(format(new Date(), 'yyyy-MM-dd'))}
          />
        </div>

        {/* Troca direta de profissional: sem botão "Ver", o clique já navega */}
        {isGestor && profissionais.length > 1 && (
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
            <span className="w-full text-[11px] font-bold uppercase tracking-wider text-slate-400 pt-3 pb-0.5">
              Ver outro profissional
            </span>
            {profissionais.map(p => {
              const ativo = p.id === targetId
              const href = `/configuracoes/disponibilidade?profissional=${p.id}${dataParam ? `&data=${dataParam}` : ''}`
              return (
                <Link
                  key={p.id}
                  href={href}
                  aria-current={ativo ? 'page' : undefined}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    ativo
                      ? 'bg-[#006b5a] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {p.nome.split(' ').slice(0, 2).join(' ')}
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Resumo semana */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-[#006b5a]/20 rounded-2xl p-4 flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-[#006b5a]/10 flex items-center justify-center shrink-0">
            <CheckCircle size={20} className="text-[#006b5a]" />
          </span>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Livre na semana</p>
            <p className="text-2xl font-bold text-[#006b5a] leading-tight">
              {Math.floor(totalLivreSemana / 60)}h{totalLivreSemana % 60 > 0 ? ` ${totalLivreSemana % 60}min` : ''}
            </p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <XCircle size={20} className="text-slate-400" />
          </span>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Ocupado na semana</p>
            <p className="text-2xl font-bold text-slate-600 leading-tight">
              {Math.floor(totalOcupadoSemana / 60)}h{totalOcupadoSemana % 60 > 0 ? ` ${totalOcupadoSemana % 60}min` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Grade semanal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {dadosPorDia.map(({ dia, trabalha, jornadaInicio, jornadaFim, almocoInicio, almocoFim, livres, totalLivre, totalOcupado }) => {
          const isHoje = isSameDay(dia, new Date())
          return (
            <div
              key={dia.toISOString()}
              className={`rounded-2xl border flex flex-col overflow-hidden bg-white ${
                isHoje ? 'border-[#006b5a] shadow-md ring-1 ring-[#006b5a]/20' : 'border-slate-200'
              } ${!trabalha ? 'opacity-60' : ''}`}
            >
              <div className={`px-3 py-2.5 flex items-baseline justify-between ${isHoje ? 'bg-[#006b5a] text-white' : 'bg-slate-50 text-slate-700'}`}>
                <span className="text-xs font-bold uppercase tracking-wider opacity-90">
                  {DIAS_SEMANA[dia.getDay()]}
                </span>
                <span className="text-xl font-extrabold leading-none">{format(dia, 'd')}</span>
              </div>

              <div className="flex-1 p-2.5 space-y-2">
                {!trabalha ? (
                  <p className="text-xs text-slate-400 text-center py-4">Não atende</p>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium pb-2 border-b border-slate-100">
                      <Clock size={12} />
                      <span>{jornadaInicio} – {jornadaFim}</span>
                    </div>

                    {almocoInicio && almocoFim && (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5">
                        <p className="text-xs font-bold text-amber-800 leading-tight">Intervalo</p>
                        <p className="text-xs text-amber-700 mt-0.5 tabular-nums">{almocoInicio} – {almocoFim}</p>
                      </div>
                    )}

                    {livres.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-3">Sem horário livre</p>
                    ) : (
                      livres.map((slot, i) => (
                        <div key={i} className="rounded-lg bg-[#006b5a]/8 border border-[#006b5a]/25 px-2.5 py-1.5">
                          <p className="text-sm font-bold text-[#006b5a] leading-tight tabular-nums">
                            {slot.inicio} – {slot.fim}
                          </p>
                          <p className="text-xs text-[#006b5a]/70 mt-0.5">
                            {slot.duracaoMin >= 60
                              ? `${Math.floor(slot.duracaoMin / 60)}h${slot.duracaoMin % 60 > 0 ? `${slot.duracaoMin % 60}min` : ''}`
                              : `${slot.duracaoMin}min`} livre
                          </p>
                        </div>
                      ))
                    )}

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-[#006b5a] font-bold">
                        {totalLivre >= 60
                          ? `${Math.floor(totalLivre / 60)}h${totalLivre % 60 > 0 ? `${totalLivre % 60}m` : ''}`
                          : totalLivre > 0 ? `${totalLivre}min` : '—'} livre
                      </span>
                      <span className="text-slate-400">
                        {totalOcupado >= 60
                          ? `${Math.floor(totalOcupado / 60)}h${totalOcupado % 60 > 0 ? `${totalOcupado % 60}m` : ''}`
                          : totalOcupado > 0 ? `${totalOcupado}min` : ''} {totalOcupado > 0 ? 'ocup.' : ''}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="text-center pb-2">
        <Link
          href={isGestor && paramProfId ? `/configuracoes/jornada?profissional=${paramProfId}` : '/configuracoes/jornada'}
          className="inline-block px-4 py-2 rounded-lg text-sm text-[#006b5a] font-semibold border border-[#006b5a]/25 hover:bg-[#006b5a]/5 transition-colors"
        >
          Editar jornada de trabalho →
        </Link>
      </div>
    </div>
  )
}

// ─── Visão Geral (gestor/master — todos os profissionais) ─────────────────────

async function ViewGeral({
  profissionais,
  profissionaisStatus,
  dataParam,
  agrupamento,
  initialStatuses,
  opcoesStatus,
}: {
  profissionais: { id: string; nome: string }[]
  profissionaisStatus: { id: string; nome: string }[]
  dataParam: string | undefined
  agrupamento: 'horario' | 'profissional'
  initialStatuses: Awaited<ReturnType<typeof listarStatusDisponibilidade>>
  opcoesStatus: OpcaoStatus[]
}) {
  const supabase = await createClient()

  let dataSelecionada = new Date()
  if (dataParam) {
    const parsed = parseISO(dataParam)
    if (isValid(parsed)) dataSelecionada = parsed
  }

  const inicioDaSemana = startOfWeek(dataSelecionada, { weekStartsOn: 0 })
  const fimDaSemana = endOfWeek(dataSelecionada, { weekStartsOn: 0 })
  const diasDaSemana = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(inicioDaSemana, i)
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0))
  })

  const semanaLabel = `${format(inicioDaSemana, "d 'De' MMM", { locale: ptBR })} – ${format(fimDaSemana, "d 'De' MMM", { locale: ptBR })}`
  const prevData = format(subWeeks(dataSelecionada, 1), 'yyyy-MM-dd')
  const nextData = format(addWeeks(dataSelecionada, 1), 'yyyy-MM-dd')

  const buildNavUrl = (data: string) =>
    `/configuracoes/disponibilidade?visao=geral&agrupamento=${agrupamento}&data=${data}`

  const buildToggleUrl = (ag: string) =>
    `/configuracoes/disponibilidade?visao=geral&agrupamento=${ag}&data=${format(dataSelecionada, 'yyyy-MM-dd')}`

  // Buscar jornada de todos que podem aparecer no status ou na grade
  const profIds = [...new Set([...profissionais.map((p) => p.id), ...profissionaisStatus.map((p) => p.id)])]
  const { data: todasJornadas } = await supabase
    .from('disponibilidade_profissional')
    .select('profissional_id, dia_semana, jornada_inicio, jornada_fim, intervalo_inicio, intervalo_fim, ativo')
    .in('profissional_id', profIds)
    .eq('ativo', true)

  // Montar mapa: profId → dia_semana → { inicio, fim }
  const jornadaMap = new Map<string, Map<number, DisponibilidadeDia>>()
  for (const j of todasJornadas ?? []) {
    if (!jornadaMap.has(j.profissional_id)) jornadaMap.set(j.profissional_id, new Map())
    jornadaMap.get(j.profissional_id)!.set(j.dia_semana, normalizarDisponibilidade(j))
  }

  const inicioKey = formatAppDateKey(diasDaSemana[0])
  const fimKey = formatAppDateKey(diasDaSemana[6])

  const { data: jornadasMensais } = await supabase
    .from('jornada_mensal_profissional')
    .select('profissional_id, data, jornada_inicio, jornada_fim, intervalo_inicio, intervalo_fim, ativo')
    .in('profissional_id', profIds)
    .gte('data', inicioKey)
    .lte('data', fimKey)

  const jornadaMensalMap = buildMapaMensalPorProfissional((jornadasMensais ?? []) as Array<{
    profissional_id: string
    data: string
    jornada_inicio: string | null
    jornada_fim: string | null
    intervalo_inicio?: string | null
    intervalo_fim?: string | null
    ativo: boolean
  }>)

  const profIdsComJornada = [...new Set((todasJornadas ?? []).map((j) => j.profissional_id))]
  const { data: todosAgendamentos } = profIdsComJornada.length > 0
    ? await supabase
        .from('atendimentos')
        .select('profissional_id, data_agendamento, duracao_minutos')
        .in('profissional_id', profIdsComJornada)
        .gte('data_agendamento', getAppDayRangeUTC(inicioKey).start)
        .lte('data_agendamento', getAppDayRangeUTC(fimKey).end)
        .not('status', 'in', STATUS_NAO_BLOQUEIAM_RAW_SQL)
    : { data: [] }

  const { data: todosBloqueios } = profIdsComJornada.length > 0
    ? await supabase
        .from('jornada_mensal_bloqueio')
        .select('profissional_id, data, hora_inicio, hora_fim')
        .in('profissional_id', profIdsComJornada)
        .gte('data', inicioKey)
        .lte('data', fimKey)
    : { data: [] }

  const bloqueiosPorProfEData = new Map<string, IntervaloBloqueado[]>()
  for (const b of todosBloqueios ?? []) {
    const chave = `${b.profissional_id}|${b.data}`
    const doDia = bloqueiosPorProfEData.get(chave) ?? []
    doDia.push({ inicio: toMin(b.hora_inicio), fim: toMin(b.hora_fim) })
    bloqueiosPorProfEData.set(chave, doDia)
  }

  // Calcular slots livres por profissional por dia
  type ProfDia = {
    profId: string
    nome: string
    dia: Date
    trabalha: boolean
    almocoInicio?: string | null
    almocoFim?: string | null
    livres: SlotLivre[]
  }

  const profissionaisComJornada = profissionais.filter((prof) => jornadaMap.has(prof.id))

  const nomesExibicao = buildNomesExibicao(profissionaisComJornada)

  const grid: ProfDia[] = []
  for (const prof of profissionaisComJornada) {
    const jornProf = jornadaMap.get(prof.id)
    for (const dia of diasDaSemana) {
      const jornDia = jornProf ? resolverJornadaDoDia(dia, jornProf, jornadaMensalMap.get(prof.id)) : null
      if (!jornDia) {
        grid.push({ profId: prof.id, nome: prof.nome, dia, trabalha: false, livres: [] })
        continue
      }
      const diaKey = formatAppDateKey(dia)
      const agsDoDia = (todosAgendamentos ?? []).filter(
        a => a.profissional_id === prof.id && formatAppDateKey(new Date(a.data_agendamento)) === diaKey
      )
      const ocupados: IntervaloBloqueado[] = [
        ...agsDoDia.map(a => {
          const h = getAppHour(new Date(a.data_agendamento))
          const m = new Date(a.data_agendamento).getMinutes()
          const horaMin = h * 60 + m
          return { inicio: horaMin, fim: horaMin + (a.duracao_minutos ?? 60) }
        }),
        ...(bloqueiosPorProfEData.get(`${prof.id}|${diaKey}`) ?? []),
      ]
      grid.push({
        profId: prof.id,
        nome: prof.nome,
        dia,
        trabalha: true,
        almocoInicio: jornDia.intervalo_inicio,
        almocoFim: jornDia.intervalo_fim,
        livres: calcularSlotsLivres(jornDia, ocupados),
      })
    }
  }

  return (
    <div className="space-y-6 px-6">
      {/* Status em tempo real */}
      <StatusEquipeRealtime
        profissionais={profissionaisStatus}
        initialStatuses={initialStatuses}
        opcoes={opcoesStatus}
        disponibilidades={Object.fromEntries(
          profissionaisStatus.map((prof) => [
            prof.id,
            Object.fromEntries((jornadaMap.get(prof.id) ?? new Map()).entries()),
          ]),
        )}
        disponibilidadesHoje={Object.fromEntries(
          profissionaisStatus.map((prof) => [
            prof.id,
            resolverJornadaDoDia(
              parseAppDate(formatAppDateKey(new Date())),
              jornadaMap.get(prof.id) ?? new Map(),
              jornadaMensalMap.get(prof.id),
            ) ?? null,
          ]),
        )}
      />

      {/* Cabeçalho */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 leading-tight">Disponibilidade da equipe</h2>
            <p className="text-sm text-slate-500 mt-1">
              Horários livres de {profissionaisComJornada.length} profissiona{profissionaisComJornada.length === 1 ? 'l' : 'is'} na semana
            </p>
          </div>
          <SeletorSemana
            semanaLabel={semanaLabel}
            hrefAnterior={buildNavUrl(prevData)}
            hrefProxima={buildNavUrl(nextData)}
            hrefHoje={buildNavUrl(format(new Date(), 'yyyy-MM-dd'))}
          />
        </div>

        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Agrupar</span>
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <Link
              href={buildToggleUrl('horario')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                agrupamento === 'horario' ? 'bg-white shadow-sm text-[#006b5a]' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Por horário
            </Link>
            <Link
              href={buildToggleUrl('profissional')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                agrupamento === 'profissional' ? 'bg-white shadow-sm text-[#006b5a]' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Por profissional
            </Link>
          </div>
        </div>
      </div>

      {agrupamento === 'profissional' ? (
        // ── Por profissional: cada linha = um profissional, dias como colunas legíveis ──
        <div className="space-y-4">
          {profissionaisComJornada.map(prof => {
            const diasProf = grid.filter(g => g.profId === prof.id)
            const diasComTrabalho = diasProf.filter(d => d.trabalha)
            return (
              <div key={prof.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Nome do profissional */}
                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-slate-800">{prof.nome}</p>
                  <Link
                    href={`/configuracoes/disponibilidade?profissional=${prof.id}`}
                    className="text-xs text-[#006b5a] font-semibold hover:underline shrink-0"
                  >
                    Ver detalhe →
                  </Link>
                </div>
                {/* Grid de dias — rola na horizontal em telas estreitas em vez de espremer */}
                <div className="overflow-x-auto">
                  <div className="grid grid-cols-7 divide-x divide-slate-100 min-w-[860px]">
                    {diasProf.map(({ dia, trabalha, almocoInicio, almocoFim, livres }) => {
                      const isHoje = isSameDay(dia, new Date())
                      return (
                        <div key={dia.toISOString()} className={`p-3 min-h-[110px] ${isHoje ? 'bg-[#006b5a]/5' : ''}`}>
                          <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${isHoje ? 'text-[#006b5a]' : 'text-slate-400'}`}>
                            {DIAS_SEMANA[dia.getDay()]} {format(dia, 'd')}
                          </p>
                          {!trabalha ? (
                            <p className="text-xs text-slate-300">—</p>
                          ) : (
                            <div className="space-y-1.5">
                              {almocoInicio && almocoFim && (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5">
                                  <p className="text-xs font-bold text-amber-800 leading-tight">Intervalo</p>
                                  <p className="text-xs text-amber-700 mt-0.5 tabular-nums">{almocoInicio}–{almocoFim}</p>
                                </div>
                              )}
                              {livres.length === 0 ? (
                                <p className="text-xs text-slate-400">Sem livre</p>
                              ) : (
                                livres.map((slot, i) => (
                                  <div key={i} className="bg-[#006b5a]/8 border border-[#006b5a]/25 rounded-lg px-2 py-1.5">
                                    <p className="text-xs font-bold text-[#006b5a] leading-tight tabular-nums">{slot.inicio}–{slot.fim}</p>
                                    <p className="text-xs text-[#006b5a]/70 mt-0.5">
                                      {slot.duracaoMin >= 60 ? `${Math.floor(slot.duracaoMin / 60)}h${slot.duracaoMin % 60 > 0 ? `${slot.duracaoMin % 60}m` : ''}` : `${slot.duracaoMin}min`}
                                    </p>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
                {diasComTrabalho.length === 0 && (
                  <div className="px-5 py-3 text-xs text-slate-400">Sem jornada cadastrada</div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        // ── Por horário: cada coluna = dia, dentro lista quem está livre ──
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {diasDaSemana.map(dia => {
            const isHoje = isSameDay(dia, new Date())
            // Coletar todos os slots desse dia e quem está livre
            const diasGridDia = grid.filter(g => isSameDay(g.dia, dia) && g.trabalha && g.livres.length > 0)

            // Agrupar por hora (cada slot abrange múltiplas horas cheias)
            const horasMap = new Map<number, string[]>() // hora → nomes
            for (const entry of diasGridDia) {
              for (const slot of entry.livres) {
                const inicioH = parseInt(slot.inicio.split(':')[0])
                const fimH = parseInt(slot.fim.split(':')[0])
                for (let h = inicioH; h < fimH; h++) {
                  if (!horasMap.has(h)) horasMap.set(h, [])
                  horasMap.get(h)!.push(nomesExibicao.get(entry.profId) ?? entry.nome.toUpperCase())
                }
              }
            }

            const horasEntries = Array.from(horasMap.entries())
              .sort(([a], [b]) => a - b)
              .map(([hora, nomes]) => ({ hora, nomes }))
            const diaLabel = format(dia, "EEE, d 'de' MMM", { locale: ptBR })

            return (
              <div
                key={dia.toISOString()}
                className={`rounded-2xl border flex flex-col overflow-hidden bg-white ${
                  isHoje ? 'border-[#006b5a] shadow-md ring-1 ring-[#006b5a]/20' : 'border-slate-200'
                }`}
              >
                <div className={`px-3 py-2.5 flex items-center justify-between ${isHoje ? 'bg-[#006b5a] text-white' : 'bg-slate-50 text-slate-700'}`}>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider opacity-90">
                      {DIAS_SEMANA[dia.getDay()]}
                    </span>
                    <span className="text-xl font-extrabold leading-none">{format(dia, 'd')}</span>
                  </div>
                  {horasEntries.length > 0 && (
                    <BtnCopiarDisponibilidade diaLabel={diaLabel} horas={horasEntries} />
                  )}
                </div>
                <div className="flex-1 p-3 space-y-2.5">
                  {horasEntries.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-5">Nenhum livre</p>
                  ) : (
                    horasEntries.map(({ hora: h, nomes }) => (
                      <div key={h} className="flex items-start gap-2">
                        <span className="text-xs font-bold text-slate-500 w-9 shrink-0 pt-1 tabular-nums">
                          {h.toString().padStart(2, '0')}h
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {nomes.map((nome, i) => (
                            <span key={i} className="inline-flex items-center text-xs font-bold bg-[#006b5a]/10 text-[#006b5a] px-2 py-1 rounded-lg">
                              {nome}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DisponibilidadePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { user, profile } = await requireModulo('configuracoes:disponibilidade')

  const supabase = await createClient()
  const params = await searchParams

  const isGestor = podeGerirEquipe({
    role: profile?.role,
    nivelAcesso: profile?.nivel_acesso,
  })

  let profissionais: { id: string; nome: string }[] = []
  let profissionaisStatus: { id: string; nome: string }[] = []
  if (isGestor) {
    const [{ data: listaProfissionais }, { data: jornadasAtivas }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('ativo', true)
        .in('role', ['fisioterapeuta', 'gestor'])
        .order('full_name'),
      supabase
        .from('disponibilidade_profissional')
        .select('profissional_id')
        .eq('ativo', true),
    ])

    const profissionaisComJornada = new Set((jornadasAtivas ?? []).map((item) => item.profissional_id))
    const equipeStatus = (listaProfissionais ?? []).filter((p) =>
      podeEntrarNaAgendaOuRelatorio(p, profissionaisComJornada),
    )

    profissionaisStatus = equipeStatus.map((p) => ({ id: p.id, nome: p.full_name || 'Sem nome' }))
    profissionais = equipeStatus
      .filter((p) => p.role === 'fisioterapeuta' || (p.role === 'gestor' && profissionaisComJornada.has(p.id)))
      .map((p) => ({ id: p.id, nome: p.full_name || 'Sem nome' }))
  } else {
    profissionaisStatus = [{ id: user.id, nome: profile?.full_name ?? 'Você' }]
  }

  const visao = typeof params.visao === 'string' ? params.visao : null
  const paramProfId = typeof params.profissional === 'string' ? params.profissional : null
  const dataParam = typeof params.data === 'string' ? params.data : undefined
  const agrupamento = params.agrupamento === 'profissional' ? 'profissional' : 'horario'
  const targetId = isGestor && paramProfId ? paramProfId : user.id
  const statusIds = isGestor ? profissionaisStatus.map(p => p.id) : [targetId]

  // AC-030: o catálogo real, do banco. Sem ele o painel caía no DEFAULT_OPCOES
  // de 4 slugs e todo status criado pelo gestor aparecia com o identificador
  // cru, sem cor, sem ping e sem contador.
  const [initialStatuses, opcoesStatus] = await Promise.all([
    listarStatusDisponibilidade(statusIds),
    listarStatusOpcoesParaExibicao(),
  ])

  // Gestor sem parâmetro → redirect para visão geral
  if (isGestor && !visao && !paramProfId) {
    const hoje = format(new Date(), 'yyyy-MM-dd')
    redirect(`/configuracoes/disponibilidade?visao=geral&agrupamento=horario&data=${hoje}`)
  }

  // Gestor em visão geral
  if (isGestor && visao === 'geral') {
    return (
      <ViewGeral
        profissionais={profissionais}
        profissionaisStatus={profissionaisStatus}
        dataParam={dataParam}
        agrupamento={agrupamento as 'horario' | 'profissional'}
        initialStatuses={initialStatuses}
        opcoesStatus={opcoesStatus}
      />
    )
  }

  // Individual (fisioterapeuta ou gestor com ?profissional=id)
  const nomeProfissional = isGestor
    ? profissionais.find(p => p.id === targetId)?.nome ?? 'Profissional'
    : profile?.full_name ?? 'Você'

  return (
    <ViewIndividual
      targetId={targetId}
      nomeProfissional={nomeProfissional}
      isGestor={isGestor}
      profissionais={profissionais}
      paramProfId={paramProfId}
      dataParam={dataParam}
      initialStatuses={initialStatuses}
      opcoesStatus={opcoesStatus}
    />
  )
}
