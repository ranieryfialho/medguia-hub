import { Header } from '@/components/layout/Header'
import { AppShell } from '@/components/layout/AppShell'
import { createClient } from '@/lib/supabase/server'
import { ModalPrimeiroAcesso } from '@/components/features/shared'
import { Toaster } from 'react-hot-toast'
import { listarTodasDisponibilidades } from '@/actions/disponibilidade'
import { normalizarDisponibilidade, type DisponibilidadeDia } from '@/lib/disponibilidade'
import { podeEntrarNaAgendaOuRelatorio, podeEntrarNoWidgetDisponibilidade } from '@/lib/profissionais'
import { WidgetDisponibilidade } from '@/components/features/configuracoes'
import { listarStatusDisponibilidade } from '@/actions/status-disponibilidade'
import { listarTiposConsultaAtivos } from '@/actions/tipos-consulta'
import { listarPlanosSaudeAtivos } from '@/actions/planos-saude'

function buildAvatarFallbackDataUrl(nomeUsuario: string) {
  const iniciais = nomeUsuario
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('')
    || 'U'

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
      <rect width="80" height="80" rx="16" fill="#cce2da" />
      <text
        x="50%"
        y="50%"
        text-anchor="middle"
        dominant-baseline="central"
        font-family="Arial, sans-serif"
        font-size="28"
        font-weight="700"
        fill="#006b5a"
      >${iniciais}</text>
    </svg>
  `.trim()

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

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
      .select('primeiro_acesso, role, nivel_acesso, full_name, avatar_url, modulos_liberados')
      .eq('id', user.id)
      .single()

    if (!error && data) {
      profile = data
    } else if (error) {
      console.warn('Erro ao carregar profile no layout:', error.message || error.code || 'erro_desconhecido')
    }
    if (profile?.primeiro_acesso || user?.user_metadata?.primeiro_acesso) {
      primeiroAcesso = true
    }
  }

  const nomeUsuario = profile?.full_name || user?.email?.split('@')[0] || 'Usuário'
  const cargoUsuario = profile?.role || 'Gestor'
  const userRole = profile?.role || ''
  const userNivelAcesso = profile?.nivel_acesso || ''
  const modulosLiberados: string[] = profile?.modulos_liberados ?? []
  const avatarUrl = profile?.avatar_url || buildAvatarFallbackDataUrl(nomeUsuario)

  const prontuariosPendentes = 0

  const [{ data: listaProfissionais }, todasDisponibilidades, tiposConsulta, planosSaude] = await Promise.all([
    supabase.from('profiles').select('id, full_name, role, ativo').in('role', ['fisioterapeuta', 'gestor', 'medico']).order('full_name'),
    listarTodasDisponibilidades(),
    listarTiposConsultaAtivos(),
    listarPlanosSaudeAtivos(),
  ])

  const disponibilidadesMap: Record<string, Record<number, DisponibilidadeDia>> = {}
  for (const d of todasDisponibilidades) {
    if (!disponibilidadesMap[d.profissional_id]) disponibilidadesMap[d.profissional_id] = {}
    disponibilidadesMap[d.profissional_id][d.dia_semana] = normalizarDisponibilidade(d)
  }

  const profissionaisComJornada = new Set(todasDisponibilidades.map((d) => d.profissional_id))
  const profissionais = (listaProfissionais ?? [])
    .filter((p: { id: string; full_name: string; role: string; ativo?: boolean | null }) =>
      p.ativo !== false &&
      podeEntrarNaAgendaOuRelatorio(p, profissionaisComJornada),
    )
    .map((p: { id: string; full_name: string; role: string }) => ({
      id: p.id,
      nome: p.full_name || 'Sem nome',
      cargo: p.role || 'Profissional',
    }))

  const profissionaisWidget = (listaProfissionais ?? [])
    .filter((p: { id: string; full_name: string; role: string; ativo?: boolean | null }) =>
      p.ativo === true &&
      podeEntrarNoWidgetDisponibilidade(p, profissionaisComJornada),
    )
    .map((p: { id: string; full_name: string; role: string }) => ({
      id: p.id,
      nome: p.full_name || 'Sem nome',
      cargo: p.role || 'Profissional',
    }))

  const statusDisponibilidade = await listarStatusDisponibilidade(profissionaisWidget.map(p => p.id))

  return (
    <AppShell
      profissionais={profissionais}
      disponibilidades={disponibilidadesMap}
      tiposConsulta={tiposConsulta}
      planosSaude={planosSaude}
      headerData={{ nomeUsuario, cargoUsuario, avatarUrl, userRole, userNivelAcesso, modulosLiberados, prontuariosPendentes }}
    >
      <Header nomeUsuario={nomeUsuario} cargoUsuario={cargoUsuario} avatarUrl={avatarUrl} />
      <main
        className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 w-0 min-w-full px-4 pt-4 pb-28 md:px-6 md:pt-6 md:pb-32 lg:px-8 lg:pt-8 lg:pb-32"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {children}
      </main>

      {primeiroAcesso && <ModalPrimeiroAcesso />}
      <Toaster position="top-right" />
      {user && (
        <WidgetDisponibilidade
          profissionais={profissionaisWidget}
          initialStatuses={statusDisponibilidade}
          currentUserId={user.id}
          disponibilidades={disponibilidadesMap}
        />
      )}
    </AppShell>
  )
}
