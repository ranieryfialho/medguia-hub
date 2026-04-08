import { createClient } from '@/lib/supabase/server'
import { KanbanContatos } from '@/components/features/KanbanContatos'
import { listarTemplates } from '@/actions/templates'
import type { StatusContato } from '@/actions/contatos'
import { Target } from 'lucide-react'

export type ContatoPaciente = {
  id: string
  nome: string
  telefone: string
  email: string | null
  status: StatusContato
  responsavel_id: string | null
  responsavel_nome: string | null
  ultimo_atendimento_data: string | null
  ultimo_atendimento_tipo: string | null
}

export type ProfileSimples = { id: string; full_name: string }

export default async function ContatosPage() {
  const supabase = await createClient()

  const [
    { data: pacientes },
    { data: contatos },
    { data: profiles },
    { data: atendimentos },
    templates,
  ] = await Promise.all([
    supabase.from('pacientes').select('id, nome, telefone, email').eq('ativo', true).order('nome'),
    supabase.from('contatos_base').select('paciente_id, status, responsavel_id'),
    supabase.from('profiles').select('id, full_name').eq('ativo', true).neq('role', 'master').order('full_name'),
    supabase.from('atendimentos').select('paciente_id, data_agendamento, tipo').order('data_agendamento', { ascending: false }),
    listarTemplates('reativacao'),
  ])

  const contatosMap = new Map((contatos ?? []).map(c => [c.paciente_id, c]))
  const profilesMap = new Map((profiles ?? []).map(p => [p.id, p]))

  const ultimoAtendimentoMap = new Map<string, { data: string; tipo: string }>()
  for (const a of atendimentos ?? []) {
    if (!ultimoAtendimentoMap.has(a.paciente_id)) {
      ultimoAtendimentoMap.set(a.paciente_id, { data: a.data_agendamento, tipo: a.tipo })
    }
  }

  const data: ContatoPaciente[] = (pacientes ?? []).map(p => {
    const c = contatosMap.get(p.id)
    const ua = ultimoAtendimentoMap.get(p.id)
    const responsavelNome = c?.responsavel_id ? profilesMap.get(c.responsavel_id)?.full_name ?? null : null
    return {
      id: p.id,
      nome: p.nome,
      telefone: p.telefone,
      email: p.email,
      status: (c?.status ?? 'a_contactar') as StatusContato,
      responsavel_id: c?.responsavel_id ?? null,
      responsavel_nome: responsavelNome,
      ultimo_atendimento_data: ua?.data ?? null,
      ultimo_atendimento_tipo: ua?.tipo ?? null,
    }
  })

  const totalPacientes = data.length

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-[#f0fcf9] border border-[#c3ede6] rounded-xl">
          <Target size={20} className="text-[#006b5a]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#083142]">Base de Contatos</h1>
          <p className="text-sm text-[#6d7a75]">Gerencie o contato com todos os pacientes ativos</p>
        </div>
        <div className="ml-auto text-sm text-[#6d7a75] bg-white border border-[#dee3e3] px-3 py-1.5 rounded-lg font-medium">
          {totalPacientes} pacientes
        </div>
      </div>

      <KanbanContatos contatos={data} profiles={profiles ?? []} templates={templates} />
    </div>
  )
}