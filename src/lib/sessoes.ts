import { isStatusNaoEfetivo } from '@/lib/atendimento-status'

type SessaoBasica = {
  id: string
  agendamento_id: string | null
  data_agendamento: string
  status: string
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
): Map<string, { sessao_efetiva: number; total_efetivo: number }> {
  // Agrupa por agendamento_id
  const grupos = new Map<string, SessaoBasica[]>()
  for (const s of todasSessoes) {
    if (!s.agendamento_id) continue
    const list = grupos.get(s.agendamento_id) ?? []
    list.push(s)
    grupos.set(s.agendamento_id, list)
  }

  const result = new Map<string, { sessao_efetiva: number; total_efetivo: number }>()

  for (const sessoes of grupos.values()) {
    const sorted = [...sessoes].sort((a, b) =>
      a.data_agendamento.localeCompare(b.data_agendamento)
    )
    const efetivas = sorted.filter(s => !isStatusNaoEfetivo(s.status))
    const total = efetivas.length

    for (let i = 0; i < efetivas.length; i++) {
      result.set(efetivas[i].id, { sessao_efetiva: i + 1, total_efetivo: total })
    }
    for (const s of sorted.filter(s => isStatusNaoEfetivo(s.status))) {
      result.set(s.id, { sessao_efetiva: 0, total_efetivo: total })
    }
  }

  return result
}
