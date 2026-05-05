import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { requireModulo } from '@/lib/guard'
import {
  BarChart3,
  CalendarCheck2,
  ClipboardList,
  RefreshCw,
  Stethoscope,
  TrendingUp,
  Undo2,
} from 'lucide-react'
import { BtnGerarPdfConsultas } from '@/components/features/BtnGerarPdfConsultas'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

type AgendamentoResumo = {
  id: string
  profissional_id: string | null
  tipo: string | null
  data_inicio: string | null
  is_recorrente: boolean | null
  gerou_venda: boolean | null
  marcou_retorno: boolean | null
}

type AtendimentoResumo = {
  id: string
  agendamento_id: string | null
  profissional_id: string | null
  tipo: string | null
  status: string | null
  data_agendamento: string
}

type MetricaTipo = {
  tipo: string
  agendamentos: number
  atendimentos: number
  concluidos: number
  pendentes: number
}

type LinhaProfissional = {
  profissionalId: string
  profissionalNome: string
  agendamentos: number
  recorrentes: number
  atendimentos: number
  concluidos: number
  pendentes: number
  canceladosOuFalta: number
}

const STATUS_PENDENTES = new Set(['aguardando', 'confirmado', 'em atendimento', 'reposicao', 'reposição'])
const STATUS_CANCELADOS = new Set(['cancelado', 'falta', 'reagendado'])

function lowerSafe(value: string | null | undefined) {
  return (value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

function normalizarTipo(tipo: string | null | undefined) {
  const texto = (tipo ?? '').trim()
  return texto || 'Sem tipo'
}

function formatarStatus(status: string) {
  switch (status) {
    case 'Aguardando':
      return 'Aguardando'
    case 'Confirmado':
      return 'Confirmado'
    case 'Em Atendimento':
      return 'Em Atendimento'
    case 'Concluído':
      return 'Concluído'
    case 'Cancelado':
      return 'Cancelado'
    case 'Falta':
      return 'Falta'
    case 'Reagendado':
      return 'Reagendado'
    case 'Reposição':
      return 'Reposição'
    default:
      return status
  }
}

export default async function RelatorioConsultasPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  await requireModulo('pacientes')

  const supabase = await createClient()
  const params = await searchParams

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('nivel_acesso')
    .eq('id', user.id)
    .single()

  const isGestorOuMaster = profile?.nivel_acesso === 'gestor' || profile?.nivel_acesso === 'master'

  const hoje = new Date()
  const dataInicioPadrao = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10)
  const dataFimPadrao = hoje.toISOString().slice(0, 10)

  const data_inicio = (params.data_inicio as string) || dataInicioPadrao
  const data_fim = (params.data_fim as string) || dataFimPadrao
  const profissional_id = (params.profissional_id as string) || ''
  const tipo_filtro = (params.tipo as string) || ''
  const status_filtro = (params.status as string) || ''

  const profissionalFiltroEfetivo = isGestorOuMaster ? profissional_id : user.id
  const dataInicioIso = `${data_inicio}T00:00:00`
  const dataFimIso = `${data_fim}T23:59:59`

  const { data: profissionaisRaw } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('role', ['fisioterapeuta', 'gestor'])
    .eq('ativo', true)
    .order('full_name')

  const profissionais = (profissionaisRaw ?? []).map((item: { id: string; full_name: string | null }) => ({
    id: item.id,
    nome: item.full_name || 'Sem nome',
  }))
  const profissionaisMap = new Map(profissionais.map((item) => [item.id, item.nome]))

  let agendamentosQuery = supabase
    .from('agendamentos')
    .select('id, profissional_id, tipo, data_inicio, is_recorrente, gerou_venda, marcou_retorno')
    .gte('data_inicio', data_inicio)
    .lte('data_inicio', data_fim)

  if (profissionalFiltroEfetivo) {
    agendamentosQuery = agendamentosQuery.eq('profissional_id', profissionalFiltroEfetivo)
  }
  if (tipo_filtro) {
    agendamentosQuery = agendamentosQuery.eq('tipo', tipo_filtro)
  }

  let atendimentosQuery = supabase
    .from('atendimentos')
    .select('id, agendamento_id, profissional_id, tipo, status, data_agendamento')
    .gte('data_agendamento', dataInicioIso)
    .lte('data_agendamento', dataFimIso)

  if (profissionalFiltroEfetivo) {
    atendimentosQuery = atendimentosQuery.eq('profissional_id', profissionalFiltroEfetivo)
  }
  if (tipo_filtro) {
    atendimentosQuery = atendimentosQuery.eq('tipo', tipo_filtro)
  }
  if (status_filtro) {
    atendimentosQuery = atendimentosQuery.eq('status', status_filtro)
  }

  const [{ data: agendamentosRaw }, { data: atendimentosRaw }] = await Promise.all([
    agendamentosQuery.order('data_inicio', { ascending: false }),
    atendimentosQuery.order('data_agendamento', { ascending: false }),
  ])

  const agendamentos = (agendamentosRaw ?? []) as AgendamentoResumo[]
  const atendimentos = (atendimentosRaw ?? []) as AtendimentoResumo[]

  const tiposMap = new Map<string, MetricaTipo>()
  const linhasProfissional = new Map<string, LinhaProfissional>()
  const statusMap: Record<string, number> = {}

  function garantirLinhaProfissional(profissionalId: string | null) {
    const id = profissionalId ?? 'sem_profissional'
    if (!linhasProfissional.has(id)) {
      linhasProfissional.set(id, {
        profissionalId: id,
        profissionalNome: profissionaisMap.get(id) ?? 'Sem responsável',
        agendamentos: 0,
        recorrentes: 0,
        atendimentos: 0,
        concluidos: 0,
        pendentes: 0,
        canceladosOuFalta: 0,
      })
    }
    return linhasProfissional.get(id)!
  }

  function garantirTipo(tipoBruto: string | null | undefined) {
    const tipo = normalizarTipo(tipoBruto)
    if (!tiposMap.has(tipo)) {
      tiposMap.set(tipo, {
        tipo,
        agendamentos: 0,
        atendimentos: 0,
        concluidos: 0,
        pendentes: 0,
      })
    }
    return tiposMap.get(tipo)!
  }

  for (const agendamento of agendamentos) {
    const tipo = garantirTipo(agendamento.tipo)
    tipo.agendamentos++

    const linhaProf = garantirLinhaProfissional(agendamento.profissional_id)
    linhaProf.agendamentos++
    if (agendamento.is_recorrente) linhaProf.recorrentes++
  }

  for (const atendimento of atendimentos) {
    const tipo = garantirTipo(atendimento.tipo)
    tipo.atendimentos++

    const statusNormalizado = lowerSafe(atendimento.status)
    const statusLabel = formatarStatus(atendimento.status || 'Sem status')
    statusMap[statusLabel] = (statusMap[statusLabel] || 0) + 1

    const linhaProf = garantirLinhaProfissional(atendimento.profissional_id)
    linhaProf.atendimentos++

    if (statusNormalizado === 'concluido' || statusNormalizado === 'concluído') {
      tipo.concluidos++
      linhaProf.concluidos++
    } else if (STATUS_CANCELADOS.has(statusNormalizado)) {
      linhaProf.canceladosOuFalta++
    } else if (STATUS_PENDENTES.has(statusNormalizado)) {
      tipo.pendentes++
      linhaProf.pendentes++
    }
  }

  const linhasTipo = Array.from(tiposMap.values())
    .sort((a, b) => b.atendimentos - a.atendimentos || b.agendamentos - a.agendamentos)

  const linhasProfissionalOrdenadas = Array.from(linhasProfissional.values())
    .sort((a, b) => b.atendimentos - a.atendimentos || b.agendamentos - a.agendamentos)

  const totalAgendamentos = agendamentos.length
  const totalAtendimentos = atendimentos.length
  const totalRecorrentes = agendamentos.filter((item) => item.is_recorrente).length
  const totalConcluidos = atendimentos.filter((item) => {
    const status = lowerSafe(item.status)
    return status === 'concluido' || status === 'concluído'
  }).length
  const totalPendentes = atendimentos.filter((item) => STATUS_PENDENTES.has(lowerSafe(item.status))).length
  const totalCanceladosOuFalta = atendimentos.filter((item) => STATUS_CANCELADOS.has(lowerSafe(item.status))).length
  const opcoesTipos = Array.from(new Set([
    ...agendamentos.map((item) => normalizarTipo(item.tipo)),
    ...atendimentos.map((item) => normalizarTipo(item.tipo)),
  ])).sort((a, b) => a.localeCompare(b))

  const opcoesStatus = Array.from(new Set(atendimentos.map((item) => formatarStatus(item.status || 'Sem status'))))
    .sort((a, b) => a.localeCompare(b))
  const periodoLabel = data_inicio === data_fim
    ? data_inicio
    : `${data_inicio} até ${data_fim}`

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-text-secondary mb-2 flex items-center gap-2">
          <Link href="/dashboard" className="hover:text-primary-500 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/pacientes" className="hover:text-primary-500 transition-colors">Pacientes</Link>
          <span>/</span>
          <span className="text-text-primary font-medium">Relatório de Consultas</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary flex items-center gap-2">
              <BarChart3 size={28} className="text-primary-500" />
              Relatório de Agendamentos e Atendimentos
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Baseado apenas nas tabelas `agendamentos` e `atendimentos`, com foco em volume, status, recorrência e responsáveis.
            </p>
          </div>
          {(totalAgendamentos > 0 || totalAtendimentos > 0) && (
            <BtnGerarPdfConsultas
              periodoLabel={periodoLabel}
              totalAgendamentos={totalAgendamentos}
              totalAtendimentos={totalAtendimentos}
              totalConcluidos={totalConcluidos}
              totalRecorrentes={totalRecorrentes}
              totalPendentes={totalPendentes}
              totalCanceladosOuFalta={totalCanceladosOuFalta}
              porTipo={linhasTipo.map((linha) => ({
                tipo: linha.tipo,
                agendamentos: linha.agendamentos,
                atendimentos: linha.atendimentos,
                concluidos: linha.concluidos,
                pendentes: linha.pendentes,
              }))}
              porProfissional={linhasProfissionalOrdenadas.map((linha) => ({
                profissionalNome: linha.profissionalNome,
                agendamentos: linha.agendamentos,
                recorrentes: linha.recorrentes,
                atendimentos: linha.atendimentos,
                concluidos: linha.concluidos,
                pendentes: linha.pendentes,
                canceladosOuFalta: linha.canceladosOuFalta,
              }))}
              porStatus={statusMap}
            />
          )}
        </div>
      </div>

      <form method="get" className="bg-surface rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold text-text-primary mb-3">Filtros</h2>
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="block text-xs text-text-secondary uppercase mb-1">Data Início</label>
            <input
              type="date"
              name="data_inicio"
              defaultValue={data_inicio}
              className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary uppercase mb-1">Data Fim</label>
            <input
              type="date"
              name="data_fim"
              defaultValue={data_fim}
              className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
            />
          </div>
          {isGestorOuMaster && (
            <div>
              <label className="block text-xs text-text-secondary uppercase mb-1">Fisioterapeuta</label>
              <select
                name="profissional_id"
                defaultValue={profissional_id}
                className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
              >
                <option value="">Todos</option>
                {profissionais.map((profissional) => (
                  <option key={profissional.id} value={profissional.id}>{profissional.nome}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs text-text-secondary uppercase mb-1">Tipo</label>
            <select
              name="tipo"
              defaultValue={tipo_filtro}
              className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
            >
              <option value="">Todos</option>
              {opcoesTipos.map((tipo) => (
                <option key={tipo} value={tipo}>{tipo}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-secondary uppercase mb-1">Status do Atendimento</label>
            <select
              name="status"
              defaultValue={status_filtro}
              className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
            >
              <option value="">Todos</option>
              {opcoesStatus.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-md text-sm font-medium transition-colors"
          >
            Filtrar
          </button>
          {(data_inicio !== dataInicioPadrao || data_fim !== dataFimPadrao || profissional_id || tipo_filtro || status_filtro) && (
            <Link
              href="/pacientes/relatorio-consultas"
              className="px-4 py-2 bg-page hover:bg-page/80 border border-border text-text-secondary rounded-md text-sm transition-colors"
            >
              Limpar
            </Link>
          )}
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <ClipboardList size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">Agendamentos</span>
          </div>
          <p className="text-3xl font-bold text-[#006b5a]">{totalAgendamentos}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Stethoscope size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">Atendimentos</span>
          </div>
          <p className="text-3xl font-bold text-[#006b5a]">{totalAtendimentos}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <CalendarCheck2 size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">Concluídos</span>
          </div>
          <p className="text-3xl font-bold text-[#006b5a]">{totalConcluidos}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <RefreshCw size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">Recorrentes</span>
          </div>
          <p className="text-3xl font-bold text-[#006b5a]">{totalRecorrentes}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <TrendingUp size={15} />
            <span className="text-xs font-semibold uppercase tracking-wide">Pendentes</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{totalPendentes}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Undo2 size={15} />
            <span className="text-xs font-semibold uppercase tracking-wide">Cancelado/Falta</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{totalCanceladosOuFalta}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Tipos de Consulta</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-right px-4 py-3">Agendamentos</th>
                <th className="text-right px-4 py-3">Atendimentos</th>
                <th className="text-right px-4 py-3">Concluídos</th>
                <th className="text-right px-4 py-3">Pendentes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {linhasTipo.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Nenhum dado encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
              {linhasTipo.map((linha) => (
                <tr key={linha.tipo}>
                  <td className="px-4 py-3 font-medium text-slate-900">{linha.tipo}</td>
                  <td className="px-4 py-3 text-right">{linha.agendamentos}</td>
                  <td className="px-4 py-3 text-right">{linha.atendimentos}</td>
                  <td className="px-4 py-3 text-right">{linha.concluidos}</td>
                  <td className="px-4 py-3 text-right">{linha.pendentes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Por Fisioterapeuta</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="text-left px-4 py-3">Fisioterapeuta</th>
                  <th className="text-right px-4 py-3">Agend.</th>
                  <th className="text-right px-4 py-3">Recorr.</th>
                  <th className="text-right px-4 py-3">Atend.</th>
                  <th className="text-right px-4 py-3">Concl.</th>
                  <th className="text-right px-4 py-3">Pend.</th>
                  <th className="text-right px-4 py-3">Canc./Falta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linhasProfissionalOrdenadas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      Nenhum fisioterapeuta com dados no período.
                    </td>
                  </tr>
                )}
                {linhasProfissionalOrdenadas.map((linha) => (
                  <tr key={linha.profissionalId}>
                    <td className="px-4 py-3 font-medium text-slate-900">{linha.profissionalNome}</td>
                    <td className="px-4 py-3 text-right">{linha.agendamentos}</td>
                    <td className="px-4 py-3 text-right">{linha.recorrentes}</td>
                    <td className="px-4 py-3 text-right">{linha.atendimentos}</td>
                    <td className="px-4 py-3 text-right">{linha.concluidos}</td>
                    <td className="px-4 py-3 text-right">{linha.pendentes}</td>
                    <td className="px-4 py-3 text-right">{linha.canceladosOuFalta}</td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Distribuição de Status dos Atendimentos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Quantidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.keys(statusMap).length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-slate-500">
                    Nenhum atendimento encontrado no período.
                  </td>
                </tr>
              )}
              {Object.entries(statusMap)
                .sort((a, b) => b[1] - a[1])
                .map(([status, quantidade]) => (
                  <tr key={status}>
                    <td className="px-4 py-3 font-medium text-slate-900">{status}</td>
                    <td className="px-4 py-3 text-right">{quantidade}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
