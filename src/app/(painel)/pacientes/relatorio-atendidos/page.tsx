import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { requireModulo } from '@/lib/guard'
import { isGestorSistema } from '@/lib/permissoes'
import { formatAppDateKey, getAppDayRangeUTC } from '@/lib/datetime'
import { isStatusFabril } from '@/lib/atendimento-status'
import { Users, CalendarDays, Stethoscope, ClipboardList } from 'lucide-react'
import { FiltrosCadastros } from '@/components/features/shared'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>
type TipoFiltro = '12meses' | 'mes' | 'semana' | 'personalizado'

type AtendimentoResumo = {
  paciente_id: string
  status: string | null
  data_agendamento: string
}

function getSemanaKey(isoStr: string): string {
  return getMondayKey(formatAppDateKey(isoStr))
}

function getMesKey(isoStr: string): string {
  return formatAppDateKey(isoStr).slice(0, 7)
}

function formatarMes(mesKey: string): string {
  const [y, m] = mesKey.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' })
    .format(new Date(`${y}-${String(m).padStart(2, '0')}-15T12:00:00Z`))
    .replace(/^\w/, c => c.toUpperCase())
    .replace('.', '')
}

function formatarSemana(mondayKey: string): string {
  const [y, m, d] = mondayKey.split('-').map(Number)
  const mon = new Date(y, m - 1, d)
  const sun = new Date(y, m - 1, d + 6)
  const fmt = (dt: Date) => `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`
  return `${fmt(mon)} – ${fmt(sun)}`
}

function formatarDia(diaKey: string): string {
  const [y, mo, d] = diaKey.split('-')
  return `${d}/${mo}/${y}`
}

function formatarDiaSemana(diaKey: string): string {
  const [y, m, d] = diaKey.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
    .format(new Date(y, m - 1, d))
    .replace(/^\w/, c => c.toUpperCase())
    .replace('.', '')
}

function getMondayKey(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = dt.getDay() === 0 ? 6 : dt.getDay() - 1
  dt.setDate(dt.getDate() - dow)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function getMonthRange(mesKey: string) {
  const [y, m] = mesKey.split('-').map(Number)
  const lastDay = new Date(y, m, 0)
  const lastStr = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
  return {
    start: getAppDayRangeUTC(`${y}-${String(m).padStart(2, '0')}-01`).start,
    end: getAppDayRangeUTC(lastStr).end,
  }
}

function getWeekRange(mondayKey: string) {
  const [y, m, d] = mondayKey.split('-').map(Number)
  const sunday = new Date(y, m - 1, d + 6)
  const sundayStr = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`
  return {
    start: getAppDayRangeUTC(mondayKey).start,
    end: getAppDayRangeUTC(sundayStr).end,
  }
}

export default async function RelatorioAtendidosPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, profile } = await requireModulo('pacientes')

  const supabase = await createClient()
  const params = await searchParams
  const agora = new Date()
  const hojeKey = formatAppDateKey(agora)

  // Padrão: semana atual — é a pergunta mais comum ("quantos atendemos essa semana").
  const tipo = ((params.tipo as string) || 'semana') as TipoFiltro
  const mesParam = (params.mes as string) || ''
  const semanaParam = (params.semana as string) || (tipo === 'semana' ? hojeKey : '')
  const inicioParam = (params.inicio as string) || ''
  const fimParam = (params.fim as string) || ''

  let queryInicio: string
  let queryFim: string

  if (tipo === 'mes' && mesParam) {
    const range = getMonthRange(mesParam)
    queryInicio = range.start
    queryFim = range.end
  } else if (tipo === 'semana' && semanaParam) {
    const mondayKey = getMondayKey(semanaParam)
    const range = getWeekRange(mondayKey)
    queryInicio = range.start
    queryFim = range.end
  } else if (tipo === 'personalizado' && (inicioParam || fimParam)) {
    queryInicio = inicioParam
      ? getAppDayRangeUTC(inicioParam).start
      : new Date(agora.getFullYear() - 1, agora.getMonth(), agora.getDate()).toISOString()
    queryFim = fimParam ? getAppDayRangeUTC(fimParam).end : agora.toISOString()
  } else {
    queryInicio = new Date(agora.getFullYear() - 1, agora.getMonth(), agora.getDate()).toISOString()
    queryFim = agora.toISOString()
  }

  const isGestorOuMaster = isGestorSistema(profile?.nivel_acesso)
  const categoria = params.categoria === 'medicos'
    ? 'medicos'
    : params.categoria === 'todos'
      ? 'todos'
      : 'fisioterapia'
  const profissionalIdParam = (params.profissional_id as string) || ''

  let profIds: string[] = [user.id]
  let fisioterapeutas: { id: string; nome: string }[] = []
  let medicosOpcoes: { id: string; nome: string }[] = []

  if (isGestorOuMaster) {
    const { data: profsData } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['fisioterapeuta', 'medico'])
      .eq('ativo', true)
      .order('full_name')

    const profs = (profsData ?? []) as { id: string; full_name: string | null; role: string | null }[]
    fisioterapeutas = profs.filter((p) => p.role === 'fisioterapeuta').map((p) => ({ id: p.id, nome: p.full_name || 'Sem nome' }))
    medicosOpcoes = profs.filter((p) => p.role === 'medico').map((p) => ({ id: p.id, nome: p.full_name || 'Sem nome' }))

    const opcoesCategoria = categoria === 'medicos'
      ? medicosOpcoes
      : categoria === 'fisioterapia'
        ? fisioterapeutas
        : [...fisioterapeutas, ...medicosOpcoes]
    const profissionalValido = opcoesCategoria.some((p) => p.id === profissionalIdParam)
    profIds = profissionalValido ? [profissionalIdParam] : opcoesCategoria.map((p) => p.id)
  }

  const { data: atendData } = profIds.length > 0
    ? await supabase
        .from('atendimentos')
        .select('paciente_id, status, data_agendamento')
        .in('profissional_id', profIds)
        .gte('data_agendamento', queryInicio)
        .lte('data_agendamento', queryFim)
    : { data: [] }

  const todosAtendimentos = (atendData ?? []) as AtendimentoResumo[]

  // Pacientes Ativos: qualquer status no período (mesma definição usada no Dashboard e em /pacientes).
  const pacientesAtivos = new Set(todosAtendimentos.map((a) => a.paciente_id)).size

  // Pacientes Atendidos: só quem de fato passou pela sessão (concluído ou em atendimento).
  const atendidos = todosAtendimentos.filter((a) => isStatusFabril(a.status))

  const porDia = new Map<string, { pacientes: Set<string>; total: number }>()
  const porSemana = new Map<string, { pacientes: Set<string>; total: number }>()
  const porMes = new Map<string, { pacientes: Set<string>; total: number }>()
  const pacientesDistintos = new Set<string>()

  for (const a of atendidos) {
    pacientesDistintos.add(a.paciente_id)

    const diaKey = formatAppDateKey(a.data_agendamento)
    if (!porDia.has(diaKey)) porDia.set(diaKey, { pacientes: new Set(), total: 0 })
    const dia = porDia.get(diaKey)!
    dia.pacientes.add(a.paciente_id)
    dia.total++

    const semanaKey = getSemanaKey(a.data_agendamento)
    if (!porSemana.has(semanaKey)) porSemana.set(semanaKey, { pacientes: new Set(), total: 0 })
    const semana = porSemana.get(semanaKey)!
    semana.pacientes.add(a.paciente_id)
    semana.total++

    const mesKey = getMesKey(a.data_agendamento)
    if (!porMes.has(mesKey)) porMes.set(mesKey, { pacientes: new Set(), total: 0 })
    const mes = porMes.get(mesKey)!
    mes.pacientes.add(a.paciente_id)
    mes.total++
  }

  const dias = Array.from(porDia.entries()).sort(([a], [b]) => b.localeCompare(a))
  const semanas = Array.from(porSemana.entries()).sort(([a], [b]) => b.localeCompare(a))
  const meses = Array.from(porMes.entries()).sort(([a], [b]) => b.localeCompare(a))

  const isFiltered = tipo !== '12meses'
  const diasExibidos = isFiltered ? dias : dias.slice(0, 30)

  const periodoLabel = (() => {
    if (tipo === 'mes' && mesParam) return `Mês: ${formatarMes(mesParam)}`
    if (tipo === 'semana' && semanaParam) return `Semana: ${formatarSemana(getMondayKey(semanaParam))}`
    if (tipo === 'personalizado') {
      const de = inicioParam ? formatarDia(inicioParam) : '—'
      const ate = fimParam ? formatarDia(fimParam) : '—'
      return `Período: ${de} a ${ate}`
    }
    return 'Últimos 12 meses'
  })()

  const profissionalLabel = (() => {
    if (!isGestorOuMaster) return null
    const opcoes = categoria === 'medicos'
      ? medicosOpcoes
      : categoria === 'fisioterapia'
        ? fisioterapeutas
        : [...fisioterapeutas, ...medicosOpcoes]
    const selecionado = opcoes.find((p) => p.id === profissionalIdParam)
    const categoriaLabel = categoria === 'medicos' ? 'Médicos' : categoria === 'fisioterapia' ? 'Fisioterapeutas' : 'Todos'
    return selecionado ? selecionado.nome : `Todos (${categoriaLabel})`
  })()

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-text-secondary mb-2 flex items-center gap-2">
          <Link href="/dashboard" className="hover:text-primary-500 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/pacientes" className="hover:text-primary-500 transition-colors">Pacientes</Link>
          <span>/</span>
          <span className="text-text-primary font-medium">Relatório de Atendidos</span>
        </div>
        <h1 className="text-2xl font-semibold text-text-primary flex items-center gap-2">
          <Stethoscope size={28} className="text-primary-500" />
          Relatório de Pacientes Atendidos
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          {periodoLabel}
          {profissionalLabel && ` · ${profissionalLabel}`} · pacientes que passaram por sessão (concluído ou em atendimento), agrupados por dia, semana e mês.
        </p>
      </div>

      <FiltrosCadastros
        tipo={tipo}
        mes={mesParam}
        semana={semanaParam}
        inicio={inicioParam}
        fim={fimParam}
        action="/pacientes/relatorio-atendidos"
        limparHref="/pacientes/relatorio-atendidos"
        tipoLabels={{ semana: 'Semana específica (padrão: esta semana)' }}
        {...(isGestorOuMaster
          ? {
              categoriaAtual: categoria,
              profissionalIdAtual: profissionalIdParam,
              fisioterapeutas,
              medicos: medicosOpcoes,
            }
          : {})}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Users size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">Pacientes ativos no período</span>
          </div>
          <p className="text-3xl font-bold text-[#006b5a]">{pacientesAtivos}</p>
          <p className="text-xs text-slate-400 mt-1">qualquer status (agendado, cancelado, atendido...)</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Stethoscope size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">Pacientes atendidos (distintos)</span>
          </div>
          <p className="text-3xl font-bold text-[#006b5a]">{pacientesDistintos.size}</p>
          <p className="text-xs text-slate-400 mt-1">cada pessoa conta 1 vez, mesmo com +1 sessão no período</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <ClipboardList size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">Total de atendimentos</span>
          </div>
          <p className="text-3xl font-bold text-[#006b5a]">{atendidos.length}</p>
          <p className="text-xs text-slate-400 mt-1">soma de todas as sessões, incluindo retornos</p>
        </div>
      </div>

      {meses.length > 1 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Por Mês</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="text-left px-4 py-3">Mês</th>
                  <th className="text-right px-4 py-3">Pacientes distintos</th>
                  <th className="text-right px-4 py-3">Atendimentos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {meses.map(([key, dados]) => (
                  <tr key={key}>
                    <td className="px-4 py-3 font-medium text-slate-900">{formatarMes(key)}</td>
                    <td className="px-4 py-3 text-right">{dados.pacientes.size}</td>
                    <td className="px-4 py-3 text-right">{dados.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {semanas.length > 1 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Por Semana</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="text-left px-4 py-3">Semana</th>
                  <th className="text-right px-4 py-3">Pacientes distintos</th>
                  <th className="text-right px-4 py-3">Atendimentos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {semanas.map(([key, dados]) => (
                  <tr key={key}>
                    <td className="px-4 py-3 font-medium text-slate-900">{formatarSemana(key)}</td>
                    <td className="px-4 py-3 text-right">{dados.pacientes.size}</td>
                    <td className="px-4 py-3 text-right">{dados.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">
            Por Dia{' '}
            {!isFiltered && <span className="text-xs font-normal text-slate-400">(últimos 30 dias)</span>}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr>
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-right px-4 py-3">Pacientes distintos</th>
                <th className="text-right px-4 py-3">Atendimentos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {diasExibidos.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                    Nenhum atendimento no período.
                  </td>
                </tr>
              )}
              {diasExibidos.map(([key, dados]) => (
                <tr key={key}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {formatarDia(key)} <span className="text-slate-400 font-normal">· {formatarDiaSemana(key)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">{dados.pacientes.size}</td>
                  <td className="px-4 py-3 text-right">{dados.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
