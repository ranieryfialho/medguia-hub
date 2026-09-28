'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { requireModulo } from '@/lib/guard'
import type { ConfigClinica } from '@/lib/clinica'

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function salvarConfigClinica(config: ConfigClinica): Promise<{ error?: string }> {
  try {
    await requireModulo('configuracoes:clinica')

    const db = createServiceClient()
    const agora = new Date().toISOString()

    const upserts = [
      { chave: 'clinica_nome',                  valor: config.nome ?? '' },
      { chave: 'clinica_cnpj',                  valor: config.cnpj ?? '' },
      { chave: 'clinica_especialidade',          valor: config.especialidade ?? '' },
      { chave: 'clinica_telefone',               valor: config.telefone ?? '' },
      { chave: 'clinica_whatsapp',               valor: config.whatsapp ?? '' },
      { chave: 'clinica_email',                  valor: config.email ?? '' },
      { chave: 'clinica_site',                   valor: config.site ?? '' },
      { chave: 'clinica_endereco',               valor: config.endereco ?? '' },
      { chave: 'clinica_endereco_numero',        valor: config.endereco_numero ?? '' },
      { chave: 'clinica_endereco_complemento',   valor: config.endereco_complemento ?? '' },
      { chave: 'clinica_endereco_bairro',        valor: config.endereco_bairro ?? '' },
      { chave: 'clinica_endereco_cidade',        valor: config.endereco_cidade ?? '' },
      { chave: 'clinica_endereco_estado',        valor: config.endereco_estado ?? '' },
      { chave: 'clinica_endereco_cep',           valor: config.endereco_cep ?? '' },
    ].map(u => ({ ...u, atualizado_em: agora }))

    const { error } = await db.from('configuracoes_sistema').upsert(upserts, { onConflict: 'chave' })
    if (error) throw error

    revalidatePath('/configuracoes/clinica')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao salvar configurações' }
  }
}
