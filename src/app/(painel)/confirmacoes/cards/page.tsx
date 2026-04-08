import { createClient } from '@/lib/supabase/server'
import { CardConfirmacaoPaciente } from '@/components/features/CardConfirmacaoPaciente'
import { buildSessaoEfetivaMap } from '@/lib/sessoes'
import { PhoneCall } from 'lucide-react'

function periodoParaContatarHoje(): Array<{ dataInicio: string; dataFim: string; label: string }> {
  const agora = new Date()
  const TZ = 'America/Sao_Paulo'

  // Retorna a data no calendário de Brasília (YYYY-MM-DD)
  const dateBRT = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)

  // Hora atual formatada em Brasília
  const horaAtualBRT = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(agora)

  const hojeString = dateBRT(agora)

  // "Amanhã em BRT" = agora + 24h, depois pegar a data BRT
  const amanha = new Date(agora.getTime() + 24 * 60 * 60 * 1000)
  const amanhaString = dateBRT(amanha)

  // "Depois de amanhã em BRT" para o fim do período de amanhã
  const depoisDeAmanha = new Date(agora.getTime() + 48 * 60 * 60 * 1000)
  const depoisDeAmanhaString = dateBRT(depoisDeAmanha)

  // Meia-noite de BRT equivale a 03:00 UTC (UTC-3, sem horário de verão desde 2019)
  const MIDNIGHT_BRT_IN_UTC = 'T03:00:00Z'

  return [
    // Hoje: atendimentos que ainda não passaram (≥ agora em UTC)
    {
      dataInicio: agora.toISOString(),
      dataFim: `${amanhaString}${MIDNIGHT_BRT_IN_UTC}`, // 23:59:59 BRT = 03:00 UTC do dia seguinte
      label: `hoje (a partir de ${horaAtualBRT})`,
    },
    // Amanhã: todos os atendimentos do dia inteiro
    {
      dataInicio: `${amanhaString}${MIDNIGHT_BRT_IN_UTC}`,        // 00:00 BRT = 03:00 UTC
      dataFim: `${depoisDeAmanhaString}${MIDNIGHT_BRT_IN_UTC}`,   // 23:59 BRT = 03:00 UTC do dia seguinte
      label: 'amanhã (todos)',
    },
  ]
}

export default async function CardsPage() {
  const supabase = await createClient()
  const periodos = periodoParaContatarHoje()

  if (periodos.length === 0) {
    return (
      <div className="w-full space-y-6">
        <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100">
          <PhoneCall size={24} className="text-[#006b5a]" />
          <h2 className="text-2xl font-bold tracking-tight text-[#006b5a]">Confirmações</h2>
        </div>

        <div className="text-center py-12 bg-white rounded-xl border border-slate-100 shadow-sm">
          <PhoneCall size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">Nenhuma confirmação pendente para hoje</p>
          <p className="text-sm text-slate-400 mt-2">Todas as consultas previstas já foram contatadas</p>
        </div>
      </div>
    )
  }

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
      profissional:profiles!profissional_id(id, full_name, role)
    `)
    .eq('status', 'Aguardando')
    .or('contato_confirmacao.is.null,contato_confirmacao.eq.nao_atendeu')
    .or(
      periodos
        .map(p => `and(data_agendamento.gte.${p.dataInicio},data_agendamento.lte.${p.dataFim})`)
        .join(',')
    )
    .order('data_agendamento', { ascending: true })

  // Buscar todas as sessões dos agendamentos relevantes para calcular números efetivos
  const agendamentoIds = [...new Set(
    (atendimentos ?? []).map(a => a.agendamento_id).filter(Boolean) as string[]
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

  const pacientesAContatar = (atendimentos ?? [])
    .filter(a => a.paciente)
    .map(a => {
      const efetivo = sessaoEfetivaMap.get(a.id)
      return {
        id: (a.paciente as any).id,
        atendimento_id: a.id,
        agendamento_id: a.agendamento_id as string | null,
        nome: (a.paciente as any).nome,
        telefone: (a.paciente as any).telefone,
        data_agendamento: a.data_agendamento,
        tipo: a.tipo,
        profissional_nome: (a.profissional as any)?.full_name || 'Profissional',
        numero_sessao: efetivo?.sessao_efetiva ?? a.numero_sessao ?? 1,
        total_sessoes: efetivo?.total_efetivo ?? a.total_sessoes ?? 1,
        contato_confirmacao: a.contato_confirmacao as string | null,
      }
    })

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100">
        <PhoneCall size={24} className="text-[#006b5a]" />
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#006b5a]">Confirmações</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {pacientesAContatar.length} {pacientesAContatar.length === 1 ? 'consulta para' : 'consultas para'} confirmar
          </p>
        </div>
      </div>

      {/* Data info */}
      <div className="bg-gradient-to-r from-[#006b5a]/5 to-[#33a68f]/5 border border-[#006b5a]/10 rounded-xl p-4">
        <p className="text-sm font-semibold text-[#006b5a]">
          📞 Confirmações de consultas de hoje
        </p>
        <p className="text-xs text-slate-600 mt-1">
          {periodos.map((p, idx) => (
            <span key={idx}>
              {idx > 0 && ' • '}
              {p.label}
            </span>
          ))}
        </p>
      </div>

      {/* Lista de pacientes */}
      {pacientesAContatar.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-100 shadow-sm">
          <PhoneCall size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">Nenhuma confirmação pendente</p>
          <p className="text-sm text-slate-400 mt-2">Todas as consultas previstas já foram contatadas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pacientesAContatar.map((paciente, idx) => (
            <CardConfirmacaoPaciente
              key={idx}
              paciente={paciente}
            />
          ))}
        </div>
      )}
    </div>
  )
}