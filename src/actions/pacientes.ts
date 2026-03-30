'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function criarPaciente(prevState: any, formData: FormData) {
  const supabase = await createClient()

  const dadosPaciente = {
    nome: formData.get('nome') as string,
    cpf: formData.get('cpf') as string,
    data_nascimento: formData.get('data_nascimento') as string,
    telefone: formData.get('telefone') as string,
    telefone_secundario: formData.get('telefone_secundario') as string,
    email: formData.get('email') as string,
    genero: formData.get('genero') as string,
    profissao: formData.get('profissao') as string,
    rg: formData.get('rg') as string,
    orgao_emissor_rg: formData.get('orgao_emissor_rg') as string,
    origem: formData.get('origem') as string,
    indicado_por: formData.get('indicado_por') as string,
    endereco: formData.get('endereco') as string,
    endereco_sem_numero: formData.get('endereco_sem_numero') === 'on',
    complemento: formData.get('complemento') as string,
    observacoes_gerais: formData.get('observacoes_gerais') as string,
    convenio: formData.get('convenio') as string,
  }

  const { error } = await supabase
    .from('pacientes')
    .insert(dadosPaciente)

  if (error) {
    return { error: `Erro ao criar paciente: ${error.message}`, fields: dadosPaciente }
  }

  // ROTAS ATUALIZADAS
  revalidatePath('/pacientes')
  redirect('/pacientes')
}

export async function editarPaciente(prevState: any, formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string

  const dadosPaciente = {
    ativo: formData.get('ativo') === 'true',
    nome: formData.get('nome') as string,
    cpf: formData.get('cpf') as string,
    data_nascimento: formData.get('data_nascimento') as string,
    telefone: formData.get('telefone') as string,
    telefone_secundario: formData.get('telefone_secundario') as string,
    email: formData.get('email') as string,
    genero: formData.get('genero') as string,
    profissao: formData.get('profissao') as string,
    rg: formData.get('rg') as string,
    orgao_emissor_rg: formData.get('orgao_emissor_rg') as string,
    origem: formData.get('origem') as string,
    indicado_por: formData.get('indicado_por') as string,
    endereco: formData.get('endereco') as string,
    endereco_sem_numero: formData.get('endereco_sem_numero') === 'on',
    complemento: formData.get('complemento') as string,
    observacoes_gerais: formData.get('observacoes_gerais') as string,
    convenio: formData.get('convenio') as string,
  }

  const { error } = await supabase
    .from('pacientes')
    .update(dadosPaciente)
    .eq('id', id)

  if (error) {
    return { error: `Erro ao editar paciente: ${error.message}`, fields: dadosPaciente }
  }

  // ROTAS ATUALIZADAS
  revalidatePath('/pacientes')
  redirect('/pacientes')
}

export async function adicionarObservacao(prevState: any, formData: FormData) {
  const supabase = await createClient()

  const pacienteId = formData.get('paciente_id') as string
  const novaObservacao = formData.get('nova_observacao') as string

  if (!novaObservacao.trim()) return { error: 'A observação não pode estar vazia.' }

  const { data: paciente } = await supabase
    .from('pacientes')
    .select('observacoes_gerais')
    .eq('id', pacienteId)
    .single()

  const observacoesAtuais = paciente?.observacoes_gerais || ''
  const dataFormatada = new Date().toLocaleDateString('pt-BR')
  const entradaFormatada = `• [${dataFormatada}] ${novaObservacao.trim()}`

  const textoAtualizado = observacoesAtuais 
    ? `${observacoesAtuais}\n${entradaFormatada}` 
    : entradaFormatada

  const { error } = await supabase
    .from('pacientes')
    .update({ observacoes_gerais: textoAtualizado })
    .eq('id', pacienteId)

  if (error) {
    return { error: 'Erro ao salvar observação.' }
  }

  // ROTA ATUALIZADA
  revalidatePath(`/pacientes/${pacienteId}`)
  return { success: true }
}

export async function arquivarPaciente(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('pacientes')
    .update({ ativo: false })
    .eq('id', id)

  if (error) {
    return { error: 'Erro ao arquivar paciente.' }
  }

  revalidatePath('/pacientes')
  return { success: true }
}