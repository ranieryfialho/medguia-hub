'use server'

import { createClient as createSupabaseAdminClient, type SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { obterModulosPadraoParaUsuario } from '@/lib/modulos'
import { isGestorSistema, isMasterSistema } from '@/lib/permissoes'
import { createClient as createServerClient } from '@/lib/supabase/server'

async function contarMastersAtivosAdmin(supabaseAdmin: SupabaseClient) {
  const { count, error } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('nivel_acesso', 'master')
    .eq('ativo', true)

  if (error) return null
  return count ?? 0
}

type GestorOuMasterContext =
  | { error: string }
  | {
      supabase: Awaited<ReturnType<typeof createServerClient>>
      user: NonNullable<Awaited<ReturnType<Awaited<ReturnType<typeof createServerClient>>['auth']['getUser']>>['data']['user']>
      self: { nivel_acesso: 'gestor' | 'master' }
    }

async function requireGestorOuMaster(): Promise<GestorOuMasterContext> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { data: self } = await supabase
    .from('profiles')
    .select('nivel_acesso')
    .eq('id', user.id)
    .single()

  if (!self || !isGestorSistema(self.nivel_acesso)) {
    return { error: 'Sem permissão para gerenciar colaboradores' }
  }

  return {
    supabase,
    user,
    self: { nivel_acesso: self.nivel_acesso as 'gestor' | 'master' },
  }
}

export async function cadastrarColaborador(_prevState: { error?: string } | null, formData: FormData) {
  const nome = formData.get('nome') as string
  const cpf = formData.get('cpf') as string
  const email = formData.get('email') as string
  const telefone = formData.get('telefone') as string
  const cargo = formData.get('cargo') as string
  const conselho = formData.get('conselho') as string
  const especialidade = formData.get('especialidade') as string
  const senhaProvisoria = formData.get('senha') as string
  const nivelAcesso = (formData.get('nivel_acesso') as string) || 'basico'
  const modulosLiberados = obterModulosPadraoParaUsuario(cargo, nivelAcesso)

  const ctx = await requireGestorOuMaster()
  if ('error' in ctx) return { error: ctx.error }
  if (isMasterSistema(nivelAcesso) && !isMasterSistema(ctx.self.nivel_acesso)) {
    return { error: 'Apenas master pode conceder nível master' }
  }

  const supabaseAdmin = createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: email,
    password: senhaProvisoria,
    email_confirm: true,
    user_metadata: { full_name: nome, primeiro_acesso: true }
  })

  if (authError) {
    console.error('Erro ao criar no Auth:', authError.message)
    const emailJaExiste = authError.message.toLowerCase().includes('already') || authError.message.toLowerCase().includes('registered')
    return { error: emailJaExiste ? 'Este e-mail já está cadastrado no sistema.' : `Erro ao criar usuário: ${authError.message}` }
  }

  const userId = authData.user.id

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: userId,
      full_name: nome,
      role: cargo,
      cpf: cpf,
      email: email,
      telefone: telefone,
      conselho: conselho || null,
      especialidade: especialidade || null,
      ativo: true,
      primeiro_acesso: true,
      nivel_acesso: nivelAcesso,
      modulos_liberados: modulosLiberados,
    })

  if (profileError) {
    console.error('Erro ao fazer upsert em profiles:', profileError.message)
    return { error: 'Usuário criado, mas houve um erro ao salvar os detalhes do perfil.' }
  }

  // Garante que primeiro_acesso=true independente de triggers do banco
  await supabaseAdmin
    .from('profiles')
    .update({ primeiro_acesso: true })
    .eq('id', userId)

  revalidatePath('/equipe')
  redirect('/equipe')
}

export async function editarColaborador(_prevState: { error?: string } | null, formData: FormData) {
  const id = formData.get('id') as string
  const nome = formData.get('nome') as string
  const cpf = formData.get('cpf') as string
  const telefone = formData.get('telefone') as string
  const cargo = formData.get('cargo') as string
  const conselho = formData.get('conselho') as string
  const especialidade = formData.get('especialidade') as string
  const nivelAcesso = (formData.get('nivel_acesso') as string) || 'basico'

  const retornoErro = (mensagem: string) => ({ error: mensagem })

  const ctx = await requireGestorOuMaster()
  if ('error' in ctx) return retornoErro(ctx.error)
  const { self } = ctx

  const supabaseAdmin = createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1. Atualiza os dados na tabela pública 'profiles'
  const { data: perfilAtual } = await supabaseAdmin
    .from('profiles')
    .select('role, nivel_acesso, modulos_liberados')
    .eq('id', id)
    .single()

  let modulosLiberados = perfilAtual?.modulos_liberados ?? null
  const mudouCargo = perfilAtual?.role !== cargo
  const mudouNivel = perfilAtual?.nivel_acesso !== nivelAcesso

  if (isMasterSistema(perfilAtual?.nivel_acesso) && !isMasterSistema(self.nivel_acesso)) {
    return retornoErro('Apenas master pode editar um usuário master')
  }

  if (isMasterSistema(nivelAcesso) && !isMasterSistema(self.nivel_acesso)) {
    return retornoErro('Apenas master pode conceder nível master')
  }

  if (isMasterSistema(perfilAtual?.nivel_acesso) && !isMasterSistema(nivelAcesso)) {
    const totalMastersAtivos = await contarMastersAtivosAdmin(supabaseAdmin)
    if (totalMastersAtivos === 1) {
      return retornoErro('Não é possível remover o nível master do último master ativo')
    }
  }

  if (
    isMasterSistema(nivelAcesso) ||
    mudouCargo ||
    mudouNivel ||
    !Array.isArray(perfilAtual?.modulos_liberados) ||
    perfilAtual.modulos_liberados.length === 0
  ) {
    modulosLiberados = obterModulosPadraoParaUsuario(cargo, nivelAcesso)
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      full_name: nome,
      role: cargo,
      cpf: cpf,
      telefone: telefone,
      conselho: conselho || null,
      especialidade: especialidade || null,
      nivel_acesso: nivelAcesso,
      modulos_liberados: modulosLiberados,
    })
    .eq('id', id)

  if (profileError) {
    console.error('Erro ao atualizar profiles:', profileError.message)
    return retornoErro('Erro ao salvar os detalhes do perfil.')
  }

  // 2. Atualiza o nome também nos metadados do Auth
  await supabaseAdmin.auth.admin.updateUserById(id, {
    user_metadata: { full_name: nome }
  })

  revalidatePath('/equipe')
  redirect('/equipe')
}

export async function alternarAtivoColaborador(id: string, ativarAgora: boolean) {
  const ctx = await requireGestorOuMaster()
  if ('error' in ctx) return { error: ctx.error }

  const supabaseAdmin = createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: alvo } = await supabaseAdmin
    .from('profiles')
    .select('nivel_acesso')
    .eq('id', id)
    .single()

  if (isMasterSistema(alvo?.nivel_acesso) && !isMasterSistema(ctx.self.nivel_acesso)) {
    return { error: 'Apenas master pode alterar o acesso de outro usuário master' }
  }

  if (isMasterSistema(alvo?.nivel_acesso) && !ativarAgora) {
    const totalMastersAtivos = await contarMastersAtivosAdmin(supabaseAdmin)
    if (totalMastersAtivos === 1) {
      return { error: 'Não é possível inativar o último master ativo' }
    }
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({ ativo: ativarAgora })
    .eq('id', id)

  if (profileError) {
    return { error: 'Erro ao atualizar o perfil.' }
  }

  // Bane ou desbane no Auth para bloquear/liberar o login
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
    ban_duration: ativarAgora ? 'none' : '876000h',
  })

  if (authError) {
    return { error: 'Perfil atualizado, mas não foi possível alterar o acesso de login.' }
  }

  revalidatePath('/equipe')
  return { success: true }
}

export async function redefinirSenha(id: string, novaSenha: string) {
  if (!novaSenha || novaSenha.length < 6) {
    return { error: 'A senha deve ter no mínimo 6 caracteres.' }
  }

  const ctx = await requireGestorOuMaster()
  if ('error' in ctx) return { error: ctx.error }

  const supabaseAdmin = createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: alvo } = await supabaseAdmin
    .from('profiles')
    .select('nivel_acesso')
    .eq('id', id)
    .single()

  if (isMasterSistema(alvo?.nivel_acesso) && !isMasterSistema(ctx.self.nivel_acesso)) {
    return { error: 'Apenas master pode redefinir a senha de outro usuário master' }
  }

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
    password: novaSenha,
    user_metadata: { primeiro_acesso: true },
  })

  if (authError) {
    console.error('Erro ao redefinir senha:', authError.message)
    return { error: 'Não foi possível redefinir a senha.' }
  }

  // Força o colaborador a trocar a senha no próximo acesso
  await supabaseAdmin
    .from('profiles')
    .update({ primeiro_acesso: true })
    .eq('id', id)

  return { success: true }
}
