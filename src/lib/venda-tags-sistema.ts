import type { SupabaseClient } from '@supabase/supabase-js'

export const TAG_SISTEMA_SEM_CONTRATO = 'sem_contrato'
export const TAG_SISTEMA_CONTRATO_ASSINADO = 'contrato_assinado'

async function idsTagsSistema(db: SupabaseClient) {
  const { data } = await db
    .from('venda_tags')
    .select('id, sistema_chave')
    .in('sistema_chave', [TAG_SISTEMA_SEM_CONTRATO, TAG_SISTEMA_CONTRATO_ASSINADO])

  const porChave = new Map((data ?? []).map((t) => [t.sistema_chave as string, t.id as string]))
  return {
    semContrato: porChave.get(TAG_SISTEMA_SEM_CONTRATO) ?? null,
    contratoAssinado: porChave.get(TAG_SISTEMA_CONTRATO_ASSINADO) ?? null,
  }
}

/**
 * Deixa as tags de contrato da venda coerentes com o estado dela:
 * - só venda confirmada tem tag de contrato (orçamento não tem nenhuma);
 * - com contrato gerado -> CONTRATO ASSINADO;
 * - sem contrato -> SEM CONTRATO, exceto se já tem CONTRATO ASSINADO (marcado à mão).
 * Chamar depois de criar a venda, mudar o status ou gerar o contrato.
 * Nunca lança: a tag é acessório da operação principal.
 */
export async function sincronizarTagContratoVenda(db: SupabaseClient, vendaId: string, userId?: string) {
  try {
    const [{ data: venda }, tags] = await Promise.all([
      db.from('vendas').select('status').eq('id', vendaId).maybeSingle(),
      idsTagsSistema(db),
    ])
    if (!venda) return

    const ids = [tags.semContrato, tags.contratoAssinado].filter((id): id is string => !!id)
    if (ids.length === 0) return

    let desejada: string | null = null
    if ((venda.status ?? 'venda_confirmada') === 'venda_confirmada') {
      const [{ data: termo }, { data: jaAssinada }] = await Promise.all([
        db.from('venda_termos').select('id').eq('venda_id', vendaId).eq('tipo', 'termo').limit(1).maybeSingle(),
        tags.contratoAssinado
          ? db.from('venda_tags_vinculos').select('tag_id').eq('venda_id', vendaId).eq('tag_id', tags.contratoAssinado).maybeSingle()
          : Promise.resolve({ data: null }),
      ])
      desejada = termo || jaAssinada ? tags.contratoAssinado : tags.semContrato
    }

    const remover = ids.filter((id) => id !== desejada)
    if (remover.length > 0) {
      await db.from('venda_tags_vinculos').delete().eq('venda_id', vendaId).in('tag_id', remover)
    }
    if (desejada) {
      await db
        .from('venda_tags_vinculos')
        .upsert(
          { venda_id: vendaId, tag_id: desejada, criado_por: userId ?? null },
          { onConflict: 'venda_id,tag_id', ignoreDuplicates: true },
        )
    }
  } catch (err) {
    console.error('[venda-tags-sistema] sincronizarTagContratoVenda', err)
  }
}
