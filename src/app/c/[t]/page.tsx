import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'

type Props = { params: Promise<{ t: string }> }

export default async function ShortConfirmPage({ params }: Props) {
  const { t } = await params
  const supabase = await createClient()

  const { data } = await supabase
    .from('atendimentos')
    .select('token_confirmacao')
    .eq('token_curto', t)
    .single()

  if (!data?.token_confirmacao) {
    notFound()
  }

  redirect(`/confirmar/${data.token_confirmacao}`)
}
