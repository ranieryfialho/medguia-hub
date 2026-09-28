import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const BUCKET = 'clinica-assets'
const LOGO_PATH = 'clinica-logo'

function db() {
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
    if (!file) return Response.json({ error: 'Arquivo não enviado' }, { status: 400 })

    if (!file.type.startsWith('image/')) {
      return Response.json({ error: 'Apenas imagens são aceitas' }, { status: 400 })
    }
    if (file.size > 2 * 1024 * 1024) {
      return Response.json({ error: 'Imagem deve ter no máximo 2 MB' }, { status: 400 })
    }

    const storage = db().storage

    // Cria o bucket se ainda não existir
    await storage.createBucket(BUCKET, { public: true }).catch(() => {})

    const ext = file.name.split('.').pop() ?? 'png'
    const path = `${LOGO_PATH}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) throw uploadError

    const { data: urlData } = storage.from(BUCKET).getPublicUrl(path)
    // Adiciona timestamp para bustar cache do navegador
    const url = `${urlData.publicUrl}?t=${Date.now()}`

    await db()
      .from('configuracoes_sistema')
      .upsert(
        { chave: 'clinica_logo_url', valor: url, atualizado_em: new Date().toISOString() },
        { onConflict: 'chave' },
      )

    return Response.json({ url })
  } catch (err) {
    console.error('[Upload Logo]', err)
    return Response.json({ error: 'Erro ao fazer upload da logo' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

    const storage = db().storage

    // Remove arquivos com qualquer extensão
    const { data: files } = await storage.from(BUCKET).list()
    const logos = (files ?? []).filter(f => f.name.startsWith(LOGO_PATH))
    if (logos.length) {
      await storage.from(BUCKET).remove(logos.map(f => f.name))
    }

    await db()
      .from('configuracoes_sistema')
      .upsert(
        { chave: 'clinica_logo_url', valor: '', atualizado_em: new Date().toISOString() },
        { onConflict: 'chave' },
      )

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[Delete Logo]', err)
    return Response.json({ error: 'Erro ao remover logo' }, { status: 500 })
  }
}