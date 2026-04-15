import { createClient } from '@/lib/supabase/server'
import { format, startOfMonth, addDays, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { TrendingUp, Users, BarChart3 } from 'lucide-react'
import { calcularKPIs } from '@/lib/relatorios/kpis-tempo-fabril'
import { formatAppDateKey, getAppDayRangeUTC } from '@/lib/datetime'

type Atendimento = {
  id: string
  profissional_id: string
  data_agendamento: string
  duracao_minutos: number | null
  status: string
  tipo: string
  numero_sessao: number | null
  paciente_id: string
}

type Jornada = {
  profissional_id: string
  dia_semana: number
  hora_inicio: string
  hora_fim: string
  almoco_inicio: string | null
  almoco_fim: string | null
}

type Profissional = {
  id: string
  full_name: string | null
  role: string | null
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const hoje = new Date()
  const inicioMes = startOfMonth(hoje)

  // 1. Buscar perfil do usuário logado
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user!.id)
    .single()

  const isGestorOuMaster = profile?.role === 'gestor' || profile?.role === 'master'

  // 2. Determinar lista de profissionais
  let profissionais: Profissional[] = []
  let profIds: string[] = []
  let profissionaisParaKPI: Array<{ id: string; nome: string }> = []

  if (isGestorOuMaster) {
    // Gestor/Master vê toda a equipe
    const { data: allProfs } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['fisioterapeuta', 'gestor'])
      .eq('ativo', true)
      .order('full_name')
    profissionais = allProfs || []
    profIds = profissionais.map(p => p.id)
    profissionaisParaKPI = profissionais.map(p => ({ id: p.id, nome: p.full_name || 'Sem nome' }))
  } else {
    // Fisioterapeuta vê apenas a si mesmo
    profissionais = [{ id: user!.id, full_name: profile?.full_name || 'Você', role: 'fisioterapeuta' }]
    profIds = [user!.id]
    profissionaisParaKPI = [{ id: user!.id, nome: profile?.full_name || 'Você' }]
  }

  // 3. Buscar dados em paralelo
  const inicioMes_UTC = getAppDayRangeUTC(formatAppDateKey(inicioMes)).start
  const hoje_UTC = getAppDayRangeUTC(formatAppDateKey(hoje)).end

  const [atendimentosRes, jornadasRes, pacientesNovosRes] = await Promise.all([
    supabase
      .from('atendimentos')
      .select('id, profissional_id, data_agendamento, duracao_minutos, status, tipo, numero_sessao, paciente_id')
      .in('profissional_id', profIds)
      .gte('data_agendamento', inicioMes_UTC)
      .lte('data_agendamento', hoje_UTC)
      .order('data_agendamento', { ascending: true }),
    supabase
      .from('disponibilidade_profissional')
      .select('profissional_id, dia_semana, hora_inicio, hora_fim, almoco_inicio, almoco_fim')
      .in('profissional_id', profIds)
      .eq('ativo', true),
    supabase
      .from('pacientes')
      .select('id, created_at')
      .gte('created_at', inicioMes_UTC)
      .lte('created_at', hoje_UTC),
  ])

  const atendimentos: Atendimento[] = atendimentosRes.data || []
  const jornadas: Jornada[] = jornadasRes.data || []
  const pacientesNovos = pacientesNovosRes.data || []

  // 4. Calcular KPIs usando função existente
  const kpis = calcularKPIs(
    profissionaisParaKPI,
    atendimentos,
    jornadas,
    inicioMes,
    hoje
  )

  // 5. Bloco 1: Produtividade / Fábril
  const totalJornadaMin = kpis.reduce((s, k) => s + k.jornadaContratadaMin, 0)
  const totalFabrilMin = kpis.reduce((s, k) => s + k.tempoFabrilMin, 0)
  const totalAtendimentos = kpis.reduce((s, k) => s + k.qtdAtendimentos, 0)
  const taxaOcupacaoGlobal = totalJornadaMin > 0 ? Math.round((totalFabrilMin / totalJornadaMin) * 100) : 0

  // 6. Bloco 2: Volume de Atendimentos
  const totalAtend = atendimentos.length
  const concluidos = atendimentos.filter(a => a.status?.toLowerCase() === 'concluído').length
  const cancelados = atendimentos.filter(a => a.status?.toLowerCase() === 'cancelado').length
  const faltas = atendimentos.filter(a => a.status?.toLowerCase() === 'falta').length
  const emAberto = atendimentos.filter(a => ['confirmado', 'aguardando'].includes(a.status?.toLowerCase() ?? '')).length
  const taxaConclusao = totalAtend > 0 ? Math.round((concluidos / totalAtend) * 100) : 0

  // 7. Bloco 3: Pacientes
  const pacientesComAtendimento = new Set(atendimentos.map(a => a.paciente_id)).size
  const novosPacientes = pacientesNovos.length

  // 8. Bloco 4: Tendência 7 dias
  const tendencia7Dias = Array.from({ length: 7 }, (_, i) => {
    const dia = addDays(subDays(hoje, 6), i)
    const diaKey = formatAppDateKey(dia)
    const count = atendimentos.filter(a => formatAppDateKey(a.data_agendamento) === diaKey).length
    const concluidos = atendimentos.filter(
      a => formatAppDateKey(a.data_agendamento) === diaKey && a.status?.toLowerCase() === 'concluído'
    ).length
    return { dia: format(dia, 'EEE', { locale: ptBR }), count, concluidos }
  })

  const maxTendencia = Math.max(...tendencia7Dias.map(d => d.count), 1)

  // 9. Formatar período para display
  const mesAno = format(hoje, 'MMMM yyyy', { locale: ptBR })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#171d1c]">Dashboard Gerencial</h1>
        <p className="text-sm text-[#3d4945] mt-1">
          Acompanhe os indicadores de produtividade em <span className="font-semibold capitalize">{mesAno}</span>
        </p>
      </div>

      {/* BLOCO 1: PRODUTIVIDADE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-[#006b5a] to-[#33a68f] p-6 rounded-3xl shadow-lg text-white">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest opacity-80">Taxa de Ocupação</h3>
            <div className="bg-white/20 p-2 rounded-lg">
              <TrendingUp size={18} />
            </div>
          </div>
          <p className="text-3xl font-bold">{taxaOcupacaoGlobal}%</p>
          <p className="text-xs mt-2 opacity-75">
            {totalFabrilMin > 0 ? `${Math.round(totalFabrilMin / 60)}h ${totalFabrilMin % 60}m / ${Math.round(totalJornadaMin / 60)}h` : '0 / 0'}
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#bcc9c4]/30">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xs font-bold text-[#3d4945] uppercase tracking-widest">Total de Atendimentos</h3>
            <BarChart3 size={18} className="text-[#006b5a]" />
          </div>
          <p className="text-3xl font-bold text-[#171d1c]">{totalAtend}</p>
          <p className="text-xs mt-2 text-[#3d4945]/70">{taxaConclusao}% concluídos</p>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#bcc9c4]/30">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xs font-bold text-[#3d4945] uppercase tracking-widest">Pacientes Ativos</h3>
            <Users size={18} className="text-[#006b5a]" />
          </div>
          <p className="text-3xl font-bold text-[#171d1c]">{pacientesComAtendimento}</p>
          <p className="text-xs mt-2 text-[#3d4945]/70">{novosPacientes} novos este mês</p>
        </div>
      </div>

      {/* BLOCO 2: DISTRIBUIÇÃO DE STATUS + TENDÊNCIA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Distribuição de Status */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#bcc9c4]/30">
          <h3 className="text-sm font-bold text-[#171d1c] uppercase tracking-widest mb-4">Distribuição de Status</h3>
          <div className="space-y-3">
            {[
              { label: 'Concluído', count: concluidos, cor: 'bg-green-500' },
              { label: 'Cancelado', count: cancelados, cor: 'bg-red-500' },
              { label: 'Falta', count: faltas, cor: 'bg-gray-500' },
              { label: 'Em Aberto', count: emAberto, cor: 'bg-amber-500' },
            ].map((item) => {
              const pct = totalAtend > 0 ? Math.round((item.count / totalAtend) * 100) : 0
              return (
                <div key={item.label}>
                  <div className="flex justify-between items-center text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${item.cor}`} />
                      <span className="text-[#3d4945] font-medium">{item.label}</span>
                    </div>
                    <span className="text-[#171d1c] font-bold">{item.count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-[#f0f5f4] rounded-full h-1.5">
                    <div
                      className={`${item.cor} h-1.5 rounded-full transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Tendência 7 dias */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#bcc9c4]/30">
          <h3 className="text-sm font-bold text-[#171d1c] uppercase tracking-widest mb-4">Tendência (7 dias)</h3>
          <div className="flex items-end justify-between gap-1 h-32">
            {tendencia7Dias.map((dia, i) => {
              const alturaTotal = dia.count > 0 ? (dia.count / maxTendencia) * 100 : 5
              const alturaConcluida = dia.concluidos > 0 ? (dia.concluidos / maxTendencia) * 100 : 0

              return (
                <div key={i} className="flex flex-col items-center gap-2 flex-1">
                  <div className="relative w-full h-24 flex items-end justify-center">
                    {/* Barra total */}
                    <div
                      className="absolute bottom-0 w-full bg-[#cce2da] rounded-sm transition-all"
                      style={{ height: `${alturaTotal}%` }}
                    />
                    {/* Barra concluída */}
                    {alturaConcluida > 0 && (
                      <div
                        className="absolute bottom-0 w-full bg-[#006b5a] rounded-sm transition-all"
                        style={{ height: `${alturaConcluida}%` }}
                      />
                    )}
                  </div>
                  <span className="text-xs font-semibold text-[#3d4945]/60 capitalize">
                    {dia.dia.slice(0, 3)}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-3 mt-3 text-xs text-[#3d4945]/60">
            <div className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 bg-[#cce2da] rounded-sm" />
              Total
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 bg-[#006b5a] rounded-sm" />
              Concluído
            </div>
          </div>
        </div>
      </div>

      {/* BLOCO 3: RANKING DA EQUIPE (Apenas Gestor/Master) */}
      {isGestorOuMaster && kpis.length > 1 && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#bcc9c4]/30">
          <h3 className="text-sm font-bold text-[#171d1c] uppercase tracking-widest mb-4">Ranking da Equipe</h3>
          <div className="space-y-3">
            {kpis
              .sort((a, b) => b.taxaOcupacao - a.taxaOcupacao)
              .map((kpi, idx) => (
                <div key={kpi.profissionalId} className="flex items-center justify-between p-3 bg-[#f9faf8] rounded-xl border border-[#bcc9c4]/20">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-[#006b5a] text-sm">{idx + 1}º</span>
                    <div>
                      <p className="text-sm font-bold text-[#171d1c]">{kpi.nome}</p>
                      <p className="text-xs text-[#3d4945]/60">{kpi.qtdAtendimentos} atendimentos</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-[#006b5a]">{kpi.taxaOcupacao}%</p>
                    <p className="text-xs text-[#3d4945]/60">ocupação</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
