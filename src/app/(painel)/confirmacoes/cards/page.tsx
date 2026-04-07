import { createClient } from '@/lib/supabase/server'
import { CardConfirmacaoPaciente } from '@/components/features/CardConfirmacaoPaciente'
import { PhoneCall } from 'lucide-react'

function periodoParaContatarHoje(): Array<{ dataInicio: string; dataFim: string; label: string }> {
  const agora = new Date()
  const hojeString = agora.toISOString().split('T')[0]

  const amanha = new Date(agora)
  amanha.setUTCDate(agora.getUTCDate() + 1)
  const amanhaString = amanha.toISOString().split('T')[0]

  return [
    // Hoje: apenas atendimentos que ainda não passaram (≥ agora)
    {
      dataInicio: agora.toISOString(),
      dataFim: `${hojeString}T23:59:59Z`,
      label: `hoje (a partir de ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`,
    },
    // Amanhã: todos os atendimentos do dia
    {
      dataInicio: `${amanhaString}T00:00:00Z`,
      dataFim: `${amanhaString}T23:59:59Z`,
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

  // Buscar atendimentos + pacientes e profissionais para o slide de reagendamento
  const [
    { data: atendimentos },
    { data: pacientesLista },
    { data: profissionaisLista },
  ] = await Promise.all([
    supabase
      .from('atendimentos')
      .select(`
        id,
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
      .order('data_agendamento', { ascending: true }),
    supabase.from('pacientes').select('id, nome').order('nome'),
    supabase.from('profiles').select('id, full_name, role').order('full_name'),
  ])

  const pacientesAContatar = (atendimentos ?? [])
    .filter(a => a.paciente)
    .map(a => ({
      id: (a.paciente as any).id,
      atendimento_id: a.id,
      nome: (a.paciente as any).nome,
      telefone: (a.paciente as any).telefone,
      data_agendamento: a.data_agendamento,
      tipo: a.tipo,
      profissional_nome: (a.profissional as any)?.full_name || 'Profissional',
      numero_sessao: a.numero_sessao || 1,
      total_sessoes: a.total_sessoes || 1,
      contato_confirmacao: a.contato_confirmacao as string | null,
    }))

  const pacientesSlide = (pacientesLista ?? []).map(p => ({ id: p.id, nome: p.nome }))
  const profissionaisSlide = (profissionaisLista ?? []).map(p => ({
    id: p.id,
    nome: p.full_name || '',
    cargo: p.role || '',
  }))

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
              pacientesSlide={pacientesSlide}
              profissionaisSlide={profissionaisSlide}
            />
          ))}
        </div>
      )}
    </div>
  )
}