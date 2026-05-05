import { Header } from '@/components/layout/Header'
import { AppShell } from '@/components/layout/AppShell'
import { createClient } from '@/lib/supabase/server'
import { ModalPrimeiroAcesso } from '@/components/features/ModalPrimeiroAcesso'
import { Toaster } from 'react-hot-toast'
import { listarTodasDisponibilidades } from '@/actions/disponibilidade'
import { normalizarDisponibilidade, type DisponibilidadeDia } from '@/lib/disponibilidade'
import { podeEntrarNaAgendaOuRelatorio } from '@/lib/profissionais'
import { WidgetDisponibilidade } from '@/components/features/WidgetDisponibilidade'
import { listarStatusDisponibilidade } from '@/actions/status-disponibilidade'
import { listarTiposConsultaAtivos } from '@/actions/tipos-consulta'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let primeiroAcesso = false
  let profile = null

  if (user) {
    const { data, error } = await supabase
      .from('profiles')
      .select('primeiro_acesso, role, nivel_acesso, full_name, avatar_url, especialidade, modulos_liberados')
      .eq('id', user.id)
      .single()

    if (!error && data) {
      profile = data
    }
    if (profile?.primeiro_acesso || user?.user_metadata?.primeiro_acesso) {
      primeiroAcesso = true
    }
  }

  const nomeUsuario = profile?.full_name || user?.email?.split('@')[0] || 'Usuário'
  const cargoUsuario = profile?.role || profile?.especialidade || 'Gestor'
  const userRole = profile?.role || ''
  const userNivelAcesso = profile?.nivel_acesso || ''
  const modulosLiberados: string[] = profile?.modulos_liberados ?? []
  const avatarUrl = profile?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(nomeUsuario)}&background=cce2da&color=006b5a&bold=true`

  let prontuariosPendentes = 0
  if (user && modulosLiberados.includes('prontuarios')) {
    const atendimentosConcluidosQuery = supabase
      .from('atendimentos')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Concluído')

    const prontuariosPreenchidosQuery = supabase
      .from('prontuarios')
      .select('atendimento_id, atendimentos!inner(id)', { count: 'exact', head: true })
      .eq('atendimentos.status', 'Concluído')

    if (userNivelAcesso === 'basico') {
      atendimentosConcluidosQuery.eq('profissional_id', user.id)
      prontuariosPreenchidosQuery.eq('atendimentos.profissional_id', user.id)
    }

    const [{ count: totalConcluidos }, { count: totalComProntuario }] = await Promise.all([
      atendimentosConcluidosQuery,
      prontuariosPreenchidosQuery,
    ])

    prontuariosPendentes = Math.max(0, (totalConcluidos ?? 0) - (totalComProntuario ?? 0))
  }

  const [{ data: listaProfissionais }, todasDisponibilidades, tiposConsulta] = await Promise.all([
    supabase.from('profiles').select('id, full_name, role').eq('ativo', true).neq('role', 'master').neq('role', 'medico').order('full_name'),
    listarTodasDisponibilidades(),
    listarTiposConsultaAtivos(),
  ])

  const disponibilidadesMap: Record<string, Record<number, DisponibilidadeDia>> = {}
  for (const d of todasDisponibilidades) {
    if (!disponibilidadesMap[d.profissional_id]) disponibilidadesMap[d.profissional_id] = {}
    disponibilidadesMap[d.profissional_id][d.dia_semana] = normalizarDisponibilidade(d)
  }

  const profissionaisComJornada = new Set(todasDisponibilidades.map((d) => d.profissional_id))
  const profissionais = (listaProfissionais ?? [])
    .filter((p: { id: string; full_name: string; role: string }) =>
      podeEntrarNaAgendaOuRelatorio(p, profissionaisComJornada),
    )
    .map((p: { id: string; full_name: string; role: string }) => ({
      id: p.id,
      nome: p.full_name || 'Sem nome',
      cargo: p.role || 'Profissional',
    }))

  const statusDisponibilidade = await listarStatusDisponibilidade(profissionais.map(p => p.id))

  return (
    <AppShell
      profissionais={profissionais}
      disponibilidades={disponibilidadesMap}
      tiposConsulta={tiposConsulta}
      headerData={{ nomeUsuario, cargoUsuario, avatarUrl, userRole, userNivelAcesso, modulosLiberados, prontuariosPendentes }}
    >
      <Header nomeUsuario={nomeUsuario} cargoUsuario={cargoUsuario} avatarUrl={avatarUrl} />
      <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto overflow-x-hidden min-h-0 w-0 min-w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
        {children}
      </main>

      {primeiroAcesso && <ModalPrimeiroAcesso />}
      <Toaster position="top-right" />
      {user && (
        <WidgetDisponibilidade
          profissionais={profissionais}
          initialStatuses={statusDisponibilidade}
          currentUserId={user.id}
          disponibilidades={disponibilidadesMap}
        />
      )}
    </AppShell>
  )
}
