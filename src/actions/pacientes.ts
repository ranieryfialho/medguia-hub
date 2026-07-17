'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { atualizarMetadataInativacao } from '@/lib/paciente-inativacao'
import { criarPastaPaciente } from '@/actions/google-drive'

function normalizarCPF(cpf: string): string {
  return cpf.replace(/\D/g, '')
}

function normalizarTexto(valor: string): string {
  return valor.trim().replace(/\s+/g, ' ').toLowerCase()
}

function normalizarTelefone(telefone: string): string {
  return telefone.replace(/\D/g, '')
}

function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

export type PacienteDuplicado = {
  id: string
  nome: string
  cpf: string | null
  telefone: string | null
  email: string | null
  data_nascimento: string | null
  ativo: boolean | null
  score: number
  motivos: string[]
}

export type PacienteFormState = {
  error?: string
  warning?: string
  fields?: Record<string, unknown>
  duplicateCandidates?: PacienteDuplicado[]
}

async function buscarPossiveisDuplicadosPaciente(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dadosPaciente: {
    nome: string
    telefone: string
    email: string
    data_nascimento: string | null
  },
  pacienteIdIgnorar?: string,
): Promise<PacienteDuplicado[]> {
  const nomeNormalizado = normalizarTexto(dadosPaciente.nome || '')

  if (!nomeNormalizado) return []

  let query = supabase
    .from('pacientes')
    .select('id, nome, cpf, telefone, email, data_nascimento, ativo')
    .ilike('nome', nomeNormalizado)
    .limit(10)

  if (pacienteIdIgnorar) {
    query = query.neq('id', pacienteIdIgnorar)
  }

  const { data, error } = await query

  if (error || !data) return []

  const telefoneNormalizado = normalizarTelefone(dadosPaciente.telefone || '')
  const emailNormalizado = normalizarEmail(dadosPaciente.email || '')

  return data
    .map((paciente) => {
      const motivos: string[] = ['nome igual']
      let score = 1

      if (telefoneNormalizado && normalizarTelefone(paciente.telefone || '') === telefoneNormalizado) {
        motivos.push('telefone igual')
        score += 3
      }

      if (emailNormalizado && normalizarEmail(paciente.email || '') === emailNormalizado) {
        motivos.push('email igual')
        score += 2
      }

      if (dadosPaciente.data_nascimento && paciente.data_nascimento === dadosPaciente.data_nascimento) {
        motivos.push('data de nascimento igual')
        score += 3
      }

      return {
        ...paciente,
        score,
        motivos,
      }
    })
    .sort((a, b) => b.score - a.score || a.nome.localeCompare(b.nome))
}

export async function criarPaciente(prevState: PacienteFormState | null, formData: FormData) {
  const supabase = await createClient()
  const confirmarDuplicado = formData.get('confirmar_duplicado') === '1'

  const cpfRaw = (formData.get('cpf') as string || '').trim()
  const cpf = cpfRaw ? normalizarCPF(cpfRaw) : ''
  const dataNascimentoRaw = (formData.get('data_nascimento') as string || '').trim()

  const dadosPaciente = {
    nome: formData.get('nome') as string,
    cpf: cpf || null,
    data_nascimento: dataNascimentoRaw || null,
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
    fonte: 'sistema',
  }

  if (cpf) {
    const { data: cpfExistente } = await supabase
      .from('pacientes')
      .select('id')
      .eq('cpf', cpf)
      .maybeSingle()

    if (cpfExistente) {
      return { error: 'Já existe um paciente cadastrado com este CPF.', fields: dadosPaciente }
    }
  }

  if (!confirmarDuplicado) {
    const duplicados = await buscarPossiveisDuplicadosPaciente(supabase, {
      nome: dadosPaciente.nome,
      telefone: dadosPaciente.telefone,
      email: dadosPaciente.email,
      data_nascimento: dadosPaciente.data_nascimento,
    })

    if (duplicados.length > 0) {
      return {
        error: '',
        warning: 'Encontramos pacientes já cadastrados com o mesmo nome. Revise antes de salvar.',
        fields: dadosPaciente,
        duplicateCandidates: duplicados,
      }
    }
  }

  const { data: novoPaciente, error } = await supabase
    .from('pacientes')
    .insert(dadosPaciente)
    .select('id, nome')
    .single()

  if (error) {
    return { error: `Erro ao criar paciente: ${error.message}`, fields: dadosPaciente }
  }

  void criarPastaPaciente(novoPaciente.id, novoPaciente.nome)

  revalidatePath('/pacientes')
  redirect('/pacientes')
}

export async function editarPaciente(prevState: PacienteFormState | null, formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string

  const confirmarDuplicado = formData.get('confirmar_duplicado') === '1'
  const cpfRaw = (formData.get('cpf') as string || '').trim()
  const cpf = cpfRaw ? normalizarCPF(cpfRaw) : ''
  const dataNascimentoRaw = (formData.get('data_nascimento') as string || '').trim()
  const ativo = formData.get('ativo') === 'true'
  const motivoInatividade = formData.get('motivo_inatividade') as string || ''
  const obitoInatividade = formData.get('obito_inatividade') === 'on'
  const observacoesGerais = formData.get('observacoes_gerais') as string || ''

  const dadosPaciente = {
    ativo,
    nome: formData.get('nome') as string,
    cpf: cpf || null,
    data_nascimento: dataNascimentoRaw || null,
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
    observacoes_gerais: atualizarMetadataInativacao(observacoesGerais, {
      ativo,
      motivo: motivoInatividade,
      obito: obitoInatividade,
    }),
    convenio: formData.get('convenio') as string,
  }
  const fields = {
    ...dadosPaciente,
    ativo: ativo ? 'true' : 'false',
    motivo_inatividade: motivoInatividade,
    obito_inatividade: obitoInatividade ? 'on' : '',
  }

  if (cpf) {
    const { data: cpfExistente } = await supabase
      .from('pacientes')
      .select('id')
      .eq('cpf', cpf)
      .neq('id', id)
      .maybeSingle()

    if (cpfExistente) {
      return { error: 'Já existe um paciente cadastrado com este CPF.', fields }
    }
  }

  if (!confirmarDuplicado) {
    const duplicados = await buscarPossiveisDuplicadosPaciente(
      supabase,
      {
        nome: dadosPaciente.nome,
        telefone: dadosPaciente.telefone,
        email: dadosPaciente.email,
        data_nascimento: dadosPaciente.data_nascimento,
      },
      id,
    )

    if (duplicados.length > 0) {
      return {
        error: '',
        warning: 'Encontramos pacientes já cadastrados com dados parecidos. Revise antes de atualizar.',
        fields,
        duplicateCandidates: duplicados,
      }
    }
  }

  const { error } = await supabase
    .from('pacientes')
    .update(dadosPaciente)
    .eq('id', id)

  if (error) {
    return { error: `Erro ao editar paciente: ${error.message}`, fields }
  }

  // ROTAS ATUALIZADAS
  revalidatePath('/pacientes')
  redirect('/pacientes')
}

export async function adicionarObservacao(prevState: PacienteFormState | null, formData: FormData) {
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

export type ObservacaoPaciente = {
  id: string
  paciente_id: string
  texto: string | null
  tag: string
  google_drive_file_id: string | null
  google_drive_file_url: string | null
  google_drive_file_nome: string | null
  google_drive_file_mime: string | null
  autor_id: string | null
  autor_nome: string | null
  criado_em: string
}

export async function listarObservacoesPaciente(pacienteId: string): Promise<ObservacaoPaciente[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('observacoes_paciente')
    .select('id, paciente_id, texto, tag, google_drive_file_id, google_drive_file_url, google_drive_file_nome, google_drive_file_mime, autor_id, criado_em')
    .eq('paciente_id', pacienteId)
    .order('criado_em', { ascending: false })

  if (!data?.length) return []

  const autorIds = [...new Set(data.map(o => o.autor_id).filter(Boolean))] as string[]
  const autoresMap = new Map<string, string>()
  if (autorIds.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', autorIds)
    for (const p of profiles ?? []) autoresMap.set(p.id, p.full_name)
  }

  return data.map(o => ({ ...o, autor_nome: o.autor_id ? (autoresMap.get(o.autor_id) ?? null) : null }))
}

export async function adicionarObservacaoPaciente(
  pacienteId: string,
  texto: string | null,
  tag: string,
  arquivo?: { id: string; url: string; nome: string; mime: string } | null,
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!texto?.trim() && !arquivo) return { error: 'Adicione uma observação ou selecione um arquivo.' }

  const { error } = await supabase.from('observacoes_paciente').insert({
    paciente_id: pacienteId,
    texto: texto?.trim() || null,
    tag,
    google_drive_file_id: arquivo?.id ?? null,
    google_drive_file_url: arquivo?.url ?? null,
    google_drive_file_nome: arquivo?.nome ?? null,
    google_drive_file_mime: arquivo?.mime ?? null,
    autor_id: user?.id ?? null,
  })

  if (error) return { error: 'Erro ao salvar observação.' }

  revalidatePath(`/pacientes/${pacienteId}`)
  return { success: true }
}

export async function buscarPacientesPorNome(termo: string): Promise<{ id: string; nome: string; detalhe?: string }[]> {
  const termoBusca = termo.trim()
  const termoCpf = normalizarCPF(termoBusca)
  const buscaPorNome = /[A-Za-zÀ-ÿ]/.test(termoBusca)

  if (termoBusca.length < 2 && termoCpf.length < 3) return []

  const supabase = await createClient()
  let query = supabase
    .from('pacientes')
    .select('id, nome, telefone, cpf')
    .not('ativo', 'is', 'false')
    .order('nome', { ascending: true })
    .limit(10)

  if (buscaPorNome) {
    query = query.ilike('nome', `%${termoBusca}%`)
  } else if (termoCpf.length >= 3) {
    query = query.ilike('cpf', `%${termoCpf}%`)
  }

  const { data } = await query

  return (data ?? []).map(p => ({
    id: p.id,
    nome: p.nome,
    detalhe: p.cpf ?? p.telefone ?? undefined,
  }))
}

export async function buscarMedicosPorNome(termo: string): Promise<{ id: string; nome: string; detalhe?: string }[]> {
  if (!termo.trim()) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, especialidade')
    .ilike('full_name', `%${termo.trim()}%`)
    .eq('role', 'medico')
    .eq('ativo', true)
    .order('full_name', { ascending: true })
    .limit(8)
  return (data ?? []).map(p => ({ id: p.id, nome: p.full_name ?? '', detalhe: p.especialidade ?? undefined }))
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
