import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listarDisponibilidade } from '@/actions/disponibilidade'
import { DisponibilidadeEditor } from '@/components/features/DisponibilidadeEditor'

export default async function DisponibilidadePage({
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

  // Busca lista de profissionais (só para gestor)
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

  // ID do profissional alvo (gestor pode trocar via ?profissional=)
  const paramProfId = typeof params.profissional === 'string' ? params.profissional : null

  // Gestor sem param → redireciona para o primeiro profissional da lista
  if (isGestor && !paramProfId && profissionais.length > 0) {
    redirect(`/configuracoes/disponibilidade?profissional=${profissionais[0].id}`)
  }

  const targetId = isGestor && paramProfId ? paramProfId : user.id

  const disponibilidade = await listarDisponibilidade(targetId)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100">
        <h2 className="text-2xl font-bold tracking-tight text-[#006b5a]">Configurações</h2>
        <p className="text-sm text-slate-500 mt-0.5">Gerencie a disponibilidade de atendimento</p>
      </div>

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
