import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowLeft, BarChart3, Search } from 'lucide-react'
import { requireModulo } from '@/lib/guard'
import { createClient } from '@/lib/supabase/server'
import { isGestorSistema } from '@/lib/permissoes'
import { parseAppDate, getAppDayRangeUTC } from '@/lib/datetime'
import { DashboardFollowUps } from '@/components/features/follow-ups/DashboardFollowUps'
import { BtnGerarPdfFollowUps, BtnExportarMdFollowUps } from '@/components/features/shared'
import type { DadosRelatorioFollowUps } from '@/lib/relatorios/follow-ups-relatorio-dados'

const SEM_RESPONSAVEL = 'sem_responsavel'

export default async function RelatorioFollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { user, profile } = await requireModulo('follow_ups')
  const supabase = await createClient()
  const params = await searchParams

  const isGestorOuMaster = isGestorSistema(profile?.nivel_acesso)

  const busca = ((params.busca as string) || '').trim()
  const tipoFiltro = (params.tipo_id as string) || ''
  // Não-gestor só vê o próprio relatório, independente do que vier na URL
  const responsavelParam = isGestorOuMaster ? ((params.responsavel_id as string) || '') : user.id
  const semResponsavel = responsavelParam === SEM_RESPONSAVEL
  const responsavelFiltro = semResponsavel ? '' : responsavelParam
  const de = (params.de as string) || ''
  const ate = (params.ate as string) || ''

  let pacienteIdsBusca: string[] = []
  if (busca) {
    const { data } = await supabase
      .from('pacientes')
      .select('id')
      .ilike('nome', `%${busca}%`)
      .limit(200)
    pacienteIdsBusca = (data ?? []).map(p => p.id)
  }

  const semResultados = busca.length > 0 && pacienteIdsBusca.length === 0

  const [tiposRes, profissionaisRes] = await Promise.all([
    supabase.from('follow_up_tipos').select('id, nome, cor').eq('ativo', true).order('ordem').order('nome'),
    supabase.from('profiles').select('id, full_name').order('full_name'),
  ])

  const tipos = tiposRes.data ?? []
  const profissionais = profissionaisRes.data ?? []

  // ─── Backlog: pendentes há mais de 7 dias ──────────────────────────────────
  const BACKLOG_DIAS = 7
  const cutoffBacklogIso = new Date(new Date().getTime() - BACKLOG_DIAS * 24 * 60 * 60 * 1000).toISOString()

  let pendentesAntigosCountQuery = supabase
    .from('follow_ups')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pendente')
    .lt('created_at', cutoffBacklogIso)
  if (tipoFiltro) pendentesAntigosCountQuery = pendentesAntigosCountQuery.eq('tipo_id', tipoFiltro)
  if (responsavelFiltro) pendentesAntigosCountQuery = pendentesAntigosCountQuery.eq('responsavel_id', responsavelFiltro)
  if (semResponsavel) pendentesAntigosCountQuery = pendentesAntigosCountQuery.is('responsavel_id', null)
  if (pacienteIdsBusca.length > 0) pendentesAntigosCountQuery = pendentesAntigosCountQuery.in('paciente_id', pacienteIdsBusca)

  let pendentesAntigosListaQuery = supabase
    .from('follow_ups')
    .select(`
      id, created_at,
      tipo:follow_up_tipos(nome),
      responsavel:profiles!responsavel_id(full_name),
      paciente:pacientes(nome)
    `)
    .eq('status', 'pendente')
    .lt('created_at', cutoffBacklogIso)
    .order('created_at', { ascending: true })
    .limit(20)
  if (tipoFiltro) pendentesAntigosListaQuery = pendentesAntigosListaQuery.eq('tipo_id', tipoFiltro)
  if (responsavelFiltro) pendentesAntigosListaQuery = pendentesAntigosListaQuery.eq('responsavel_id', responsavelFiltro)
  if (semResponsavel) pendentesAntigosListaQuery = pendentesAntigosListaQuery.is('responsavel_id', null)
  if (pacienteIdsBusca.length > 0) pendentesAntigosListaQuery = pendentesAntigosListaQuery.in('paciente_id', pacienteIdsBusca)

  // ─── Dashboard: conjunto filtrado (tipo/responsável/busca + período), pendente e concluído ───
  let periodoQuery = supabase
    .from('follow_ups')
    .select(`
      id, tipo_id, responsavel_id, status, created_at, updated_at,
      tipo:follow_up_tipos(nome, cor),
      responsavel:profiles!responsavel_id(full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(3000)
  if (tipoFiltro) periodoQuery = periodoQuery.eq('tipo_id', tipoFiltro)
  if (responsavelFiltro) periodoQuery = periodoQuery.eq('responsavel_id', responsavelFiltro)
  if (semResponsavel) periodoQuery = periodoQuery.is('responsavel_id', null)
  if (pacienteIdsBusca.length > 0) periodoQuery = periodoQuery.in('paciente_id', pacienteIdsBusca)
  if (de) periodoQuery = periodoQuery.gte('created_at', getAppDayRangeUTC(de).start)
  if (ate) periodoQuery = periodoQuery.lte('created_at', getAppDayRangeUTC(ate).end)

  let totalPendentesAntigos = 0
  let pendentesAntigosRaw: any[] = []
  let periodoRaw: any[] = []

  if (!semResultados) {
    const [backlogCountRes, backlogListaRes, periodoRes] = await Promise.all([
      pendentesAntigosCountQuery,
      pendentesAntigosListaQuery,
      periodoQuery,
    ])
    totalPendentesAntigos = backlogCountRes.count ?? 0
    pendentesAntigosRaw = backlogListaRes.data ?? []
    periodoRaw = periodoRes.data ?? []
  }

  // ─── Monta os dados agregados do dashboard / exportações ───────────────────
  const totalDashboard = periodoRaw.length
  const totalPendentesFiltro = periodoRaw.filter((p: any) => p.status === 'pendente').length
  const totalConcluidosFiltro = periodoRaw.filter((p: any) => p.status === 'concluido').length
  const taxaConclusao = totalDashboard > 0 ? Math.round((totalConcluidosFiltro / totalDashboard) * 100) : 0

  const concluidosComTempo = periodoRaw.filter((p: any) => p.status === 'concluido')
  const tempoMedioConclusaoDias = concluidosComTempo.length > 0
    ? Math.round(
        concluidosComTempo.reduce((soma: number, p: any) =>
          soma + (new Date(p.updated_at).getTime() - new Date(p.created_at).getTime()), 0)
        / concluidosComTempo.length / (1000 * 60 * 60 * 24)
      )
    : null

  const tipoMap = new Map<string, { nome: string; cor: string | null; total: number }>()
  for (const p of periodoRaw) {
    const nome = p.tipo?.nome ?? 'Sem tipo'
    const atual = tipoMap.get(nome) ?? { nome, cor: p.tipo?.cor ?? null, total: 0 }
    atual.total++
    tipoMap.set(nome, atual)
  }

  const responsavelMap = new Map<string, { nome: string; total: number; pendentes: number; concluidos: number }>()
  for (const p of periodoRaw) {
    const chave = p.responsavel_id ?? 'sem_responsavel'
    const nome = p.responsavel?.full_name ?? 'Sem responsável'
    const atual = responsavelMap.get(chave) ?? { nome, total: 0, pendentes: 0, concluidos: 0 }
    atual.total++
    if (p.status === 'pendente') atual.pendentes++
    else atual.concluidos++
    responsavelMap.set(chave, atual)
  }

  const pendentesAntigos = pendentesAntigosRaw.map((p: any) => ({
    paciente_nome: p.paciente?.nome ?? 'Paciente',
    tipo_nome: p.tipo?.nome ?? 'Sem tipo',
    responsavel_nome: p.responsavel?.full_name ?? null,
    dias_pendente: Math.floor((new Date().getTime() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24)),
    criado_em: p.created_at,
  }))

  const periodoLabel = de && ate
    ? `${format(parseAppDate(de), 'dd/MM/yyyy')} – ${format(parseAppDate(ate), 'dd/MM/yyyy')}`
    : de
    ? `A partir de ${format(parseAppDate(de), 'dd/MM/yyyy')}`
    : ate
    ? `Até ${format(parseAppDate(ate), 'dd/MM/yyyy')}`
    : 'Todos os períodos'

  const partesFiltro: string[] = []
  if (tipoFiltro) {
    const tipoNome = tipos.find(t => t.id === tipoFiltro)?.nome
    if (tipoNome) partesFiltro.push(`Tipo: ${tipoNome}`)
  }
  if (isGestorOuMaster && semResponsavel) {
    partesFiltro.push('Responsável: sem responsável atribuído')
  } else if (isGestorOuMaster && responsavelFiltro) {
    const respNome = profissionais.find(p => p.id === responsavelFiltro)?.full_name
    if (respNome) partesFiltro.push(`Responsável: ${respNome}`)
  } else if (!isGestorOuMaster) {
    partesFiltro.push(`Responsável: ${profile?.full_name ?? 'Você'}`)
  }
  if (busca) partesFiltro.push(`Busca: "${busca}"`)
  const filtrosLabel = partesFiltro.length > 0 ? partesFiltro.join(' · ') : 'Todos os follow-ups'

  const dadosRelatorio: DadosRelatorioFollowUps = {
    periodoLabel,
    filtrosLabel,
    total: totalDashboard,
    totalPendentes: totalPendentesFiltro,
    totalConcluidos: totalConcluidosFiltro,
    taxaConclusao,
    tempoMedioConclusaoDias,
    totalPendentesAntigos,
    pendentesAntigos,
    contagemPorTipo: [...tipoMap.values()],
    porResponsavel: [...responsavelMap.values()].map(r => ({
      ...r,
      taxaConclusao: r.total > 0 ? Math.round((r.concluidos / r.total) * 100) : 0,
    })),
  }

  return (
    <div className="w-full space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <Link
            href="/follow-ups"
            title="Voltar para o operacional"
            className="w-10 h-10 rounded-xl bg-[#006b5a]/10 flex items-center justify-center shrink-0 text-[#006b5a] hover:bg-[#006b5a]/20 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-[#006b5a] flex items-center gap-2">
              <BarChart3 size={18} />
              Relatório de Follow-ups
            </h2>
            <p className="text-xs text-slate-500">Indicadores, distribuição por tipo e por responsável</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <BtnExportarMdFollowUps {...dadosRelatorio} />
          <BtnGerarPdfFollowUps {...dadosRelatorio} />
        </div>
      </div>

      {/* Filtros */}
      <form method="get" action="/relatorios/follow-ups" className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            name="busca"
            defaultValue={busca}
            placeholder="Buscar por paciente..."
            className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#006b5a]/50 shadow-sm"
          />
        </div>
        <select
          name="tipo_id"
          defaultValue={tipoFiltro}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#006b5a]/50 shadow-sm"
        >
          <option value="">Todos os tipos</option>
          {tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        {isGestorOuMaster && (
          <select
            name="responsavel_id"
            defaultValue={responsavelParam}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#006b5a]/50 shadow-sm"
          >
            <option value="">Todos os responsáveis</option>
            <option value={SEM_RESPONSAVEL}>Sem responsável</option>
            {profissionais.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        )}
        <div className="flex flex-col">
          <label className="text-[11px] font-semibold text-slate-500 mb-1">De</label>
          <input
            type="date"
            name="de"
            defaultValue={de}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#006b5a]/50 shadow-sm"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-[11px] font-semibold text-slate-500 mb-1">Até</label>
          <input
            type="date"
            name="ate"
            defaultValue={ate}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#006b5a]/50 shadow-sm"
          />
        </div>
        <button type="submit" className="px-4 py-2 bg-[#006b5a] hover:bg-[#005a4b] text-white rounded-lg text-sm font-medium transition-colors">
          Filtrar
        </button>
        {(busca || tipoFiltro || (isGestorOuMaster && responsavelParam) || de || ate) && (
          <Link href="/relatorios/follow-ups" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm transition-colors">
            Limpar
          </Link>
        )}
      </form>

      {/* Dashboard */}
      <DashboardFollowUps dados={dadosRelatorio} />
    </div>
  )
}
