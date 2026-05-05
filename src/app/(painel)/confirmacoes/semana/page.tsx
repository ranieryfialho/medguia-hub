import { createClient } from '@/lib/supabase/server'
import { buildSessaoEfetivaMap } from '@/lib/sessoes'
import { CalendarDays, User } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
import { requireModulo } from '@/lib/guard'

const TZ = 'America/Sao_Paulo'
const MIDNIGHT_BRT_IN_UTC = 'T03:00:00Z'

const ABAS = ['seg', 'ter', 'qua', 'qui', 'sex'] as const
type AbaKey = typeof ABAS[number]

const NOME_DIA: Record<AbaKey, string> = {
  seg: 'Segunda', ter: 'Terça', qua: 'Quarta', qui: 'Quinta', sex: 'Sexta',
}

const STATUS_CONFIG: Record<string, { label: string; cor: string; bg: string }> = {
  confirmou:   { label: 'Confirmado',  cor: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  vai_faltar:  { label: 'Vai faltar',  cor: 'text-red-600',     bg: 'bg-red-50 border-red-200' },
  nao_atendeu: { label: 'Não atendeu', cor: 'text-orange-600',  bg: 'bg-orange-50 border-orange-200' },
  reagendou:   { label: 'Reagendado',  cor: 'text-slate-600',   bg: 'bg-slate-50 border-slate-200' },
  pendente:    { label: 'Pendente',    cor: 'text-slate-400',   bg: 'bg-white border-slate-100' },
}

type AtendimentoRow = {
  id: string
  agendamento_id: string | null
  data_agendamento: string
  tipo: string
  numero_sessao: number | null
  total_sessoes: number | null
  contato_confirmacao: string | null
  paciente: { id: string; nome: string; telefone: string } | null
  profissional: { full_name: string } | null
}

function semanaAtual() {
  const agora = new Date()

  const dateBRT = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)

  // Dia da semana em BRT (0=Dom, 1=Seg, ..., 6=Sab)
  const dow = agora.toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short' })
  const dowIndex = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(dow)

  // Offset em dias até segunda desta semana
  const offsetAteSeg = dowIndex === 0 ? 1 : dowIndex === 6 ? 2 : -(dowIndex - 1)
  const segunda = new Date(agora.getTime() + offsetAteSeg * 24 * 60 * 60 * 1000)

  const hojeISO = dateBRT(agora)

  const dias = ABAS.map((aba, i) => {
    const d = new Date(segunda.getTime() + i * 24 * 60 * 60 * 1000)
    const prox = new Date(segunda.getTime() + (i + 1) * 24 * 60 * 60 * 1000)
    return {
      aba,
      dataInicio: `${dateBRT(d)}${MIDNIGHT_BRT_IN_UTC}`,
      dataFim: `${dateBRT(prox)}${MIDNIGHT_BRT_IN_UTC}`,
      dataObj: d,
      dataISO: dateBRT(d),
      isHoje: dateBRT(d) === hojeISO,
    }
  })

  // Aba padrão: hoje se for dia útil, senão segunda
  const abaHoje = dias.find(d => d.isHoje)?.aba ?? 'seg'

  return { dias, dataInicioSemana: dias[0].dataInicio, dataFimSemana: dias[4].dataFim, abaHoje }
}

export default async function SemanaPage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string }>
}) {
  await requireModulo('confirmacoes:semana')

  const supabase = await createClient()
  const { dias, dataInicioSemana, dataFimSemana, abaHoje } = semanaAtual()

  const { dia: diaParam } = await searchParams
  const abaAtiva: AbaKey = ABAS.includes(diaParam as AbaKey) ? (diaParam as AbaKey) : abaHoje

  const { data: atendimentos } = await supabase
    .from('atendimentos')
    .select(`
      id,
      agendamento_id,
      data_agendamento,
      tipo,
      numero_sessao,
      total_sessoes,
      contato_confirmacao,
      paciente:pacientes(id, nome, telefone),
      profissional:profiles!profissional_id(full_name)
    `)
    .eq('status', 'Aguardando')
    .gte('data_agendamento', dataInicioSemana)
    .lte('data_agendamento', dataFimSemana)
    .order('data_agendamento', { ascending: true }) as { data: AtendimentoRow[] | null }

  const agendamentoIds = [...new Set(
    (atendimentos ?? [])
      .filter(a => !!a.agendamento_id && (a.total_sessoes ?? 0) > 1)
      .map(a => a.agendamento_id) as string[]
  )]
  let sessaoEfetivaMap = new Map<string, { sessao_efetiva: number; total_efetivo: number }>()
  if (agendamentoIds.length > 0) {
    const { data: todasSessoes } = await supabase
      .from('atendimentos')
      .select('id, agendamento_id, data_agendamento, status')
      .in('agendamento_id', agendamentoIds)
    if (todasSessoes) {
      sessaoEfetivaMap = buildSessaoEfetivaMap(todasSessoes)
    }
  }

  // Agrupar por dia
  const porDia = dias.map(dia => {
    const lista = (atendimentos ?? [])
      .filter(a => {
        const t = new Date(a.data_agendamento).getTime()
        return t >= new Date(dia.dataInicio).getTime() && t < new Date(dia.dataFim).getTime()
      })
      .map(a => {
        const ef = sessaoEfetivaMap.get(a.id)
        return {
          ...a,
          numero_sessao: ef?.sessao_efetiva ?? a.numero_sessao ?? 1,
          total_sessoes: ef?.total_efetivo ?? a.total_sessoes ?? 1,
        }
      })

    return {
      dia,
      lista,
      confirmados: lista.filter(a => a.contato_confirmacao === 'confirmou').length,
      pendentes:   lista.filter(a => !a.contato_confirmacao || a.contato_confirmacao === 'nao_atendeu').length,
    }
  })

  const totalSemana      = porDia.reduce((acc, g) => acc + g.lista.length, 0)
  const totalConfirmados = porDia.reduce((acc, g) => acc + g.confirmados, 0)
  const totalPendentes   = porDia.reduce((acc, g) => acc + g.pendentes, 0)

  const labelSemana = `${format(new Date(dias[0].dataObj), 'dd/MM', { locale: ptBR })} – ${format(new Date(dias[4].dataObj), 'dd/MM', { locale: ptBR })}`

  const diaAtivo = porDia.find(g => g.dia.aba === abaAtiva)!

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3 min-w-0">
          <CalendarDays size={24} className="text-[#006b5a] shrink-0" />
          <div className="min-w-0">
            <h2 className="text-2xl font-bold tracking-tight text-[#006b5a]">Semana</h2>
            <p className="text-xs text-slate-500 mt-0.5">{labelSemana}</p>
          </div>
        </div>
        <Link
          href="/confirmacoes/cards"
          className="text-xs font-semibold text-[#006b5a] bg-[#006b5a]/10 hover:bg-[#006b5a]/20 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <span className="hidden sm:inline">Fila do dia →</span>
          <span className="sm:hidden">Fila →</span>
        </Link>
      </div>

      {/* Resumo da semana */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <div className="bg-white border border-slate-100 rounded-xl p-3 md:p-4 text-center shadow-sm">
          <p className="text-xl md:text-2xl font-bold text-slate-800">{totalSemana}</p>
          <p className="text-[10px] md:text-xs text-slate-500 mt-0.5 md:mt-1">na semana</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 md:p-4 text-center shadow-sm">
          <p className="text-xl md:text-2xl font-bold text-emerald-700">{totalConfirmados}</p>
          <p className="text-[10px] md:text-xs text-emerald-600 mt-0.5 md:mt-1">confirmadas</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 md:p-4 text-center shadow-sm">
          <p className="text-xl md:text-2xl font-bold text-amber-700">{totalPendentes}</p>
          <p className="text-[10px] md:text-xs text-amber-600 mt-0.5 md:mt-1">pendentes</p>
        </div>
      </div>

      {/* Abas dos dias */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Barra de abas */}
        <div className="flex border-b border-slate-100">
          {porDia.map(({ dia, lista, pendentes }) => {
            const isAtiva = dia.aba === abaAtiva
            return (
              <Link
                key={dia.aba}
                href={`/confirmacoes/semana?dia=${dia.aba}`}
                className={`flex-1 flex flex-col items-center py-2.5 px-0.5 text-center transition-colors relative min-w-0 ${
                  isAtiva
                    ? 'text-[#006b5a] bg-[#006b5a]/5'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                {/* Indicador ativo */}
                {isAtiva && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#006b5a] rounded-t-full" />
                )}

                <span className={`text-xs font-bold leading-none ${isAtiva ? 'text-[#006b5a]' : 'text-slate-600'}`}>
                  {NOME_DIA[dia.aba].slice(0, 3)}
                </span>
                <span className="hidden sm:block text-[10px] text-slate-400 mt-0.5">
                  {format(new Date(dia.dataObj), 'dd/MM')}
                </span>
                <span className="sm:hidden text-[10px] text-slate-400 mt-0.5">
                  {format(new Date(dia.dataObj), 'dd')}
                </span>

                {/* Badges */}
                <div className="flex items-center justify-center gap-0.5 mt-1 h-4">
                  {dia.isHoje && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#006b5a] shrink-0" title="Hoje" />
                  )}
                  {lista.length > 0 && (
                    <span className={`text-[10px] font-semibold px-1 py-0.5 rounded-full leading-none ${
                      pendentes > 0
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {lista.length}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>

        {/* Conteúdo da aba ativa */}
        <div>
          {diaAtivo.lista.length === 0 ? (
            <div className="text-center py-12">
              <CalendarDays size={36} className="mx-auto text-slate-200 mb-3" />
              <p className="text-sm text-slate-400 font-medium">
                Nenhuma consulta para {NOME_DIA[abaAtiva].toLowerCase()}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {diaAtivo.lista.map(a => {
                const statusKey = a.contato_confirmacao ?? 'pendente'
                const status = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.pendente
                const iniciais = (a.paciente?.nome ?? '?')
                  .split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()

                return (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-lg bg-[#006b5a]/10 text-[#006b5a] flex items-center justify-center text-xs font-bold shrink-0">
                      {iniciais}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-slate-900 truncate">
                          {a.paciente?.nome ?? '—'}
                        </span>
                        {a.total_sessoes > 1 && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 bg-[#006b5a]/10 text-[#006b5a] rounded-full whitespace-nowrap shrink-0">
                            {a.numero_sessao}/{a.total_sessoes}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {a.tipo} • {format(new Date(a.data_agendamento), 'HH:mm')}
                        {a.profissional?.full_name && (
                          <span className="hidden sm:inline">
                            {' '}•{' '}
                            <User size={10} className="inline mb-px" />
                            {' '}{a.profissional.full_name}
                          </span>
                        )}
                      </p>
                      {a.profissional?.full_name && (
                        <p className="sm:hidden text-[10px] text-slate-400 mt-0.5 truncate flex items-center gap-1">
                          <User size={10} className="shrink-0" />
                          {a.profissional.full_name}
                        </p>
                      )}
                    </div>

                    {/* Status badge */}
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border whitespace-nowrap shrink-0 ${status.bg} ${status.cor}`}>
                      {status.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
