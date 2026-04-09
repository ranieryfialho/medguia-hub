'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function cadastrarColaborador(_prevState: { error?: string } | null, formData: FormData) {
  const nome = formData.get('nome') as string
  const cpf = formData.get('cpf') as string
  const email = formData.get('email') as string
  const telefone = formData.get('telefone') as string
  const cargo = formData.get('cargo') as string
  const conselho = formData.get('conselho') as string
  const especialidade = formData.get('especialidade') as string
  const senhaProvisoria = formData.get('senha') as string

  const supabaseAdmin = createClient(
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

export async function editarColaborador(formData: FormData) {
  const id = formData.get('id') as string
  const nome = formData.get('nome') as string
  const cpf = formData.get('cpf') as string
  const telefone = formData.get('telefone') as string
  const cargo = formData.get('cargo') as string
  const conselho = formData.get('conselho') as string
  const especialidade = formData.get('especialidade') as string

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1. Atualiza os dados na tabela pública 'profiles'
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      full_name: nome,
      role: cargo,
      cpf: cpf,
      telefone: telefone,
      conselho: conselho || null,
      especialidade: especialidade || null
    })
    .eq('id', id)

  if (profileError) {
    console.error('Erro ao atualizar profiles:', profileError.message)
    throw new Error('Erro ao salvar os detalhes do perfil.')
  }

  // 2. Atualiza o nome também nos metadados do Auth
  await supabaseAdmin.auth.admin.updateUserById(id, {
    user_metadata: { full_name: nome }
  })

  revalidatePath('/equipe')
  redirect('/equipe')
}

export async function alternarAtivoColaborador(id: string, ativarAgora: boolean) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

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

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

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