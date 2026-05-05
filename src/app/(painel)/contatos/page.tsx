import { createClient } from '@/lib/supabase/server'
import { KanbanContatos } from '@/components/features/KanbanContatos'
import type { StatusContato } from '@/actions/contatos'
import {
  normalizarColunasContato,
  type KanbanColunaContato,
} from '@/lib/contatos-kanban'
import {
  criarMapaUltimoAtendimento,
  listarUltimosAtendimentosPorPacientes,
  type UltimoAtendimentoClient,
} from '@/lib/ultimo-atendimento'
import { Target } from 'lucide-react'
import { requireModulo } from '@/lib/guard'

export type ContatoPaciente = {
  id: string
  nome: string
  telefone: string
  email: string | null
  recuperacao_base: boolean
  status: StatusContato
  kanban_coluna_chave: string
  responsavel_id: string | null
  responsavel_nome: string | null
  ultimo_atendimento_data: string | null
  ultimo_atendimento_tipo: string | null
}

export type ProfileSimples = { id: string; full_name: string }

const HISTORICO_ATENDIMENTOS_ANOS = 2

async function fetchAll<T>(
  fetcher: (from: number, to: number) => PromiseLike<{ data: T[] | null }>
): Promise<T[]> {
  const SIZE = 1000
  const acc: T[] = []
  let page = 0
  while (true) {
    const { data } = await fetcher(page * SIZE, (page + 1) * SIZE - 1)
    if (!data?.length) break
    acc.push(...data)
    if (data.length < SIZE) break
    page++
  }
  return acc
}

export default async function ContatosPage() {
  await requireModulo('contatos:base')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const atendimentoCutoff = new Date()
  atendimentoCutoff.setFullYear(atendimentoCutoff.getFullYear() - HISTORICO_ATENDIMENTOS_ANOS)
  const atendimentoCutoffIso = atendimentoCutoff.toISOString()

  const [pacientes, contatos, { data: profiles }, templates, { data: profile }, { data: kanbanColumnsRaw }] = await Promise.all([
    fetchAll((from, to) =>
      supabase.from('pacientes').select('id, nome, telefone, email, recuperacao_base').eq('ativo', true).order('nome').range(from, to)
    ),
    fetchAll((from, to) =>
      supabase.from('contatos_base').select('paciente_id, status, kanban_coluna_chave, responsavel_id').range(from, to)
    ),
    supabase.from('profiles').select('id, full_name').eq('ativo', true).neq('role', 'master').neq('role', 'medico').order('full_name'),
    user
      ? supabase
          .from('templates_mensagem')
          .select('id, nome, conteudo, criado_por')
          .or(`criado_por.is.null,criado_por.eq.${user.id}`)
          .eq('categoria', 'reativacao')
          .order('criado_em', { ascending: true })
          .then(({ data }) => data ?? [])
      : Promise.resolve([]),
    user
      ? supabase.from('profiles').select('role, nivel_acesso').eq('id', user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('kanban_colunas_contatos')
      .select('chave, nome, tipo, status_base, cor_chave, ordem')
      .order('ordem', { ascending: true }),
  ])
  const atendimentos = await listarUltimosAtendimentosPorPacientes(
    supabase as unknown as UltimoAtendimentoClient,
    pacientes.map((paciente) => paciente.id),
    atendimentoCutoffIso
  )

  const contatosMap = new Map(contatos.map(c => [c.paciente_id, c]))
  const profilesMap = new Map((profiles ?? []).map(p => [p.id, p]))
  const kanbanColumns = normalizarColunasContato((kanbanColumnsRaw ?? null) as KanbanColunaContato[] | null)
  const ultimoAtendimentoMap = criarMapaUltimoAtendimento(atendimentos)

  const data: ContatoPaciente[] = pacientes.map(p => {
    const c = contatosMap.get(p.id)
    const ua = ultimoAtendimentoMap.get(p.id)
    const responsavelNome = c?.responsavel_id ? profilesMap.get(c.responsavel_id)?.full_name ?? null : null
    return {
      id: p.id,
      nome: p.nome,
      telefone: p.telefone,
      email: p.email,
      recuperacao_base: p.recuperacao_base,
      status: (c?.status ?? (p.recuperacao_base ? 'recuperacao_base' : 'a_contactar')) as StatusContato,
      kanban_coluna_chave: c?.kanban_coluna_chave ?? c?.status ?? (p.recuperacao_base ? 'recuperacao_base' : 'a_contactar'),
      responsavel_id: c?.responsavel_id ?? null,
      responsavel_nome: responsavelNome,
      ultimo_atendimento_data: ua?.data ?? null,
      ultimo_atendimento_tipo: ua?.tipo ?? null,
    }
  })

  const totalPacientes = data.length

  return (
    <div className="space-y-6 sm:space-y-8 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="p-3 bg-gradient-to-br from-[#f0fcf9] to-[#e6f9f5] border border-[#c3ede6] rounded-2xl shadow-sm shrink-0">
            <Target size={24} className="text-[#006b5a]" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#083142] tracking-tight">Base de Contatos</h1>
            <p className="text-sm sm:text-base text-[#6d7a75] mt-0.5">Gerencie o relacionamento com os pacientes</p>
          </div>
        </div>
        <div className="sm:ml-auto inline-flex items-center self-start sm:self-auto text-sm text-[#083142] bg-white border border-[#dee3e3] px-4 py-2 rounded-xl font-semibold shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#006b5a] mr-2 animate-pulse"></span>
          {totalPacientes} pacientes ativos
        </div>
      </div>

      <KanbanContatos
        contatos={data}
        profiles={profiles ?? []}
        templates={templates}
        columns={kanbanColumns}
        userNivelAcesso={profile?.nivel_acesso ?? ''}
      />
    </div>
  )
}
