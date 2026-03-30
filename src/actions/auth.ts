'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

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