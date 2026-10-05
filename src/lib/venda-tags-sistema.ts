import type { SupabaseClient } from '@supabase/supabase-js'

export const TAG_SISTEMA_SEM_CONTRATO = 'sem_contrato'
export const TAG_SISTEMA_CONTRATO_ASSINADO = 'contrato_assinado'

async function idDaTagSistema(db: SupabaseClient, chave: string): Promise<string | null> {
  const { data } = await db
    .from('venda_tags')
    .select('id')
    .eq('sistema_chave', chave)
    .maybeSingle()
  return data?.id ?? null
}

/** Venda recém-criada nasce com a tag SEM CONTRATO. Nunca lança: tag é acessório da venda. */
export async function marcarVendaSemContrato(db: SupabaseClient, vendaId: string, userId?: string) {
  try {
    const tagId = await idDaTagSistema(db, TAG_SISTEMA_SEM_CONTRATO)
    if (!tagId) return
    await db
      .from('venda_tags_vinculos')
      .upsert(
        { venda_id: vendaId, tag_id: tagId, criado_por: userId ?? null },
        { onConflict: 'venda_id,tag_id', ignoreDuplicates: true },
      )
  } catch (err) {
    console.error('[venda-tags-sistema] marcarVendaSemContrato', err)
  }
}

/** Contrato gerado: troca SEM CONTRATO por CONTRATO ASSINADO. Nunca lança. */
export async function marcarVendaContratoAssinado(db: SupabaseClient, vendaId: string, userId?: string) {
  try {
    const [semId, assinadoId] = await Promise.all([
      idDaTagSistema(db, TAG_SISTEMA_SEM_CONTRATO),
      idDaTagSistema(db, TAG_SISTEMA_CONTRATO_ASSINADO),
    ])
    if (!assinadoId) return
    await db
      .from('venda_tags_vinculos')
      .upsert(
        { venda_id: vendaId, tag_id: assinadoId, criado_por: userId ?? null },
        { onConflict: 'venda_id,tag_id', ignoreDuplicates: true },
      )
    if (semId) {
      await db.from('venda_tags_vinculos').delete().eq('venda_id', vendaId).eq('tag_id', semId)
    }
  } catch (err) {
    console.error('[venda-tags-sistema] marcarVendaContratoAssinado', err)
  }
}
