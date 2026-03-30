'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function registrarAvaliacao(prevState: any, formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado' }

  const paciente_id = formData.get('paciente_id') as string
  const fechou = formData.get('fechou') === 'true'
  const motivo_nao_fechamento = formData.get('motivo_nao_fechamento') as string

  if (!fechou && !motivo_nao_fechamento) {
    return { error: 'Por favor, informe o motivo do não fechamento.' }
  }

  const { error: atendimentoError } = await supabase
    .from('atendimentos')
    .insert({
      paciente_id,
      fisioterapeuta_id: user.id,
      tipo: 'avaliacao',
      fechou,
      motivo_nao_fechamento: fechou ? null : motivo_nao_fechamento
    })

  if (atendimentoError) {
    return { error: `Erro ao salvar avaliação: ${atendimentoError.message}` }
  }

  const statusEvento = fechou ? 'tratamento_ativo' : 'pausado'
  const obsEvento = fechou
    ? '✅ Avaliação realizada. Paciente FECHOU o tratamento.'
    : `❌ Avaliação realizada. Paciente NÃO fechou. Motivo principal: ${motivo_nao_fechamento}`

  await supabase.from('eventos_paciente').insert({
    paciente_id,
    status: statusEvento,
    observacao: obsEvento,
    responsavel_id: user.id
  })

  revalidatePath(`/pacientes/${paciente_id}`)
  return { success: true }
}