import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { listarDisponibilidade } from '@/actions/disponibilidade'
import { listarJornadaMensal } from '@/actions/jornada-mensal'
import { listarBloqueiosMes } from '@/actions/jornada-bloqueios'
import { JornadaEditor, JornadaMensalEditor } from '@/components/features/configuracoes'
import { requireModulo } from '@/lib/guard'
import { podeGerirEquipe } from '@/lib/permissoes'

export default async function JornadaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { user, profile } = await requireModulo('configuracoes:jornada')

  const supabase = await createClient()
  const params = await searchParams

  const isGestor = podeGerirEquipe({
    role: profile?.role,
    nivelAcesso: profile?.nivel_acesso,
  })
  const mesReferencia = typeof params.mes === 'string' && /^\d{4}-\d{2}$/.test(params.mes)
    ? params.mes
    : format(new Date(), 'yyyy-MM')

  let profissionais: { id: string; nome: string }[] = []
  if (isGestor) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('ativo', true)
      .eq('role', 'fisioterapeuta')
      .order('full_name')
    profissionais = (data ?? []).map(p => ({ id: p.id, nome: p.full_name || 'Sem nome' }))
  }

  const paramProfId = typeof params.profissional === 'string' ? params.profissional : null

  if (isGestor && !paramProfId && profissionais.length > 0) {
    redirect(`/configuracoes/jornada?profissional=${profissionais[0].id}&mes=${mesReferencia}`)
  }

  const targetId = isGestor && paramProfId ? paramProfId : user.id

  const [disponibilidade, jornadaMensal, bloqueiosMensal] = await Promise.all([
    listarDisponibilidade(targetId),
    listarJornadaMensal(targetId, mesReferencia),
    listarBloqueiosMes(targetId, mesReferencia),
  ])

  return (
    <div className="space-y-6 px-3 sm:px-4 lg:px-6">
      <JornadaMensalEditor
        key={`${targetId}-${mesReferencia}`}
        targetProfissionalId={targetId}
        disponibilidade={disponibilidade}
        jornadaMensal={jornadaMensal}
        bloqueiosMensal={bloqueiosMensal}
        isGestor={isGestor}
        profissionais={profissionais}
        profissionalAtualId={targetId}
        mesReferencia={mesReferencia}
      />

      <JornadaEditor
        key={targetId}
        targetProfissionalId={targetId}
        disponibilidade={disponibilidade}
        isGestor={isGestor}
        profissionais={profissionais}
        profissionalAtualId={targetId}
        mostrarSeletorProfissional={false}
      />
    </div>
  )
}
