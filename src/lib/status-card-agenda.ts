/**
 * Modelo de exibição do card de status na rota de agendamento.
 * Sem I/O — concentra a precedência entre atendimento e declaração, o filtro
 * de profissional desligado e o tempo decorrido, testáveis com node --test.
 * Ver .spec/features/status-personalizados-ciclo-vida/spec.md
 */

export type ProfissionalCardInput = {
  profissionalId: string
  nome: string
  ativo: boolean
}

export type DeclaracaoStatusInput = {
  profissionalId: string
  slug: string
  observacao: string | null
  iniciadoEm: Date
}

export type OpcaoCatalogoInput = {
  slug: string
  label: string
  cor: string
}

export type CardStatusAgenda = {
  profissionalId: string
  nome: string
  emAtendimento: boolean
  statusPrincipal: { slug: string; label: string; cor: string }
  observacao: string | null
  iniciadoEm: Date
  tempoDecorridoMin: number
}

const SLUG_OCUPADO = 'ocupado'

function resolverOpcao(slug: string, opcoes: OpcaoCatalogoInput[]): { slug: string; label: string; cor: string } {
  const encontrada = opcoes.find((opcao) => opcao.slug === slug)
  return encontrada ?? { slug, label: slug, cor: 'slate' }
}

function calcularTempoDecorridoMin(iniciadoEm: Date, agora: Date): number {
  return Math.max(0, Math.round((agora.getTime() - iniciadoEm.getTime()) / 60_000))
}

/**
 * AC-008/AC-009/AC-010: monta o modelo pronto do card de status da agenda a
 * partir das declarações de status personalizado ativas.
 * - Profissional desligado não entra na lista, mesmo com declaração remanescente (AC-010).
 * - Sem atendimento em curso, o status principal é a própria declaração (AC-008).
 * - Com atendimento em curso, o status principal vira "Em atendimento" e a
 *   declaração passa a informação secundária — motivo e tempo continuam
 *   vindos dela (AC-009, decisão de 10/08: a agenda vence).
 */
export function montarCardsStatus(
  profissionais: ProfissionalCardInput[],
  declaracoes: DeclaracaoStatusInput[],
  emAtendimentoIds: Iterable<string>,
  opcoes: OpcaoCatalogoInput[],
  agora: Date = new Date(),
): CardStatusAgenda[] {
  const emAtendimentoSet = new Set(emAtendimentoIds)
  const profissionalPorId = new Map(profissionais.map((p) => [p.profissionalId, p]))

  const cards: CardStatusAgenda[] = []

  for (const declaracao of declaracoes) {
    const profissional = profissionalPorId.get(declaracao.profissionalId)
    if (!profissional || !profissional.ativo) continue // AC-010

    const emAtendimento = emAtendimentoSet.has(declaracao.profissionalId)
    const statusPrincipal = emAtendimento
      ? resolverOpcao(SLUG_OCUPADO, opcoes)
      : resolverOpcao(declaracao.slug, opcoes)

    cards.push({
      profissionalId: declaracao.profissionalId,
      nome: profissional.nome,
      emAtendimento,
      statusPrincipal,
      observacao: declaracao.observacao,
      iniciadoEm: declaracao.iniciadoEm,
      tempoDecorridoMin: calcularTempoDecorridoMin(declaracao.iniciadoEm, agora),
    })
  }

  return cards
}
