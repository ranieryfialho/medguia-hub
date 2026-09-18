import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ClipboardList, Search, User, ChevronRight, CalendarDays, CheckCheck, History, BarChart3, AlertTriangle, Send } from 'lucide-react'
import { requireModulo } from '@/lib/guard'
import { createClient } from '@/lib/supabase/server'
import { isGestorSistema } from '@/lib/permissoes'
import { getAppDayRangeUTC } from '@/lib/datetime'
import { BotaoConcluirFollowUp } from '@/components/features/follow-ups/BotaoConcluirFollowUp'
import { BotaoNovoFollowUp } from '@/components/features/follow-ups/BotaoNovoFollowUp'
import AvatarPaciente from '@/components/features/pacientes/AvatarPaciente'

const LIMITE = 25
const BACKLOG_DIAS = 7
const SEM_RESPONSAVEL = 'sem_responsavel'

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
  // Não-gestor só pode ver os próprios follow-ups (responsavel_id) nas abas
  // Pendentes/Histórico, independente do que vier na URL. Na aba "Criados por
  // mim" o recorte é por criado_por, então esse trava não se aplica ali.
  const responsavelParam = isGestorOuMaster
    ? ((params.responsavel_id as string) || '')
    : (aba === 'criados' ? '' : user.id)
  // Valor sentinela do select: pega só o que ficou sem ninguém atribuído
  const semResponsavel = responsavelParam === SEM_RESPONSAVEL
  const responsavelFiltro = semResponsavel ? '' : responsavelParam
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

  const [tiposRes, profissionaisRes, todosProfissionaisRes] = await Promise.all([
    supabase.from('follow_up_tipos').select('id, nome, cor').eq('ativo', true).order('ordem').order('nome'),
    isGestorOuMaster
      ? supabase.from('profiles').select('id, full_name').order('full_name')
      : Promise.resolve({ data: null }),
    // Independe do nível de acesso: usado no formulário de "Novo Follow-up" para
    // permitir endereçar a qualquer responsável, mesmo para quem não é gestor.
    supabase.from('profiles').select('id, full_name').order('full_name'),
  ])

  const tipos = tiposRes.data ?? []
  const profissionais = profissionaisRes.data ?? []
  const todosProfissionais = todosProfissionaisRes.data ?? []

  // ─── Lista paginada (respeita aba + filtros, incluindo o range de datas) ────
  // Pendentes: mais antigos primeiro (fila de trabalho). Histórico e Criados
  // por mim: mais recentes primeiro (acompanhamento).
  let query = supabase
    .from('follow_ups')
    .select(`
      id, paciente_id, atendimento_id, tipo_id, descricao, responsavel_id, criado_por, created_at, status,
      tipo:follow_up_tipos(id, nome, cor),
      paciente:pacientes(id, nome, foto_drive_file_id, foto_atualizada_em),
      responsavel:profiles!responsavel_id(id, full_name),
      autor:profiles!criado_por(id, full_name)
    `, { count: 'exact' })
    .order('created_at', { ascending: aba === 'pendentes' })
    .range(offset, offset + LIMITE - 1)

  if (aba === 'criados') {
    // Acompanhamento de tudo que essa pessoa criou, independente de quem é o
    // responsável e do status — por isso não entra no filtro de responsável.
    query = query.eq('criado_por', user.id)
  } else {
    query = query.eq('status', aba === 'historico' ? 'concluido' : 'pendente')
  }

  if (tipoFiltro) query = query.eq('tipo_id', tipoFiltro)
  if (responsavelFiltro) query = query.eq('responsavel_id', responsavelFiltro)
  if (semResponsavel) query = query.is('responsavel_id', null)
  if (pacienteIdsBusca.length > 0) query = query.in('paciente_id', pacienteIdsBusca)
  if (de) query = query.gte('created_at', getAppDayRangeUTC(de).start)
  if (ate) query = query.lte('created_at', getAppDayRangeUTC(ate).end)

  // ─── Backlog: quantos pendentes (sob os filtros atuais) já passaram de 7 dias ───
  const cutoffBacklogIso = new Date(new Date().getTime() - BACKLOG_DIAS * 24 * 60 * 60 * 1000).toISOString()
  let backlogCountQuery = supabase
    .from('follow_ups')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pendente')
    .lt('created_at', cutoffBacklogIso)
  if (tipoFiltro) backlogCountQuery = backlogCountQuery.eq('tipo_id', tipoFiltro)
  if (responsavelFiltro) backlogCountQuery = backlogCountQuery.eq('responsavel_id', responsavelFiltro)
  if (semResponsavel) backlogCountQuery = backlogCountQuery.is('responsavel_id', null)
  if (pacienteIdsBusca.length > 0) backlogCountQuery = backlogCountQuery.in('paciente_id', pacienteIdsBusca)

  let followUpsRaw: any[] = []
  let count = 0
  let totalPendentesAntigos = 0

  if (!semResultados) {
    const [listaRes, backlogCountRes] = await Promise.all([query, backlogCountQuery])
    followUpsRaw = listaRes.data ?? []
    count = listaRes.count ?? 0
    totalPendentesAntigos = backlogCountRes.count ?? 0
  }

  const followUps = followUpsRaw
  const total = count
  const totalPaginas = Math.ceil(total / LIMITE)

  function buildUrl(p: number, abaAlvo?: string) {
    const sp = new URLSearchParams()
    sp.set('aba', abaAlvo ?? aba)
    if (busca) sp.set('busca', busca)
    if (tipoFiltro) sp.set('tipo_id', tipoFiltro)
    if (isGestorOuMaster && responsavelParam) sp.set('responsavel_id', responsavelParam)
    if (de) sp.set('de', de)
    if (ate) sp.set('ate', ate)
    if (p > 1) sp.set('pagina', String(p))
    return `/follow-ups?${sp.toString()}`
  }

  function buildRelatorioUrl() {
    const sp = new URLSearchParams()
    if (busca) sp.set('busca', busca)
    if (tipoFiltro) sp.set('tipo_id', tipoFiltro)
    if (isGestorOuMaster && responsavelParam) sp.set('responsavel_id', responsavelParam)
    if (de) sp.set('de', de)
    if (ate) sp.set('ate', ate)
    const qs = sp.toString()
    return qs ? `/relatorios/follow-ups?${qs}` : '/relatorios/follow-ups'
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

  const agoraMs = new Date().getTime()

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
              {aba === 'pendentes'
                ? 'Acompanhamentos aguardando conclusão'
                : aba === 'criados'
                ? 'Follow-ups que você criou, independente de quem é o responsável'
                : 'Histórico de follow-ups concluídos'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <BotaoNovoFollowUp tipos={tipos} profissionais={todosProfissionais} />
          <Link
            href={buildRelatorioUrl()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-[#006b5a]/40 text-slate-600 hover:text-[#006b5a] rounded-lg text-sm font-medium transition-colors"
          >
            <BarChart3 size={14} />
            Relatório
          </Link>
          {aba === 'pendentes' && total > 0 && (
            <span className="bg-red-100 text-red-700 text-sm font-bold px-3 py-1.5 rounded-full shrink-0">
              {total} pendente{total !== 1 ? 's' : ''}
            </span>
          )}
          {aba !== 'pendentes' && (
            <span className="bg-[#006b5a]/10 text-[#006b5a] text-sm font-semibold px-3 py-1.5 rounded-full shrink-0">
              {total} registro{total !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Alerta de backlog */}
      {aba === 'pendentes' && totalPendentesAntigos > 0 && (
        <Link
          href={buildRelatorioUrl()}
          className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 hover:border-amber-300 text-amber-800 px-4 py-3 rounded-xl text-sm font-medium transition-colors"
        >
          <AlertTriangle size={16} className="shrink-0 text-amber-600" />
          {totalPendentesAntigos} follow-up{totalPendentesAntigos !== 1 ? 's' : ''} pendente{totalPendentesAntigos !== 1 ? 's' : ''} há mais de {BACKLOG_DIAS} dias.
          <span className="underline underline-offset-2 ml-auto shrink-0">Ver no relatório</span>
        </Link>
      )}

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
        <Link
          href={buildUrl(1, 'criados')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            aba === 'criados' ? 'bg-white text-[#006b5a] shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Send size={15} />
          Criados por mim
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
          ) : aba === 'criados' ? (
            <>
              <Send size={32} className="text-slate-300" />
              <p className="font-bold text-slate-700">Nenhum follow-up criado por você</p>
              <p className="text-slate-400 text-sm">
                {busca ? `Sem resultados para "${busca}".` : 'Os follow-ups que você registrar aparecem aqui.'}
              </p>
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
            const paciente = fu.paciente as { id: string; nome: string; foto_drive_file_id: string | null; foto_atualizada_em: string | null } | null
            const tipo = fu.tipo as { id: string; nome: string; cor: string | null } | null
            const responsavel = fu.responsavel as { id: string; full_name: string } | null
            const autor = fu.autor as { id: string; full_name: string } | null
            const nome = paciente?.nome ?? 'Paciente'
            const diasPendente = fu.status === 'pendente'
              ? Math.floor((agoraMs - new Date(fu.created_at).getTime()) / (1000 * 60 * 60 * 24))
              : null
            const atrasado = diasPendente !== null && diasPendente >= BACKLOG_DIAS

            return (
              <div
                key={fu.id}
                className={`flex items-center gap-4 bg-white rounded-xl p-4 shadow-sm border transition-all ${
                  atrasado ? 'border-amber-300 hover:border-amber-400' : 'border-slate-100 hover:border-[#006b5a]/20'
                }`}
              >
                <Link
                  href={`/pacientes/${fu.paciente_id}?aba=follow-ups&follow_up_id=${fu.id}`}
                  className="shrink-0"
                >
                  <AvatarPaciente
                    nome={nome}
                    fotoDriveFileId={paciente?.foto_drive_file_id}
                    fotoAtualizadaEm={paciente?.foto_atualizada_em}
                    size="sm"
                  />
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
                    {diasPendente !== null && (
                      <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        atrasado ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {atrasado && <AlertTriangle size={10} />}
                        {diasPendente === 0 ? 'hoje' : `há ${diasPendente} dia${diasPendente !== 1 ? 's' : ''}`}
                      </span>
                    )}
                    {aba === 'criados' && fu.status === 'concluido' && (
                      <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                        <CheckCheck size={10} />
                        Concluído
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
                {fu.status === 'pendente' ? (
                  <BotaoConcluirFollowUp id={fu.id} />
                ) : (
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
