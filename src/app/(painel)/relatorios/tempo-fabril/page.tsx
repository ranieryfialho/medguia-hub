import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { formatAppDateKey } from '@/lib/datetime'
import { ptBR } from 'date-fns/locale'
import { BtnImprimirRelatorio } from '@/components/features/shared'
import { FiltrosRelatorio } from '@/components/features/relatorios'
import { ConteudoRelatorio } from '@/components/features/relatorios'
import {
  calcularKPIs,
  formatarMinutos,
  resolverPeriodo,
  type Atendimento,
  type Jornada,
  type JornadaPlanejada,
  type Reuniao,
  type HistoricoStatus,
  type KPIsProfissional,
} from '@/lib/relatorios/kpis-tempo-fabril'
import { listarStatusOpcoes } from '@/actions/status-disponibilidade-config'
import { podeEntrarNaAgendaOuRelatorio } from '@/lib/profissionais'
import { requireModulo } from '@/lib/guard'
import { isGestorSistema } from '@/lib/permissoes'

// Componente de cards resumo
function CardsResumoFabril({
  kpisGeral,
}: {
  kpisGeral: KPIsProfissional[]
}) {
  const totalJornada = kpisGeral.reduce((acc, k) => acc + k.jornadaContratadaMin, 0)
  const totalFabril = kpisGeral.reduce((acc, k) => acc + k.tempoFabrilMin, 0)
  const totalQtd = kpisGeral.reduce((acc, k) => acc + k.qtdAtendimentos, 0)
  const taxaGeral = totalJornada > 0 ? Math.round((totalFabril / totalJornada) * 100) : 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <p className="text-xs font-semibold text-slate-500 mb-1">Jornada Contratada</p>
        <p className="text-2xl font-bold text-[#006b5a]">{formatarMinutos(totalJornada)}</p>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <p className="text-xs font-semibold text-slate-500 mb-1">Tempo Fábril</p>
        <p className="text-2xl font-bold text-[#006b5a]">{formatarMinutos(totalFabril)}</p>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <p className="text-xs font-semibold text-slate-500 mb-1">Taxa Geral</p>
        <p className="text-2xl font-bold text-[#006b5a]">{taxaGeral}%</p>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <p className="text-xs font-semibold text-slate-500 mb-1">Atendimentos</p>
        <p className="text-2xl font-bold text-[#006b5a]">{totalQtd}</p>
      </div>
    </div>
  )
}


// Main Page Component
export default async function TempoFabrilPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { user, profile } = await requireModulo('equipe:tempo_fabril')

  const supabase = await createClient()
  const params = await searchParams

  const isGestorOuMaster = isGestorSistema(profile?.nivel_acesso)
  const { dataInicio, dataFim } = resolverPeriodo(params)

  // Buscar profissionais elegíveis
  const dataInicioStr = formatAppDateKey(dataInicio)
  const dataFimStr = formatAppDateKey(dataFim)
  const utcInicio = new Date(`${dataInicioStr}T00:00:00-03:00`).toISOString()
  const utcFim = new Date(`${dataFimStr}T23:59:59.999-03:00`).toISOString()

  const [{ data: listaProfissionais }, { data: jornadasAtivas }, { data: jornadasMensaisAtivas }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['fisioterapeuta', 'gestor'])
      .eq('ativo', true)
      .order('full_name'),
    supabase
      .from('disponibilidade_profissional')
      .select('profissional_id')
      .eq('ativo', true),
    supabase
      .from('jornada_mensal_profissional')
      .select('profissional_id, data, jornada_inicio, jornada_fim, intervalo_inicio, intervalo_fim, ativo')
      .gte('data', dataInicioStr)
      .lte('data', dataFimStr),
  ])

  const profissionaisComJornada = new Set([
    ...(jornadasAtivas ?? []).map((j) => j.profissional_id),
    ...(jornadasMensaisAtivas ?? []).map((j) => j.profissional_id),
  ])
  const profissionais = (listaProfissionais ?? [])
    .filter((p) => podeEntrarNaAgendaOuRelatorio(p, profissionaisComJornada))
    .map(p => ({
    id: p.id,
    nome: p.full_name || 'Sem nome',
  }))

  // Determinar profissionais a serem consultados
  const profFiltroParam = typeof params.profissional === 'string' ? params.profissional : 'todos'
  const profFiltro = isGestorOuMaster
    ? (profFiltroParam === 'todos' || profissionais.some((p) => p.id === profFiltroParam) ? profFiltroParam : 'todos')
    : user.id

  const profIds = profFiltro === 'todos'
    ? profissionais.map(p => p.id)
    : [profFiltro]

  // Queries paralelas
  const [{ data: atendimentosResp }, { data: atendimentosExec }, { data: jornadas }, { data: jornadasPlanejadas }, { data: reunioes }, { data: historicoResp }, statusOpcoes] = await Promise.all([
    supabase
      .from('atendimentos')
      .select('id, profissional_id, fisioterapeuta_id, data_agendamento, duracao_minutos, status, tipo, numero_sessao, paciente_id')
      .in('profissional_id', profIds)
      .gte('data_agendamento', utcInicio)
      .lte('data_agendamento', utcFim),
    supabase
      .from('atendimentos')
      .select('id, profissional_id, fisioterapeuta_id, data_agendamento, duracao_minutos, status, tipo, numero_sessao, paciente_id')
      .in('fisioterapeuta_id', profIds)
      .gte('data_agendamento', utcInicio)
      .lte('data_agendamento', utcFim),
    supabase
      .from('disponibilidade_profissional')
      .select('profissional_id, dia_semana, jornada_inicio, jornada_fim, intervalo_inicio, intervalo_fim')
      .in('profissional_id', profIds)
      .eq('ativo', true),
    supabase
      .from('jornada_mensal_profissional')
      .select('profissional_id, data, jornada_inicio, jornada_fim, intervalo_inicio, intervalo_fim, ativo')
      .in('profissional_id', profIds)
      .gte('data', dataInicioStr)
      .lte('data', dataFimStr),
    supabase
      .from('historico_reunioes')
      .select('profissional_id, inicio, fim, duracao_minutos')
      .in('profissional_id', profIds)
      .gte('inicio', utcInicio)
      .lte('inicio', utcFim)
      .not('fim', 'is', null),
    supabase
      .from('historico_status_disponibilidade')
      .select('profissional_id, status, inicio, fim, duracao_minutos')
      .in('profissional_id', profIds)
      .gte('inicio', utcInicio)
      .lte('inicio', utcFim)
      .not('fim', 'is', null),
    listarStatusOpcoes(),
  ])

  // Unir responsáveis + executores sem duplicar (mesmo atendimento pode aparecer nos dois)
  const atendimentosMap = new Map<string, Atendimento>()
  for (const a of [...(atendimentosResp ?? []), ...(atendimentosExec ?? [])]) {
    if (!atendimentosMap.has(a.id)) atendimentosMap.set(a.id, a as Atendimento)
  }
  const atendimentos = Array.from(atendimentosMap.values())

  // Calcular KPIs
  const kpisEquipe = calcularKPIs(
    profissionais,
    atendimentos,
    (jornadas ?? []) as Jornada[],
    (jornadasPlanejadas ?? []) as JornadaPlanejada[],
    dataInicio,
    dataFim,
    (reunioes ?? []) as Reuniao[],
    (historicoResp ?? []) as HistoricoStatus[],
  )

  const profissionaisFiltrados = profFiltro === 'todos'
    ? profissionais
    : profissionais.filter(p => p.id === profFiltro)

  const kpis = profFiltro === 'todos'
    ? kpisEquipe
    : kpisEquipe.filter((kpi) => profissionaisFiltrados.some((prof) => prof.id === kpi.profissionalId))

  const semanaLabel = `${format(dataInicio, "d 'de' MMMM", { locale: ptBR })} – ${format(dataFim, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}`

  return (
    <div id="relatorio-fabril" className="space-y-6 px-4 sm:px-6 pb-8">
      <div className="bg-white rounded-2xl border border-[#bcc9c4]/30 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#006b5a]">Tempo Fábril</h2>
            <p className="text-sm text-[#3d4945] mt-0.5">{semanaLabel}</p>
          </div>
          <BtnImprimirRelatorio
            periodoLabel={semanaLabel}
            kpisEquipe={kpisEquipe}
            profFiltro={profFiltro}
          />
        </div>
      </div>

      {/* Filtros */}
      <FiltrosRelatorio
        profissionais={profissionais}
        isGestor={isGestorOuMaster}
        paramsAtuais={params}
      />

      {/* Cards resumo */}
      <CardsResumoFabril kpisGeral={kpis} />

      {/* Conteúdo com abas (Geral/Individual) */}
      <ConteudoRelatorio
        kpis={kpis}
        kpisEquipe={kpisEquipe}
        profFiltro={profFiltro}
        statusOpcoes={statusOpcoes}
      />
    </div>
  )
}
