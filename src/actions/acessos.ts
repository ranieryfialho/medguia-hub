'use server'

import { createClient as createSupabaseAdminClient, type SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import {
  TODOS_MODULOS,
  obterModulosPadraoParaUsuario,
  type CargoColaborador,
  type ModuloChave,
  type NivelAcesso,
} from '@/lib/modulos'
import { isGestorSistema, isMasterSistema } from '@/lib/permissoes'
import { createClient as createServerClient } from '@/lib/supabase/server'

type AtualizarConfiguracaoPayload = {
  usuarioId: string
  cargo: CargoColaborador
  nivelAcesso: NivelAcesso
  modulos: ModuloChave[]
}

async function contarMastersAtivosAdmin(supabaseAdmin: SupabaseClient) {
  const { count, error } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('nivel_acesso', 'master')
    .eq('ativo', true)

  if (error) return null
  return count ?? 0
}

export async function atualizarConfiguracaoAcessoUsuario(
  payload: AtualizarConfiguracaoPayload,
): Promise<{ error?: string }> {
  const { usuarioId, cargo, nivelAcesso } = payload
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { data: self } = await supabase
    .from('profiles')
    .select('nivel_acesso')
    .eq('id', user.id)
    .single()

  if (!self || !isGestorSistema(self.nivel_acesso)) {
    return { error: 'Sem permissão para editar acessos' }
  }

  const supabaseAdmin = createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: alvo } = await supabaseAdmin
    .from('profiles')
    .select('nivel_acesso, full_name')
    .eq('id', usuarioId)
    .single()

  if (isMasterSistema(alvo?.nivel_acesso) && !isMasterSistema(self.nivel_acesso)) {
    return { error: 'Apenas master pode alterar outro usuário master' }
  }

  if (isMasterSistema(nivelAcesso) && !isMasterSistema(self.nivel_acesso)) {
    return { error: 'Apenas master pode conceder nível master' }
  }

  if (isMasterSistema(alvo?.nivel_acesso) && !isMasterSistema(nivelAcesso)) {
    const totalMastersAtivos = await contarMastersAtivosAdmin(supabaseAdmin)
    if (totalMastersAtivos === 1) {
      return { error: 'Não é possível remover o nível master do último master ativo' }
    }
  }

  const modulosBase = isMasterSistema(nivelAcesso)
    ? obterModulosPadraoParaUsuario(cargo, nivelAcesso)
    : payload.modulos

  const modulosSanitizados = Array.from(
    new Set(modulosBase.filter((item): item is ModuloChave => TODOS_MODULOS.includes(item as ModuloChave))),
  )

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      role: cargo,
      nivel_acesso: nivelAcesso,
      modulos_liberados: modulosSanitizados,
    })
    .eq('id', usuarioId)

  if (error) return { error: error.message }

  revalidatePath('/equipe/acessos')
  revalidatePath('/equipe')
  return {}
}
