import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ClipboardList, Search, User, ChevronRight, CalendarDays } from 'lucide-react'
import { requireModulo } from '@/lib/guard'
import { createClient } from '@/lib/supabase/server'

function iniciais(nome: string) {
  return nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

const LIMITE = 25

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  await requireModulo('follow_ups')
  const supabase = await createClient()
  const params = await searchParams

  const busca = ((params.busca as string) || '').trim()
  const tipoFiltro = (params.tipo_id as string) || ''
  const responsavelFiltro = (params.responsavel_id as string) || ''
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
    supabase.from('profiles').select('id, full_name').order('full_name'),
  ])

  const tipos = tiposRes.data ?? []
  const profissionais = profissionaisRes.data ?? []

  let query = supabase
    .from('follow_ups')
    .select(`
      id, paciente_id, atendimento_id, tipo_id, descricao, responsavel_id, criado_por, created_at,
      tipo:follow_up_tipos(id, nome, cor),
      paciente:pacientes(id, nome),
      responsavel:profiles!responsavel_id(id, full_name),
      autor:profiles!criado_por(id, full_name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + LIMITE - 1)

  if (tipoFiltro) query = query.eq('tipo_id', tipoFiltro)
  if (responsavelFiltro) query = query.eq('responsavel_id', responsavelFiltro)
  if (pacienteIdsBusca.length > 0) query = query.in('paciente_id', pacienteIdsBusca)

  const { data: followUpsRaw, count } = semResultados
    ? { data: [] as any[], count: 0 }
    : await query
  const followUps = followUpsRaw ?? []

  const total = count ?? 0
  const totalPaginas = Math.ceil(total / LIMITE)

  function buildUrl(p: number) {
    const sp = new URLSearchParams()
    if (busca) sp.set('busca', busca)
    if (tipoFiltro) sp.set('tipo_id', tipoFiltro)
    if (responsavelFiltro) sp.set('responsavel_id', responsavelFiltro)
    if (p > 1) sp.set('pagina', String(p))
    const qs = sp.toString()
    return `/follow-ups${qs ? `?${qs}` : ''}`
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
      <div className="flex items-center justify-between bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#006b5a]/10 flex items-center justify-center shrink-0">
            <ClipboardList size={20} className="text-[#006b5a]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#006b5a]">Follow-ups</h2>
            <p className="text-xs text-slate-500">Registro de acompanhamento por paciente</p>
          </div>
        </div>
        <span className="bg-[#006b5a]/10 text-[#006b5a] text-sm font-semibold px-3 py-1.5 rounded-full shrink-0">
          {total} registro{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Filtros */}
      <form method="get" action="/follow-ups" className="flex flex-wrap items-end gap-3">
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
        <select
          name="responsavel_id"
          defaultValue={responsavelFiltro}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#006b5a]/50 shadow-sm"
        >
          <option value="">Todos os responsáveis</option>
          {profissionais.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
        <button type="submit" className="px-4 py-2 bg-[#006b5a] hover:bg-[#005a4b] text-white rounded-lg text-sm font-medium transition-colors">
          Filtrar
        </button>
        {(busca || tipoFiltro || responsavelFiltro) && (
          <Link href="/follow-ups" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm transition-colors">
            Limpar
          </Link>
        )}
      </form>

      {/* Lista */}
      {followUps.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-slate-100 flex flex-col items-center gap-3 text-center">
          <ClipboardList size={32} className="text-slate-300" />
          <p className="font-bold text-slate-700">Nenhum follow-up encontrado</p>
          <p className="text-slate-400 text-sm">
            {busca ? `Sem resultados para "${busca}".` : 'Nenhum follow-up registrado ainda.'}
          </p>
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
              <Link
                key={fu.id}
                href={`/pacientes/${fu.paciente_id}?aba=follow-ups`}
                className="flex items-center gap-4 bg-white rounded-xl p-4 shadow-sm border border-slate-100 hover:border-[#006b5a]/30 hover:shadow-md active:scale-[0.99] transition-all group"
              >
                <div className="w-11 h-11 rounded-2xl bg-[#006b5a] flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm">
                  {iniciais(nome)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-900 leading-tight">{nome}</p>
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
                </div>
                <ChevronRight size={18} className="text-slate-300 group-hover:text-[#006b5a] group-hover:translate-x-0.5 transition-all shrink-0" />
              </Link>
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