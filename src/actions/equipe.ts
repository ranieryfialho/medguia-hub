'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function cadastrarColaborador(formData: FormData) {
  // 1. Extraindo os dados do formulário
  const nome = formData.get('nome') as string
  const cpf = formData.get('cpf') as string
  const email = formData.get('email') as string
  const telefone = formData.get('telefone') as string
  const cargo = formData.get('cargo') as string
  const conselho = formData.get('conselho') as string
  const especialidade = formData.get('especialidade') as string
  
  // Extraindo a nova senha provisória definida pelo gestor no formulário
  const senhaProvisoria = formData.get('senha') as string

  // 2. Iniciando o Supabase com a Chave de Administrador (Bypassa o RLS)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 3. Criando o usuário no Auth usando a senha provisória dinâmica
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: email,
    password: senhaProvisoria, 
    email_confirm: true,
    user_metadata: { full_name: nome }
  })

  if (authError) {
    console.error('Erro ao criar no Auth:', authError.message)
    throw new Error('Não foi possível criar as credenciais do usuário.')
  }

  const userId = authData.user.id

  // 4. UPSERT: Atualiza se existir, Cria se não existir.
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
      primeiro_acesso: true // Garante que o usuário precisará trocar a senha no 1º login
    })

  if (profileError) {
    console.error('Erro ao fazer upsert em profiles:', profileError.message)
    throw new Error('Usuário criado, mas houve um erro ao salvar os detalhes do perfil.')
  }

  // 5. Atualiza a tela de listagem e redireciona de volta
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