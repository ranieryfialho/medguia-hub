'use server'

// Import relativo do módulo de regras: precisa ser resolvível por `node --test`
// sem alias (ASM-001), pois este arquivo é carregado diretamente pelo seu teste.
import {
  validarObservacao,
  type OpcaoStatusRegra,
  type ResultadoValidacao,
} from '../lib/status-disponibilidade-regras.ts'

export type StatusDisponibilidade = 'disponivel' | 'reuniao' | 'ocupado' | 'ausente'

export type StatusRow = {
  profissional_id: string
  status: string
  atualizado_em: string
}

/**
 * AC-001, AC-002: decide, a partir da opção do catálogo, se a troca pode prosseguir.
 * Opção desconhecida (fora do catálogo) não é bloqueada aqui — quem decide é o banco.
 */
export async function validarTrocaDeStatus(
  opcao: OpcaoStatusRegra | null | undefined,
  observacao: string | null | undefined,
): Promise<ResultadoValidacao> {
  if (!opcao) return { valido: true }
  return validarObservacao(opcao, observacao)
}

export async function setStatusDisponibilidade(
  novoStatus: string,
  observacao?: string | null,
): Promise<{ status: string } | { error: string }> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'NÃ£o autenticado' }

  const { data: opcaoRow } = await supabase
    .from('status_disponibilidade_opcoes')
    .select('slug, sistema, observacao_obrigatoria')
    .eq('slug', novoStatus)
    .maybeSingle()

  const validacao = await validarTrocaDeStatus(opcaoRow as OpcaoStatusRegra | null, observacao)
  if (!validacao.valido) return { error: validacao.mensagem }

  const payload = {
    profissional_id: user.id,
    status: novoStatus,
    observacao: observacao?.trim() || null,
    atualizado_em: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('status_disponibilidade')
    .upsert({
      ...payload,
      origem: 'manual',
    })

  if (error?.message.includes("Could not find the 'origem' column")) {
    const { error: fallbackError } = await supabase
      .from('status_disponibilidade')
      .upsert(payload)

    if (fallbackError) return { error: fallbackError.message }
    return { status: novoStatus }
  }

  if (error) return { error: error.message }
  return { status: novoStatus }
}

export async function listarStatusDisponibilidade(profissionalIds?: string[]): Promise<StatusRow[]> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  if (profissionalIds && profissionalIds.length > 0) {
    const { data } = await supabase.rpc('fn_status_equipe_agora', { p_ids: profissionalIds })
    return (data ?? []) as StatusRow[]
  }

  const { data } = await supabase
    .from('status_disponibilidade')
    .select('profissional_id, status, atualizado_em')
  return (data ?? []) as StatusRow[]
}

export type DeclaracaoStatusRow = {
  profissional_id: string
  status: string
  observacao: string | null
  atualizado_em: string
}

/**
 * AC-029: rede de releitura do card da agenda.
 *
 * Devolve a DECLARAÇÃO crua de `status_disponibilidade`, não o status resolvido
 * por `fn_status_equipe_agora` — o card aplica a própria precedência em
 * `montarCardsStatus` e precisa da declaração original, com a observação, para
 * poder exibir "Em atendimento · declarou: Em reunião" (AC-009/AC-020).
 *
 * É a mesma consulta que a rota de agendamento faz na renderização do servidor;
 * existe aqui para que o cliente possa repeti-la sem depender de um evento de
 * Realtime que, entre junho e 11/08, nunca chegou.
 */
export async function listarDeclaracoesStatus(
  profissionalIds: string[],
): Promise<DeclaracaoStatusRow[]> {
  if (profissionalIds.length === 0) return []

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { data } = await supabase
    .from('status_disponibilidade')
    .select('profissional_id, status, observacao, atualizado_em')
    .in('profissional_id', profissionalIds)

  return (data ?? []) as DeclaracaoStatusRow[]
}
