/**
 * Agrupamento do painel "Status agora" (Configurações → Disponibilidade).
 *
 * Sem I/O — decide o que ganha destaque e o que fica compacto, testável com
 * node --test. O componente só percorre o resultado.
 *
 * Ver .spec/features/status-personalizados-ciclo-vida/spec.md (AC-030 a AC-032)
 */

import { tempoRestanteBlocoMs } from './status-disponibilidade-regras.ts'

/**
 * Os três identificadores derivados do sistema. São contrato: estão fixos em
 * quatro pontos sem integridade referencial entre si (RFC 002, "Divergência 2").
 */
export const SLUGS_DE_SISTEMA = new Set(['disponivel', 'ausente', 'ocupado'])

export type OpcaoPainel = {
  slug: string
  label: string
  label_curto: string
  cor: string
  ordem: number
  sistema: boolean
}

export type StatusPainelInput = {
  profissional_id: string
  status: string
  atualizado_em?: string | null
}

export type ProfissionalPainel = { id: string; nome: string }

export type ItemDeclarado = {
  id: string
  nome: string
  slug: string
  label: string
  cor: string
  observacao: string | null
  desdeMs: number
  restanteMs: number
  vencido: boolean
}

export type ItemCompacto = {
  id: string
  nome: string
  slug: string
  label: string
  cor: string
}

export type PainelEquipe = {
  /** Quem declarou um status — ganha linha própria, com motivo e prazo. */
  declarados: ItemDeclarado[]
  /** Quem está com paciente agora. Derivado da agenda, não expira. */
  emAtendimento: ItemCompacto[]
  livres: ItemCompacto[]
  ausentes: ItemCompacto[]
}

/**
 * AC-031: identificador fora do catálogo é DECLARADO, não de sistema.
 *
 * O padrão contrário foi o que escondeu o defeito da tela de disponibilidade:
 * com o catálogo real faltando, todo status criado pelo gestor virava um chip
 * cinza com o identificador cru, indistinguível de status de sistema. Um
 * identificador desconhecido é quase sempre um status novo — os de sistema são
 * três e fixos.
 */
export function ehDeclarado(slug: string, opcao: OpcaoPainel | undefined): boolean {
  if (opcao) return !opcao.sistema && slug !== 'ocupado'
  return !SLUGS_DE_SISTEMA.has(slug)
}

function rotulo(slug: string, opcao: OpcaoPainel | undefined): { label: string; cor: string } {
  if (opcao) return { label: opcao.label, cor: opcao.cor }
  // Sem catálogo, o identificador cru é tudo o que há. Melhor do que esconder —
  // e o formato denuncia que falta configuração, em vez de fingir normalidade.
  return { label: slug, cor: 'slate' }
}

/**
 * AC-032: separa quem declarou algo de quem está no estado normal.
 *
 * A ordem dentro de `declarados` é por prazo — quem está mais perto de expirar
 * (ou já expirou) aparece primeiro, porque é quem pode precisar de ação. As
 * listas compactas seguem a ordem do catálogo e depois o nome.
 */
export function agruparPainelEquipe(
  profissionais: ProfissionalPainel[],
  statuses: StatusPainelInput[],
  opcoes: OpcaoPainel[],
  observacoesPorProfissional: Record<string, string | null> = {},
  agora: Date = new Date(),
): PainelEquipe {
  const opcaoPorSlug = new Map(opcoes.map((o) => [o.slug, o]))
  const statusPorProfissional = new Map(statuses.map((s) => [s.profissional_id, s]))

  const painel: PainelEquipe = { declarados: [], emAtendimento: [], livres: [], ausentes: [] }

  for (const prof of profissionais) {
    const linha = statusPorProfissional.get(prof.id)
    const slug = linha?.status ?? 'ausente'
    const opcao = opcaoPorSlug.get(slug)
    const { label, cor } = rotulo(slug, opcao)

    if (ehDeclarado(slug, opcao)) {
      // Sem `atualizado_em` não há como calcular prazo. Acontece se a origem do
      // dado mudar; tratar como recém-declarado é o único palpite honesto.
      const desde = linha?.atualizado_em ? new Date(linha.atualizado_em) : agora
      const restanteMs = tempoRestanteBlocoMs(desde, agora)

      painel.declarados.push({
        id: prof.id,
        nome: prof.nome,
        slug,
        label,
        cor,
        observacao: observacoesPorProfissional[prof.id] ?? null,
        desdeMs: Math.max(0, agora.getTime() - desde.getTime()),
        restanteMs,
        vencido: restanteMs <= 0,
      })
      continue
    }

    const compacto: ItemCompacto = { id: prof.id, nome: prof.nome, slug, label, cor }
    if (slug === 'ocupado') painel.emAtendimento.push(compacto)
    else if (slug === 'disponivel') painel.livres.push(compacto)
    else painel.ausentes.push(compacto)
  }

  // Mais urgente primeiro: menor prazo restante no topo.
  painel.declarados.sort((a, b) => a.restanteMs - b.restanteMs || a.nome.localeCompare(b.nome))

  for (const lista of [painel.emAtendimento, painel.livres, painel.ausentes]) {
    lista.sort((a, b) => a.nome.localeCompare(b.nome))
  }

  return painel
}
