import { createClient } from '@/lib/supabase/server'
import { getClienteAutenticado } from '@/lib/google-drive'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response('Não autenticado', { status: 401 })

    const { fileId } = await params
    const rangeHeader = request.headers.get('range')

    const auth = await getClienteAutenticado()
    const tokenInfo = await auth.getAccessToken()
    const accessToken = tokenInfo.token
    if (!accessToken) throw new Error('Sem token de acesso ao Google Drive')

    const driveUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`
    const fetchHeaders: HeadersInit = { Authorization: `Bearer ${accessToken}` }
    if (rangeHeader) fetchHeaders['Range'] = rangeHeader

    const driveResponse = await fetch(driveUrl, { headers: fetchHeaders })

    if (!driveResponse.ok && driveResponse.status !== 206) {
      console.error(`[Drive Proxy] Drive retornou ${driveResponse.status} para ${fileId}`)
      return new Response('Arquivo não encontrado no Drive', { status: driveResponse.status })
    }

    const responseHeaders = new Headers()
    const forward = ['content-type', 'content-length', 'content-range', 'accept-ranges']
    for (const h of forward) {
      const v = driveResponse.headers.get(h)
      if (v) responseHeaders.set(h, v)
    }
    responseHeaders.set('accept-ranges', 'bytes')
    responseHeaders.set('cache-control', 'private, max-age=3600')
    responseHeaders.set('content-disposition', 'inline')

    return new Response(driveResponse.body, {
      status: driveResponse.status,
      headers: responseHeaders,
    })
  } catch (err) {
    console.error('[Drive Proxy]', err)
    return new Response('Erro ao acessar arquivo', { status: 500 })
  }
}
