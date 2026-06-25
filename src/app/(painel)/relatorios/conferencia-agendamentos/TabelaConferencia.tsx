'use client'

import { useState } from 'react'
import { CalendarDays, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import type { GrupoProfissionalConferencia } from '@/lib/relatorios/pdf-conferencia-agendamentos'

function formatarMinutos(minutos: number): string {
  if (minutos <= 0) return '—'
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  if (h === 0) return `${m}min`
  return m === 0 ? `${h}h` : `${h}h ${m}min`
}

export function TabelaConferencia({ grupos }: { grupos: GrupoProfissionalConferencia[] }) {
  const [abaAtiva, setAbaAtiva] = useState(0)
  const [pendentesAberto, setPendentesAberto] = useState(false)

  if (grupos.length === 0) return null

  const grupo = grupos[abaAtiva] ?? grupos[0]

  return (
    <div className="space-y-4">

      {/* Abas por fisioterapeuta */}
      <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl">
        {grupos.map((g, index) => (
          <button
            key={g.profissionalNome}
            onClick={() => { setAbaAtiva(index); setPendentesAberto(false) }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              abaAtiva === index
                ? 'bg-white text-[#006b5a] shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {g.profissionalNome}
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
              abaAtiva === index
                ? 'bg-[#006b5a]/10 text-[#006b5a]'
                : 'bg-slate-200 text-slate-500'
            }`}>
              {g.totalSessoes}
            </span>
            {g.pendentesPassados && g.pendentesPassados.length > 0 && (
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 border border-amber-200">
                {g.pendentesPassados.length} ⚠
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Conteúdo da aba ativa */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">

        {/* Header do profissional */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#006b5a]">
          <span className="font-bold text-white">{grupo.profissionalNome}</span>
          <span className="text-sm text-white/80 font-medium">
            {grupo.totalSessoes} sessão(ões) · {formatarMinutos(grupo.totalMinutos)}
          </span>
        </div>

        {/* Dias */}
        {grupo.dias.map((dia, diaIndex) => (
          <div key={dia.dataLabel} className={diaIndex > 0 ? 'border-t border-slate-100' : ''}>

            {/* Header do dia */}
            <div className="flex items-center justify-between px-5 py-2.5 bg-[#006b5a]/5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CalendarDays size={14} className="text-[#006b5a]" />
                <span className="text-sm font-semibold text-[#006b5a]">{dia.dataLabel}</span>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {dia.totalSessoes} sessão(ões) · {formatarMinutos(dia.totalMinutos)}
              </span>
            </div>

            {/* Tabela de sessões */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col className="w-16" />
                  <col className="w-[30%]" />
                  <col className="w-[22%]" />
                  <col className="w-20" />
                  <col />
                </colgroup>
                <thead className="bg-slate-50 text-slate-500 uppercase text-[11px]">
                  <tr>
                    <th className="text-left px-4 py-2.5">Hora</th>
                    <th className="text-left px-4 py-2.5">Paciente</th>
                    <th className="text-left px-4 py-2.5">Tipo</th>
                    <th className="text-right px-4 py-2.5">Duração</th>
                    <th className="text-left px-4 py-2.5">Plano de Saúde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {dia.sessoes.map((sessao, i) => (
                    <tr key={i} className={i % 2 === 1 ? 'bg-slate-50/50' : ''}>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500 whitespace-nowrap">{sessao.hora}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-900 truncate">{sessao.pacienteNome}</td>
                      <td className="px-4 py-2.5 text-slate-600 truncate">{sessao.tipo}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600 whitespace-nowrap">
                        {sessao.duracaoMinutos > 0 ? formatarMinutos(sessao.duracaoMinutos) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 truncate">{sessao.planoSaude}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* Seção de pendentes passados */}
        {grupo.pendentesPassados && grupo.pendentesPassados.length > 0 && (
          <div className="border-t-2 border-amber-200">
            <button
              onClick={() => setPendentesAberto(v => !v)}
              className="w-full flex items-center justify-between px-5 py-3 bg-amber-50 hover:bg-amber-100 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-500 shrink-0" />
                <span className="text-sm font-semibold text-amber-700">
                  Agendamentos não concluídos
                </span>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-800">
                  {grupo.pendentesPassados.length}
                </span>
              </div>
              {pendentesAberto
                ? <ChevronDown size={15} className="text-amber-500" />
                : <ChevronRight size={15} className="text-amber-500" />
              }
            </button>

            {pendentesAberto && (
              <div className="overflow-x-auto border-t border-amber-100">
                <table className="w-full text-sm table-fixed">
                  <colgroup>
                    <col className="w-36" />
                    <col className="w-[30%]" />
                    <col />
                    <col className="w-28" />
                  </colgroup>
                  <thead className="bg-amber-50 text-amber-700 uppercase text-[11px]">
                    <tr>
                      <th className="text-left px-4 py-2">Data / Hora</th>
                      <th className="text-left px-4 py-2">Paciente</th>
                      <th className="text-left px-4 py-2">Tipo</th>
                      <th className="text-left px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-50">
                    {grupo.pendentesPassados.map((p, i) => (
                      <tr key={i} className={i % 2 === 1 ? 'bg-amber-50/40' : 'bg-white'}>
                        <td className="px-4 py-2 text-xs text-amber-700 whitespace-nowrap font-mono">
                          {p.dataLabel} · {p.hora}
                        </td>
                        <td className="px-4 py-2 font-medium text-slate-800 truncate">{p.pacienteNome}</td>
                        <td className="px-4 py-2 text-slate-600 truncate">{p.tipo}</td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700 border border-amber-200">
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Rodapé totalizador */}
        <div className="flex items-center justify-between px-5 py-3 bg-emerald-50 border-t border-emerald-100">
          <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
            Total — {grupo.profissionalNome}
          </span>
          <span className="text-sm font-bold text-emerald-700">
            {grupo.totalSessoes} sessão(ões) · {formatarMinutos(grupo.totalMinutos)}
          </span>
        </div>
      </div>
    </div>
  )
}