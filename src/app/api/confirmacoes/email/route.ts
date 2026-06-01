import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { render } from '@react-email/render'
import { ConfirmacaoConsulta } from '@/lib/email-templates/ConfirmacaoConsulta'
import { LOGO_FOT_URL } from '@/lib/email-logo'
import * as React from 'react'

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

    const { email, mensagem, assunto, paciente, atendimento_id } = await request.json()

    if (!email || !mensagem || !assunto || !paciente) {
      return Response.json({ error: 'Dados incompletos' }, { status: 400 })
    }

    const apiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.RESEND_FROM_EMAIL

    if (!apiKey || !fromEmail) {
      return Response.json({ error: 'Resend não configurado' }, { status: 500 })
    }

    // Gera token de confirmação
    const token = crypto.randomUUID()
    const linkConfirmacao: string = `${getAppUrl(request)}/confirmar/${token}`

    if (atendimento_id) {
      const { error: updateError } = await supabase
        .from('atendimentos')
        .update({ token_confirmacao: token })
        .eq('id', atendimento_id)
      if (updateError) {
        console.error('[email] Erro ao salvar token:', updateError.message)
      }
    }

    const html = await render(
      React.createElement(ConfirmacaoConsulta, {
        pacienteNome: paciente.nome,
        tipo: paciente.tipo,
        data: paciente.data,
        hora: paciente.hora,
        profissional: paciente.profissional,
        mensagem,
        assunto,
        logoSrc: LOGO_FOT_URL,
        linkConfirmacao,
      })
    )

    const resend = new Resend(apiKey)

    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: assunto,
      html,
    })

    return Response.json({ success: true })
  } catch (error) {
    console.error('Erro ao enviar email:', error)
    return Response.json({ error: 'Erro ao enviar email' }, { status: 500 })
  }
}
