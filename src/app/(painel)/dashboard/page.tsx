import { createClient } from '@/lib/supabase/server'
import { format, startOfMonth, startOfDay, startOfWeek, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  calcularKPIs,
  type JornadaPlanejada,
  type Reuniao,
  type HistoricoStatus,
  type HistoricoStatusAberto,
} from '@/lib/relatorios/kpis-tempo-fabril'
import { formatAppDateKey, getAppDayRangeUTC } from '@/lib/datetime'
import { requireModulo } from '@/lib/guard'
import { isGestorSistema } from '@/lib/permissoes'
import {
  getAtendimentoStatusKey,
  isStatusConcluido,
  isStatusFabril,
  STATUS_PENDENTE_KEYS,
} from '@/lib/atendimento-status'
import { criarContagemStatusContato, LABEL_POR_STATUS_CONTATO } from '@/lib/contatos-kanban'
import VisaoGeralKPIs, { type PeriodoDashboardData } from './VisaoGeralKPIs'

const COR_STATUS_CONTATO: Record<string, string> = {
  a_contactar: 'bg-gray-100 text-gray-700',
  recuperacao_base: 'bg-indigo-100 text-indigo-700',
  tentativa: 'bg-amber-100 text-amber-700',
  em_conversa: 'bg-teal-100 text-teal-700',
  sem_interesse: 'bg-red-100 text-red-700',
  agendou: 'bg-green-100 text-green-700',
}

type Atendimento = {
  id: string
  profissional_id: string
  data_agendamento: string
  duracao_minutos: number | null
  status: string
  tipo: string
  numero_sessao: number | null
  paciente_id: string
}

type Jornada = {
  profissional_id: string
  dia_semana: number
  jornada_inicio: string
  jornada_fim: string
  intervalo_inicio: string | null
  intervalo_fim: string | null
}

type Profissional = {
  id: string
  full_name: string | null
  role: string | null
}

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const { user, profile } = await requireModulo('dashboard')

  const params = await searchParams
  const supabase = await createClient()
  const hoje = new Date()
  const inicioDia = startOfDay(hoje)
  const inicioSemana = startOfWeek(hoje, { weekStartsOn: 0 })
  const inicioMes = startOfMonth(hoje)

  const hojeKey = formatAppDateKey(hoje)
  const inicioSemanaKey = formatAppDateKey(inicioSemana)
  const inicioMesKey = formatAppDateKey(inicioMes)

  // Período personalizado (?periodo=personalizado&de=...&ate=...), vindo do filtro de range de datas
  const periodoParam = typeof params.periodo === 'string' ? params.periodo : 'mes'
  const isPersonalizado = periodoParam === 'personalizado'
  const deCustomKeyRaw = typeof params.de === 'string' ? params.de : hojeKey
  const ateCustomKeyRaw = typeof params.ate === 'string' ? params.ate : hojeKey
  const deCustomKey = deCustomKeyRaw <= ateCustomKeyRaw ? deCustomKeyRaw : ateCustomKeyRaw
  const ateCustomKey = deCustomKeyRaw <= ateCustomKeyRaw ? ateCustomKeyRaw : deCustomKeyRaw
  const inicioCustom = new Date(`${deCustomKey}T00:00:00`)
  const fimCustom = new Date(`${ateCustomKey}T23:59:59.999`)

  // Range de busca amplo: cobre dia/semana/mês e, se houver, o período personalizado
  const candidatosInicio = [inicioSemana, inicioMes, ...(isPersonalizado ? [inicioCustom] : [])]
  const inicioRange = candidatosInicio.reduce((min, d) => (d < min ? d : min))
  const inicioRangeKey = formatAppDateKey(inicioRange)
  const fimRangeKey = isPersonalizado && ateCustomKey > hojeKey ? ateCustomKey : hojeKey

  const isGestorOuMaster = isGestorSistema(profile?.nivel_acesso)

  // 2. Determinar lista de profissionais
  let profissionais: Profissional[] = []
  let profIds: string[] = []
  let profissionaisParaKPI: Array<{ id: string; nome: string }> = []

  if (isGestorOuMaster) {
    // Gestor/Master vê toda a equipe
    const { data: allProfs } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['fisioterapeuta', 'gestor'])
      .eq('ativo', true)
      .order('full_name')
    profissionais = allProfs || []
    profIds = profissionais.map(p => p.id)
    profissionaisParaKPI = profissionais.map(p => ({ id: p.id, nome: p.full_name || 'Sem nome' }))
  } else {
    // Fisioterapeuta vê apenas a si mesmo
    profissionais = [{ id: user.id, full_name: profile?.full_name || 'Você', role: 'fisioterapeuta' }]
    profIds = [user.id]
    profissionaisParaKPI = [{ id: user.id, nome: profile?.full_name || 'Você' }]
  }

  // 3. Buscar dados em paralelo (range amplo cobrindo dia/semana/mês/personalizado numa única busca)
  const inicioRange_UTC = getAppDayRangeUTC(inicioRangeKey).start
  const fimRange_UTC = getAppDayRangeUTC(fimRangeKey).end

  const [
    atendimentosRes,
    jornadasRes,
    jornadasMensaisRes,
    pacientesNovosRes,
    contatosBaseRes,
    reunioesRes,
    historicoRes,
    historicoAbertoRes,
  ] = await Promise.all([
    supabase
      .from('atendimentos')
      .select('id, profissional_id, data_agendamento, duracao_minutos, status, tipo, numero_sessao, paciente_id')
      .in('profissional_id', profIds)
      .gte('data_agendamento', inicioRange_UTC)
      .lte('data_agendamento', fimRange_UTC)
      .order('data_agendamento', { ascending: true }),
    supabase
      .from('disponibilidade_profissional')
      .select('profissional_id, dia_semana, jornada_inicio, jornada_fim, intervalo_inicio, intervalo_fim')
      .in('profissional_id', profIds)
      .eq('ativo', true),
    supabase
      .from('jornada_mensal_profissional')
      .select('profissional_id, data, jornada_inicio, jornada_fim, intervalo_inicio, intervalo_fim, ativo')
      .in('profissional_id', profIds)
      .gte('data', inicioRangeKey)
      .lte('data', fimRangeKey),
    supabase
      .from('pacientes')
      .select('id, created_at')
      .gte('created_at', inicioRange_UTC)
      .lte('created_at', fimRange_UTC),
    isGestorOuMaster
      ? supabase
          .from('contatos_base')
          .select('status, responsavel_id, criado_em')
          .gte('criado_em', inicioRange_UTC)
          .lte('criado_em', fimRange_UTC)
      : Promise.resolve({ data: [] as { status: string; responsavel_id: string | null; criado_em: string }[] }),
    // Reuniões legadas + histórico de status personalizados (hora administrativa, reunião, etc.)
    // — sem isso o Tempo Fábril/Taxa de Ocupação conta só atendimentos, igual /relatorios/tempo-fabril evita.
    supabase
      .from('historico_reunioes')
      .select('profissional_id, inicio, fim, duracao_minutos')
      .in('profissional_id', profIds)
      .gte('inicio', inicioRange_UTC)
      .lte('inicio', fimRange_UTC)
      .not('fim', 'is', null),
    supabase
      .from('historico_status_disponibilidade')
      .select('id, profissional_id, status, observacao, inicio, fim, duracao_minutos')
      .in('profissional_id', profIds)
      .gte('inicio', inicioRange_UTC)
      .lte('inicio', fimRange_UTC)
      .not('fim', 'is', null),
    supabase
      .from('historico_status_disponibilidade')
      .select('id, profissional_id, status, observacao, inicio')
      .in('profissional_id', profIds)
      .is('fim', null),
  ])

  const atendimentos: Atendimento[] = atendimentosRes.data || []
  const jornadas: Jornada[] = jornadasRes.data || []
  const jornadasMensais: JornadaPlanejada[] = jornadasMensaisRes.data || []
  const pacientesNovos = pacientesNovosRes.data || []
  const contatosBase = contatosBaseRes.data || []
  const reunioes: Reuniao[] = reunioesRes.data || []
  const historico: HistoricoStatus[] = historicoRes.data || []
  const historicoAberto: HistoricoStatusAberto[] = historicoAbertoRes.data || []

  // 4. Filtrar profissionais que têm jornada configurada
  const profIdsComJornada = new Set([
    ...jornadas.map(j => j.profissional_id),
    ...jornadasMensais.map(j => j.profissional_id),
  ])
  const profissionaisComJornada = profissionaisParaKPI.filter(p => profIdsComJornada.has(p.id))

  // 5. Visão Geral: recalcula TODOS os KPIs (cards, distribuição, tendência e ranking)
  // para hoje / semana / mês / personalizado — tudo reage ao mesmo filtro de período.
  function buildDiasDoPeriodo(inicioDate: Date, fimDate: Date): Date[] {
    const dias: Date[] = []
    let cursor = startOfDay(inicioDate)
    const fim = startOfDay(fimDate)
    while (cursor <= fim) {
      dias.push(cursor)
      cursor = addDays(cursor, 1)
    }
    return dias
  }

  function calcularPeriodoCompleto(
    inicioKey: string,
    fimKey: string,
    inicioDate: Date,
    fimDate: Date,
    agendaHref: string,
    ocupacaoHref: string
  ): PeriodoDashboardData {
    const atendPeriodo = atendimentos.filter(a => {
      const k = formatAppDateKey(a.data_agendamento)
      return k >= inicioKey && k <= fimKey
    })
    const pacientesAtivosPeriodo = new Set(atendPeriodo.map(a => a.paciente_id))

    // Pacientes Atendidos: subconjunto dos Ativos que de fato passaram pela sessão
    // (concluído ou em atendimento) — Ativos conta qualquer status, inclusive agendado.
    const atendidosPeriodo = atendPeriodo.filter(a => isStatusFabril(a.status))
    const pacientesAtendidosPeriodo = new Set(atendidosPeriodo.map(a => a.paciente_id))

    const pacientesCadastradosPeriodo = pacientesNovos.filter(p => {
      const k = formatAppDateKey(p.created_at)
      return k >= inicioKey && k <= fimKey
    }).length

    // Distribuição de status
    let concluidos = 0
    let cancelados = 0
    let faltas = 0
    let emAberto = 0
    for (const a of atendPeriodo) {
      const statusKey = getAtendimentoStatusKey(a.status)
      if (isStatusConcluido(a.status)) concluidos++
      if (statusKey === 'cancelado') cancelados++
      if (statusKey === 'falta') faltas++
      if (STATUS_PENDENTE_KEYS.includes(statusKey as (typeof STATUS_PENDENTE_KEYS)[number])) emAberto++
    }
    const taxaConclusaoPeriodo = atendPeriodo.length > 0
      ? Math.round((concluidos / atendPeriodo.length) * 100)
      : 0

    // Tendência: um ponto por dia dentro do período selecionado
    const diasPeriodo = buildDiasDoPeriodo(inicioDate, fimDate)
    const formatoLabel = diasPeriodo.length > 14 ? 'dd/MM' : 'EEE'
    const tendenciaMap = new Map<string, { label: string; labelCompleto: string; count: number; concluidos: number }>()
    for (const dia of diasPeriodo) {
      tendenciaMap.set(formatAppDateKey(dia), {
        label: format(dia, formatoLabel, { locale: ptBR }),
        labelCompleto: format(dia, 'EEEE, dd/MM', { locale: ptBR }),
        count: 0,
        concluidos: 0,
      })
    }
    for (const a of atendPeriodo) {
      const bucket = tendenciaMap.get(formatAppDateKey(a.data_agendamento))
      if (bucket) {
        bucket.count++
        if (isStatusConcluido(a.status)) bucket.concluidos++
      }
    }

    // Ocupação + ranking por profissional (inclui status personalizados: reunião, hora administrativa, etc.)
    // leve:true pula evolução semanal e detalhamentos que o dashboard não usa —
    // sem isso, calcularKPIs roda 3-4x (uma por período) fazendo trabalho descartado.
    const kpisPeriodo = calcularKPIs(
      profissionaisComJornada,
      atendPeriodo,
      jornadas,
      jornadasMensais,
      inicioDate,
      fimDate,
      reunioes,
      historico,
      historicoAberto,
      { leve: true },
    )
    const jornadaMin = kpisPeriodo.reduce((s, k) => s + k.jornadaContratadaMin, 0)
    const fabrilMin = kpisPeriodo.reduce((s, k) => s + k.tempoFabrilMin, 0)
    const taxaOcupacao = jornadaMin > 0 ? Math.round((fabrilMin / jornadaMin) * 100) : 0

    // Contatos da base atribuídos a cada profissional, criados dentro do período
    const contatosPeriodo = contatosBase.filter(c => {
      const k = formatAppDateKey(c.criado_em)
      return k >= inicioKey && k <= fimKey
    })
    const contatosPorResponsavel = new Map<string, number>()
    for (const c of contatosPeriodo) {
      if (!c.responsavel_id) continue
      contatosPorResponsavel.set(c.responsavel_id, (contatosPorResponsavel.get(c.responsavel_id) ?? 0) + 1)
    }

    // Funil de Contatos (apenas Gestor/Master)
    let funil: PeriodoDashboardData['funil'] = null
    if (isGestorOuMaster) {
      const contagem = criarContagemStatusContato()
      for (const c of contatosPeriodo) {
        if (c.status in contagem) contagem[c.status as keyof typeof contagem]++
      }
      const semResponsavel = contatosPeriodo.filter(c => !c.responsavel_id).length
      funil = {
        total: contatosPeriodo.length,
        semResponsavel,
        itens: Object.entries(contagem).map(([status, value]) => ({
          label: LABEL_POR_STATUS_CONTATO[status as keyof typeof contagem],
          value,
          cor: COR_STATUS_CONTATO[status] ?? 'bg-gray-100 text-gray-700',
        })),
      }
    }

    return {
      agendamentos: atendPeriodo.length,
      taxaConclusao: taxaConclusaoPeriodo,
      pacientesAtivos: pacientesAtivosPeriodo.size,
      pacientesAtendidos: pacientesAtendidosPeriodo.size,
      totalAtendidos: atendidosPeriodo.length,
      pacientesCadastrados: pacientesCadastradosPeriodo,
      taxaOcupacao,
      fabrilMin,
      jornadaMin,
      agendaHref,
      ocupacaoHref,
      pacientesAtivosHref: `/pacientes?ativos_de=${inicioKey}&ativos_ate=${fimKey}`,
      pacientesAtendidosHref: `/pacientes/relatorio-atendidos?tipo=personalizado&inicio=${inicioKey}&fim=${fimKey}`,
      distribuicao: { concluidos, cancelados, faltas, emAberto, total: atendPeriodo.length },
      tendencia: Array.from(tendenciaMap.values()),
      ranking: kpisPeriodo.map(k => ({
        profissionalId: k.profissionalId,
        nome: k.nome,
        taxaOcupacao: k.taxaOcupacao,
        qtdAtendimentos: k.qtdAtendimentos,
        qtdContatos: contatosPorResponsavel.get(k.profissionalId) ?? 0,
      })),
      funil,
    }
  }

  const dadosPorPeriodo: Partial<Record<'dia' | 'semana' | 'mes' | 'personalizado', PeriodoDashboardData>> = {
    dia: calcularPeriodoCompleto(
      hojeKey,
      hojeKey,
      inicioDia,
      hoje,
      `/agenda?view=dia&data=${hojeKey}`,
      `/relatorios/tempo-fabril?periodo=personalizado&de=${hojeKey}&ate=${hojeKey}`
    ),
    semana: calcularPeriodoCompleto(
      inicioSemanaKey,
      hojeKey,
      inicioSemana,
      hoje,
      `/agenda?view=semana&data=${hojeKey}`,
      '/relatorios/tempo-fabril?periodo=esta-semana'
    ),
    mes: calcularPeriodoCompleto(
      inicioMesKey,
      hojeKey,
      inicioMes,
      hoje,
      `/agenda?view=mes&data=${hojeKey}`,
      '/relatorios/tempo-fabril'
    ),
  }

  if (isPersonalizado) {
    dadosPorPeriodo.personalizado = calcularPeriodoCompleto(
      deCustomKey,
      ateCustomKey,
      inicioCustom,
      fimCustom,
      `/agenda?view=mes&data=${deCustomKey}`,
      `/relatorios/tempo-fabril?periodo=personalizado&de=${deCustomKey}&ate=${ateCustomKey}`
    )
  }

  // 6. Formatar período para display
  const mesAno = format(hoje, 'MMMM yyyy', { locale: ptBR })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#171d1c]">Dashboard Gerencial</h1>
        <p className="text-sm text-[#3d4945] mt-1">
          Acompanhe os indicadores de produtividade em <span className="font-semibold capitalize">{mesAno}</span>
        </p>
      </div>

      {/* VISÃO GERAL — interativo (Hoje/Semana/Mês/Personalizado): cards, distribuição, tendência e ranking */}
      <VisaoGeralKPIs
        dados={dadosPorPeriodo}
        periodoInicial={isPersonalizado ? 'personalizado' : 'mes'}
        deInicial={deCustomKey}
        ateInicial={ateCustomKey}
        isGestorOuMaster={isGestorOuMaster}
      />
    </div>
  )
}
