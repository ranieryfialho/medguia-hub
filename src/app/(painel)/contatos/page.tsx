import { createClient } from '@/lib/supabase/server'
import { KanbanContatos } from '@/components/features/contatos'
import {
  normalizarColunasContato,
  type KanbanColunaContato,
} from '@/lib/contatos-kanban'
import {
  CONTATOS_KANBAN_PAGE_SIZE,
  listarContatosKanbanBoard,
  listarResponsavelStatsContatosKanban,
} from '@/lib/contatos-kanban-data'
import { Target } from 'lucide-react'
import { requireModulo } from '@/lib/guard'

export default async function ContatosPage() {
  const { user, profile } = await requireModulo('contatos:base')

  const supabase = await createClient()

  const [{ data: profiles }, templates, { data: kanbanColumnsRaw }] = await Promise.all([
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
    supabase
      .from('kanban_colunas_contatos')
      .select('chave, nome, tipo, status_base, cor_chave, ordem')
      .order('ordem', { ascending: true }),
  ])

  const kanbanColumns = normalizarColunasContato((kanbanColumnsRaw ?? null) as KanbanColunaContato[] | null)
  const [initialBoard, responsavelStats] = await Promise.all([
    listarContatosKanbanBoard(supabase, {
      columns: kanbanColumns,
      pageSize: CONTATOS_KANBAN_PAGE_SIZE,
    }),
    listarResponsavelStatsContatosKanban(supabase),
  ])
  const totalPacientes = initialBoard.totalFiltered

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
        initialBoard={initialBoard}
        profiles={profiles ?? []}
        responsavelCounts={responsavelStats.responsavelCounts}
        semResponsavelCount={responsavelStats.semResponsavelCount}
        templates={templates}
        columns={kanbanColumns}
        userNivelAcesso={profile?.nivel_acesso ?? ''}
      />
    </div>
  )
}
