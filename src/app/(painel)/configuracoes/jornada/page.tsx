import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listarDisponibilidade } from '@/actions/disponibilidade'
import { DisponibilidadeEditor } from '@/components/features/DisponibilidadeEditor'

export default async function JornadaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const params = await searchParams

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  const isGestor = profile?.role === 'gestor' || profile?.role === 'master'

  let profissionais: { id: string; nome: string }[] = []
  if (isGestor) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('ativo', true)
      .in('role', ['fisioterapeuta', 'gestor'])
      .order('full_name')
    profissionais = (data ?? []).map(p => ({ id: p.id, nome: p.full_name || 'Sem nome' }))
  }

  const paramProfId = typeof params.profissional === 'string' ? params.profissional : null

  if (isGestor && !paramProfId && profissionais.length > 0) {
    redirect(`/configuracoes/jornada?profissional=${profissionais[0].id}`)
  }

  const targetId = isGestor && paramProfId ? paramProfId : user.id

  const disponibilidade = await listarDisponibilidade(targetId)

  return (
    <div className="space-y-6 px-6">
      <DisponibilidadeEditor
        key={targetId}
        targetProfissionalId={targetId}
        disponibilidade={disponibilidade}
        isGestor={isGestor}
        profissionais={profissionais}
        profissionalAtualId={targetId}
      />
    </div>
  )
}
