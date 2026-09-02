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
import { startBackgroundMigration, isMigrationRunning } from '@/lib/migration-runner'

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

type MigrationStatus = 'idle' | 'running' | 'paused' | 'completed'

async function lerStatusMigracaoDB(): Promise<MigrationStatus> {
  const db = createServiceClient()
  const { data } = await db
    .from('configuracoes_sistema')
    .select('valor')
    .eq('chave', 'google_drive_migration_status')
    .maybeSingle()
  return (data?.valor as MigrationStatus) ?? 'idle'
}

async function salvarStatusMigracaoDB(status: MigrationStatus, erros?: number, ultimoErro?: string): Promise<void> {
  const db = createServiceClient()
  const agora = new Date().toISOString()
  await db.from('configuracoes_sistema').upsert({ chave: 'google_drive_migration_status', valor: status, atualizado_em: agora })
  if (erros !== undefined) {
    await db.from('configuracoes_sistema').upsert({ chave: 'google_drive_migration_erros', valor: String(erros), atualizado_em: agora })
  }
  if (ultimoErro !== undefined) {
    await db.from('configuracoes_sistema').upsert({ chave: 'google_drive_migration_ultimo_erro', valor: ultimoErro.slice(0, 500), atualizado_em: agora })
  }
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
    } catch (err) {
      console.error(`[Drive] Falha ao criar pasta do atendimento ${atendimento.id}:`, err)
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

const CHAVE_ARQUIVOS_ORFAOS_PENDENTES = 'google_drive_arquivos_orfaos_pendentes'

export interface ArquivoOrfaoDrivePendente {
  pacienteId: string
  fileId: string
  registradoEm: string
}

async function lerArquivosOrfaosPendentesDB(): Promise<ArquivoOrfaoDrivePendente[]> {
  const db = createServiceClient()
  const { data } = await db
    .from('configuracoes_sistema')
    .select('valor')
    .eq('chave', CHAVE_ARQUIVOS_ORFAOS_PENDENTES)
    .maybeSingle()

  if (!data?.valor) return []
  try {
    const parsed = JSON.parse(data.valor)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function salvarArquivosOrfaosPendentesDB(lista: ArquivoOrfaoDrivePendente[]): Promise<void> {
  const db = createServiceClient()
  await db.from('configuracoes_sistema').upsert({
    chave: CHAVE_ARQUIVOS_ORFAOS_PENDENTES,
    valor: JSON.stringify(lista),
    atualizado_em: new Date().toISOString(),
  })
}

/** Registra um `fileId` que falhou ao ser apagado do Drive (T-004, §5.3 do TDD), para a rotina de T-014 varrer depois. */
export async function registrarArquivoOrfaoDrive(pacienteId: string, fileId: string): Promise<void> {
  const pendentes = await lerArquivosOrfaosPendentesDB()
  if (pendentes.some(p => p.fileId === fileId)) return
  pendentes.push({ pacienteId, fileId, registradoEm: new Date().toISOString() })
  await salvarArquivosOrfaosPendentesDB(pendentes)
}

export async function listarArquivosOrfaosDrivePendentes(): Promise<ArquivoOrfaoDrivePendente[]> {
  return lerArquivosOrfaosPendentesDB()
}

/** Tira o `fileId` da lista de pendentes depois que a rotina de limpeza confirma a remoção no Drive. */
export async function removerArquivoOrfaoDrivePendente(fileId: string): Promise<void> {
  const pendentes = await lerArquivosOrfaosPendentesDB()
  const restante = pendentes.filter(p => p.fileId !== fileId)
  if (restante.length === pendentes.length) return
  await salvarArquivosOrfaosPendentesDB(restante)
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

export async function listarMidiasPaciente(pacienteId: string): Promise<{
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
      .from('paciente_midias')
      .select('id, google_drive_file_id, google_drive_file_url, nome, mime_type, tamanho_bytes, criado_em')
      .eq('paciente_id', pacienteId)
      .order('criado_em', { ascending: false })

    if (error) return { midias: [], error: error.message }
    return { midias: data ?? [] }
  } catch (err) {
    return { midias: [], error: String(err) }
  }
}

export async function listarMidiasPacienteConsultas(pacienteId: string): Promise<{
  midias: Array<{
    id: string
    google_drive_file_id: string
    google_drive_file_url: string | null
    nome: string
    mime_type: string
    tamanho_bytes: number | null
    criado_em: string
    atendimento_data: string | null
    atendimento_tipo: string | null
  }>
  error?: string
}> {
  try {
    const db = createServiceClient()

    const { data: atendimentos } = await db
      .from('atendimentos')
      .select('id, data_agendamento, tipo')
      .eq('paciente_id', pacienteId)

    if (!atendimentos?.length) return { midias: [] }

    const atendimentoIds = atendimentos.map((a: { id: string }) => a.id)
    const atendimentoMap = new Map(
      atendimentos.map((a: { id: string; data_agendamento: string; tipo: string | null }) => [a.id, a])
    )

    const { data, error } = await db
      .from('atendimento_midias')
      .select('id, atendimento_id, google_drive_file_id, google_drive_file_url, nome, mime_type, tamanho_bytes, criado_em')
      .in('atendimento_id', atendimentoIds)
      .order('criado_em', { ascending: false })

    if (error) return { midias: [], error: error.message }

    return {
      midias: (data ?? []).map((m: { id: string; atendimento_id: string; google_drive_file_id: string; google_drive_file_url: string | null; nome: string; mime_type: string; tamanho_bytes: number | null; criado_em: string }) => {
        const atend = atendimentoMap.get(m.atendimento_id) as { data_agendamento: string; tipo: string | null } | undefined
        return {
          id: m.id,
          google_drive_file_id: m.google_drive_file_id,
          google_drive_file_url: m.google_drive_file_url,
          nome: m.nome,
          mime_type: m.mime_type,
          tamanho_bytes: m.tamanho_bytes,
          criado_em: m.criado_em,
          atendimento_data: atend?.data_agendamento ?? null,
          atendimento_tipo: atend?.tipo ?? null,
        }
      }),
    }
  } catch (err) {
    return { midias: [], error: String(err) }
  }
}

export async function buscarPastaPaciente(pacienteId: string): Promise<{
  url: string | null
  driveConectado: boolean
}> {
  try {
    const db = createServiceClient()
    const [statusConexao, { data: pasta }] = await Promise.all([
      getStatusConexao(),
      db
        .from('paciente_pastas_drive')
        .select('google_drive_folder_url')
        .eq('paciente_id', pacienteId)
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

export async function buscarStatusMigracao(): Promise<{
  status: MigrationStatus
  erros: number
  ultimoErro?: string
}> {
  const db = createServiceClient()
  const { data } = await db
    .from('configuracoes_sistema')
    .select('chave, valor')
    .in('chave', ['google_drive_migration_status', 'google_drive_migration_erros', 'google_drive_migration_ultimo_erro'])

  const map = Object.fromEntries(
    (data ?? []).map((r: { chave: string; valor: string }) => [r.chave, r.valor]),
  )
  let status = ((map['google_drive_migration_status'] ?? 'idle') as MigrationStatus)
  const erros = Number(map['google_drive_migration_erros'] ?? 0)
  const ultimoErro = map['google_drive_migration_ultimo_erro'] ?? undefined

  // If DB says running but the in-process runner is gone (server restart), reset to paused
  if (status === 'running' && !isMigrationRunning()) {
    await salvarStatusMigracaoDB('paused')
    status = 'paused'
  }

  return { status, erros, ultimoErro }
}

export async function iniciarMigracao(): Promise<{ success: boolean; error?: string }> {
  try {
    const driveStatus = await getStatusConexao()
    if (!driveStatus.conectado) {
      return { success: false, error: 'Google Drive não conectado' }
    }

    if (isMigrationRunning()) return { success: true }

    await salvarStatusMigracaoDB('running', 0)

    let errosAcumulados = 0

    startBackgroundMigration(
      async () => {
        const result = await migrarProximoLote(50)
        errosAcumulados += result.erros
        await salvarStatusMigracaoDB('running', errosAcumulados, result.ultimoErro)
        // Lote sem nenhum sucesso = pausa com mensagem de diagnóstico (não reseta para idle)
        if (!result.concluido && result.processados === 0 && result.erros > 0) {
          const msg = result.ultimoErro ?? `Nenhum paciente processado no lote (${result.erros} erros).`
          return { concluido: false, error: msg }
        }
        return { concluido: result.concluido, error: result.error }
      },
      async () => {
        const dbStatus = await lerStatusMigracaoDB()
        return dbStatus === 'running'
      },
      async (reason) => {
        // Em caso de erro, vai para 'paused' (mantém botão "Retomar") em vez de resetar para 'idle'
        const finalStatus: MigrationStatus =
          reason === 'completed' ? 'completed' : reason === 'paused' ? 'paused' : 'paused'
        await salvarStatusMigracaoDB(finalStatus, errosAcumulados)
        console.log(`[Drive] Migração finalizada: ${finalStatus} (${errosAcumulados} erros acumulados)`)
      },
    )

    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export async function pausarMigracao(): Promise<void> {
  await salvarStatusMigracaoDB('paused')
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
  ultimoErro?: string
}> {
  try {
    // Valida token uma única vez antes do loop — evita chamada de rede por paciente
    const status = await getStatusConexao()
    if (!status.conectado) {
      const msg = status.tokenInvalido
        ? 'Sessão do Google Drive expirada. Reconecte a conta em Configurações → Google Drive.'
        : 'Google Drive não conectado'
      return { processados: 0, erros: 0, restantes: 0, concluido: false, error: msg }
    }

    const db = createServiceClient()
    const { data: pacientes } = await db.rpc('buscar_pacientes_sem_pasta_drive', { p_limit: tamanhoLote })

    if (!pacientes?.length) {
      return { processados: 0, erros: 0, restantes: 0, concluido: true }
    }

    let processados = 0
    let erros = 0
    let ultimoErro: string | undefined

    for (const paciente of pacientes) {
      const resultado = await criarPastaPaciente(paciente.id, paciente.nome)
      if (resultado.success) {
        processados++
      } else {
        const msg = `Paciente "${paciente.nome}" (${paciente.id.slice(0, 8)}): ${resultado.error}`
        console.error(`[Drive] ${msg}`)
        ultimoErro = msg
        erros++
      }
      await new Promise(r => setTimeout(r, 150))
    }

    const { data: restantesData } = await db.rpc('contar_pacientes_sem_pasta_drive')
    const restantes = Number(restantesData ?? 0)

    return { processados, erros, restantes, concluido: restantes === 0, ultimoErro }
  } catch (err) {
    const msg = String(err)
    console.error('[Drive] Erro na migração em lote:', msg)
    return { processados: 0, erros: 1, restantes: -1, concluido: false, error: msg, ultimoErro: msg }
  }
}
