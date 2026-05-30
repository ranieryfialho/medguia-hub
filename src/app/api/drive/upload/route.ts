import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getClienteAutenticado } from '@/lib/google-drive'
import { google } from 'googleapis'
import { Readable } from 'stream'

function createAdminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const atendimentoId = formData.get('atendimentoId') as string | null

    if (!file || !atendimentoId) {
      return Response.json({ error: 'Arquivo e atendimentoId são obrigatórios' }, { status: 400 })
    }

    if (file.size > 50 * 1024 * 1024) {
      return Response.json({ error: 'Arquivo muito grande. Máximo 50MB.' }, { status: 400 })
    }

    const db = createAdminClient()
    const { data: pasta } = await db
      .from('atendimento_pastas_drive')
      .select('google_drive_folder_id')
      .eq('atendimento_id', atendimentoId)
      .maybeSingle()

    if (!pasta) {
      return Response.json({ error: 'Pasta do atendimento não encontrada' }, { status: 404 })
    }

    const auth = await getClienteAutenticado()
    const drive = google.drive({ version: 'v3', auth })

    const buffer = Buffer.from(await file.arrayBuffer())
    const readable = Readable.from(buffer)

    const { data: uploaded } = await drive.files.create({
      requestBody: {
        name: file.name,
        parents: [pasta.google_drive_folder_id],
      },
      media: {
        mimeType: file.type || 'application/octet-stream',
        body: readable,
      },
      fields: 'id, name, mimeType, size, webViewLink',
    })

    if (!uploaded.id) {
      return Response.json({ error: 'Falha ao fazer upload para o Drive' }, { status: 500 })
    }

    const { error: dbError } = await db.from('atendimento_midias').insert({
      atendimento_id: atendimentoId,
      google_drive_file_id: uploaded.id,
      google_drive_file_url: uploaded.webViewLink ?? null,
      nome: uploaded.name ?? file.name,
      mime_type: uploaded.mimeType ?? file.type,
      tamanho_bytes: uploaded.size ? parseInt(uploaded.size) : file.size,
    })

    if (dbError) {
      console.error('[Drive Upload] Erro ao salvar no banco:', dbError)
      return Response.json({ error: `Arquivo enviado ao Drive, mas não foi possível registrar no banco: ${dbError.message}` }, { status: 500 })
    }

    return Response.json({
      id: uploaded.id,
      nome: uploaded.name,
      mimeType: uploaded.mimeType,
      fileUrl: uploaded.webViewLink,
    })
  } catch (err) {
    console.error('[Drive Upload]', err)
    return Response.json({ error: 'Erro interno no upload' }, { status: 500 })
  }
}
