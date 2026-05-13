import { createClient } from '@/lib/supabase/server'
import { normalizarColunasContato, type KanbanColunaContato } from '@/lib/contatos-kanban'
import {
  CONTATOS_KANBAN_PAGE_SIZE,
  listarContatosKanbanBoard,
  listarContatosKanbanColumnPage,
} from '@/lib/contatos-kanban-data'

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const busca = searchParams.get('search')
    const responsavelFilter = searchParams.get('responsavel')
    const columnKey = searchParams.get('columnKey')
    const limit = parsePositiveInt(searchParams.get('limit'), CONTATOS_KANBAN_PAGE_SIZE)
    const offset = parsePositiveInt(searchParams.get('offset'), 0)

    const { data: kanbanColumnsRaw, error: kanbanColumnsError } = await supabase
      .from('kanban_colunas_contatos')
      .select('chave, nome, tipo, status_base, cor_chave, ordem')
      .order('ordem', { ascending: true })

    if (kanbanColumnsError) {
      return Response.json({ error: kanbanColumnsError.message }, { status: 500 })
    }

    const columns = normalizarColunasContato((kanbanColumnsRaw ?? null) as KanbanColunaContato[] | null)

    if (columnKey) {
      const page = await listarContatosKanbanColumnPage(supabase, {
        columnKey,
        offset,
        limit,
        busca,
        responsavelFilter,
      })

      return Response.json(page)
    }

    const board = await listarContatosKanbanBoard(supabase, {
      columns,
      pageSize: limit,
      busca,
      responsavelFilter,
    })

    return Response.json(board)
  } catch (error) {
    console.error('Erro ao carregar kanban de contatos:', error)
    return Response.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
