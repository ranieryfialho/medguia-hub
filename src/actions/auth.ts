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
