import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
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
  let userRole: string | null = null

  if (user) {
    const { data, error } = await supabase
      .from('profiles')
      .select('primeiro_acesso, role')
      .eq('id', user.id)
      .single()

    if (!error && data) {
      if (data.primeiro_acesso === true) primeiroAcesso = true
      userRole = data.role ?? null
    }
  }

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
    <div className="flex min-h-screen bg-[#f5faf9]">
      <Sidebar pacientes={pacientes ?? []} profissionais={profissionais} userRole={userRole} />
      <div className="flex-1 ml-64 flex flex-col h-screen relative">
        <Header />
        <main className="flex-1 p-6 md:p-8 overflow-y-auto min-h-0">
          {children}
        </main>
      </div>

      {primeiroAcesso && <ModalPrimeiroAcesso />}
      <Toaster position="top-right" />
    </div>
  )
}