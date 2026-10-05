'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type VendaTag = {
  id: string
  nome: string
  cor: string
  ordem: number
  ativo: boolean
  sistema_chave?: string | null
}

function revalidarRotasRelacionadas() {
  revalidatePath('/vendas')
  revalidatePath('/vendas/tags')
  revalidatePath('/vendas/[id]', 'page')
}

async function assertGestor() {
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

// ─── Catálogo ──────────────────────────────────────────────────────────────

export async function listarTagsVenda(): Promise<VendaTag[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('venda_tags')
    .select('id, nome, cor, ordem, ativo, sistema_chave')
    .order('ativo', { ascending: false })
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true })

  return data ?? []
}

export async function listarTagsVendaAtivas(): Promise<VendaTag[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('venda_tags')
    .select('id, nome, cor, ordem, ativo, sistema_chave')
    .eq('ativo', true)
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true })

  return data ?? []
}

export async function criarTagVenda(nome: string, cor: string): Promise<{ error?: string; tag?: VendaTag }> {
  const nomeNormalizado = nome.trim()
  if (!nomeNormalizado) return { error: 'Nome é obrigatório' }

  let supabase
  try { supabase = await assertGestor() } catch (e: unknown) { return { error: (e as Error).message } }

  const { data: existente } = await supabase
    .from('venda_tags')
    .select('id')
    .eq('ativo', true)
    .ilike('nome', nomeNormalizado)
    .maybeSingle()
  if (existente) return { error: 'Já existe uma tag com esse nome' }

  const { data: ultima } = await supabase
    .from('venda_tags')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('venda_tags')
    .insert({
      nome: nomeNormalizado,
      cor,
      ordem: (ultima?.ordem ?? 0) + 1,
      ativo: true,
    })
    .select('id, nome, cor, ordem, ativo, sistema_chave')
    .single()

  if (error) return { error: error.message }

  revalidarRotasRelacionadas()
  return { tag: data }
}

export async function atualizarTagVenda(id: string, nome: string, cor: string): Promise<{ error?: string }> {
  const nomeNormalizado = nome.trim()
  if (!nomeNormalizado) return { error: 'Nome é obrigatório' }

  let supabase
  try { supabase = await assertGestor() } catch (e: unknown) { return { error: (e as Error).message } }

  const { data: atual } = await supabase.from('venda_tags').select('sistema_chave').eq('id', id).maybeSingle()
  if (atual?.sistema_chave) return { error: 'Tag padrão do sistema não pode ser editada' }

  const { error } = await supabase
    .from('venda_tags')
    .update({ nome: nomeNormalizado, cor, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidarRotasRelacionadas()
  return {}
}

export async function excluirTagVenda(id: string): Promise<{ error?: string }> {
  let supabase
  try { supabase = await assertGestor() } catch (e: unknown) { return { error: (e as Error).message } }

  const { data: atual } = await supabase.from('venda_tags').select('sistema_chave').eq('id', id).maybeSingle()
  if (atual?.sistema_chave) return { error: 'Tag padrão do sistema não pode ser excluída' }

  const { error } = await supabase
    .from('venda_tags')
    .update({ ativo: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidarRotasRelacionadas()
  return {}
}

// ─── Vínculos venda <-> tag ──────────────────────────────────────────────────

export async function listarTagsDaVenda(vendaId: string): Promise<VendaTag[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('venda_tags_vinculos')
    .select('tag:venda_tags(id, nome, cor, ordem, ativo, sistema_chave)')
    .eq('venda_id', vendaId)

  return ((data ?? [])
    .map((v) => v.tag as unknown as VendaTag | null)
    .filter((t): t is VendaTag => !!t && t.ativo)
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome)))
}

export async function listarTagsPorVendas(vendaIds: string[]): Promise<Record<string, VendaTag[]>> {
  if (vendaIds.length === 0) return {}

  const supabase = await createClient()
  const { data } = await supabase
    .from('venda_tags_vinculos')
    .select('venda_id, tag:venda_tags(id, nome, cor, ordem, ativo, sistema_chave)')
    .in('venda_id', vendaIds)

  const mapa: Record<string, VendaTag[]> = {}
  for (const linha of data ?? []) {
    const tag = linha.tag as unknown as VendaTag | null
    if (!tag || !tag.ativo) continue
    if (!mapa[linha.venda_id]) mapa[linha.venda_id] = []
    mapa[linha.venda_id].push(tag)
  }
  for (const id of Object.keys(mapa)) {
    mapa[id].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))
  }
  return mapa
}

export async function adicionarTagAVenda(vendaId: string, tagId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase
    .from('venda_tags_vinculos')
    .insert({ venda_id: vendaId, tag_id: tagId, criado_por: user.id })

  // Vínculo já existe (PK duplicada) — não é erro do ponto de vista do usuário
  if (error && error.code !== '23505') return { error: error.message }

  revalidarRotasRelacionadas()
  return {}
}

export async function removerTagDaVenda(vendaId: string, tagId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('venda_tags_vinculos')
    .delete()
    .eq('venda_id', vendaId)
    .eq('tag_id', tagId)

  if (error) return { error: error.message }

  revalidarRotasRelacionadas()
  return {}
}
