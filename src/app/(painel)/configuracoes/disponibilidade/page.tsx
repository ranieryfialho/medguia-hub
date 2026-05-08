import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  format, startOfWeek, endOfWeek, addDays, subWeeks, addWeeks,
  parseISO, isValid, isSameDay,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Clock, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'
import { getAppHour } from '@/lib/datetime'
import { BtnCopiarDisponibilidade } from '@/components/features/configuracoes'
import { normalizarDisponibilidade, type DisponibilidadeDia } from '@/lib/disponibilidade'
import { obterIntervalosJornada, toHora } from '@/lib/jornada'
import { StatusEquipeRealtime } from '@/components/features/equipe'
import { listarStatusDisponibilidade } from '@/actions/status-disponibilidade'
import { requireModulo } from '@/lib/guard'
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

// ─── Visão Individual (fisioterapeuta ou drill-down gestor) ──────────────────

async function ViewIndividual({
  targetId,
  nomeProfissional,
  isGestor,
  profissionais,
  paramProfId,
  dataParam,
  initialStatuses,
}: {
  targetId: string
  nomeProfissional: string
  isGestor: boolean
  profissionais: { id: string; nome: string }[]
  paramProfId: string | null
  dataParam: string | undefined
  initialStatuses: Awaited<ReturnType<typeof listarStatusDisponibilidade>>
}) {
  const supabase = await createClient()

  let dataSelecionada = new Date()
  if (dataParam) {
    const parsed = parseISO(dataParam)
    if (isValid(parsed)) dataSelecionada = parsed
  }

  const inicioDaSemana = startOfWeek(dataSelecionada, { weekStartsOn: 0 })
  const fimDaSemana = endOfWeek(dataSelecionada, { weekStartsOn: 0 })
  const diasDaSemana = Array.from({ length: 7 }, (_, i) => addDays(inicioDaSemana, i))

  const semanaLabel = `${format(inicioDaSemana, "d 'De' MMM", { locale: ptBR })} – ${format(fimDaSemana, "d 'De' MMM", { locale: ptBR })}`
  const prevData = format(subWeeks(dataSelecionada, 1), 'yyyy-MM-dd')
  const nextData = format(addWeeks(dataSelecionada, 1), 'yyyy-MM-dd')

  const buildUrl = (data: string) => {
    const base = `/configuracoes/disponibilidade?data=${data}`
    return isGestor && paramProfId ? `${base}&profissional=${paramProfId}` : base
  }

  const { data: jornada } = await supabase
    .from('disponibilidade_profissional')
    .select('dia_semana, hora_inicio, hora_fim, almoco_inicio, almoco_fim, ativo')
    .eq('profissional_id', targetId)
    .eq('ativo', true)

  const jornadaMap = new Map(
    (jornada ?? []).map(j => [j.dia_semana, normalizarDisponibilidade(j)])
  )

  const { data: agendamentos } = await supabase
    .from('atendimentos')
    .select('data_agendamento, duracao_minutos')
    .eq('profissional_id', targetId)
    .gte('data_agendamento', inicioDaSemana.toISOString())
    .lte('data_agendamento', fimDaSemana.toISOString())
    .not('status', 'in', STATUS_NAO_BLOQUEIAM_RAW_SQL)

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
    const diaSemana = dia.getDay()
    const jornDia = jornadaMap.get(diaSemana)
    if (!jornDia) return { dia, trabalha: false, livres: [], totalOcupado: 0, totalLivre: 0 }

    const agsDoDia = (agendamentos ?? []).filter(a => isSameDay(new Date(a.data_agendamento), dia))
    const ocupados: IntervaloBloqueado[] = agsDoDia.map(a => {
      const d = new Date(a.data_agendamento)
      const horaMin = getAppHour(d) * 60 + parseInt(format(d, 'mm'))
      return { inicio: horaMin, fim: horaMin + (a.duracao_minutos ?? 60) }
    })

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
      jornadaInicio: jornDia.hora_inicio,
      jornadaFim: jornDia.hora_fim,
      almocoInicio: jornDia.almoco_inicio,
      almocoFim: jornDia.almoco_fim,
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
          disponibilidades={{ [targetId]: Object.fromEntries(jornadaMap.entries()) }}
        />
      )}

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#006b5a]">Disponibilidade</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Horários livres de <span className="font-semibold text-slate-700">{nomeProfissional}</span> — jornada menos agendamentos existentes
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isGestor && (
              <Link
                href="/configuracoes/disponibilidade?visao=geral"
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#006b5a]/30 text-[#006b5a] hover:bg-[#006b5a]/5 transition-colors"
              >
                ← Visão geral
              </Link>
            )}
            <Link href={buildUrl(prevData)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-600">
              <ChevronLeft size={18} />
            </Link>
            <span className="text-sm font-semibold text-slate-700 min-w-[180px] text-center capitalize">
              {semanaLabel}
            </span>
            <Link href={buildUrl(nextData)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-600">
              <ChevronRight size={18} />
            </Link>
          </div>
        </div>

        {isGestor && profissionais.length > 0 && (
          <div className="mt-4 max-w-xs">
            <label className="text-xs font-semibold text-slate-500 block mb-1.5">Profissional</label>
            <form method="GET" action="/configuracoes/disponibilidade" className="flex gap-2">
              {dataParam && <input type="hidden" name="data" value={dataParam} />}
              <select
                name="profissional"
                defaultValue={targetId}
                className="flex-1 bg-white border border-[#bcc9c4] rounded-lg px-3 py-2 text-sm text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] transition-all font-medium appearance-none shadow-sm"
              >
                {profissionais.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
              <button type="submit" className="px-3 py-2 bg-[#006b5a] text-white text-sm font-semibold rounded-lg hover:bg-[#005548] transition-colors">
                Ver
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Resumo semana */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#006b5a]/5 border border-[#006b5a]/15 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle size={20} className="text-[#006b5a] shrink-0" />
          <div>
            <p className="text-xs text-slate-500 font-medium">Livre na semana</p>
            <p className="text-lg font-bold text-[#006b5a]">
              {Math.floor(totalLivreSemana / 60)}h{totalLivreSemana % 60 > 0 ? ` ${totalLivreSemana % 60}min` : ''}
            </p>
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3">
          <XCircle size={20} className="text-slate-400 shrink-0" />
          <div>
            <p className="text-xs text-slate-500 font-medium">Ocupado na semana</p>
            <p className="text-lg font-bold text-slate-600">
              {Math.floor(totalOcupadoSemana / 60)}h{totalOcupadoSemana % 60 > 0 ? ` ${totalOcupadoSemana % 60}min` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Grade semanal */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {dadosPorDia.map(({ dia, trabalha, jornadaInicio, jornadaFim, almocoInicio, almocoFim, livres, totalLivre, totalOcupado }) => {
          const isHoje = isSameDay(dia, new Date())
          return (
            <div
              key={dia.toISOString()}
              className={`rounded-xl border flex flex-col overflow-hidden ${isHoje ? 'border-[#006b5a]/40 shadow-md' : 'border-slate-200'} ${!trabalha ? 'opacity-50' : ''}`}
            >
              <div className={`px-3 py-2.5 text-center ${isHoje ? 'bg-[#006b5a] text-white' : 'bg-slate-50 text-slate-700'}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{DIAS_SEMANA[dia.getDay()]}</p>
                <p className="text-lg font-extrabold leading-none mt-0.5">{format(dia, 'd')}</p>
              </div>
              <div className="bg-white flex-1 p-2.5 space-y-1.5">
                {!trabalha ? (
                  <p className="text-[10px] text-slate-400 text-center py-2 italic">Não atende</p>
                ) : (
                  <>
                    <div className="flex items-center gap-1 text-[9px] text-slate-400 font-medium pb-1 border-b border-slate-100">
                      <Clock size={9} />
                      <span>{jornadaInicio} – {jornadaFim}</span>
                    </div>
                    {almocoInicio && almocoFim && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5">
                        <p className="text-[10px] font-bold text-amber-700 leading-none">Almoço</p>
                        <p className="text-[9px] text-amber-600 mt-0.5">{almocoInicio} – {almocoFim}</p>
                      </div>
                    )}
                    {livres.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic text-center py-2">Sem horário livre</p>
                    ) : (
                      livres.map((slot, i) => (
                        <div key={i} className="bg-[#006b5a]/8 border border-[#006b5a]/20 rounded-lg px-2 py-1.5">
                          <p className="text-[10px] font-bold text-[#006b5a] leading-none">{slot.inicio} – {slot.fim}</p>
                          <p className="text-[9px] text-[#006b5a]/60 mt-0.5">
                            {slot.duracaoMin >= 60
                              ? `${Math.floor(slot.duracaoMin / 60)}h${slot.duracaoMin % 60 > 0 ? `${slot.duracaoMin % 60}min` : ''}`
                              : `${slot.duracaoMin}min`} livre
                          </p>
                        </div>
                      ))
                    )}
                    <div className="pt-1 border-t border-slate-100 flex justify-between text-[9px] text-slate-400">
                      <span className="text-[#006b5a] font-semibold">
                        {totalLivre >= 60 ? `${Math.floor(totalLivre / 60)}h${totalLivre % 60 > 0 ? `${totalLivre % 60}m` : ''} livre` : totalLivre > 0 ? `${totalLivre}min livre` : 'sem livre'}
                      </span>
                      <span>
                        {totalOcupado >= 60 ? `${Math.floor(totalOcupado / 60)}h${totalOcupado % 60 > 0 ? `${totalOcupado % 60}m` : ''} ocup.` : totalOcupado > 0 ? `${totalOcupado}min ocup.` : ''}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="text-center">
        <Link
          href={isGestor && paramProfId ? `/configuracoes/jornada?profissional=${paramProfId}` : '/configuracoes/jornada'}
          className="text-sm text-[#006b5a] font-semibold hover:underline"
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
}: {
  profissionais: { id: string; nome: string }[]
  profissionaisStatus: { id: string; nome: string }[]
  dataParam: string | undefined
  agrupamento: 'horario' | 'profissional'
  initialStatuses: Awaited<ReturnType<typeof listarStatusDisponibilidade>>
}) {
  const supabase = await createClient()

  let dataSelecionada = new Date()
  if (dataParam) {
    const parsed = parseISO(dataParam)
    if (isValid(parsed)) dataSelecionada = parsed
  }

  const inicioDaSemana = startOfWeek(dataSelecionada, { weekStartsOn: 0 })
  const fimDaSemana = endOfWeek(dataSelecionada, { weekStartsOn: 0 })
  const diasDaSemana = Array.from({ length: 7 }, (_, i) => addDays(inicioDaSemana, i))

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
    .select('profissional_id, dia_semana, hora_inicio, hora_fim, almoco_inicio, almoco_fim, ativo')
    .in('profissional_id', profIds)
    .eq('ativo', true)

  // Montar mapa: profId → dia_semana → { inicio, fim }
  const jornadaMap = new Map<string, Map<number, DisponibilidadeDia>>()
  for (const j of todasJornadas ?? []) {
    if (!jornadaMap.has(j.profissional_id)) jornadaMap.set(j.profissional_id, new Map())
    jornadaMap.get(j.profissional_id)!.set(j.dia_semana, normalizarDisponibilidade(j))
  }

  const profIdsComJornada = [...new Set((todasJornadas ?? []).map((j) => j.profissional_id))]
  const { data: todosAgendamentos } = profIdsComJornada.length > 0
    ? await supabase
        .from('atendimentos')
        .select('profissional_id, data_agendamento, duracao_minutos')
        .in('profissional_id', profIdsComJornada)
        .gte('data_agendamento', inicioDaSemana.toISOString())
        .lte('data_agendamento', fimDaSemana.toISOString())
        .not('status', 'in', STATUS_NAO_BLOQUEIAM_RAW_SQL)
    : { data: [] }

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
      const diaSemana = dia.getDay()
      const jornDia = jornProf?.get(diaSemana)
      if (!jornDia) {
        grid.push({ profId: prof.id, nome: prof.nome, dia, trabalha: false, livres: [] })
        continue
      }
      const agsDoDia = (todosAgendamentos ?? []).filter(
        a => a.profissional_id === prof.id && isSameDay(new Date(a.data_agendamento), dia)
      )
      const ocupados: IntervaloBloqueado[] = agsDoDia.map(a => {
        const h = getAppHour(new Date(a.data_agendamento))
        const m = new Date(a.data_agendamento).getMinutes()
        const horaMin = h * 60 + m
        return { inicio: horaMin, fim: horaMin + (a.duracao_minutos ?? 60) }
      })
      grid.push({
        profId: prof.id,
        nome: prof.nome,
        dia,
        trabalha: true,
        almocoInicio: jornDia.almoco_inicio,
        almocoFim: jornDia.almoco_fim,
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
        disponibilidades={Object.fromEntries(
          profissionaisStatus.map((prof) => [
            prof.id,
            Object.fromEntries((jornadaMap.get(prof.id) ?? new Map()).entries()),
          ]),
        )}
      />

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#006b5a]">Disponibilidade — Visão Geral</h2>
            <p className="text-sm text-slate-500 mt-0.5">Horários livres de todos os profissionais na semana</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Toggle agrupamento */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
              <Link
                href={buildToggleUrl('horario')}
                className={`px-3 py-1.5 rounded-md transition-all ${agrupamento === 'horario' ? 'bg-white shadow text-[#006b5a]' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Por horário
              </Link>
              <Link
                href={buildToggleUrl('profissional')}
                className={`px-3 py-1.5 rounded-md transition-all ${agrupamento === 'profissional' ? 'bg-white shadow text-[#006b5a]' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Por profissional
              </Link>
            </div>
            {/* Navegação semana */}
            <div className="flex items-center gap-1">
              <Link href={buildNavUrl(prevData)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-600">
                <ChevronLeft size={18} />
              </Link>
              <span className="text-sm font-semibold text-slate-700 min-w-[180px] text-center capitalize">
                {semanaLabel}
              </span>
              <Link href={buildNavUrl(nextData)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-600">
                <ChevronRight size={18} />
              </Link>
            </div>
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
              <div key={prof.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Nome do profissional */}
                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-800">{prof.nome}</p>
                  <Link
                    href={`/configuracoes/disponibilidade?profissional=${prof.id}`}
                    className="text-xs text-[#006b5a] font-semibold hover:underline"
                  >
                    Ver detalhe →
                  </Link>
                </div>
                {/* Grid de dias */}
                <div className="grid grid-cols-7 divide-x divide-slate-100">
                  {diasProf.map(({ dia, trabalha, almocoInicio, almocoFim, livres }) => {
                    const isHoje = isSameDay(dia, new Date())
                    return (
                      <div key={dia.toISOString()} className={`p-3 min-h-[100px] ${isHoje ? 'bg-[#006b5a]/5' : ''}`}>
                        <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${isHoje ? 'text-[#006b5a]' : 'text-slate-400'}`}>
                          {DIAS_SEMANA[dia.getDay()]} {format(dia, 'd')}
                        </p>
                        {!trabalha ? (
                          <p className="text-xs text-slate-300 italic">—</p>
                        ) : (
                          <div className="space-y-1.5">
                            {almocoInicio && almocoFim && (
                              <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5">
                                <p className="text-[10px] font-bold text-amber-700 leading-tight">Almoço</p>
                                <p className="text-[10px] text-amber-600 mt-0.5">{almocoInicio}–{almocoFim}</p>
                              </div>
                            )}
                            {livres.length === 0 ? (
                              <p className="text-xs text-slate-400 italic">Sem livre</p>
                            ) : (
                              livres.map((slot, i) => (
                                <div key={i} className="bg-[#006b5a]/8 border border-[#006b5a]/20 rounded-lg px-2 py-1.5">
                                  <p className="text-xs font-bold text-[#006b5a] leading-tight">{slot.inicio}–{slot.fim}</p>
                                  <p className="text-[10px] text-[#006b5a]/60 mt-0.5">
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
                {diasComTrabalho.length === 0 && (
                  <div className="px-5 py-3 text-xs text-slate-400 italic">Sem jornada cadastrada</div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        // ── Por horário: cada coluna = dia, dentro lista quem está livre ──
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
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
                className={`rounded-xl border flex flex-col overflow-hidden ${isHoje ? 'border-[#006b5a]/40 shadow-md' : 'border-slate-200'}`}
              >
                <div className={`px-3 py-3 text-center relative ${isHoje ? 'bg-[#006b5a] text-white' : 'bg-slate-50 text-slate-700'}`}>
                  <p className="text-xs font-bold uppercase tracking-wider opacity-80">{DIAS_SEMANA[dia.getDay()]}</p>
                  <p className="text-xl font-extrabold leading-none mt-1">{format(dia, 'd')}</p>
                  {horasEntries.length > 0 && (
                    <div className="absolute top-2 right-2">
                      <BtnCopiarDisponibilidade diaLabel={diaLabel} horas={horasEntries} />
                    </div>
                  )}
                </div>
                <div className="bg-white flex-1 p-3 space-y-2">
                  {horasEntries.length === 0 ? (
                    <p className="text-xs text-slate-300 italic text-center py-4">Nenhum livre</p>
                  ) : (
                    horasEntries.map(({ hora: h, nomes }) => (
                      <div key={h} className="flex items-start gap-2">
                        <span className="text-xs font-bold text-slate-400 w-9 shrink-0 pt-0.5">{h.toString().padStart(2, '0')}H</span>
                        <div className="flex flex-wrap gap-1">
                          {nomes.map((nome, i) => (
                            <span key={i} className="inline-flex items-center justify-center text-center text-[11px] font-bold bg-[#006b5a]/10 text-[#006b5a] px-2 py-1 rounded-full">
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
  await requireModulo('configuracoes:disponibilidade')

  const supabase = await createClient()
  const params = await searchParams

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, nivel_acesso, full_name')
    .eq('id', user.id)
    .single()

  const isGestor = profile?.nivel_acesso === 'gestor' || profile?.nivel_acesso === 'master'

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
      .filter((p) => p.role === 'fisioterapeuta')
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
  const initialStatuses = await listarStatusDisponibilidade(statusIds)

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
    />
  )
}
