import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listarDisponibilidade } from '@/actions/disponibilidade'
import { JornadaEditor } from '@/components/features/configuracoes'
import { requireModulo } from '@/lib/guard'

export default async function JornadaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { user, profile } = await requireModulo('configuracoes:jornada')

  const supabase = await createClient()
  const params = await searchParams

  const isGestor = profile?.nivel_acesso === 'gestor' || profile?.nivel_acesso === 'master'

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
      <JornadaEditor
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
