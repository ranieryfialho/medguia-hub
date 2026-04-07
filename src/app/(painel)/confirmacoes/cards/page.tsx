import { createClient } from '@/lib/supabase/server'
import { CardConfirmacaoPaciente } from '@/components/features/CardConfirmacaoPaciente'
import { PhoneCall } from 'lucide-react'
import { format } from 'date-fns'

function periodoParaContatarHoje(): Array<{ dataInicio: string; dataFim: string; corteHora: string }> {
  const hoje = new Date()
  const periodos: Array<{ dataInicio: string; dataFim: string; corteHora: string }> = []

  // Regra: consultas de tarde (≥13:00) são contatadas HOJE a partir das 13:00
  const hojeString = hoje.toISOString().split('T')[0]
  periodos.push({
    dataInicio: `${hojeString}T13:00:00Z`,
    dataFim: `${hojeString}T23:59:59Z`,
    corteHora: '13:00',
  })

  // Regra: consultas de manhã (<13:00) amanhã são contatadas HOJE a partir das 00:00
  const amanha = new Date(hoje)
  amanha.setDate(hoje.getDate() + 1)
  const amanhaString = amanha.toISOString().split('T')[0]
  if (amanha.getDay() !== 0) { // ignora se amanhã for domingo
    periodos.push({
      dataInicio: `${amanhaString}T00:00:00Z`,
      dataFim: `${amanhaString}T12:59:59Z`,
      corteHora: '12:59',
    })
  }

  // Exceção: se hoje é sexta (5), contatar para segunda
  if (hoje.getDay() === 5) {
    const proxSegunda = new Date(hoje)
    proxSegunda.setDate(hoje.getDate() + 3)
    const segundaString = proxSegunda.toISOString().split('T')[0]
    periodos.push({
      dataInicio: `${segundaString}T00:00:00Z`,
      dataFim: `${segundaString}T23:59:59Z`,
      corteHora: '00:00',
    })
  }

  return periodos
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
          {periodos.map((p, idx) => {
            const data = p.dataInicio.split('T')[0]
            const horaInfo = p.corteHora === '00:00' ? 'todas' : `a partir de ${p.corteHora}`
            return (
              <span key={idx}>
                {idx > 0 && ' • '}
                {format(new Date(`${data}T00:00:00`), "dd/MM")} ({horaInfo})
              </span>
            )
          })}
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