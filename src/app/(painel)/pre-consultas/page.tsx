import { createClient } from '@/lib/supabase/server'
import { requireModulo } from '@/lib/guard'
import { listarFisioterapeutas } from '@/actions/agenda'
import { CardPreConsultaPendente, type PreConsultaPendente } from '@/components/features/pre-consultas/CardPreConsultaPendente'
import { Stethoscope } from 'lucide-react'

export default async function PreConsultasPage() {
  await requireModulo('pre_consultas')

  const supabase = await createClient()

  const [{ data: pendentes }, fisioterapeutas] = await Promise.all([
    supabase
      .from('atendimentos')
      .select(`
        id,
        tipo,
        created_at,
        agendamento_origem_id,
        direcao_encaminhamento,
        paciente:pacientes(id, nome, telefone)
      `)
      .eq('status', 'Aguardando Fisioterapeuta')
      .order('created_at', { ascending: true }),
    listarFisioterapeutas(),
  ])

  const lista = (pendentes ?? []) as Array<{
    id: string
    tipo: string
    created_at: string
    agendamento_origem_id: string | null
    direcao_encaminhamento: 'pre' | 'pos' | null
    paciente: { id: string; nome: string; telefone: string | null } | { id: string; nome: string; telefone: string | null }[] | null
  }>

  const origemIds = [...new Set(lista.map((p) => p.agendamento_origem_id).filter((id): id is string => !!id))]
  const origensMap = new Map<string, { data_agendamento: string; tipo: string | null; profissionalNome: string | null }>()

  if (origemIds.length > 0) {
    const { data: origens } = await supabase
      .from('atendimentos')
      .select('id, data_agendamento, tipo, profissional:profiles!profissional_id(full_name)')
      .in('id', origemIds)

    for (const origem of (origens ?? []) as Array<{
      id: string
      data_agendamento: string
      tipo: string | null
      profissional: { full_name: string | null } | { full_name: string | null }[] | null
    }>) {
      const profissional = Array.isArray(origem.profissional) ? origem.profissional[0] ?? null : origem.profissional
      origensMap.set(origem.id, {
        data_agendamento: origem.data_agendamento,
        tipo: origem.tipo,
        profissionalNome: profissional?.full_name ?? null,
      })
    }
  }

  const preConsultas: PreConsultaPendente[] = lista.map((p) => ({
    id: p.id,
    tipo: p.tipo,
    created_at: p.created_at,
    direcao_encaminhamento: p.direcao_encaminhamento,
    paciente: Array.isArray(p.paciente) ? p.paciente[0] ?? null : p.paciente,
    origem: p.agendamento_origem_id ? origensMap.get(p.agendamento_origem_id) ?? null : null,
  }))

  const totalPos = preConsultas.filter((p) => p.direcao_encaminhamento === 'pos').length

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100">
        <Stethoscope size={22} className="text-[#006b5a] shrink-0" />
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#006b5a]">Pré-consultas pendentes</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {preConsultas.length} {preConsultas.length === 1 ? 'pendente' : 'pendentes'} aguardando atribuição de fisioterapeuta
            {totalPos > 0 ? ` — ${totalPos} ${totalPos === 1 ? 'já é pós-consulta' : 'já são pós-consulta'}` : ''}
          </p>
        </div>
      </div>

      {preConsultas.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-100 shadow-sm">
          <Stethoscope size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">Nenhuma pré-consulta pendente</p>
        </div>
      ) : (
        <div className="space-y-3">
          {preConsultas.map((pendente) => (
            <CardPreConsultaPendente key={pendente.id} pendente={pendente} fisioterapeutas={fisioterapeutas} />
          ))}
        </div>
      )}
    </div>
  )
}
