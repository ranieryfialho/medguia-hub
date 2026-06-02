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

function gerarTokenCurto(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes).map(b => chars[b % chars.length]).join('')
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

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

    const token = crypto.randomUUID()
    const tokenCurto = gerarTokenCurto()
    const appUrl = getAppUrl(request)
    const linkConfirmacao = `${appUrl}/c/${tokenCurto}`

    if (atendimento_id) {
      const { error: updateError } = await supabase
        .from('atendimentos')
        .update({ token_confirmacao: token, token_curto: tokenCurto })
        .eq('id', atendimento_id)

      if (updateError) {
        console.error('[sms] Erro ao salvar token:', updateError.message)
      }
    }

    const mensagemFinal = mensagem.replace(/{{link_confirmacao}}/g, linkConfirmacao)
    const client = twilio(accountSid, authToken)
    const telefoneFormatado = telefone.replace(/\D/g, '')
    const to = telefoneFormatado.startsWith('55') ? `+${telefoneFormatado}` : `+55${telefoneFormatado}`
    const statusCallback = `${appUrl}/api/confirmacoes/sms-status`

    const sms = await client.messages.create({
      body: mensagemFinal,
      from: fromNumber,
      to,
      statusCallback: atendimento_id
        ? `${statusCallback}?atendimento_id=${encodeURIComponent(atendimento_id)}`
        : statusCallback,
    })

    if (atendimento_id) {
      const { error: updateError } = await supabase
        .from('atendimentos')
        .update({
          sms_sid: sms.sid,
          sms_status: sms.status,
          sms_error_code: null,
          sms_error_message: null,
          data_ultimo_envio_sms: new Date().toISOString(),
        })
        .eq('id', atendimento_id)

      if (updateError) {
        console.error('[sms] Erro ao salvar metadata do envio:', updateError.message)
      }
    }

    return Response.json({
      success: true,
      sid: sms.sid,
      status: sms.status,
      message: 'SMS aceito pela Twilio. A entrega final depende da operadora.',
    })
  } catch (error) {
    console.error('Erro ao enviar SMS:', error)
    return Response.json({ error: 'Erro ao enviar SMS' }, { status: 500 })
  }
}
