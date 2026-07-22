import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ClipboardList, Search, User, ChevronRight, CalendarDays, CheckCheck, History } from 'lucide-react'
import { requireModulo } from '@/lib/guard'
import { createClient } from '@/lib/supabase/server'
import { isGestorSistema } from '@/lib/permissoes'
import { parseAppDate, getAppDayRangeUTC } from '@/lib/datetime'
import { BotaoConcluirFollowUp } from '@/components/features/follow-ups/BotaoConcluirFollowUp'
import { DashboardFollowUps } from '@/components/features/follow-ups/DashboardFollowUps'
import { BtnGerarPdfFollowUps, BtnExportarMdFollowUps } from '@/components/features/shared'
import type { DadosRelatorioFollowUps } from '@/lib/relatorios/follow-ups-relatorio-dados'

function iniciais(nome: string) {
  return nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

const LIMITE = 25
const BACKLOG_DIAS = 7

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { user, profile } = await requireModulo('follow_ups')
  const supabase = await createClient()
  const params = await searchParams

  const isGestorOuMaster = isGestorSistema(profile?.nivel_acesso)

  const aba = (params.aba as string) || 'pendentes'
  const busca = ((params.busca as string) || '').trim()
  const tipoFiltro = (params.tipo_id as string) || ''
  // Não-gestor só pode ver os próprios follow-ups, independente do que vier na URL
  const responsavelFiltro = isGestorOuMaster ? ((params.responsavel_id as string) || '') : user.id
  const de = (params.de as string) || ''
  const ate = (params.ate as string) || ''
  const pagina = Math.max(1, parseInt((params.pagina as string) || '1'))
  const offset = (pagina - 1) * LIMITE

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
    isGestorOuMaster
      ? supabase.from('profiles').select('id, full_name').order('full_name')
      : Promise.resolve({ data: null }),
  ])

  const tipos = tiposRes.data ?? []
  const profissionais = profissionaisRes.data ?? []

  // ─── Lista paginada (respeita aba + filtros, incluindo o range de datas) ────
  let query = supabase
    .from('follow_ups')
    .select(`
      id, paciente_id, atendimento_id, tipo_id, descricao, responsavel_id, criado_por, created_at, status,
      tipo:follow_up_tipos(id, nome, cor),
      paciente:pacientes(id, nome),
      responsavel:profiles!responsavel_id(id, full_name),
      autor:profiles!criado_por(id, full_name)
    `, { count: 'exact' })
    .eq('status', aba === 'historico' ? 'concluido' : 'pendente')
    .order('created_at', { ascending: false })
    .range(offset, offset + LIMITE - 1)

  if (tipoFiltro) query = query.eq('tipo_id', tipoFiltro)
  if (responsavelFiltro) query = query.eq('responsavel_id', responsavelFiltro)
  if (pacienteIdsBusca.length > 0) query = query.in('paciente_id', pacienteIdsBusca)
  if (de) query = query.gte('created_at', getAppDayRangeUTC(de).start)
  if (ate) query = query.lte('created_at', getAppDayRangeUTC(ate).end)

  // ─── Backlog: pendentes há mais de 7 dias (sempre sobre o total atual, sem filtro de período) ───
  const cutoffBacklogIso = new Date(new Date().getTime() - BACKLOG_DIAS * 24 * 60 * 60 * 1000).toISOString()

  let pendentesAntigosCountQuery = supabase
    .from('follow_ups')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pendente')
    .lt('created_at', cutoffBacklogIso)
  if (tipoFiltro) pendentesAntigosCountQuery = pendentesAntigosCountQuery.eq('tipo_id', tipoFiltro)
  if (responsavelFiltro) pendentesAntigosCountQuery = pendentesAntigosCountQuery.eq('responsavel_id', responsavelFiltro)
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
  if (pacienteIdsBusca.length > 0) periodoQuery = periodoQuery.in('paciente_id', pacienteIdsBusca)
  if (de) periodoQuery = periodoQuery.gte('created_at', getAppDayRangeUTC(de).start)
  if (ate) periodoQuery = periodoQuery.lte('created_at', getAppDayRangeUTC(ate).end)

  let followUpsRaw: any[] = []
  let count = 0
  let totalPendentesAntigos = 0
  let pendentesAntigosRaw: any[] = []
  let periodoRaw: any[] = []

  if (!semResultados) {
    const [listaRes, backlogCountRes, backlogListaRes, periodoRes] = await Promise.all([
      query,
      pendentesAntigosCountQuery,
      pendentesAntigosListaQuery,
      periodoQuery,
    ])
    followUpsRaw = listaRes.data ?? []
    count = listaRes.count ?? 0
    totalPendentesAntigos = backlogCountRes.count ?? 0
    pendentesAntigosRaw = backlogListaRes.data ?? []
    periodoRaw = periodoRes.data ?? []
  }

  const followUps = followUpsRaw
  const total = count
  const totalPaginas = Math.ceil(total / LIMITE)

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
  if (isGestorOuMaster && responsavelFiltro) {
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

  function buildUrl(p: number, abaAlvo?: string) {
    const sp = new URLSearchParams()
    sp.set('aba', abaAlvo ?? aba)
    if (busca) sp.set('busca', busca)
    if (tipoFiltro) sp.set('tipo_id', tipoFiltro)
    if (isGestorOuMaster && responsavelFiltro) sp.set('responsavel_id', responsavelFiltro)
    if (de) sp.set('de', de)
    if (ate) sp.set('ate', ate)
    if (p > 1) sp.set('pagina', String(p))
    return `/follow-ups?${sp.toString()}`
  }

  const paginas: Array<number | '...'> = []
  if (totalPaginas <= 7) {
    for (let p = 1; p <= totalPaginas; p++) paginas.push(p)
  } else {
    paginas.push(1)
    if (pagina > 4) paginas.push('...')
    for (let p = Math.max(2, pagina - 1); p <= Math.min(totalPaginas - 1, pagina + 1); p++) paginas.push(p)
    if (pagina < totalPaginas - 3) paginas.push('...')
    paginas.push(totalPaginas)
  }

  return (
    <div className="w-full space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#006b5a]/10 flex items-center justify-center shrink-0">
            <ClipboardList size={20} className="text-[#006b5a]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#006b5a]">Follow-ups</h2>
            <p className="text-xs text-slate-500">
              {aba === 'pendentes' ? 'Acompanhamentos aguardando conclusão' : 'Histórico de follow-ups concluídos'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <BtnExportarMdFollowUps {...dadosRelatorio} />
          <BtnGerarPdfFollowUps {...dadosRelatorio} />
          {aba === 'pendentes' && total > 0 && (
            <span className="bg-red-100 text-red-700 text-sm font-bold px-3 py-1.5 rounded-full shrink-0">
              {total} pendente{total !== 1 ? 's' : ''}
            </span>
          )}
          {aba === 'historico' && (
            <span className="bg-[#006b5a]/10 text-[#006b5a] text-sm font-semibold px-3 py-1.5 rounded-full shrink-0">
              {total} registro{total !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Dashboard */}
      <DashboardFollowUps dados={dadosRelatorio} />

      {/* Abas */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <Link
          href={buildUrl(1, 'pendentes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            aba === 'pendentes' ? 'bg-white text-[#006b5a] shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <ClipboardList size={15} />
          Pendentes
        </Link>
        <Link
          href={buildUrl(1, 'historico')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            aba === 'historico' ? 'bg-white text-[#006b5a] shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <History size={15} />
          Histórico
        </Link>
      </div>

      {/* Filtros */}
      <form method="get" action="/follow-ups" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="aba" value={aba} />
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
            defaultValue={responsavelFiltro}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#006b5a]/50 shadow-sm"
          >
            <option value="">Todos os responsáveis</option>
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
        {(busca || tipoFiltro || (isGestorOuMaster && responsavelFiltro) || de || ate) && (
          <Link href={`/follow-ups?aba=${aba}`} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm transition-colors">
            Limpar
          </Link>
        )}
      </form>

      {/* Lista */}
      {followUps.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-slate-100 flex flex-col items-center gap-4 text-center">
          {aba === 'pendentes' ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <CheckCheck size={32} className="text-[#006b5a]" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-lg">Tudo em dia!</p>
                <p className="text-slate-500 text-sm mt-1">Nenhum follow-up pendente.</p>
              </div>
            </>
          ) : (
            <>
              <ClipboardList size={32} className="text-slate-300" />
              <p className="font-bold text-slate-700">Nenhum follow-up encontrado</p>
              <p className="text-slate-400 text-sm">
                {busca ? `Sem resultados para "${busca}".` : 'Nenhum follow-up concluído ainda.'}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {followUps.map((fu: any) => {
            const paciente = fu.paciente as { id: string; nome: string } | null
            const tipo = fu.tipo as { id: string; nome: string; cor: string | null } | null
            const responsavel = fu.responsavel as { id: string; full_name: string } | null
            const autor = fu.autor as { id: string; full_name: string } | null
            const nome = paciente?.nome ?? 'Paciente'

            return (
              <div
                key={fu.id}
                className="flex items-center gap-4 bg-white rounded-xl p-4 shadow-sm border border-slate-100 hover:border-[#006b5a]/20 transition-all"
              >
                <Link
                  href={`/pacientes/${fu.paciente_id}?aba=follow-ups&follow_up_id=${fu.id}`}
                  className="w-11 h-11 rounded-2xl bg-[#006b5a] flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm"
                >
                  {iniciais(nome)}
                </Link>
                <Link
                  href={`/pacientes/${fu.paciente_id}?aba=follow-ups&follow_up_id=${fu.id}`}
                  className="flex-1 min-w-0 group"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-900 leading-tight group-hover:text-[#006b5a] transition-colors">{nome}</p>
                    {tipo && (
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={tipo.cor
                          ? { backgroundColor: `${tipo.cor}20`, color: tipo.cor }
                          : { backgroundColor: 'rgb(0 107 90 / 0.1)', color: '#006b5a' }
                        }
                      >
                        {tipo.nome}
                      </span>
                    )}
                  </div>
                  {fu.descricao && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{fu.descricao}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <CalendarDays size={11} />
                      {format(new Date(fu.created_at), "dd MMM yyyy · HH:mm", { locale: ptBR })}
                    </span>
                    {responsavel && (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <User size={11} />
                        {responsavel.full_name}
                      </span>
                    )}
                    {autor && (
                      <span className="text-xs text-slate-300">por {autor.full_name}</span>
                    )}
                  </div>
                </Link>
                {aba === 'pendentes' && (
                  <BotaoConcluirFollowUp id={fu.id} />
                )}
                {aba === 'historico' && (
                  <ChevronRight size={18} className="text-slate-300 shrink-0" />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="text-xs text-slate-400">
            {offset + 1}–{Math.min(pagina * LIMITE, total)} de {total} registro{total !== 1 ? 's' : ''}
          </p>
          <div className="flex flex-wrap items-center gap-1">
            <Link
              href={buildUrl(pagina - 1)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${pagina === 1 ? 'pointer-events-none opacity-30 bg-slate-100 text-slate-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
            >
              ← Anterior
            </Link>
            {paginas.map((p, i) =>
              p === '...' ? (
                <span key={`e-${i}`} className="px-2 py-1.5 text-sm text-slate-400">...</span>
              ) : (
                <Link
                  key={p}
                  href={buildUrl(p)}
                  className={`min-w-9 px-3 py-1.5 rounded-lg text-center text-sm transition-colors ${p === pagina ? 'bg-[#006b5a] text-white font-semibold' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                >
                  {p}
                </Link>
              )
            )}
            <Link
              href={buildUrl(pagina + 1)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${pagina === totalPaginas ? 'pointer-events-none opacity-30 bg-slate-100 text-slate-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
            >
              Próxima →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
