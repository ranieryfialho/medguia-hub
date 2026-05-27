import { createClient } from '@/lib/supabase/server'
import { CardConfirmacaoPaciente } from '@/components/features/pacientes'
import { buildSessaoEfetivaMap } from '@/lib/sessoes'
import { PhoneCall, CalendarDays } from 'lucide-react'
import Link from 'next/link'
import { requireModulo } from '@/lib/guard'

type Periodo = {
  dataInicio: string
  dataFim: string
  label: string
  labelCurto: string
  diaSemana: string // 'hoje' | 'amanha' | 'segunda'
  dataExibicao: string // ex: "03/05"
}

type AtendimentoRow = {
  id: string
  agendamento_id: string | null
  data_agendamento: string
  tipo: string
  numero_sessao: number | null
  total_sessoes: number | null
  contato_confirmacao: string | null
  paciente: { id: string; nome: string; telefone: string; email: string | null } | null
  profissional: { full_name: string } | null
}

function periodoParaContatar(): { periodos: Periodo[]; isSexta: boolean } {
  const agora = new Date()
  const TZ = 'America/Sao_Paulo'

  const dateBRT = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)

  const horaAtualBRT = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(agora)

  const diaSemanaAtual = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'long',
  }).format(agora)

  const isSexta = diaSemanaAtual === 'Friday'

  const MIDNIGHT_BRT_IN_UTC = 'T03:00:00Z'

  const formatarDataExibicao = (d: Date) =>
    new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit' }).format(d)

  const amanhaDate = new Date(agora.getTime() + 24 * 60 * 60 * 1000)
  const amanhaString = dateBRT(amanhaDate)

  // Período de hoje: do agora até meia-noite BRT
  const periodoHoje: Periodo = {
    dataInicio: agora.toISOString(),
    dataFim: `${amanhaString}${MIDNIGHT_BRT_IN_UTC}`,
    label: `Hoje, a partir de ${horaAtualBRT}`,
    labelCurto: `a partir de ${horaAtualBRT}`,
    diaSemana: 'hoje',
    dataExibicao: formatarDataExibicao(agora),
  }

  if (isSexta) {
    // Sexta: busca hoje + segunda-feira (pula sábado e domingo)
    // Segunda = agora + 3 dias
    const segundaDate = new Date(agora.getTime() + 3 * 24 * 60 * 60 * 1000)
    const segundaString = dateBRT(segundaDate)
    const tercaDate = new Date(agora.getTime() + 4 * 24 * 60 * 60 * 1000)
    const tercaString = dateBRT(tercaDate)

    return {
      isSexta: true,
      periodos: [
        periodoHoje,
        {
          dataInicio: `${segundaString}${MIDNIGHT_BRT_IN_UTC}`,
          dataFim: `${tercaString}${MIDNIGHT_BRT_IN_UTC}`,
          label: `Segunda-feira, ${formatarDataExibicao(segundaDate)}`,
          labelCurto: 'dia todo',
          diaSemana: 'segunda',
          dataExibicao: formatarDataExibicao(segundaDate),
        },
      ],
    }
  }

  // Dias normais: hoje + amanhã
  const depoisDeAmanhaDate = new Date(agora.getTime() + 48 * 60 * 60 * 1000)
  const depoisDeAmanhaString = dateBRT(depoisDeAmanhaDate)

  return {
    isSexta: false,
    periodos: [
      periodoHoje,
      {
        dataInicio: `${amanhaString}${MIDNIGHT_BRT_IN_UTC}`,
        dataFim: `${depoisDeAmanhaString}${MIDNIGHT_BRT_IN_UTC}`,
        label: `Amanhã, ${formatarDataExibicao(amanhaDate)}`,
        labelCurto: 'dia todo',
        diaSemana: 'amanha',
        dataExibicao: formatarDataExibicao(amanhaDate),
      },
    ],
  }
}

export default async function CardsPage() {
  await requireModulo('confirmacoes:cards')

  const supabase = await createClient()
  const { periodos, isSexta } = periodoParaContatar()

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
      paciente:pacientes(id, nome, telefone, email),
      profissional:profiles!profissional_id(full_name)
    `)
    .eq('status', 'Aguardando')
    .or('contato_confirmacao.is.null,contato_confirmacao.eq.nao_atendeu')
    .or(
      periodos
        .map(p => `and(data_agendamento.gte.${p.dataInicio},data_agendamento.lte.${p.dataFim})`)
        .join(',')
    )
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

  // Mapear pacientes e associar ao período correto
  const pacientesPorPeriodo = periodos.map(periodo => {
    const lista = (atendimentos ?? [])
      .filter(a => {
        if (!a.paciente) return false
        const dataAt = new Date(a.data_agendamento).getTime()
        return (
          dataAt >= new Date(periodo.dataInicio).getTime() &&
          dataAt <= new Date(periodo.dataFim).getTime()
        )
      })
      .map(a => {
        const efetivo = sessaoEfetivaMap.get(a.id)
        return {
          id: a.paciente!.id,
          atendimento_id: a.id,
          agendamento_id: a.agendamento_id,
          nome: a.paciente!.nome,
          telefone: a.paciente!.telefone,
          email: a.paciente!.email,
          data_agendamento: a.data_agendamento,
          tipo: a.tipo,
          profissional_nome: a.profissional?.full_name || 'Profissional',
          numero_sessao: efetivo?.sessao_efetiva ?? a.numero_sessao ?? 1,
          total_sessoes: efetivo?.total_efetivo ?? a.total_sessoes ?? 1,
          contato_confirmacao: a.contato_confirmacao,
        }
      })

    return { periodo, lista }
  })

  const totalConsultas = pacientesPorPeriodo.reduce((acc, g) => acc + g.lista.length, 0)

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <PhoneCall size={24} className="text-[#006b5a]" />
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[#006b5a]">Confirmações</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {totalConsultas} {totalConsultas === 1 ? 'consulta para' : 'consultas para'} confirmar
            </p>
          </div>
        </div>
        <Link
          href="/confirmacoes/semana"
          className="text-xs font-semibold text-[#006b5a] bg-[#006b5a]/10 hover:bg-[#006b5a]/20 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
        >
          Ver semana →
        </Link>
      </div>

      {/* Banner contextual */}
      {isSexta ? (
        <div className="bg-linear-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <CalendarDays size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-700">Rotina de sexta-feira</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Confirme as consultas de hoje e antecipe os pacientes de segunda-feira — eles precisam ser avisados ainda hoje.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-linear-to-r from-[#006b5a]/5 to-[#33a68f]/5 border border-[#006b5a]/10 rounded-xl p-4 flex items-start gap-3">
          <PhoneCall size={16} className="text-[#006b5a] mt-0.5 shrink-0" />
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-[#006b5a]">Confirmações do dia</span>
            {' '}— consultas de hoje (restantes) e de amanhã.
          </p>
        </div>
      )}

      {/* Lista agrupada por período */}
      {totalConsultas === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-100 shadow-sm">
          <PhoneCall size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">Nenhuma confirmação pendente</p>
          <p className="text-sm text-slate-400 mt-2">Todas as consultas previstas já foram contatadas</p>
        </div>
      ) : (
        <div className="space-y-6">
          {pacientesPorPeriodo.map(({ periodo, lista }) => {
            if (lista.length === 0) return null
            return (
              <div key={periodo.diaSemana} className="space-y-3">
                {/* Cabeçalho do grupo */}
                <div className={`flex items-center gap-3 px-1 ${
                  periodo.diaSemana === 'segunda'
                    ? 'text-amber-700'
                    : 'text-[#006b5a]'
                }`}>
                  <div className={`h-px flex-1 ${
                    periodo.diaSemana === 'segunda' ? 'bg-amber-200' : 'bg-[#006b5a]/20'
                  }`} />
                  <span className="text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                    {periodo.label}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    periodo.diaSemana === 'segunda'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-[#006b5a]/10 text-[#006b5a]'
                  }`}>
                    {lista.length} {lista.length === 1 ? 'consulta' : 'consultas'}
                  </span>
                  <div className={`h-px flex-1 ${
                    periodo.diaSemana === 'segunda' ? 'bg-amber-200' : 'bg-[#006b5a]/20'
                  }`} />
                </div>

                {/* Cards do grupo */}
                {lista.map((paciente, idx) => (
                  <CardConfirmacaoPaciente
                    key={idx}
                    paciente={paciente}
                    showDate={periodo.diaSemana !== 'hoje'}
                  />
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
