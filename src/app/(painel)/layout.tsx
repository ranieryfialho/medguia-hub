import { Header } from '@/components/layout/Header'
import { AppShell } from '@/components/layout/AppShell'
import { createClient } from '@/lib/supabase/server'
import { ModalPrimeiroAcesso } from '@/components/features/ModalPrimeiroAcesso'
import { Toaster } from 'react-hot-toast'
import { listarTodasDisponibilidades } from '@/actions/disponibilidade'
import { normalizarDisponibilidade, type DisponibilidadeDia } from '@/lib/disponibilidade'
import { podeEntrarNaAgendaOuRelatorio } from '@/lib/profissionais'

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
      .select('primeiro_acesso, role, full_name, avatar_url, especialidade')
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
  const avatarUrl = profile?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(nomeUsuario)}&background=cce2da&color=006b5a&bold=true`

  const [{ data: listaProfissionais }, todasDisponibilidades] = await Promise.all([
    supabase.from('profiles').select('id, full_name, role').eq('ativo', true).neq('role', 'master').neq('role', 'medico').order('full_name'),
    listarTodasDisponibilidades(),
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

  return (
    <AppShell
      profissionais={profissionais}
      disponibilidades={disponibilidadesMap}
      headerData={{ nomeUsuario, cargoUsuario, avatarUrl, userRole }}
    >
      <Header />
      <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto min-h-0">
        {children}
      </main>

      {primeiroAcesso && <ModalPrimeiroAcesso />}
      <Toaster position="top-right" />
    </AppShell>
  )
}
