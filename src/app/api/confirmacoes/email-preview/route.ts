import { createClient } from '@/lib/supabase/server'
import { render } from '@react-email/render'
import { ConfirmacaoConsulta } from '@/lib/email-templates/ConfirmacaoConsulta'
import { LOGO_FOT_BASE64 } from '@/lib/email-logo'
import * as React from 'react'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { mensagem, assunto, paciente } = await request.json()

    const html = await render(
      React.createElement(ConfirmacaoConsulta, {
        pacienteNome: paciente.nome,
        tipo: paciente.tipo,
        data: paciente.data,
        hora: paciente.hora,
        profissional: paciente.profissional,
        mensagem,
        assunto,
        logoSrc: LOGO_FOT_BASE64,
        linkConfirmacao: '#preview',
      })
    )

    return Response.json({ html })
  } catch (error) {
    console.error('Erro ao gerar preview:', error)
    return Response.json({ error: 'Erro ao gerar preview' }, { status: 500 })
  }
}
