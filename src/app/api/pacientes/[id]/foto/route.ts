// Rota dedicada de foto do paciente (RFC 006 / TDD 006, §5.3). Ponto único
// de escrita da foto: sessão, magic bytes, teto de 2MB, pasta do Drive,
// upload, persistência e só então limpeza do arquivo anterior — nessa ordem
// (§5.3 do TDD), para trocar um risco de lixo por um risco de perda de dado.
//
// `processarUploadFoto`/`processarRemocaoFoto` recebem as dependências
// externas (banco, pasta do Drive, cliente do Drive) por parâmetro em vez de
// as criarem internamente, para poderem ser testadas sem o runtime do Next
// (route.test.ts injeta mocks nelas).

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getClienteAutenticado } from '@/lib/google-drive'
import { garantirPastaPacientePorId } from '@/actions/google-drive'
import { detectarMimeRealPorBytes, type MimeImagemAceita } from '@/lib/imagem'
import { google } from 'googleapis'
import { Readable } from 'stream'

export const TAMANHO_MAXIMO_SERVIDOR_BYTES = 2 * 1024 * 1024 // 2MB — AC-091

type SupabaseAdmin = ReturnType<typeof createServiceClient>

interface DriveApiCliente {
  files: {
    create: (args: unknown) => Promise<{ data: { id?: string | null } }>
    update: (args: unknown) => Promise<unknown>
  }
}

interface DepsFotoPaciente {
  db: SupabaseAdmin
  garantirPastaPacientePorId: (pacienteId: string) => Promise<{ success: boolean; error?: string }>
  criarClienteDrive: () => Promise<DriveApiCliente>
}

interface ResultadoRotaFoto {
  status: number
  body: Record<string, unknown>
}

const EXTENSAO_POR_MIME: Record<MimeImagemAceita, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function nomeArquivoFoto(pacienteId: string, mime: MimeImagemAceita): string {
  const idCurto = pacienteId.replace(/-/g, '').slice(0, 8).toUpperCase()
  return `foto_perfil_${idCurto}.${EXTENSAO_POR_MIME[mime]}`
}

function createAdminClient(): SupabaseAdmin {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function criarClienteDriveReal(): Promise<DriveApiCliente> {
  const auth = await getClienteAutenticado()
  return google.drive({ version: 'v3', auth }) as unknown as DriveApiCliente
}

/**
 * Processa o upload/troca da foto de um paciente. Não cria nenhuma
 * permissão explícita no arquivo (AC-103) — a permissão é herdada da pasta
 * do paciente onde o arquivo é criado.
 */
export async function processarUploadFoto(
  deps: DepsFotoPaciente,
  pacienteId: string,
  file: File,
): Promise<ResultadoRotaFoto> {
  if (file.size > TAMANHO_MAXIMO_SERVIDOR_BYTES) {
    return { status: 400, body: { error: 'A imagem passa do limite de 2MB aceito pelo servidor.' } }
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const mimeReal = detectarMimeRealPorBytes(bytes)
  if (!mimeReal) {
    return { status: 400, body: { error: 'O arquivo enviado não é uma imagem válida.' } }
  }

  const { data: paciente } = await deps.db
    .from('pacientes')
    .select('id, foto_drive_file_id')
    .eq('id', pacienteId)
    .maybeSingle()

  if (!paciente) {
    return { status: 404, body: { error: 'Paciente não encontrado' } }
  }

  const pasta = await deps.garantirPastaPacientePorId(pacienteId)
  if (!pasta.success) {
    return { status: 502, body: { error: 'Não foi possível salvar a foto no Drive' } }
  }

  const { data: pastaDrive } = await deps.db
    .from('paciente_pastas_drive')
    .select('google_drive_folder_id')
    .eq('paciente_id', pacienteId)
    .maybeSingle()

  if (!pastaDrive?.google_drive_folder_id) {
    return { status: 502, body: { error: 'Não foi possível salvar a foto no Drive' } }
  }

  let drive: DriveApiCliente
  try {
    drive = await deps.criarClienteDrive()
  } catch (err) {
    console.error('[Foto Paciente] Drive indisponível:', err)
    return { status: 502, body: { error: 'Não foi possível salvar a foto no Drive' } }
  }

  const fileIdAnterior = paciente.foto_drive_file_id as string | null
  const nomeArquivo = nomeArquivoFoto(pacienteId, mimeReal)

  let uploadedId: string | null | undefined
  try {
    const { data: uploaded } = await drive.files.create({
      requestBody: { name: nomeArquivo, parents: [pastaDrive.google_drive_folder_id] },
      media: { mimeType: mimeReal, body: Readable.from(Buffer.from(bytes)) },
      fields: 'id',
    })
    uploadedId = uploaded.id
  } catch (err) {
    console.error('[Foto Paciente] Falha ao subir foto para o Drive:', err)
    return { status: 502, body: { error: 'Não foi possível salvar a foto no Drive' } }
  }

  if (!uploadedId) {
    return { status: 502, body: { error: 'Não foi possível salvar a foto no Drive' } }
  }

  const fotoAtualizadaEm = new Date().toISOString()

  const { error: updateError } = await deps.db
    .from('pacientes')
    .update({ foto_drive_file_id: uploadedId, foto_atualizada_em: fotoAtualizadaEm })
    .eq('id', pacienteId)

  if (updateError) {
    console.error('[Foto Paciente] Falha ao persistir foto no banco:', updateError)
    return { status: 502, body: { error: 'Não foi possível salvar a foto no Drive' } }
  }

  if (fileIdAnterior && fileIdAnterior !== uploadedId) {
    try {
      // Só apaga o anterior depois do novo estar salvo no banco (§5.3 do
      // TDD): se a limpeza falhar aqui, sobra um órfão recuperável (T-014),
      // nunca uma perda de foto.
      await drive.files.update({ fileId: fileIdAnterior, requestBody: { trashed: true } })
    } catch (err) {
      console.warn(
        '[Foto Paciente] Falha ao remover foto anterior do Drive (arquivo órfão):',
        pacienteId,
        fileIdAnterior,
        err,
      )
    }
  }

  return { status: 200, body: { fotoDriveFileId: uploadedId, fotoAtualizadaEm } }
}

/** Remove a foto do paciente. Idempotente: paciente sem foto responde 200 sem tocar no Drive (AC-095). */
export async function processarRemocaoFoto(
  deps: DepsFotoPaciente,
  pacienteId: string,
): Promise<ResultadoRotaFoto> {
  const { data: paciente } = await deps.db
    .from('pacientes')
    .select('id, foto_drive_file_id')
    .eq('id', pacienteId)
    .maybeSingle()

  if (!paciente) {
    return { status: 404, body: { error: 'Paciente não encontrado' } }
  }

  const fileId = paciente.foto_drive_file_id as string | null
  if (!fileId) {
    return { status: 200, body: { ok: true } }
  }

  try {
    const drive = await deps.criarClienteDrive()
    await drive.files.update({ fileId, requestBody: { trashed: true } })
  } catch (err) {
    console.error('[Foto Paciente] Falha ao mover foto para a lixeira do Drive:', pacienteId, fileId, err)
  }

  const { error: updateError } = await deps.db
    .from('pacientes')
    .update({ foto_drive_file_id: null, foto_atualizada_em: null })
    .eq('id', pacienteId)

  if (updateError) {
    console.error('[Foto Paciente] Falha ao limpar foto do banco:', updateError)
    return { status: 502, body: { error: 'Não foi possível remover a foto' } }
  }

  return { status: 200, body: { ok: true } }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return Response.json({ error: 'Arquivo obrigatório' }, { status: 400 })
    }

    const resultado = await processarUploadFoto(
      { db: createAdminClient(), garantirPastaPacientePorId, criarClienteDrive: criarClienteDriveReal },
      id,
      file,
    )
    return Response.json(resultado.body, { status: resultado.status })
  } catch (err) {
    console.error('[Foto Paciente]', err)
    return Response.json({ error: 'Erro interno ao processar a foto' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params

    const resultado = await processarRemocaoFoto(
      { db: createAdminClient(), garantirPastaPacientePorId, criarClienteDrive: criarClienteDriveReal },
      id,
    )
    return Response.json(resultado.body, { status: resultado.status })
  } catch (err) {
    console.error('[Foto Paciente]', err)
    return Response.json({ error: 'Erro interno ao processar a foto' }, { status: 500 })
  }
}
