import { createClient } from '@/lib/supabase/server'
import { requireModulo } from '@/lib/guard'
import { formatAppDate, formatAppTime, getAppDayRangeUTC } from '@/lib/datetime'
import { ClipboardCheck, Clock, Users } from 'lucide-react'
import { BtnGerarPdfConferencia } from '@/components/features/shared/BtnGerarPdfConferencia'
import { BtnExportarXlsxConferencia } from '@/components/features/shared/BtnExportarXlsxConferencia'
import type { GrupoProfissionalConferencia } from '@/lib/relatorios/pdf-conferencia-agendamentos'
import { TabelaConferencia } from './TabelaConferencia'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

const STATUS_CONCLUIDO = ['Concluído', 'Concluido', 'concluído', 'concluido']
const STATUS_CANCELADO = ['Cancelado', 'cancelado', 'Cancelada', 'cancelada']

function formatarMinutos(minutos: number): string {
  if (minutos <= 0) return '—'
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  if (h === 0) return `${m}min`
  return m === 0 ? `${h}h` : `${h}h ${m}min`
}

export default async function ConferenciaAgendamentosPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  await requireModulo('equipe:conferencia')

  const supabase = await createClient()
  const params = await searchParams

  const hoje = new Date()
  const dataInicioPadrao = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10)
  const dataFimPadrao = hoje.toISOString().slice(0, 10)

  const dataInicio = (params.data_inicio as string) || dataInicioPadrao
  const dataFim = (params.data_fim as string) || dataFimPadrao
  const profissionalId = (params.profissional_id as string) || ''

  const dataInicioIso = getAppDayRangeUTC(dataInicio).start
  const dataFimIso = getAppDayRangeUTC(dataFim).end

  const { data: perfisProfissionaisRaw } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('role', 'fisioterapeuta')
    .eq('ativo', true)
    .order('full_name')

  const profissionais = (perfisProfissionaisRaw ?? []) as Array<{
    id: string
    full_name: string | null
    role: string | null
  }>

  let query = supabase
    .from('atendimentos')
    .select(`
      id,
      data_agendamento,
      tipo,
      profissional_id,
      agendamento_id,
      duracao_minutos,
      pacientes(nome),
      profissional:profiles!profissional_id(full_name),
      agendamento:agendamentos!agendamento_id(plano_saude)
    `)
    .in('status', STATUS_CONCLUIDO)
    .gte('data_agendamento', dataInicioIso)
    .lte('data_agendamento', dataFimIso)
    .order('data_agendamento', { ascending: true })

  if (profissionalId) {
    query = query.eq('profissional_id', profissionalId)
  } else {
    const idsFisios = profissionais.map(p => p.id)
    if (idsFisios.length > 0) {
      query = query.in('profissional_id', idsFisios)
    }
  }

  const { data: atendimentosRaw } = await query
  const atendimentos = (atendimentosRaw ?? []) as any[]

  // Agendamentos passados não concluídos (excluindo cancelados)
  const agora = new Date().toISOString()
  let queryPendentes = supabase
    .from('atendimentos')
    .select(`
      id,
      data_agendamento,
      tipo,
      status,
      profissional_id,
      pacientes(nome),
      profissional:profiles!profissional_id(full_name)
    `)
    .not('status', 'in', `(${[...STATUS_CONCLUIDO, ...STATUS_CANCELADO].map(s => `"${s}"`).join(',')})`)
    .gte('data_agendamento', dataInicioIso)
    .lt('data_agendamento', agora)
    .order('data_agendamento', { ascending: true })

  if (profissionalId) {
    queryPendentes = queryPendentes.eq('profissional_id', profissionalId)
  } else {
    const idsFisios = profissionais.map(p => p.id)
    if (idsFisios.length > 0) {
      queryPendentes = queryPendentes.in('profissional_id', idsFisios)
    }
  }

  const { data: pendentesRaw } = await queryPendentes
  const atendimentosPendentes = (pendentesRaw ?? []) as any[]

  const profissionaisMap = new Map(profissionais.map(p => [p.id, p.full_name || 'Sem nome']))

  const gruposMap = new Map<string, GrupoProfissionalConferencia>()

  for (const a of atendimentos) {
    const profId = a.profissional_id as string | null
    if (!profId) continue

    const profNome =
      (Array.isArray(a.profissional) ? a.profissional[0]?.full_name : a.profissional?.full_name)
      ?? profissionaisMap.get(profId)
      ?? 'Sem responsável'
    const pacienteNome =
      (Array.isArray(a.pacientes) ? a.pacientes[0]?.nome : a.pacientes?.nome) ?? 'Paciente'
    const hora = formatAppTime(a.data_agendamento)
    const tipo = (a.tipo as string | null) || 'Sem tipo'
    const agJoin = (Array.isArray(a.agendamento) ? a.agendamento[0] : a.agendamento) as { plano_saude?: string | null } | null
    const duracaoMinutos = (a.duracao_minutos as number | null) ?? 0
    const planoSaude = agJoin?.plano_saude?.trim() || 'Não informado'
    const dataLabel = formatAppDate(a.data_agendamento)

    if (!gruposMap.has(profId)) {
      gruposMap.set(profId, {
        profissionalNome: profNome,
        dias: [],
        totalSessoes: 0,
        totalMinutos: 0,
      })
    }

    const grupo = gruposMap.get(profId)!
    let dia = grupo.dias.find(d => d.dataLabel === dataLabel)
    if (!dia) {
      dia = { dataLabel, sessoes: [], totalSessoes: 0, totalMinutos: 0 }
      grupo.dias.push(dia)
    }

    dia.sessoes.push({ pacienteNome, hora, tipo, duracaoMinutos, planoSaude })
    dia.totalSessoes++
    dia.totalMinutos += duracaoMinutos
    grupo.totalSessoes++
    grupo.totalMinutos += duracaoMinutos
  }

  // Agrupar pendentes passados por profissional
  for (const a of atendimentosPendentes) {
    const profId = a.profissional_id as string | null
    if (!profId) continue

    const profNome =
      (Array.isArray(a.profissional) ? a.profissional[0]?.full_name : a.profissional?.full_name)
      ?? profissionaisMap.get(profId)
      ?? 'Sem responsável'
    const pacienteNome =
      (Array.isArray(a.pacientes) ? a.pacientes[0]?.nome : a.pacientes?.nome) ?? 'Paciente'

    if (!gruposMap.has(profId)) {
      gruposMap.set(profId, {
        profissionalNome: profNome,
        dias: [],
        totalSessoes: 0,
        totalMinutos: 0,
      })
    }

    const grupo = gruposMap.get(profId)!
    if (!grupo.pendentesPassados) grupo.pendentesPassados = []
    grupo.pendentesPassados.push({
      pacienteNome,
      hora: formatAppTime(a.data_agendamento),
      dataLabel: formatAppDate(a.data_agendamento),
      tipo: (a.tipo as string | null) || 'Sem tipo',
      status: (a.status as string) || 'Pendente',
    })
  }

  for (const grupo of gruposMap.values()) {
    grupo.dias.sort((a, b) => a.dataLabel.localeCompare(b.dataLabel))
  }

  const grupos = Array.from(gruposMap.values()).sort((a, b) =>
    a.profissionalNome.localeCompare(b.profissionalNome),
  )

  const totalGeralSessoes = grupos.reduce((acc, g) => acc + g.totalSessoes, 0)
  const totalGeralMinutos = grupos.reduce((acc, g) => acc + g.totalMinutos, 0)

  const periodoLabel =
    dataInicio === dataFim ? dataInicio : `${dataInicio} até ${dataFim}`
  const profissionalFiltroNome = profissionalId
    ? profissionaisMap.get(profissionalId)
    : undefined

  const exportProps = {
    periodoLabel,
    profissionalFiltro: profissionalFiltroNome,
    grupos,
    totalGeralSessoes,
    totalGeralMinutos,
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#006b5a]/10 flex items-center justify-center shrink-0">
            <ClipboardCheck size={20} className="text-[#006b5a]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#006b5a]">Conferência de Agendamentos</h2>
            <p className="text-xs text-slate-500">Atendimentos concluídos por profissional e dia</p>
          </div>
        </div>
        {totalGeralSessoes > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <BtnExportarXlsxConferencia {...exportProps} />
            <BtnGerarPdfConferencia {...exportProps} />
          </div>
        )}
      </div>

      {/* Filtros */}
      <form
        method="get"
        action="/relatorios/conferencia-agendamentos"
        className="flex flex-wrap items-end gap-3"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Data início</label>
          <input
            type="date"
            name="data_inicio"
            defaultValue={dataInicio}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#006b5a]/50 shadow-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Data fim</label>
          <input
            type="date"
            name="data_fim"
            defaultValue={dataFim}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#006b5a]/50 shadow-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Profissional</label>
          <select
            name="profissional_id"
            defaultValue={profissionalId}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#006b5a]/50 shadow-sm"
          >
            <option value="">Todos</option>
            {profissionais.map(p => (
              <option key={p.id} value={p.id}>{p.full_name}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-[#006b5a] hover:bg-[#005a4b] text-white rounded-lg text-sm font-medium transition-colors self-end"
        >
          Filtrar
        </button>
      </form>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <ClipboardCheck size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">Sessões concluídas</span>
          </div>
          <p className="text-3xl font-bold text-[#006b5a]">{totalGeralSessoes}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Clock size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">Total trabalhado</span>
          </div>
          <p className="text-3xl font-bold text-[#006b5a]">{formatarMinutos(totalGeralMinutos)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Users size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">Profissionais</span>
          </div>
          <p className="text-3xl font-bold text-[#006b5a]">{grupos.length}</p>
        </div>
      </div>

      {/* Tabela com abas */}
      {totalGeralSessoes === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-slate-100 flex flex-col items-center gap-4 text-center">
          <ClipboardCheck size={40} className="text-slate-200" />
          <div>
            <p className="font-bold text-slate-700">Nenhum atendimento encontrado</p>
            <p className="text-slate-400 text-sm mt-1">Ajuste o período ou o profissional selecionado.</p>
          </div>
        </div>
      ) : (
        <TabelaConferencia grupos={grupos} />
      )}
    </div>
  )
}