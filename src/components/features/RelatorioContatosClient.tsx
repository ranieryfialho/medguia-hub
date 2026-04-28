'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { AlertCircle, CheckCircle2, TrendingUp, Users, Eye, EyeOff } from 'lucide-react'

type StatusContato = 'a_contactar' | 'tentativa' | 'em_conversa' | 'sem_interesse' | 'agendou'

type ContatoComDados = {
  paciente_id: string
  paciente_nome: string
  status: StatusContato
  responsavel_id: string | null
  responsavel_nome: string | null
  ultimo_atendimento_data: string | null
  ultimo_atendimento_tipo: string | null
  ultima_nota_criada_em: string | null
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
  taxaConversaoGeral: number
  totalContatos: number
  isGestorOuMaster: boolean
  userNome: string
}

const STATUS_COLORS: Record<StatusContato, string> = {
  a_contactar: '#6d7a75',
  tentativa: '#b45309',
  em_conversa: '#006b5a',
  sem_interesse: '#ba1a1a',
  agendou: '#1AAF9A',
}

const STATUS_LABELS: Record<StatusContato, string> = {
  a_contactar: 'A Contatar',
  tentativa: 'Tentativa',
  em_conversa: 'Em Conversa',
  sem_interesse: 'Sem Interesse',
  agendou: 'Agendou',
}

function calcularDiasSdeUltimaAtividade(ultimaNota: string | null, ultimoAtendimento: string | null): number {
  const ultimaAtividade = ultimaNota ?? ultimoAtendimento
  if (!ultimaAtividade) return 999

  const dias = Math.floor(
    (new Date().getTime() - new Date(ultimaAtividade).getTime()) / (1000 * 60 * 60 * 24)
  )
  return dias
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
  contatos,
  contagemPorStatus,
  contatosPorResponsavel,
  contatosEmRisco,
  contatosSemResponsavel,
  taxaConversaoGeral,
  totalContatos,
  isGestorOuMaster,
  userNome,
}: RelatorioContatosClientProps) {
  const [abaAtiva, setAbaAtiva] = useState<'performance' | 'risco'>('performance')
  const [filtroResponsavel, setFiltroResponsavel] = useState<string | null>(null)

  // Dados para gráfico de pizza
  const pieData = [
    { name: STATUS_LABELS.a_contactar, value: contagemPorStatus.a_contactar },
    { name: STATUS_LABELS.tentativa, value: contagemPorStatus.tentativa },
    { name: STATUS_LABELS.em_conversa, value: contagemPorStatus.em_conversa },
    { name: STATUS_LABELS.agendou, value: contagemPorStatus.agendou },
    { name: STATUS_LABELS.sem_interesse, value: contagemPorStatus.sem_interesse },
  ].filter(d => d.value > 0)

  // Dados para gráfico de barras (por responsável)
  const barData = contatosPorResponsavel.map(r => ({
    nome: r.nome,
    total: r.total,
    a_contactar: r.contagemPorStatus.a_contactar,
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
                <h4 className="text-xs font-bold uppercase tracking-widest opacity-80">Total</h4>
                <Users size={18} />
              </div>
              <p className="text-3xl font-bold">{totalContatos}</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#bcc9c4]/30">
              <div className="flex items-start justify-between mb-4">
                <h4 className="text-xs font-bold text-[#3d4945] uppercase tracking-widest">Taxa Conversão</h4>
                <TrendingUp size={18} className="text-[#006b5a]" />
              </div>
              <p className="text-3xl font-bold text-[#006b5a]">{taxaConversaoGeral}%</p>
              <p className="text-xs mt-2 text-[#3d4945]/60">
                {contagemPorStatus.agendou} de {totalContatos - contagemPorStatus.sem_interesse}
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#bcc9c4]/30">
              <div className="flex items-start justify-between mb-4">
                <h4 className="text-xs font-bold text-[#3d4945] uppercase tracking-widest">Agendamentos</h4>
                <CheckCircle2 size={18} className="text-green-600" />
              </div>
              <p className="text-3xl font-bold text-green-600">{contagemPorStatus.agendou}</p>
              <p className="text-xs mt-2 text-[#3d4945]/60">Conversões realizadas</p>
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
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name as StatusContato] || '#999'} />
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
                { label: STATUS_LABELS.a_contactar, value: contagemPorStatus.a_contactar, color: STATUS_COLORS.a_contactar },
                { label: STATUS_LABELS.tentativa, value: contagemPorStatus.tentativa, color: STATUS_COLORS.tentativa },
                { label: STATUS_LABELS.em_conversa, value: contagemPorStatus.em_conversa, color: STATUS_COLORS.em_conversa },
                { label: STATUS_LABELS.agendou, value: contagemPorStatus.agendou, color: STATUS_COLORS.agendou },
              ].map((item) => {
                const pct = totalContatos > 0 ? Math.round((item.value / totalContatos) * 100) : 0
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
        </div>
      )}

      {/* ABA 2: CONTATOS EM RISCO */}
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
                      <th className="px-4 py-3 text-left font-semibold text-[#3d4945]">Status</th>
                      <th className="px-4 py-3 text-left font-semibold text-[#3d4945]">Última Atividade</th>
                      <th className="px-4 py-3 text-left font-semibold text-[#3d4945]">Responsável</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contatosRiscoFiltrados.map(c => {
                      const diasSdeUltima = calcularDiasSdeUltimaAtividade(c.ultima_nota_criada_em, c.ultimo_atendimento_data)
                      return (
                        <tr key={c.paciente_id} className={`border-b border-[#bcc9c4]/30 ${corRiscoPorDias(diasSdeUltima)}`}>
                          <td className="px-4 py-3 font-medium text-[#171d1c]">{c.paciente_nome}</td>
                          <td className="px-4 py-3">
                            <span
                              className="px-2 py-1 rounded-full text-xs font-semibold text-white"
                              style={{ backgroundColor: STATUS_COLORS[c.status] }}
                            >
                              {STATUS_LABELS[c.status]}
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