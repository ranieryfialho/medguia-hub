'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { AlertCircle, CheckCircle2, TrendingUp, Users, Activity, FileText } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  LABEL_POR_STATUS_CONTATO,
  getVisualColunaContato,
  type ColunaCorContato,
  type StatusContatoPadrao,
} from '@/lib/contatos-kanban'

type StatusContato = StatusContatoPadrao

type ContatoComDados = {
  paciente_id: string
  paciente_nome: string
  status: StatusContato
  kanban_coluna_chave: string
  kanban_coluna_nome: string
  kanban_coluna_cor_chave: ColunaCorContato
  responsavel_id: string | null
  responsavel_nome: string | null
  ultimo_atendimento_data: string | null
  ultimo_atendimento_tipo: string | null
  ultima_nota_criada_em: string | null
  atualizado_em: string
}

type AtividadeResponsavel = {
  id: string
  nome: string
  carteira: number
  notasPeriodo: number
  pacientesContatados: number
  taxaAtividade: number
}

interface RelatorioContatosClientProps {
  contatos: ContatoComDados[]
  contagemPorStatus: Record<StatusContato, number>
  contatosPorResponsavel: Array<{
    id: string | null
    nome: string
    total: number
    contagemPorStatus: Record<StatusContato, number>
    taxaConversao: number
  }>
  contatosEmRisco: ContatoComDados[]
  contatosSemResponsavel: ContatoComDados[]
  contagemPorColuna: Array<{
    chave: string
    nome: string
    corChave: ColunaCorContato
    total: number
  }>
  taxaConversaoGeral: number
  totalContatos: number
  isGestorOuMaster: boolean
  userNome: string
  atividadePorResponsavel: AtividadeResponsavel[]
  periodoLabel: string
  periodoAtual: string
  totalNotasPeriodo: number
  totalPacientesContatados: number
  contagemPorStatusPeriodo: Record<StatusContato, number>
  contatosPorResponsavelPeriodo: Array<{
    id: string | null
    nome: string
    total: number
    contagemPorStatus: Record<StatusContato, number>
    taxaConversao: number
  }>
  taxaConversaoPeriodo: number
  totalContatosPeriodo: number
  contagemPorColunaPeriodo: Array<{ chave: string; nome: string; corChave: ColunaCorContato; total: number }>
}

const STATUS_COLORS: Record<StatusContato, string> = {
  a_contactar: getVisualColunaContato('a_contactar').cor,
  recuperacao_base: getVisualColunaContato('recuperacao_base').cor,
  tentativa: getVisualColunaContato('tentativa').cor,
  em_conversa: getVisualColunaContato('em_conversa').cor,
  sem_interesse: getVisualColunaContato('sem_interesse').cor,
  agendou: getVisualColunaContato('agendou').cor,
}

const STATUS_LABELS: Record<StatusContato, string> = LABEL_POR_STATUS_CONTATO

function calcularDiasSdeUltimaAtividade(
  ultimaNota: string | null,
  ultimoAtendimento: string | null,
  atualizadoEm: string,
): number {
  const ultimaAtividade = ultimaNota ?? ultimoAtendimento ?? atualizadoEm
  return Math.floor(
    (new Date().getTime() - new Date(ultimaAtividade).getTime()) / (1000 * 60 * 60 * 24)
  )
}

function corRiscoPorDias(dias: number): string {
  if (dias < 30) return 'bg-green-50 border-l-4 border-green-500'
  if (dias < 90) return 'bg-amber-50 border-l-4 border-amber-500'
  return 'bg-red-50 border-l-4 border-red-500'
}

function labelRiscoPorDias(dias: number): string {
  if (dias < 30) return `${dias}d - Ativo`
  if (dias < 90) return `${dias}d - Atenção`
  return `${dias}d - Em Risco`
}

export function RelatorioContatosClient({
  contatos: _contatos,
  contagemPorStatus: _contagemPorStatus,
  contatosPorResponsavel,
  contatosEmRisco,
  contatosSemResponsavel,
  contagemPorColuna: _contagemPorColuna,
  taxaConversaoGeral: _taxaConversaoGeral,
  totalContatos,
  isGestorOuMaster,
  userNome: _userNome,
  atividadePorResponsavel,
  periodoLabel,
  periodoAtual: _periodoAtual,
  totalNotasPeriodo,
  totalPacientesContatados,
  contagemPorStatusPeriodo,
  contatosPorResponsavelPeriodo,
  taxaConversaoPeriodo,
  totalContatosPeriodo,
  contagemPorColunaPeriodo,
}: RelatorioContatosClientProps) {
  void _contatos
  void _userNome
  void _periodoAtual
  void _contagemPorStatus
  void _contagemPorColuna
  void _taxaConversaoGeral
  const router = useRouter()
  const searchParams = useSearchParams()
  const [abaAtiva, setAbaAtiva] = useState<'performance' | 'risco' | 'atividade'>('performance')
  const [filtroResponsavel, setFiltroResponsavel] = useState<string | null>(null)
  const [filtroFisioAtividade, setFiltroFisioAtividade] = useState<string>('todos')

  const deAtual  = searchParams.get('de')  ?? ''
  const ateAtual = searchParams.get('ate') ?? ''
  const [de,  setDe]  = useState(deAtual)
  const [ate, setAte] = useState(ateAtual)

  function aplicarPeriodo() {
    if (!de || !ate) return
    const params = new URLSearchParams(searchParams)
    params.set('periodo', 'personalizado')
    params.set('de', de)
    params.set('ate', ate)
    router.push(`?${params.toString()}`)
  }

  // Dados para gráfico de pizza (período)
  const pieData = ([
    { key: 'a_contactar', name: STATUS_LABELS.a_contactar, value: contagemPorStatusPeriodo.a_contactar },
    { key: 'recuperacao_base', name: STATUS_LABELS.recuperacao_base, value: contagemPorStatusPeriodo.recuperacao_base },
    { key: 'tentativa', name: STATUS_LABELS.tentativa, value: contagemPorStatusPeriodo.tentativa },
    { key: 'em_conversa', name: STATUS_LABELS.em_conversa, value: contagemPorStatusPeriodo.em_conversa },
    { key: 'agendou', name: STATUS_LABELS.agendou, value: contagemPorStatusPeriodo.agendou },
    { key: 'sem_interesse', name: STATUS_LABELS.sem_interesse, value: contagemPorStatusPeriodo.sem_interesse },
  ] satisfies Array<{ key: StatusContato; name: string; value: number }>).filter((d) => d.value > 0)

  // Dados para gráfico de barras (período, por responsável)
  const barData = contatosPorResponsavelPeriodo.map(r => ({
    nome: r.nome,
    total: r.total,
    a_contactar: r.contagemPorStatus.a_contactar,
    recuperacao_base: r.contagemPorStatus.recuperacao_base,
    tentativa: r.contagemPorStatus.tentativa,
    em_conversa: r.contagemPorStatus.em_conversa,
    agendou: r.contagemPorStatus.agendou,
    sem_interesse: r.contagemPorStatus.sem_interesse,
  }))

  const contatosRiscoFiltrados = filtroResponsavel
    ? contatosEmRisco.filter(c => c.responsavel_id === (filtroResponsavel === 'sem_responsavel' ? null : filtroResponsavel))
    : contatosEmRisco

  const contagemRiscoFiltrados = filtroResponsavel
    ? contatosSemResponsavel.filter(c => c.responsavel_id === (filtroResponsavel === 'sem_responsavel' ? null : filtroResponsavel))
    : contatosSemResponsavel

  return (
    <div className="space-y-6">
      {/* Seletor de período global */}
      <div className="bg-white rounded-2xl border border-[#bcc9c4]/30 p-4">
        <p className="text-xs font-bold text-[#3d4945] uppercase tracking-widest mb-3">Período</p>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="text-[11px] font-semibold text-[#3d4945] block mb-1">De</label>
            <input
              type="date"
              value={de}
              onChange={e => setDe(e.target.value)}
              className="bg-[#f0f5f4] border border-[#bcc9c4]/50 rounded-lg px-3 py-2 text-sm text-[#171d1c] focus:outline-none focus:border-[#006b5a] focus:ring-1 focus:ring-[#006b5a]/30"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#3d4945] block mb-1">Até</label>
            <input
              type="date"
              value={ate}
              onChange={e => setAte(e.target.value)}
              className="bg-[#f0f5f4] border border-[#bcc9c4]/50 rounded-lg px-3 py-2 text-sm text-[#171d1c] focus:outline-none focus:border-[#006b5a] focus:ring-1 focus:ring-[#006b5a]/30"
            />
          </div>
          <button
            onClick={aplicarPeriodo}
            disabled={!de || !ate}
            className="px-4 py-2 bg-[#006b5a] text-white text-sm font-semibold rounded-lg hover:bg-[#005548] transition-colors disabled:opacity-40"
          >
            Aplicar
          </button>
          {periodoLabel && (
            <p className="text-xs text-[#3d4945]/60 self-center capitalize">{periodoLabel}</p>
          )}
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-2 border-b border-[#bcc9c4]/30">
        <button
          onClick={() => setAbaAtiva('performance')}
          className={`px-5 py-3 font-semibold text-sm transition-all border-b-2 ${
            abaAtiva === 'performance'
              ? 'text-[#006b5a] border-b-[#006b5a]'
              : 'text-[#3d4945] border-b-transparent hover:text-[#006b5a]'
          }`}
        >
          Performance Geral
        </button>
        <button
          onClick={() => setAbaAtiva('atividade')}
          className={`px-5 py-3 font-semibold text-sm transition-all border-b-2 ${
            abaAtiva === 'atividade'
              ? 'text-[#006b5a] border-b-[#006b5a]'
              : 'text-[#3d4945] border-b-transparent hover:text-[#006b5a]'
          }`}
        >
          Atividade por Período
        </button>
        <button
          onClick={() => setAbaAtiva('risco')}
          className={`px-5 py-3 font-semibold text-sm transition-all border-b-2 relative ${
            abaAtiva === 'risco'
              ? 'text-[#006b5a] border-b-[#006b5a]'
              : 'text-[#3d4945] border-b-transparent hover:text-[#006b5a]'
          }`}
        >
          Contatos em Risco
          {contatosEmRisco.length > 0 && (
            <span className="absolute -top-1 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {contatosEmRisco.length}
            </span>
          )}
        </button>
      </div>

      {/* ABA 1: PERFORMANCE GERAL */}
      {abaAtiva === 'performance' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-[#006b5a] to-[#33a68f] p-6 rounded-2xl text-white shadow-md">
              <div className="flex items-start justify-between mb-4">
                <h4 className="text-xs font-bold uppercase tracking-widest opacity-80">No Período</h4>
                <Users size={18} />
              </div>
              <p className="text-3xl font-bold">{totalContatosPeriodo}</p>
              <p className="text-xs mt-2 opacity-70">de {totalContatos} na carteira total</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#bcc9c4]/30">
              <div className="flex items-start justify-between mb-4">
                <h4 className="text-xs font-bold text-[#3d4945] uppercase tracking-widest">Taxa Conversão</h4>
                <TrendingUp size={18} className="text-[#006b5a]" />
              </div>
              <p className="text-3xl font-bold text-[#006b5a]">{taxaConversaoPeriodo}%</p>
              <p className="text-xs mt-2 text-[#3d4945]/60">
                {contagemPorStatusPeriodo.agendou} de {totalContatosPeriodo - contagemPorStatusPeriodo.sem_interesse}
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#bcc9c4]/30">
              <div className="flex items-start justify-between mb-4">
                <h4 className="text-xs font-bold text-[#3d4945] uppercase tracking-widest">Agendamentos</h4>
                <CheckCircle2 size={18} className="text-green-600" />
              </div>
              <p className="text-3xl font-bold text-green-600">{contagemPorStatusPeriodo.agendou}</p>
              <p className="text-xs mt-2 text-[#3d4945]/60">Conversões no período</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#bcc9c4]/30">
              <div className="flex items-start justify-between mb-4">
                <h4 className="text-xs font-bold text-[#3d4945] uppercase tracking-widest">Em Risco</h4>
                <AlertCircle size={18} className="text-red-600" />
              </div>
              <p className="text-3xl font-bold text-red-600">{contatosEmRisco.length}</p>
              <p className="text-xs mt-2 text-[#3d4945]/60">Sem atividade há 30+ dias</p>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#bcc9c4]/30">
              <h3 className="text-sm font-bold text-[#171d1c] uppercase tracking-widest mb-6">Distribuição por Status</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.key]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => `${value} contatos`}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #bcc9c4' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Bar Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#bcc9c4]/30">
              <h3 className="text-sm font-bold text-[#171d1c] uppercase tracking-widest mb-6">Contatos por Responsável</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={barData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="nome" type="category" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => `${value} contatos`}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #bcc9c4' }}
                  />
                  <Bar dataKey="a_contactar" stackId="status" fill={STATUS_COLORS.a_contactar} />
                  <Bar dataKey="recuperacao_base" stackId="status" fill={STATUS_COLORS.recuperacao_base} />
                  <Bar dataKey="tentativa" stackId="status" fill={STATUS_COLORS.tentativa} />
                  <Bar dataKey="em_conversa" stackId="status" fill={STATUS_COLORS.em_conversa} />
                  <Bar dataKey="agendou" stackId="status" fill={STATUS_COLORS.agendou} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Funil Visual */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#bcc9c4]/30">
            <h3 className="text-sm font-bold text-[#171d1c] uppercase tracking-widest mb-6">Funil de Conversão</h3>
            <div className="space-y-4">
              {[
                { label: STATUS_LABELS.a_contactar, value: contagemPorStatusPeriodo.a_contactar, color: STATUS_COLORS.a_contactar },
                { label: STATUS_LABELS.recuperacao_base, value: contagemPorStatusPeriodo.recuperacao_base, color: STATUS_COLORS.recuperacao_base },
                { label: STATUS_LABELS.tentativa, value: contagemPorStatusPeriodo.tentativa, color: STATUS_COLORS.tentativa },
                { label: STATUS_LABELS.em_conversa, value: contagemPorStatusPeriodo.em_conversa, color: STATUS_COLORS.em_conversa },
                { label: STATUS_LABELS.agendou, value: contagemPorStatusPeriodo.agendou, color: STATUS_COLORS.agendou },
              ].map((item) => {
                const pct = totalContatosPeriodo > 0 ? Math.round((item.value / totalContatosPeriodo) * 100) : 0
                return (
                  <div key={item.label}>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-semibold text-[#171d1c]">{item.label}</span>
                      <span className="text-sm font-bold text-[#3d4945]">
                        {item.value} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#f0f5f4] rounded-full h-3 overflow-hidden">
                      <div
                        className="h-3 rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#bcc9c4]/30">
            <h3 className="text-sm font-bold text-[#171d1c] uppercase tracking-widest mb-6">Etapas do Kanban</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {contagemPorColunaPeriodo.filter(i => i.total > 0).map((item) => {
                const visual = getVisualColunaContato(item.corChave)
                const pct = totalContatosPeriodo > 0 ? Math.round((item.total / totalContatosPeriodo) * 100) : 0
                return (
                  <div key={item.chave} className="rounded-xl border p-4" style={{ borderColor: visual.cor + '30', backgroundColor: visual.corBg }}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#171d1c] truncate">{item.nome}</p>
                        <p className="text-[11px] mt-1" style={{ color: visual.cor }}>{pct}% da base</p>
                      </div>
                      <div
                        className="min-w-[42px] h-9 px-2 rounded-full flex items-center justify-center text-sm font-bold"
                        style={{ backgroundColor: visual.corBadgeBg, color: visual.corBadgeText }}
                      >
                        {item.total}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: ATIVIDADE POR PERÍODO */}
      {abaAtiva === 'atividade' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-[#006b5a] to-[#33a68f] p-6 rounded-2xl text-white shadow-md">
              <div className="flex items-start justify-between mb-4">
                <h4 className="text-xs font-bold uppercase tracking-widest opacity-80">Notas no Período</h4>
                <FileText size={18} />
              </div>
              <p className="text-3xl font-bold">{totalNotasPeriodo}</p>
              <p className="text-xs mt-2 opacity-70">Interações registradas</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#bcc9c4]/30">
              <div className="flex items-start justify-between mb-4">
                <h4 className="text-xs font-bold text-[#3d4945] uppercase tracking-widest">Pacientes Contatados</h4>
                <Users size={18} className="text-[#006b5a]" />
              </div>
              <p className="text-3xl font-bold text-[#006b5a]">{totalPacientesContatados}</p>
              <p className="text-xs mt-2 text-[#3d4945]/60">Pacientes únicos alcançados</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#bcc9c4]/30">
              <div className="flex items-start justify-between mb-4">
                <h4 className="text-xs font-bold text-[#3d4945] uppercase tracking-widest">Mais Ativo</h4>
                <Activity size={18} className="text-amber-500" />
              </div>
              {atividadePorResponsavel[0] ? (
                <>
                  <p className="text-lg font-bold text-[#171d1c] truncate">{atividadePorResponsavel[0].nome.split(' ')[0]}</p>
                  <p className="text-xs mt-2 text-[#3d4945]/60">{atividadePorResponsavel[0].notasPeriodo} notas</p>
                </>
              ) : (
                <p className="text-sm text-[#3d4945]/50 mt-2">Sem dados</p>
              )}
            </div>
          </div>

          {/* Filtro por fisio + Tabela */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#bcc9c4]/30 overflow-hidden">
            <div className="px-6 py-4 border-b border-[#bcc9c4]/30 flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-sm font-bold text-[#171d1c] uppercase tracking-widest">Por Profissional</h3>
              {atividadePorResponsavel.length > 1 && (
                <select
                  value={filtroFisioAtividade}
                  onChange={e => setFiltroFisioAtividade(e.target.value)}
                  className="text-xs font-semibold bg-[#f0f5f4] border border-[#bcc9c4]/50 rounded-lg px-3 py-1.5 text-[#3d4945] focus:outline-none focus:border-[#006b5a]"
                >
                  <option value="todos">Todos os profissionais</option>
                  {atividadePorResponsavel.map(r => (
                    <option key={r.id} value={r.id}>{r.nome}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#f9faf8] border-b border-[#bcc9c4]/30">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold text-[#3d4945]">Profissional</th>
                    <th className="px-5 py-3 text-center font-semibold text-[#3d4945]">Carteira</th>
                    <th className="px-5 py-3 text-center font-semibold text-[#3d4945]">Notas no Período</th>
                    <th className="px-5 py-3 text-center font-semibold text-[#3d4945]">Pacientes Contatados</th>
                    <th className="px-5 py-3 text-center font-semibold text-[#3d4945]">Taxa de Atividade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#bcc9c4]/20">
                  {atividadePorResponsavel
                    .filter(r => filtroFisioAtividade === 'todos' || r.id === filtroFisioAtividade)
                    .map(r => (
                      <tr key={r.id} className="hover:bg-[#f9faf8] transition-colors">
                        <td className="px-5 py-3 font-semibold text-[#171d1c]">{r.nome}</td>
                        <td className="px-5 py-3 text-center text-[#3d4945]">{r.carteira}</td>
                        <td className="px-5 py-3 text-center">
                          <span className="font-bold text-[#006b5a]">{r.notasPeriodo}</span>
                        </td>
                        <td className="px-5 py-3 text-center text-[#3d4945]">{r.pacientesContatados}</td>
                        <td className="px-5 py-3 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                            r.taxaAtividade >= 60
                              ? 'bg-green-50 text-green-700 border-green-300'
                              : r.taxaAtividade >= 30
                                ? 'bg-amber-50 text-amber-700 border-amber-300'
                                : 'bg-red-50 text-red-700 border-red-300'
                          }`}>
                            {r.taxaAtividade}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  {atividadePorResponsavel.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-sm text-[#3d4945]/50">
                        Nenhuma nota registrada no período selecionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: CONTATOS EM RISCO */}
      {abaAtiva === 'risco' && (
        <div className="space-y-6">
          {/* Filtro por responsável */}
          {isGestorOuMaster && contatosPorResponsavel.length > 1 && (
            <div>
              <h3 className="text-xs font-bold text-[#3d4945] uppercase tracking-widest mb-3">Filtrar por Responsável</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFiltroResponsavel(null)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all ${
                    filtroResponsavel === null
                      ? 'bg-[#006b5a] text-white'
                      : 'bg-[#f0f5f4] text-[#3d4945] hover:bg-[#e0f5f0]'
                  }`}
                >
                  Todos
                </button>
                {contatosPorResponsavel.map(r => (
                  <button
                    key={r.id ?? 'sem_responsavel'}
                    onClick={() => setFiltroResponsavel(r.id ?? 'sem_responsavel')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all ${
                      filtroResponsavel === (r.id ?? 'sem_responsavel')
                        ? 'bg-[#006b5a] text-white'
                        : 'bg-[#f0f5f4] text-[#3d4945] hover:bg-[#e0f5f0]'
                    }`}
                  >
                    {r.nome} ({r.total})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Alerta: Contatos sem responsável */}
          {contagemRiscoFiltrados.length > 0 && (
            <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-orange-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-orange-900">Atenção: Contatos sem Responsável</h4>
                  <p className="text-sm text-orange-700 mt-1">
                    {contagemRiscoFiltrados.length} contato(s) não atribuído(s) a nenhum responsável.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tabela de contatos em risco */}
          {contatosRiscoFiltrados.length > 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-[#bcc9c4]/30 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#f9faf8] border-b border-[#bcc9c4]/30">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-[#3d4945]">Paciente</th>
                      <th className="px-4 py-3 text-left font-semibold text-[#3d4945]">Etapa</th>
                      <th className="px-4 py-3 text-left font-semibold text-[#3d4945]">Última Atividade</th>
                      <th className="px-4 py-3 text-left font-semibold text-[#3d4945]">Responsável</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contatosRiscoFiltrados.map(c => {
                      const diasSdeUltima = calcularDiasSdeUltimaAtividade(c.ultima_nota_criada_em, c.ultimo_atendimento_data, c.atualizado_em)
                      return (
                        <tr key={c.paciente_id} className={`border-b border-[#bcc9c4]/30 ${corRiscoPorDias(diasSdeUltima)}`}>
                          <td className="px-4 py-3 font-medium text-[#171d1c]">{c.paciente_nome}</td>
                          <td className="px-4 py-3">
                            <span
                              className="px-2 py-1 rounded-full text-xs font-semibold text-white"
                              style={{ backgroundColor: getVisualColunaContato(c.kanban_coluna_cor_chave).cor }}
                            >
                              {c.kanban_coluna_nome}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[#3d4945]/80">
                            <span className="font-semibold">{labelRiscoPorDias(diasSdeUltima)}</span>
                            {c.ultimo_atendimento_data && (
                              <p className="text-xs text-[#3d4945]/60 mt-1">
                                {format(new Date(c.ultimo_atendimento_data), 'dd/MM/yyyy', { locale: ptBR })}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-[#3d4945]/80">
                            {c.responsavel_nome || <span className="text-red-600 font-semibold">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white p-12 rounded-2xl shadow-sm border border-[#bcc9c4]/30 text-center">
              <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4" />
              <h3 className="text-lg font-semibold text-[#171d1c] mb-2">Nenhum contato em risco</h3>
              <p className="text-[#3d4945]/70">Todos os contatos estão atualizados e ativos.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
