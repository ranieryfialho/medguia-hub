import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getClienteAutenticado } from '@/lib/google-drive'
import { google } from 'googleapis'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const vendaId = searchParams.get('vendaId')
    if (!vendaId) return Response.json({ error: 'vendaId obrigatório' }, { status: 400 })

    const db = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data, error } = await db
      .from('venda_termos')
      .select('google_drive_file_id, google_drive_file_url, google_drive_folder_url')
      .eq('venda_id', vendaId)
      .order('gerado_em', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    if (!data?.google_drive_file_id) return Response.json({ exists: false })

    // Verifica se o arquivo ainda existe no Drive
    try {
      const auth = await getClienteAutenticado()
      const drive = google.drive({ version: 'v3', auth })
      await drive.files.get({ fileId: data.google_drive_file_id, fields: 'id' })
    } catch {
      return Response.json({ exists: false })
    }

    return Response.json({
      exists: true,
      fileUrl: data.google_drive_file_url,
      folderUrl: data.google_drive_folder_url,
    })
  } catch {
    return Response.json({ exists: false })
  }
}
