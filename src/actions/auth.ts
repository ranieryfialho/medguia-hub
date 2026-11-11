'use server'

import { createClient } from '@/lib/supabase/server'
import { destinoRetornoSeguro } from '@/lib/sso/retorno-seguro'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'

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

  // SSO com o dashboard (AC-120): valida o retorno de novo no servidor, nunca confia no formulário.
  const retorno = destinoRetornoSeguro(formData.get('retorno') as string | null)
  redirect(retorno ?? '/dashboard')
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

  // Limpa o flag com service role e confere as linhas afetadas: o update via RLS
  // pode afetar 0 linhas sem erro, deixando o modal preso apos a troca.
  const supabaseAdmin = createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: perfilAtualizado, error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({ primeiro_acesso: false })
    .eq('id', user.id)
    .select('id')

  if (profileError || !perfilAtualizado?.length) {
    return { error: 'Erro ao liberar o acesso do perfil.' }
  }

  // Garante o metadata limpo no servidor, independente do estado da sessao do navegador.
  await supabaseAdmin.auth.admin.updateUserById(user.id, {
    user_metadata: { primeiro_acesso: false },
  })

  // Renova a sessao para que o JWT do cookie nao carregue o metadata antigo.
  await supabase.auth.refreshSession()

  revalidatePath('/', 'layout')
  return { success: true }
}
