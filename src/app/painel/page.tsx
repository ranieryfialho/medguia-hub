import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { startOfDay, endOfDay } from 'date-fns'
import { PainelTV, type AtendimentoPainel } from '@/components/features/painel/PainelTV'

export const dynamic = 'force-dynamic'

export default async function PainelPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const agora  = new Date()
  const inicio = startOfDay(agora).toISOString()
  const fim    = endOfDay(agora).toISOString()

  const { data } = await supabase
    .from('atendimentos')
    .select(`
      id,
      data_agendamento,
      status,
      tipo,
      chamado_em,
      pacientes ( nome ),
      profissional:profiles!profissional_id ( full_name )
    `)
    .gte('data_agendamento', inicio)
    .lte('data_agendamento', fim)
    .not('status', 'in', '("Cancelado","Falta","Reagendado")')
    .order('data_agendamento', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const atendimentos = (data ?? []) as any as AtendimentoPainel[]

  return <PainelTV atendimentosIniciais={atendimentos} />
}
