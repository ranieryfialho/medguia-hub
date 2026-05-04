export type UltimoAtendimentoClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{
    data: unknown
    error: { message?: string; code?: string } | null
  }>
  from: (table: string) => {
    select: (columns: string) => {
      in: (column: string, values: string[]) => {
        gte: (column: string, value: string) => {
          order: (column: string, options?: { ascending?: boolean }) => {
            range: (
              from: number,
              to: number
            ) => PromiseLike<{ data: unknown[] | null }>
          }
        }
      }
    }
  }
}

export type UltimoAtendimentoResumo = {
  paciente_id: string
  data_agendamento: string
  tipo: string | null
}

const PAGE_SIZE = 1000

async function fetchAll<T>(
  fetcher: (from: number, to: number) => PromiseLike<{ data: T[] | null }>
): Promise<T[]> {
  const acc: T[] = []
  let page = 0

  while (true) {
    const { data } = await fetcher(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    if (!data?.length) break
    acc.push(...data)
    if (data.length < PAGE_SIZE) break
    page++
  }

  return acc
}

function isFunctionMissing(error: { message?: string; code?: string } | null) {
  if (!error) return false
  return error.code === 'PGRST202' || error.message?.includes('Could not find the function') === true
}

export async function listarUltimosAtendimentosPorPacientes(
  supabase: UltimoAtendimentoClient,
  pacienteIds: string[],
  dataMinIso?: string
): Promise<UltimoAtendimentoResumo[]> {
  if (!pacienteIds.length) return []

  const { data, error } = await supabase.rpc('fn_ultimo_atendimento_por_pacientes', {
    p_ids: pacienteIds,
    p_data_min: dataMinIso ?? null,
  })

  if (!error && Array.isArray(data)) {
    return data as UltimoAtendimentoResumo[]
  }

  if (!isFunctionMissing(error)) {
    console.error('Erro ao buscar ultimos atendimentos via RPC:', error)
  }

  const atendimentos = await fetchAll<UltimoAtendimentoResumo>((from, to) =>
    supabase
      .from('atendimentos')
      .select('paciente_id, data_agendamento, tipo')
      .in('paciente_id', pacienteIds)
      .gte('data_agendamento', dataMinIso ?? '1900-01-01T00:00:00.000Z')
      .order('data_agendamento', { ascending: false })
      .range(from, to) as PromiseLike<{ data: UltimoAtendimentoResumo[] | null }>
  )

  const ultimoAtendimentoMap = new Map<string, UltimoAtendimentoResumo>()
  for (const atendimento of atendimentos) {
    if (!ultimoAtendimentoMap.has(atendimento.paciente_id)) {
      ultimoAtendimentoMap.set(atendimento.paciente_id, atendimento)
    }
  }

  return Array.from(ultimoAtendimentoMap.values())
}

export function criarMapaUltimoAtendimento(atendimentos: UltimoAtendimentoResumo[]) {
  return new Map(
    atendimentos.map((atendimento) => [
      atendimento.paciente_id,
      {
        data: atendimento.data_agendamento,
        tipo: atendimento.tipo,
      },
    ])
  )
}
