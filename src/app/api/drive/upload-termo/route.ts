import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getClienteAutenticado, buscarOuCriarSubpasta, criarPastaPacienteNoDrive } from '@/lib/google-drive'
import { sincronizarTagContratoVenda } from '@/lib/venda-tags-sistema'
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
    const aceiteEm = (formData.get('aceiteEm') as string | null) || null

    if (!file || !vendaId || !pacienteId || !nomePaciente) {
      return Response.json({ error: 'Dados obrigatórios ausentes' }, { status: 400 })
    }

    const db = createAdminClient()

    // Já existe um documento desse tipo pra essa venda? Se sim, sobrepõe (mesmo
    // arquivo no Drive, mesma linha no banco) em vez de acumular cópias.
    const { data: termoExistente } = await db
      .from('venda_termos')
      .select('id, google_drive_file_id')
      .eq('venda_id', vendaId)
      .eq('tipo', tipo)
      .order('gerado_em', { ascending: false })
      .limit(1)
      .maybeSingle()

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

    const dataHoje = new Date().toISOString().slice(0, 10)
    const nomeArquivo = `${tipo === 'recibo' ? 'Recibo' : 'Contrato'}_${dataHoje}.pdf`

    let fileId: string | null | undefined
    let fileUrl: string | null | undefined

    if (termoExistente?.google_drive_file_id) {
      try {
        // Sobrepõe o arquivo já existente no Drive, mantendo o mesmo id/link.
        const { data: atualizado } = await drive.files.update({
          fileId: termoExistente.google_drive_file_id,
          requestBody: { name: nomeArquivo },
          media: {
            mimeType: 'application/pdf',
            body: Readable.from(buffer),
          },
          fields: 'id, name, webViewLink',
        })
        fileId = atualizado.id
        fileUrl = atualizado.webViewLink
      } catch (err) {
        // Arquivo anterior não existe mais no Drive (apagado/movido manualmente) —
        // cria um novo em vez de falhar a geração.
        const status = (err as { code?: number; status?: number })?.code ?? (err as { status?: number })?.status
        if (status !== 404) throw err
      }
    }

    if (!fileId) {
      const { data: uploaded } = await drive.files.create({
        requestBody: {
          name: nomeArquivo,
          parents: [pastaTratamentoId],
        },
        media: {
          mimeType: 'application/pdf',
          body: Readable.from(buffer),
        },
        fields: 'id, name, webViewLink',
      })
      fileId = uploaded.id
      fileUrl = uploaded.webViewLink
    }

    if (!fileId) {
      return Response.json({ error: 'Falha ao fazer upload para o Drive' }, { status: 500 })
    }

    if (termoExistente) {
      // Atualiza a mesma linha em vez de acumular uma nova.
      await db
        .from('venda_termos')
        .update({
          google_drive_file_id: fileId,
          google_drive_file_url: fileUrl ?? null,
          google_drive_folder_url: pastaTratamentoUrl,
          gerado_por: user.id,
          gerado_em: new Date().toISOString(),
          aceite_em: aceiteEm,
        })
        .eq('id', termoExistente.id)
    } else {
      await db.from('venda_termos').insert({
        venda_id: vendaId,
        paciente_id: pacienteId,
        tipo,
        google_drive_file_id: fileId,
        google_drive_file_url: fileUrl ?? null,
        google_drive_folder_url: pastaTratamentoUrl,
        gerado_por: user.id,
        aceite_em: aceiteEm,
      })
    }

    if (tipo === 'termo') {
      await sincronizarTagContratoVenda(db, vendaId, user.id)
    }

    return Response.json({
      fileId,
      fileUrl,
      folderUrl: pastaTratamentoUrl,
    })
  } catch (err) {
    console.error('[Upload Termo]', err)
    return Response.json({ error: 'Erro interno ao gerar o termo' }, { status: 500 })
  }
}