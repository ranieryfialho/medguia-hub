'use server'

// Imports relativos/dinâmicos: precisam ser resolvíveis por `node --test`
// sem alias (ASM-001), pois este arquivo é carregado diretamente pelo seu teste.
import { DEFAULT_OPCOES, type OpcaoStatus } from '../lib/status-disponibilidade-cores.ts'
import {
  podeEditarOpcao,
  type OpcaoStatusRegra,
  type ResultadoValidacao,
} from '../lib/status-disponibilidade-regras.ts'

/** AC-012: status de sistema não pode ser editado nem removido pelo gestor. */
export async function podeGerenciarOpcao(
  opcao: OpcaoStatusRegra | null | undefined,
): Promise<ResultadoValidacao> {
  if (!opcao) return { valido: true }
  if (!podeEditarOpcao(opcao)) {
    return { valido: false, mensagem: 'Status de sistema não pode ser editado nem removido' }
  }
  return { valido: true }
}

export async function listarStatusOpcoes(): Promise<OpcaoStatus[]> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('status_disponibilidade_opcoes')
    .select('*')
    .eq('ativo', true)
    .order('ordem')

  if (error || !data || data.length === 0) return DEFAULT_OPCOES
  return data as OpcaoStatus[]
}

/**
 * AC-033: o catálogo COMPLETO, incluindo o que o gestor removeu.
 *
 * `removerStatusOpcao` é soft delete (`ativo = false`) — a linha fica, e os
 * blocos de tempo já registrados sob aquele status também. Sem os removidos,
 * o Tempo Fábril e os painéis exibem o identificador cru
 * (`gravacao_mkt_1784656463413`) no lugar do rótulo, para horas que realmente
 * aconteceram.
 *
 * Use esta função para EXIBIR; use `listarStatusOpcoes` para ESCOLHER e para a
 * tela de gerenciamento, onde um status removido não deve reaparecer.
 * Como defesa em profundidade, `opcoesSelecionaveis` também descarta `ativo:
 * false` — assim uma tela que use o catálogo completo para os dois fins não
 * volta a oferecer o que foi removido.
 */
export async function listarStatusOpcoesParaExibicao(): Promise<OpcaoStatus[]> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('status_disponibilidade_opcoes')
    .select('*')
    .order('ordem')

  if (error || !data || data.length === 0) return DEFAULT_OPCOES
  return data as OpcaoStatus[]
}

async function assertGestor() {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, nivel_acesso')
    .eq('id', user.id)
    .single()
  const ok =
    ['gestor', 'master'].includes(profile?.role ?? '') ||
    ['gestor', 'master'].includes(profile?.nivel_acesso ?? '')
  if (!ok) throw new Error('Sem permissão')
  return supabase
}

type OpcaoInput = {
  label: string
  label_curto: string
  cor: string
  observacao_obrigatoria?: boolean
}

function gerarSlug(label: string) {
  const base = label
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return `${base}_${Date.now()}`
}

export async function criarStatusOpcao(input: OpcaoInput): Promise<{ error?: string }> {
  let supabase
  try { supabase = await assertGestor() } catch (e: unknown) { return { error: (e as Error).message } }

  const { data: last } = await supabase
    .from('status_disponibilidade_opcoes')
    .select('ordem')
    .eq('ativo', true)
    .eq('sistema', false)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const novaOrdem = (last?.ordem ?? 0) + 1

  const { error } = await supabase.from('status_disponibilidade_opcoes').insert({
    slug: gerarSlug(input.label),
    label: input.label.trim(),
    label_curto: input.label_curto.trim(),
    cor: input.cor,
    ordem: novaOrdem,
    sistema: false,
    ativo: true,
    observacao_obrigatoria: input.observacao_obrigatoria ?? false,
  })
  return error ? { error: error.message } : {}
}

export async function editarStatusOpcao(id: string, input: OpcaoInput): Promise<{ error?: string }> {
  let supabase
  try { supabase = await assertGestor() } catch (e: unknown) { return { error: (e as Error).message } }

  const { data: opcao } = await supabase
    .from('status_disponibilidade_opcoes').select('sistema').eq('id', id).single()
  const guarda = await podeGerenciarOpcao(opcao as OpcaoStatusRegra | null)
  if (!guarda.valido) return { error: guarda.mensagem }

  const { error } = await supabase
    .from('status_disponibilidade_opcoes')
    .update({
      label: input.label.trim(),
      label_curto: input.label_curto.trim(),
      cor: input.cor,
      observacao_obrigatoria: input.observacao_obrigatoria ?? false,
    })
    .eq('id', id)
  return error ? { error: error.message } : {}
}

export async function removerStatusOpcao(id: string): Promise<{ error?: string }> {
  let supabase
  try { supabase = await assertGestor() } catch (e: unknown) { return { error: (e as Error).message } }

  const { data: opcao } = await supabase
    .from('status_disponibilidade_opcoes').select('sistema').eq('id', id).single()
  const guarda = await podeGerenciarOpcao(opcao as OpcaoStatusRegra | null)
  if (!guarda.valido) return { error: guarda.mensagem }

  const { error } = await supabase
    .from('status_disponibilidade_opcoes').update({ ativo: false }).eq('id', id)
  return error ? { error: error.message } : {}
}

// ids: lista ordenada dos status não-sistema (do primeiro ao último)
export async function reordenarStatusOpcoes(ids: string[]): Promise<{ error?: string }> {
  let supabase
  try { supabase = await assertGestor() } catch (e: unknown) { return { error: (e as Error).message } }

  // disponivel=0, customN=N, ausente=99 — sem colisão
  const updates = ids.map((id, i) =>
    supabase
      .from('status_disponibilidade_opcoes')
      .update({ ordem: i + 1 })
      .eq('id', id)
      .eq('sistema', false)
  )
  await Promise.all(updates)
  return {}
}
