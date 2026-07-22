'use client'

import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { ClipboardList, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import type { DadosRelatorioFollowUps } from '@/lib/relatorios/follow-ups-relatorio-dados'

const CORES_FALLBACK = ['#006b5a', '#33a68f', '#f59e0b', '#0ea5e9', '#ef4444', '#8b5cf6', '#ec4899']

export function DashboardFollowUps({ dados }: { dados: DadosRelatorioFollowUps }) {
  const pieData = dados.contagemPorTipo
    .filter(t => t.total > 0)
    .map((t, i) => ({ name: t.nome, value: t.total, cor: t.cor ?? CORES_FALLBACK[i % CORES_FALLBACK.length] }))

  const barData = [...dados.porResponsavel]
    .sort((a, b) => b.total - a.total)
    .map(r => ({ nome: r.nome, pendentes: r.pendentes, concluidos: r.concluidos }))

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-[#006b5a] to-[#33a68f] p-5 rounded-2xl text-white shadow-md">
          <div className="flex items-start justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-widest opacity-80">No filtro</h4>
            <ClipboardList size={18} />
          </div>
          <p className="text-3xl font-bold">{dados.total}</p>
          <p className="text-xs mt-2 opacity-70">{dados.totalPendentes} pendente(s) · {dados.totalConcluidos} concluído(s)</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-start justify-between mb-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Taxa de conclusão</h4>
            <CheckCircle2 size={18} className="text-[#006b5a]" />
          </div>
          <p className="text-3xl font-bold text-[#006b5a]">{dados.taxaConclusao}%</p>
          <p className="text-xs mt-2 text-slate-400">{dados.totalConcluidos} de {dados.total}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-start justify-between mb-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tempo médio</h4>
            <Clock size={18} className="text-slate-400" />
          </div>
          <p className="text-3xl font-bold text-slate-700">
            {dados.tempoMedioConclusaoDias !== null ? dados.tempoMedioConclusaoDias : '—'}
            {dados.tempoMedioConclusaoDias !== null && <span className="text-base font-semibold text-slate-400"> dia(s)</span>}
          </p>
          <p className="text-xs mt-2 text-slate-400">Até a conclusão</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-start justify-between mb-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Backlog (7+ dias)</h4>
            <AlertTriangle size={18} className={dados.totalPendentesAntigos > 0 ? 'text-red-500' : 'text-slate-300'} />
          </div>
          <p className={`text-3xl font-bold ${dados.totalPendentesAntigos > 0 ? 'text-red-600' : 'text-slate-700'}`}>
            {dados.totalPendentesAntigos}
          </p>
          <p className="text-xs mt-2 text-slate-400">Pendentes sem ação há mais de 7 dias</p>
        </div>
      </div>

      {/* Gráficos */}
      {(pieData.length > 0 || barData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {pieData.length > 0 && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-6">Distribuição por Tipo</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={95}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.cor} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value} follow-up(s)`} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {barData.length > 0 && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-6">Por Responsável</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 30, left: 90, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="nome" type="category" width={90} tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="pendentes" stackId="status" fill="#f59e0b" name="Pendentes" />
                  <Bar dataKey="concluidos" stackId="status" fill="#006b5a" name="Concluídos" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Backlog detalhado */}
      {dados.pendentesAntigos.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">Pendentes há mais de 7 dias</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-2 font-semibold">Paciente</th>
                  <th className="px-4 py-2 font-semibold">Tipo</th>
                  <th className="px-4 py-2 font-semibold">Responsável</th>
                  <th className="px-4 py-2 font-semibold text-right">Dias</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dados.pendentesAntigos.map((p, i) => (
                  <tr key={i} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2 font-medium text-slate-800">{p.paciente_nome}</td>
                    <td className="px-4 py-2 text-slate-500">{p.tipo_nome}</td>
                    <td className="px-4 py-2 text-slate-500">{p.responsavel_nome ?? 'Sem responsável'}</td>
                    <td className="px-4 py-2 text-right font-bold text-red-600">{p.dias_pendente}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
