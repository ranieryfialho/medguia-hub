import { createClient } from '@supabase/supabase-js'

function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Twilio envia os dados como application/x-www-form-urlencoded
export async function POST(request: Request) {
  try {
    const body = await request.text()
    const params = new URLSearchParams(body)
    const atendimentoId = new URL(request.url).searchParams.get('atendimento_id')

    const smsSid = params.get('MessageSid')
    const smsStatus = params.get('MessageStatus')
    const errorCode = params.get('ErrorCode')
    const errorMessage = params.get('ErrorMessage')

    if (!smsSid || !smsStatus) {
      return new Response(null, { status: 204 })
    }

    const supabase = createSupabaseAdminClient()
    const payload = {
      sms_sid: smsSid,
      sms_status: smsStatus,
      sms_error_code: errorCode,
      sms_error_message: errorMessage,
    }

    let query = supabase.from('atendimentos').update(payload)

    if (atendimentoId) {
      query = query.eq('id', atendimentoId)
    } else {
      query = query.eq('sms_sid', smsSid)
    }

    const { error } = await query

    if (error) {
      console.error('[sms-status] Erro ao atualizar status:', error.message)
    }

    if (errorCode || smsStatus === 'undelivered' || smsStatus === 'failed') {
      console.error('[sms-status] Falha de entrega', {
        atendimentoId,
        smsSid,
        smsStatus,
        errorCode,
        errorMessage,
      })
    }

    return new Response(null, { status: 204 })
  } catch (error) {
    console.error('[sms-status] Erro no webhook:', error)
    return new Response(null, { status: 204 })
  }
}
