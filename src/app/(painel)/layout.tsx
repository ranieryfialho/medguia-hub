import { Header } from '@/components/layout/Header'
import { AppShell } from '@/components/layout/AppShell'
import { createClient } from '@/lib/supabase/server'
import { ModalPrimeiroAcesso } from '@/components/features/ModalPrimeiroAcesso'
import { Toaster } from 'react-hot-toast'

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
      if (data.primeiro_acesso === true) primeiroAcesso = true
      profile = data
    }
  }

  const nomeUsuario = profile?.full_name || user?.email?.split('@')[0] || 'Usuário'
  const cargoUsuario = profile?.role || profile?.especialidade || 'Gestor'
  const avatarUrl = profile?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(nomeUsuario)}&background=cce2da&color=006b5a&bold=true`

  const [{ data: pacientes }, { data: listaProfissionais }] = await Promise.all([
    supabase.from('pacientes').select('id, nome').order('nome'),
    supabase.from('profiles').select('id, full_name, role').eq('ativo', true).order('full_name'),
  ])

  const profissionais = (listaProfissionais ?? []).map((p: { id: string; full_name: string; role: string }) => ({
    id: p.id,
    nome: p.full_name || 'Sem nome',
    cargo: p.role || 'Profissional',
  }))

  return (
    <AppShell
      pacientes={pacientes ?? []}
      profissionais={profissionais}
      headerData={{ nomeUsuario, cargoUsuario, avatarUrl }}
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