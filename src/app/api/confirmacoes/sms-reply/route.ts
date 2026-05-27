import { createClient } from '@/lib/supabase/server'

// Twilio envia os dados como application/x-www-form-urlencoded
export async function POST(request: Request) {
  try {
    const body = await request.text()
    const params = new URLSearchParams(body)

    const from = params.get('From') ?? ''
    const texto = (params.get('Body') ?? '').trim().toUpperCase()

    const resposta = classificarResposta(texto)
    if (!resposta) {
      return twimlResponse('Não entendemos sua resposta. Responda SIM para confirmar ou NÃO para cancelar.')
    }

    const supabase = await createClient()

    // Normaliza o telefone recebido do Twilio (+5511999999999 → 11999999999)
    const telefoneNormalizado = from.replace(/\D/g, '').replace(/^55/, '')

    // Busca o atendimento mais recente com esse telefone ainda aguardando confirmação
    const { data: atendimento } = await supabase
      .from('atendimentos')
      .select('id, paciente:pacientes!inner(nome, telefone)')
      .eq('status', 'Aguardando')
      .or('contato_confirmacao.is.null,contato_confirmacao.eq.nao_atendeu')
      .order('data_agendamento', { ascending: true })
      .limit(20)
      .then(({ data }) => ({
        data: data?.find(a => {
          const tel = (a.paciente as unknown as { telefone: string })?.telefone?.replace(/\D/g, '').replace(/^55/, '') ?? ''
          return tel === telefoneNormalizado || tel.endsWith(telefoneNormalizado) || telefoneNormalizado.endsWith(tel)
        }) ?? null
      }))

    if (!atendimento) {
      return twimlResponse('Não encontramos uma consulta pendente para confirmar. Entre em contato com a clínica.')
    }

    const nome = (atendimento.paciente as unknown as { nome: string })?.nome?.split(' ')[0] ?? 'Paciente'

    if (resposta === 'sim') {
      await supabase
        .from('atendimentos')
        .update({ status: 'Confirmado', contato_confirmacao: 'confirmou' })
        .eq('id', atendimento.id)

      return twimlResponse(`✅ Obrigado, ${nome}! Sua consulta foi confirmada. Até logo!`)
    }

    if (resposta === 'nao') {
      await supabase
        .from('atendimentos')
        .update({ contato_confirmacao: 'vai_faltar' })
        .eq('id', atendimento.id)

      return twimlResponse(`Entendido, ${nome}. Registramos que você não poderá comparecer. Entre em contato para reagendar.`)
    }

    return twimlResponse('Não entendemos sua resposta. Responda SIM para confirmar ou NÃO para cancelar.')
  } catch (error) {
    console.error('Erro no webhook SMS:', error)
    return twimlResponse('Ocorreu um erro. Entre em contato com a clínica.')
  }
}

function classificarResposta(texto: string): 'sim' | 'nao' | null {
  const sim = ['SIM', 'S', 'YES', 'Y', 'CONFIRMO', 'CONFIRMADO', '1']
  const nao = ['NÃO', 'NAO', 'N', 'NO', 'CANCELO', 'CANCELAR', '2']
  if (sim.includes(texto)) return 'sim'
  if (nao.includes(texto)) return 'nao'
  return null
}

function twimlResponse(mensagem: string) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${mensagem}</Message></Response>`
  return new Response(xml, {
    headers: { 'Content-Type': 'text/xml' },
  })
}
