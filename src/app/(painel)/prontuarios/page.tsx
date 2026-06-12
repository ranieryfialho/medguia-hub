import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ClipboardList, CheckCheck, ChevronRight, CalendarDays, History, Search } from 'lucide-react'
import { requireModulo } from '@/lib/guard'
import { STATUS_CONCLUIDO_RAW_VALUES } from '@/lib/atendimento-status'
import { PRONTUARIOS_PENDENTES_RECENT_LIMIT } from '@/lib/prontuarios'

function iniciais(nome: string) {
  return nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

const LIMITE = 20

export default async function ProntuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { user, profile } = await requireModulo('prontuarios')

  const supabase = await createClient()
  const resolvedParams = await searchParams

  const aba = (resolvedParams.aba as string) || 'pendentes'
  const busca = ((resolvedParams.busca as string) || '').trim()
  const filtroProf = (resolvedParams.profissional_id as string) || ''
  const pagina = Math.max(1, parseInt((resolvedParams.pagina as string) || '1'))
  const offsetHistorico = (pagina - 1) * LIMITE

  const role = profile?.role ?? ''
  const isFisio = role !== 'gestor' && role !== 'master'

  let profissionaisMap = new Map<string, string>()

  // ── ABA PENDENTES ─────────────────────────────────────────────
  let pendentes: any[] = []

  if (aba === 'pendentes') {
    if (role === 'medico') {
      pendentes = []
    } else {
    const [atendimentosRes, { data: profissionaisRaw }] = await Promise.all([
      (() => {
        const q = supabase
          .from('atendimentos')
          .select(`
            id,
            data_agendamento,
            tipo,
            paciente_id,
            profissional_id,
            pacientes(id, nome),
            agendamento:agendamentos(tipo)
          `)
          .in('status', STATUS_CONCLUIDO_RAW_VALUES)
          .order('data_agendamento', { ascending: false })
          .limit(PRONTUARIOS_PENDENTES_RECENT_LIMIT)
        return isFisio ? q.eq('profissional_id', user.id) : q
      })(),
      supabase.from('profiles').select('id, full_name, role'),
    ])

    profissionaisMap = new Map((profissionaisRaw ?? []).map(p => [p.id, p.full_name]))
    const atendimentosConcluidos = atendimentosRes.data ?? []
    const atendimentoIds = atendimentosConcluidos.map((atendimento) => atendimento.id)

    let idsComProntuario = new Set<string>()

    if (atendimentoIds.length > 0) {
      const { data: comProntuario } = await supabase
        .from('prontuarios')
        .select('atendimento_id')
        .in('atendimento_id', atendimentoIds)

      idsComProntuario = new Set(comProntuario?.map((prontuario) => prontuario.atendimento_id) ?? [])
    }

    pendentes = atendimentosConcluidos.filter((atendimento) => !idsComProntuario.has(atendimento.id))
  }
  }

  // ── ABA HISTÓRICO ──────────────────────────────────────────────
  let historicoPaginado: any[] = []
  let historicoTotal = 0
  let profissionaisFiltro: { id: string; nome: string }[] = []

  if (aba === 'historico') {
    let pacienteIdsBusca: string[] = []

    if (busca) {
      const { data: pacientesBusca } = await supabase
        .from('pacientes')
        .select('id')
        .ilike('nome', `%${busca}%`)
        .limit(200)

      pacienteIdsBusca = (pacientesBusca ?? []).map((paciente) => paciente.id)
    }

    const semResultadosParaBusca = busca.length > 0 && pacienteIdsBusca.length === 0

    let query = supabase
      .from('prontuarios')
      .select(`
        atendimento_id,
        paciente_id,
        profissional_id,
        created_at,
        atendimentos(
          data_agendamento,
          tipo,
          agendamento:agendamentos(tipo)
        ),
        pacientes:paciente_id(id, nome)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offsetHistorico, offsetHistorico + LIMITE - 1)

    if (isFisio) query = query.eq('profissional_id', user.id)
    else if (filtroProf) query = query.eq('profissional_id', filtroProf)
    if (pacienteIdsBusca.length > 0) query = query.in('paciente_id', pacienteIdsBusca)

    const [{ data: historicoRaw, count }, { data: profissionaisRaw }] = await Promise.all([
      semResultadosParaBusca
        ? Promise.resolve({ data: [] as any[], count: 0 })
        : query,
      !isFisio
        ? supabase.from('profiles').select('id, full_name').in('role', ['fisioterapeuta', 'gestor']).order('full_name')
        : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null }> }),
    ])

    profissionaisMap = new Map((profissionaisRaw ?? []).map(p => [p.id, p.full_name ?? '']))
    profissionaisFiltro = (profissionaisRaw ?? []).map(p => ({
      id: p.id,
      nome: p.full_name ?? 'Sem nome',
    }))

    historicoPaginado = historicoRaw ?? []
    historicoTotal = count ?? 0
  }

  const totalPaginasHistorico = Math.ceil(historicoTotal / LIMITE)

  function buildHistoricoUrl(p: number) {
    const sp = new URLSearchParams()
    sp.set('aba', 'historico')
    if (busca) sp.set('busca', busca)
    if (filtroProf) sp.set('profissional_id', filtroProf)
    if (p > 1) sp.set('pagina', String(p))
    return `/prontuarios?${sp.toString()}`
  }

  const paginasHistorico: Array<number | '...'> = []
  if (totalPaginasHistorico <= 7) {
    for (let p = 1; p <= totalPaginasHistorico; p++) paginasHistorico.push(p)
  } else {
    paginasHistorico.push(1)
    if (pagina > 4) paginasHistorico.push('...')
    for (let p = Math.max(2, pagina - 1); p <= Math.min(totalPaginasHistorico - 1, pagina + 1); p++) {
      paginasHistorico.push(p)
    }
    if (pagina < totalPaginasHistorico - 3) paginasHistorico.push('...')
    paginasHistorico.push(totalPaginasHistorico)
  }

  return (
    <div className="w-full space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#006b5a]/10 flex items-center justify-center shrink-0">
            <ClipboardList size={20} className="text-[#006b5a]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#006b5a]">Prontuários</h2>
            <p className="text-xs text-slate-500">
              {aba === 'pendentes'
                ? 'Sessões aguardando registro clínico'
                : 'Histórico de prontuários preenchidos'}
            </p>
          </div>
        </div>
        {aba === 'pendentes' && pendentes.length > 0 && (
          <span className="bg-red-100 text-red-700 text-sm font-bold px-3 py-1.5 rounded-full shrink-0">
            {pendentes.length} pendente{pendentes.length !== 1 ? 's' : ''}
          </span>
        )}
        {aba === 'historico' && (
          <span className="bg-[#006b5a]/10 text-[#006b5a] text-sm font-semibold px-3 py-1.5 rounded-full shrink-0">
            {historicoTotal} registro{historicoTotal !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <Link
          href="/prontuarios"
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            aba === 'pendentes'
              ? 'bg-white text-[#006b5a] shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <ClipboardList size={15} />
          Pendentes
        </Link>
        <Link
          href="/prontuarios?aba=historico"
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            aba === 'historico'
              ? 'bg-white text-[#006b5a] shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <History size={15} />
          Histórico
        </Link>
      </div>

      {/* ── PENDENTES ─────────────────────────────────────────── */}
      {aba === 'pendentes' && (
        pendentes.length === 0 ? (
          <div className="bg-white rounded-xl p-12 shadow-sm border border-slate-100 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <CheckCheck size={32} className="text-[#006b5a]" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-lg">Tudo em dia!</p>
              <p className="text-slate-500 text-sm mt-1">
                Nenhuma sessão aguardando registro de evolução.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {pendentes.map((atendimento: any) => {
              const paciente = atendimento.pacientes as { id: string; nome: string } | null
              const tipo = (atendimento.agendamento as { tipo?: string } | null)?.tipo
                ?? atendimento.tipo ?? 'Sessão'
              const nome = paciente?.nome ?? 'Paciente'
              const profissionalNome = profissionaisMap.get(atendimento.profissional_id) ?? 'Sem responsável'
              const data = new Date(atendimento.data_agendamento)

              return (
                <Link
                  key={atendimento.id}
                  href={`/prontuarios/${atendimento.id}`}
                  className="flex items-center gap-4 bg-white rounded-xl p-4 shadow-sm border border-slate-100 hover:border-[#006b5a]/30 hover:shadow-md active:scale-[0.99] transition-all group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#006b5a] flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm">
                    {iniciais(nome)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 truncate leading-tight">{nome}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <CalendarDays size={11} />
                        {format(data, "dd MMM yyyy · HH:mm", { locale: ptBR })}
                      </span>
                      <span className="text-[11px] font-semibold text-[#006b5a] bg-[#006b5a]/10 px-2 py-0.5 rounded-full">
                        {tipo}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5">{profissionalNome}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="hidden sm:block text-xs font-semibold text-[#006b5a]">Preencher</span>
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-[#006b5a] group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              )
            })}
          </div>
        )
      )}

      {/* ── HISTÓRICO ─────────────────────────────────────────── */}
      {aba === 'historico' && (
        <div className="space-y-4">

          {/* Filtros */}
          <form method="get" action="/prontuarios" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="aba" value="historico" />
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
            {!isFisio && profissionaisFiltro.length > 0 && (
              <select
                name="profissional_id"
                defaultValue={filtroProf}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#006b5a]/50 shadow-sm"
              >
                <option value="">Todos os profissionais</option>
                {profissionaisFiltro.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            )}
            <button
              type="submit"
              className="px-4 py-2 bg-[#006b5a] hover:bg-[#005a4b] text-white rounded-lg text-sm font-medium transition-colors"
            >
              Filtrar
            </button>
            {(busca || filtroProf) && (
              <Link
                href="/prontuarios?aba=historico"
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm transition-colors"
              >
                Limpar
              </Link>
            )}
          </form>

          {/* Lista */}
          {historicoPaginado.length === 0 ? (
            <div className="bg-white rounded-xl p-12 shadow-sm border border-slate-100 flex flex-col items-center gap-3 text-center">
              <ClipboardList size={32} className="text-slate-300" />
              <p className="font-bold text-slate-700">Nenhum prontuário encontrado</p>
              <p className="text-slate-400 text-sm">
                {busca
                  ? `Sem resultados para "${busca}".`
                  : 'Nenhum prontuário preenchido ainda.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {historicoPaginado.map((prontuario: any) => {
                const paciente = prontuario.pacientes as { id: string; nome: string } | null
                const atendimento = prontuario.atendimentos as {
                  data_agendamento: string
                  tipo: string
                  agendamento?: { tipo?: string } | null
                } | null
                const tipo = atendimento?.agendamento?.tipo ?? atendimento?.tipo ?? 'Sessão'
                const nome = paciente?.nome ?? 'Paciente'
                const profissionalNome = profissionaisMap.get(prontuario.profissional_id) ?? ''
                const dataSessao = new Date(atendimento?.data_agendamento ?? prontuario.created_at)
                const dataRegistro = new Date(prontuario.created_at)

                return (
                  <Link
                    key={prontuario.atendimento_id}
                    href={`/prontuarios/${prontuario.atendimento_id}?from=historico`}
                    className="flex items-center gap-4 bg-white rounded-xl p-4 shadow-sm border border-slate-100 hover:border-emerald-200 hover:shadow-md active:scale-[0.99] transition-all group"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-emerald-500 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm">
                      {iniciais(nome)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 truncate leading-tight">{nome}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <CalendarDays size={11} />
                          {format(dataSessao, "dd MMM yyyy · HH:mm", { locale: ptBR })}
                        </span>
                        <span className="text-[11px] font-semibold text-[#006b5a] bg-[#006b5a]/10 px-2 py-0.5 rounded-full">
                          {tipo}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1.5">
                        {profissionalNome && <>{profissionalNome} · </>}
                        Registrado em {format(dataRegistro, "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="hidden sm:block text-xs font-semibold text-emerald-600">Ver</span>
                      <ChevronRight size={18} className="text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          {/* Paginação */}
          {totalPaginasHistorico > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <p className="text-xs text-slate-400">
                {(pagina - 1) * LIMITE + 1}–{Math.min(pagina * LIMITE, historicoTotal)} de {historicoTotal} registro{historicoTotal !== 1 ? 's' : ''}
              </p>
              <div className="flex flex-wrap items-center gap-1">
                <Link
                  href={buildHistoricoUrl(pagina - 1)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    pagina === 1
                      ? 'pointer-events-none opacity-30 bg-slate-100 text-slate-400'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  ← Anterior
                </Link>
                {paginasHistorico.map((p, index) =>
                  p === '...' ? (
                    <span
                      key={`ellipsis-${index}`}
                      className="px-2 py-1.5 text-sm text-slate-400"
                    >
                      ...
                    </span>
                  ) : (
                    <Link
                      key={p}
                      href={buildHistoricoUrl(p)}
                      className={`min-w-9 px-3 py-1.5 rounded-lg text-center text-sm transition-colors ${
                        p === pagina
                          ? 'bg-[#006b5a] text-white font-semibold'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {p}
                    </Link>
                  )
                )}
                <Link
                  href={buildHistoricoUrl(pagina + 1)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    pagina === totalPaginasHistorico
                      ? 'pointer-events-none opacity-30 bg-slate-100 text-slate-400'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Próxima →
                </Link>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
