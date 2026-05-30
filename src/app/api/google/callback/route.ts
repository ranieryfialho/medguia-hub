import { redirect } from 'next/navigation'
import { salvarTokensGoogle } from '@/lib/google-drive'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    redirect('/configuracoes/google-drive?erro=acesso_negado')
  }

  let sucesso = false
  try {
    await salvarTokensGoogle(code)
    sucesso = true
  } catch (err) {
    console.error('[Google OAuth] Falha ao salvar tokens:', err)
  }

  redirect(sucesso
    ? '/configuracoes/google-drive?conectado=true'
    : '/configuracoes/google-drive?erro=falha_auth'
  )
}
