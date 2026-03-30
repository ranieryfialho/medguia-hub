'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// FUNÇÃO 1: CRIAR NOVO COLABORADOR (Já existia)
export async function cadastrarColaborador(formData: FormData) {
  const nome = formData.get('nome') as string
  const cpf = formData.get('cpf') as string
  const email = formData.get('email') as string
  const telefone = formData.get('telefone') as string
  const cargo = formData.get('cargo') as string
  const conselho = formData.get('conselho') as string
  const especialidade = formData.get('especialidade') as string

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: email,
    password: 'Mudar@123', 
    email_confirm: true,
    user_metadata: { full_name: nome }
  })

  if (authError) {
    console.error('Erro ao criar no Auth:', authError.message)
    throw new Error('Não foi possível criar as credenciais do usuário.')
  }

  const userId = authData.user.id

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      full_name: nome,
      role: cargo,
      cpf: cpf,
      email: email,
      telefone: telefone,
      conselho: conselho || null,
      especialidade: especialidade || null,
      ativo: true
    })
    .eq('id', userId)

  if (profileError) {
    console.error('Erro ao atualizar profiles:', profileError.message)
    throw new Error('Usuário criado, mas houve um erro ao salvar os detalhes do perfil.')
  }

  revalidatePath('/equipe')
  redirect('/equipe')
}

// FUNÇÃO 2: EDITAR COLABORADOR EXISTENTE (NOVO)
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

  // 2. Opcional: Atualiza o nome também nos metadados do Auth
  await supabaseAdmin.auth.admin.updateUserById(id, {
    user_metadata: { full_name: nome }
  })

  revalidatePath('/equipe')
  redirect('/equipe')
}