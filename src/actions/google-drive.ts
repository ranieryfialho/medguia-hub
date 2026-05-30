'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import {
  gerarUrlAutorizacao,
  salvarTokensGoogle,
  criarPastaPacienteNoDrive,
  criarPastaAtendimentoNoDrive,
  getStatusConexao,
  removerConexao,
} from '@/lib/google-drive'

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function iniciarConexaoGoogleDrive() {
  const url = gerarUrlAutorizacao()
  redirect(url)
}

export async function desconectarGoogleDrive() {
  await removerConexao()
  revalidatePath('/configuracoes/google-drive')
}

export async function buscarStatusConexaoGoogle() {
  return getStatusConexao()
}

export async function completarConexaoGoogle(code: string) {
  await salvarTokensGoogle(code)
  revalidatePath('/configuracoes/google-drive')
}

export async function criarPastaPaciente(
  pacienteId: string,
  nome: string,
): Promise<{ success: boolean; folderId?: string; folderUrl?: string; error?: string }> {
  try {
    const status = await getStatusConexao()
    if (!status.conectado) return { success: false, error: 'Google Drive não conectado' }

    const db = createServiceClient()

    const { data: existing } = await db
      .from('paciente_pastas_drive')
      .select('google_drive_folder_id, google_drive_folder_url')
      .eq('paciente_id', pacienteId)
      .maybeSingle()

    if (existing) {
      return { success: true, folderId: existing.google_drive_folder_id, folderUrl: existing.google_drive_folder_url }
    }

    const { folderId, folderUrl } = await criarPastaPacienteNoDrive(pacienteId, nome)

    await db.from('paciente_pastas_drive').insert({
      paciente_id: pacienteId,
      google_drive_folder_id: folderId,
      google_drive_folder_url: folderUrl,
    })

    return { success: true, folderId, folderUrl }
  } catch (err) {
    console.error('[Drive] Erro ao criar pasta do paciente:', err)
    return { success: false, error: String(err) }
  }
}

export async function criarPastaAtendimento(
  atendimentoId: string,
  pacienteId: string,
  nomePaciente: string,
  dataAgendamento: string,
  tipo: string,
): Promise<{ success: boolean; folderUrl?: string; error?: string }> {
  try {
    const status = await getStatusConexao()
    if (!status.conectado) return { success: false, error: 'Google Drive não conectado' }

    const db = createServiceClient()

    const { data: existingAppt } = await db
      .from('atendimento_pastas_drive')
      .select('google_drive_folder_url')
      .eq('atendimento_id', atendimentoId)
      .maybeSingle()

    if (existingAppt) return { success: true, folderUrl: existingAppt.google_drive_folder_url }

    // Garante que a pasta do paciente existe
    const pastaPacienteResult = await criarPastaPaciente(pacienteId, nomePaciente)
    if (!pastaPacienteResult.success || !pastaPacienteResult.folderId) {
      return { success: false, error: pastaPacienteResult.error ?? 'Falha ao criar pasta do paciente' }
    }

    const data = dataAgendamento.slice(0, 10)
    const { folderId, folderUrl } = await criarPastaAtendimentoNoDrive(
      pastaPacienteResult.folderId,
      data,
      tipo,
    )

    await db.from('atendimento_pastas_drive').insert({
      atendimento_id: atendimentoId,
      paciente_id: pacienteId,
      google_drive_folder_id: folderId,
      google_drive_folder_url: folderUrl,
    })

    return { success: true, folderUrl }
  } catch (err) {
    console.error('[Drive] Erro ao criar pasta do atendimento:', err)
    return { success: false, error: String(err) }
  }
}

export async function criarPastasAtendimentosLote(
  atendimentos: Array<{ id: string; data_agendamento: string; tipo: string }>,
  pacienteId: string,
): Promise<void> {
  const status = await getStatusConexao()
  if (!status.conectado) return

  const db = createServiceClient()
  const { data: paciente } = await db
    .from('pacientes')
    .select('nome')
    .eq('id', pacienteId)
    .maybeSingle()

  if (!paciente) return

  for (const atendimento of atendimentos) {
    try {
      await criarPastaAtendimento(
        atendimento.id,
        pacienteId,
        paciente.nome,
        atendimento.data_agendamento,
        atendimento.tipo,
      )
    } catch {
      // falha silenciosa por sessão — não bloqueia as demais
    }
  }
}

export async function garantirPastaPacientePorId(
  pacienteId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const status = await getStatusConexao()
    if (!status.conectado) return { success: false, error: 'Google Drive não conectado' }

    const db = createServiceClient()

    const { data: existing } = await db
      .from('paciente_pastas_drive')
      .select('id')
      .eq('paciente_id', pacienteId)
      .maybeSingle()

    if (existing) return { success: true }

    const { data: paciente } = await db
      .from('pacientes')
      .select('nome')
      .eq('id', pacienteId)
      .maybeSingle()

    if (!paciente) return { success: false, error: 'Paciente não encontrado' }

    return criarPastaPaciente(pacienteId, paciente.nome)
  } catch (err) {
    console.error('[Drive] Erro ao garantir pasta do paciente:', err)
    return { success: false, error: String(err) }
  }
}

export async function listarMidiasAtendimento(atendimentoId: string): Promise<{
  midias: Array<{
    id: string
    google_drive_file_id: string
    google_drive_file_url: string | null
    nome: string
    mime_type: string
    tamanho_bytes: number | null
    criado_em: string
  }>
  error?: string
}> {
  try {
    const db = createServiceClient()
    const { data, error } = await db
      .from('atendimento_midias')
      .select('id, google_drive_file_id, google_drive_file_url, nome, mime_type, tamanho_bytes, criado_em')
      .eq('atendimento_id', atendimentoId)
      .order('criado_em', { ascending: false })

    if (error) return { midias: [], error: error.message }
    return { midias: data ?? [] }
  } catch (err) {
    return { midias: [], error: String(err) }
  }
}

export async function buscarPastaAtendimento(atendimentoId: string): Promise<{
  url: string | null
  driveConectado: boolean
}> {
  try {
    const db = createServiceClient()
    const [statusConexao, { data: pasta }] = await Promise.all([
      getStatusConexao(),
      db
        .from('atendimento_pastas_drive')
        .select('google_drive_folder_url')
        .eq('atendimento_id', atendimentoId)
        .maybeSingle(),
    ])

    return {
      url: pasta?.google_drive_folder_url ?? null,
      driveConectado: statusConexao.conectado,
    }
  } catch {
    return { url: null, driveConectado: false }
  }
}

export async function buscarStatsMigracao(): Promise<{
  total: number
  processados: number
  restantes: number
  error?: string
}> {
  try {
    const db = createServiceClient()
    const [{ count: totalAtivos }, { data: restantesData }] = await Promise.all([
      db.from('pacientes').select('id', { count: 'exact', head: true }).eq('ativo', true),
      db.rpc('contar_pacientes_sem_pasta_drive'),
    ])

    const restantes = Number(restantesData ?? 0)
    const total = totalAtivos ?? 0
    return { total, processados: total - restantes, restantes }
  } catch (err) {
    return { total: 0, processados: 0, restantes: 0, error: String(err) }
  }
}

export async function migrarProximoLote(tamanhoLote = 50): Promise<{
  processados: number
  erros: number
  restantes: number
  concluido: boolean
  error?: string
}> {
  try {
    const status = await getStatusConexao()
    if (!status.conectado) {
      return { processados: 0, erros: 0, restantes: 0, concluido: false, error: 'Google Drive não conectado' }
    }

    const db = createServiceClient()
    const { data: pacientes } = await db.rpc('buscar_pacientes_sem_pasta_drive', { p_limit: tamanhoLote })

    if (!pacientes?.length) {
      return { processados: 0, erros: 0, restantes: 0, concluido: true }
    }

    let processados = 0
    let erros = 0

    for (const paciente of pacientes) {
      try {
        await criarPastaPaciente(paciente.id, paciente.nome)
        processados++
        await new Promise(r => setTimeout(r, 150))
      } catch {
        erros++
      }
    }

    const { data: restantesData } = await db.rpc('contar_pacientes_sem_pasta_drive')
    const restantes = Number(restantesData ?? 0)

    return { processados, erros, restantes, concluido: restantes === 0 }
  } catch (err) {
    console.error('[Drive] Erro na migração em lote:', err)
    return { processados: 0, erros: 1, restantes: -1, concluido: false, error: String(err) }
  }
}
