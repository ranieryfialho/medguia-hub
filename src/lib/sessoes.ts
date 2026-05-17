import { isStatusNaoEfetivo } from '@/lib/atendimento-status'

type SessaoBasica = {
  id: string
  agendamento_id: string | null
  data_agendamento: string
  status: string
  tipo?: string | null
}

/**
 * Dado uma lista de todas as sessões dos agendamentos relevantes,
 * retorna um Map de atendimento_id → { sessao_efetiva, total_efetivo }
 * onde sessao_efetiva e total_efetivo excluem Falta, Cancelado e Reagendado da contagem.
 *
 * Exemplos:
 *   6 sessões, sessão 1 = Falta → sessão 2 vira efetiva 1/5, sessão 3 = 2/5 etc.
 *   Sessões Falta/Cancelado/Reagendado recebem sessao_efetiva = 0 (não mostrar badge).
 */
export function buildSessaoEfetivaMap(
  todasSessoes: SessaoBasica[]
): Map<string, {
  sessao_efetiva: number
  total_efetivo: number
  sessao_tipo_efetiva: number
  total_tipo_efetivo: number
}> {
  // Agrupa por agendamento_id
  const grupos = new Map<string, SessaoBasica[]>()
  for (const s of todasSessoes) {
    if (!s.agendamento_id) continue
    const list = grupos.get(s.agendamento_id) ?? []
    list.push(s)
    grupos.set(s.agendamento_id, list)
  }

  const result = new Map<string, {
    sessao_efetiva: number
    total_efetivo: number
    sessao_tipo_efetiva: number
    total_tipo_efetivo: number
  }>()

  for (const sessoes of grupos.values()) {
    const sorted = [...sessoes].sort((a, b) =>
      a.data_agendamento.localeCompare(b.data_agendamento)
    )
    const efetivas = sorted.filter(s => !isStatusNaoEfetivo(s.status))
    const total = efetivas.length
    const efetivasPorTipo = new Map<string, SessaoBasica[]>()

    for (const sessao of efetivas) {
      const chaveTipo = sessao.tipo?.trim() || '__sem_tipo__'
      const list = efetivasPorTipo.get(chaveTipo) ?? []
      list.push(sessao)
      efetivasPorTipo.set(chaveTipo, list)
    }

    for (let i = 0; i < efetivas.length; i++) {
      const sessao = efetivas[i]
      const chaveTipo = sessao.tipo?.trim() || '__sem_tipo__'
      const sessoesDoTipo = efetivasPorTipo.get(chaveTipo) ?? []
      const indiceTipo = sessoesDoTipo.findIndex((item) => item.id === sessao.id)

      result.set(sessao.id, {
        sessao_efetiva: i + 1,
        total_efetivo: total,
        sessao_tipo_efetiva: indiceTipo + 1,
        total_tipo_efetivo: sessoesDoTipo.length,
      })
    }
    for (const s of sorted.filter(s => isStatusNaoEfetivo(s.status))) {
      const chaveTipo = s.tipo?.trim() || '__sem_tipo__'
      const sessoesDoTipo = efetivasPorTipo.get(chaveTipo) ?? []
      result.set(s.id, {
        sessao_efetiva: 0,
        total_efetivo: total,
        sessao_tipo_efetiva: 0,
        total_tipo_efetivo: sessoesDoTipo.length,
      })
    }
  }

  return result
}
