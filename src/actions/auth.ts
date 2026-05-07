'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function login(prevState: any, formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: 'Credenciais inválidas. Tente novamente.' }
  }

  if (data.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('ativo')
      .eq('id', data.user.id)
      .single()

    if (profile && profile.ativo === false) {
      await supabase.auth.signOut()
      return { error: 'Seu acesso foi desativado. Contate o administrador.' }
    }
  }

  redirect('/dashboard')
}

export async function trocarSenhaPrimeiroAcesso(formData: FormData) {
  const senha = formData.get('senha') as string
  const confirmarSenha = formData.get('confirmarSenha') as string

  if (!senha || senha.length < 6) {
    return { error: 'A senha deve ter pelo menos 6 caracteres.' }
  }
  if (senha !== confirmarSenha) {
    return { error: 'As senhas não coincidem.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Sessão inválida. Faça login novamente.' }

  const { error: updateError } = await supabase.auth.updateUser({
    password: senha,
    data: { primeiro_acesso: false },
  })

  if (updateError) {
    return { error: 'Erro ao redefinir a senha: ' + updateError.message }
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ primeiro_acesso: false })
    .eq('id', user.id)

  if (profileError) {
    return { error: 'Erro ao liberar o acesso do perfil.' }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function verifyEmailForReset(_prevState: any, formData: FormData) {
  const email = formData.get('email') as string

  if (!email) {
    return { error: 'Por favor, informe seu e-mail.' }
  }

  const { createClient: createAdminClient } = await import('@supabase/supabase-js')
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await adminClient.auth.admin.listUsers()

  if (error) {
    return { error: 'Erro ao verificar e-mail. Tente novamente.' }
  }

  const user = data.users.find(u => u.email === email)

  if (!user) {
    return { error: 'E-mail não encontrado no sistema.' }
  }

  return { success: true, email, userId: user.id }
}

export async function resetPasswordByEmail(_prevState: any, formData: FormData) {
  const userId = formData.get('userId') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!userId) {
    return { error: 'Sessão inválida. Tente novamente.' }
  }

  if (!password || password.length < 6) {
    return { error: 'A senha deve ter pelo menos 6 caracteres.' }
  }

  if (password !== confirmPassword) {
    return { error: 'As senhas não coincidem.' }
  }

  const { createClient: createAdminClient } = await import('@supabase/supabase-js')
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await adminClient.auth.admin.updateUserById(userId, { password })

  if (error) {
    return { error: 'Erro ao redefinir senha: ' + error.message }
  }

  return { success: true }
}