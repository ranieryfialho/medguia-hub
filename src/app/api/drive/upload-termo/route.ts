import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getClienteAutenticado, buscarOuCriarSubpasta, criarPastaPacienteNoDrive } from '@/lib/google-drive'
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
    const vendaId = formData.get('vendaId') as string | null
    const pacienteId = formData.get('pacienteId') as string | null
    const nomePaciente = formData.get('nomePaciente') as string | null
    const nomeTratamento = formData.get('nomeTratamento') as string | null
    const tipoRaw = formData.get('tipo') as string | null
    const tipo: 'termo' | 'recibo' = tipoRaw === 'recibo' ? 'recibo' : 'termo'

    if (!file || !vendaId || !pacienteId || !nomePaciente) {
      return Response.json({ error: 'Dados obrigatórios ausentes' }, { status: 400 })
    }

    const db = createAdminClient()

    // Garante pasta do paciente
    let { data: pastaPaciente } = await db
      .from('paciente_pastas_drive')
      .select('google_drive_folder_id')
      .eq('paciente_id', pacienteId)
      .maybeSingle()

    if (!pastaPaciente) {
      const { folderId, folderUrl } = await criarPastaPacienteNoDrive(pacienteId, nomePaciente)
      await db.from('paciente_pastas_drive').insert({
        paciente_id: pacienteId,
        google_drive_folder_id: folderId,
        google_drive_folder_url: folderUrl,
      })
      pastaPaciente = { google_drive_folder_id: folderId }
    }

    // Cria pasta "Termos" dentro da pasta do paciente
    const { folderId: pastaTermosId } = await buscarOuCriarSubpasta(
      pastaPaciente.google_drive_folder_id,
      'Termos',
    )

    // Cria subpasta do tratamento
    const nomePasta = nomeTratamento?.trim() || 'Geral'
    const { folderId: pastaTratamentoId, folderUrl: pastaTratamentoUrl } =
      await buscarOuCriarSubpasta(pastaTermosId, nomePasta)

    // Upload do PDF
    const auth = await getClienteAutenticado()
    const drive = google.drive({ version: 'v3', auth })

    const buffer = Buffer.from(await file.arrayBuffer())
    const readable = Readable.from(buffer)

    const dataHoje = new Date().toISOString().slice(0, 10)
    const nomeArquivo = `${tipo === 'recibo' ? 'Recibo' : 'Contrato'}_${dataHoje}.pdf`

    const { data: uploaded } = await drive.files.create({
      requestBody: {
        name: nomeArquivo,
        parents: [pastaTratamentoId],
      },
      media: {
        mimeType: 'application/pdf',
        body: readable,
      },
      fields: 'id, name, webViewLink',
    })

    if (!uploaded.id) {
      return Response.json({ error: 'Falha ao fazer upload para o Drive' }, { status: 500 })
    }

    // Salva registro na tabela venda_termos
    await db.from('venda_termos').insert({
      venda_id: vendaId,
      paciente_id: pacienteId,
      tipo,
      google_drive_file_id: uploaded.id,
      google_drive_file_url: uploaded.webViewLink ?? null,
      google_drive_folder_url: pastaTratamentoUrl,
      gerado_por: user.id,
    })

    return Response.json({
      fileId: uploaded.id,
      fileUrl: uploaded.webViewLink,
      folderUrl: pastaTratamentoUrl,
    })
  } catch (err) {
    console.error('[Upload Termo]', err)
    return Response.json({ error: 'Erro interno ao gerar o termo' }, { status: 500 })
  }
}