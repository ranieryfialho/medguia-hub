import { createClient } from '@/lib/supabase/server'
import twilio from 'twilio'

function getAppUrl(request: Request): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }
  const url = new URL(request.url)
  const host = request.headers.get('x-forwarded-host') ?? url.host
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
  return `${proto}://${host}`
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { telefone, mensagem, atendimento_id } = await request.json()

    if (!telefone || !mensagem) {
      return Response.json({ error: 'Telefone e mensagem são obrigatórios' }, { status: 400 })
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = process.env.TWILIO_PHONE_NUMBER

    if (!accountSid || !authToken || !fromNumber) {
      return Response.json({ error: 'Twilio não configurado' }, { status: 500 })
    }

    // Gera token de confirmação (sempre, para o link aparecer no SMS)
    const token = crypto.randomUUID()
    const linkConfirmacao = `${getAppUrl(request)}/confirmar/${token}`

    if (atendimento_id) {
      const { error: updateError } = await supabase
        .from('atendimentos')
        .update({ token_confirmacao: token })
        .eq('id', atendimento_id)
      if (updateError) {
        console.error('[sms] Erro ao salvar token:', updateError.message)
      }
    }

    const mensagemFinal = mensagem.replace(/{{link_confirmacao}}/g, linkConfirmacao)

    const client = twilio(accountSid, authToken)
    const telefoneFormatado = telefone.replace(/\D/g, '')
    const to = telefoneFormatado.startsWith('55') ? `+${telefoneFormatado}` : `+55${telefoneFormatado}`

    await client.messages.create({
      body: mensagemFinal,
      from: fromNumber,
      to,
    })

    return Response.json({ success: true })
  } catch (error) {
    console.error('Erro ao enviar SMS:', error)
    return Response.json({ error: 'Erro ao enviar SMS' }, { status: 500 })
  }
}
