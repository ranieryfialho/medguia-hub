import { Header } from '@/components/layout/Header'
import { AppShell } from '@/components/layout/AppShell'
import { createClient } from '@/lib/supabase/server'
import { ModalPrimeiroAcesso } from '@/components/features/shared'
import { Toaster } from 'react-hot-toast'
import { listarTodasDisponibilidades } from '@/actions/disponibilidade'
import { formatAppDateKey, parseAppDate } from '@/lib/datetime'
import { normalizarDisponibilidade, type DisponibilidadeDia } from '@/lib/disponibilidade'
import { buildMapaMensalPorProfissional, resolverJornadaDoDia } from '@/lib/jornada-planejada'
import { podeEntrarNaAgendaOuRelatorio, podeEntrarNoWidgetDisponibilidade } from '@/lib/profissionais'
import { WidgetDisponibilidade } from '@/components/features/configuracoes'
import { listarStatusDisponibilidade } from '@/actions/status-disponibilidade'
import { listarStatusOpcoes } from '@/actions/status-disponibilidade-config'
import { listarProtocolosAtendimentoAtivos } from '@/actions/protocolos-atendimento'
import { listarTiposConsultaAtivos } from '@/actions/tipos-consulta'
import { listarPlanosSaudeAtivos } from '@/actions/planos-saude'
import { contarFollowUpsPendentes } from '@/actions/follow-ups'
import { contarProntuariosPendentes } from '@/actions/prontuarios'
import { resolverModulosEfetivos } from '@/lib/modulos'

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
  const modulosLiberados: string[] = resolverModulosEfetivos(profile?.modulos_liberados ?? [], profile?.nivel_acesso)
  const avatarUrl = profile?.avatar_url || buildAvatarFallbackDataUrl(nomeUsuario)

  const [prontuariosPendentes, followUpsPendentes] = await Promise.all([
    contarProntuariosPendentes(),
    contarFollowUpsPendentes(),
  ])

  const hoje = new Date()
  const hojeKey = formatAppDateKey(hoje)
  const mesAtual = hojeKey.slice(0, 7)
  const inicioMesAtual = `${mesAtual}-01`
  const fimMesAtual = `${mesAtual}-31`
  const [{ data: listaProfissionais }, todasDisponibilidades, { data: jornadasMensaisMes }, tiposConsulta, protocolosAtendimento, planosSaude] = await Promise.all([
    supabase.from('profiles').select('id, full_name, role, ativo').in('role', ['fisioterapeuta', 'gestor', 'medico']).order('full_name'),
    listarTodasDisponibilidades(),
    supabase
      .from('jornada_mensal_profissional')
      .select('profissional_id, data, jornada_inicio, jornada_fim, intervalo_inicio, intervalo_fim, ativo')
      .gte('data', inicioMesAtual)
      .lte('data', fimMesAtual),
    listarTiposConsultaAtivos(),
    listarProtocolosAtendimentoAtivos(),
    listarPlanosSaudeAtivos(),
  ])

  const disponibilidadesMap: Record<string, Record<number, DisponibilidadeDia>> = {}
  for (const d of todasDisponibilidades) {
    if (!disponibilidadesMap[d.profissional_id]) disponibilidadesMap[d.profissional_id] = {}
    disponibilidadesMap[d.profissional_id][d.dia_semana] = normalizarDisponibilidade(d)
  }

  const jornadasMensaisMap = buildMapaMensalPorProfissional((jornadasMensaisMes ?? []) as Array<{
    profissional_id: string
    data: string
    jornada_inicio: string | null
    jornada_fim: string | null
    intervalo_inicio?: string | null
    intervalo_fim?: string | null
    ativo: boolean
  }>)
  const disponibilidadesMensaisMap: Record<string, Record<string, DisponibilidadeDia | null>> = {}
  for (const [profissionalId, porData] of jornadasMensaisMap.entries()) {
    disponibilidadesMensaisMap[profissionalId] = {}
    for (const [data, jornada] of porData.entries()) {
      disponibilidadesMensaisMap[profissionalId][data] = jornada.ativo && jornada.jornada_inicio && jornada.jornada_fim
        ? normalizarDisponibilidade({
            jornada_inicio: jornada.jornada_inicio,
            jornada_fim: jornada.jornada_fim,
            intervalo_inicio: jornada.intervalo_inicio ?? null,
            intervalo_fim: jornada.intervalo_fim ?? null,
          })
        : null
    }
  }
  const disponibilidadesHoje: Record<string, DisponibilidadeDia | null> = {}
  const hojeDate = parseAppDate(hojeKey)
  const todosProfIdsDisponibilidade = new Set([
    ...Object.keys(disponibilidadesMap),
    ...Object.keys(disponibilidadesMensaisMap),
  ])
  for (const profissionalId of todosProfIdsDisponibilidade) {
    const semanal = disponibilidadesMap[profissionalId] ?? {}
    disponibilidadesHoje[profissionalId] = resolverJornadaDoDia(
      hojeDate,
      new Map(Object.entries(semanal).map(([dia, disp]) => [Number(dia), disp])),
      jornadasMensaisMap.get(profissionalId),
    ) ?? null
  }

  const profissionaisComJornada = new Set([
    ...todasDisponibilidades.map((d) => d.profissional_id),
    ...Object.keys(disponibilidadesMensaisMap),
  ])
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

  const [statusDisponibilidade, statusOpcoes] = await Promise.all([
    listarStatusDisponibilidade(profissionaisWidget.map(p => p.id)),
    listarStatusOpcoes(),
  ])

  return (
    <AppShell
      profissionais={profissionais}
      disponibilidades={disponibilidadesMap}
      disponibilidadesMensais={disponibilidadesMensaisMap}
      tiposConsulta={tiposConsulta}
      protocolosAtendimento={protocolosAtendimento}
      planosSaude={planosSaude}
      headerData={{ nomeUsuario, cargoUsuario, avatarUrl, userRole, userNivelAcesso, modulosLiberados, prontuariosPendentes, followUpsPendentes, userEmail: user?.email ?? '', userId: user?.id ?? '' }}
    >
      <Header nomeUsuario={nomeUsuario} cargoUsuario={cargoUsuario} avatarUrl={avatarUrl} modulosLiberados={modulosLiberados} userId={user?.id ?? ''} />
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
          disponibilidadesHoje={disponibilidadesHoje}
          opcoes={statusOpcoes}
        />
      )}
    </AppShell>
  )
}
