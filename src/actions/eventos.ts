'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Função para criar um novo evento
export async function criarEvento(prevState: any, formData: FormData) {
  const supabase = await createClient()

  const paciente_id = formData.get('paciente_id') as string
  const status = formData.get('status') as string
  const titulo = formData.get('titulo') as string 
  const observacao = formData.get('observacao') as string

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado' }

  const { error } = await supabase
    .from('eventos_paciente')
    .insert({
      paciente_id,
      status,
      titulo,
      observacao,
      responsavel_id: user.id
    })

  if (error) return { error: `Erro ao criar evento: ${error.message}` }

  // ROTA ATUALIZADA
  revalidatePath(`/pacientes/${paciente_id}`)
  return { success: true }
}

// Função para adicionar nota a um evento existente
export async function adicionarNotaEvento(prevState: any, formData: FormData) {
  const supabase = await createClient()

  const evento_id = formData.get('evento_id') as string
  const paciente_id = formData.get('paciente_id') as string
  const nova_nota = formData.get('nova_nota') as string

  if (!nova_nota.trim()) return { error: 'A nota não pode estar vazia.' }

  const { data: evento } = await supabase
    .from('eventos_paciente')
    .select('observacao')
    .eq('id', evento_id)
    .single()

  const observacaoAtual = evento?.observacao || ''
  const dataFormatada = new Date().toLocaleDateString('pt-BR')
  const notaFormatada = `\n\n• [${dataFormatada}] ${nova_nota.trim()}`
  const textoAtualizado = observacaoAtual + notaFormatada

  const { error } = await supabase
    .from('eventos_paciente')
    .update({ observacao: textoAtualizado })
    .eq('id', evento_id)

  if (error) {
    return { error: 'Erro ao adicionar nota ao evento.' }
  }

  // ROTA ATUALIZADA
  revalidatePath(`/pacientes/${paciente_id}`)
  return { success: true }
}