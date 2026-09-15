'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TrendingUp, CalendarDays, Users, UserPlus, Search, Loader2, Target, ArrowRight } from 'lucide-react'

export type StatusDistribuicao = {
  concluidos: number
  cancelados: number
  faltas: number
  emAberto: number
  total: number
}

export type TendenciaDiaData = {
  label: string
  labelCompleto: string
  count: number
  concluidos: number
}

export type RankingItem = {
  profissionalId: string
  nome: string
  taxaOcupacao: number
  qtdAtendimentos: number
  qtdContatos: number
}

export type FunilContatosData = {
  total: number
  semResponsavel: number
  itens: { label: string; value: number; cor: string }[]
}

export type PeriodoDashboardData = {
  agendamentos: number
  taxaConclusao: number
  pacientesAtivos: number
  pacientesCadastrados: number
  taxaOcupacao: number
  fabrilMin: number
  jornadaMin: number
  agendaHref: string
  ocupacaoHref: string
  distribuicao: StatusDistribuicao
  tendencia: TendenciaDiaData[]
  ranking: RankingItem[]
  funil: FunilContatosData | null
}

type PeriodoKey = 'dia' | 'semana' | 'mes' | 'personalizado'

const LABEL_PERIODO: Record<PeriodoKey, string> = {
  dia: 'Hoje',
  semana: 'Semana',
  mes: 'Mês',
  personalizado: 'Personalizado',
}

const INPUT = 'px-3 py-1.5 rounded-lg border border-[#bcc9c4]/50 bg-white text-sm text-[#171d1c] focus:outline-none focus:ring-2 focus:ring-[#006b5a]/30 focus:border-[#006b5a] transition-colors'

export default function VisaoGeralKPIs({
  dados,
  periodoInicial,
  deInicial,
  ateInicial,
  isGestorOuMaster,
}: {
  dados: Partial<Record<PeriodoKey, PeriodoDashboardData>>
  periodoInicial: PeriodoKey
  deInicial: string
  ateInicial: string
  isGestorOuMaster: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [periodo, setPeriodo] = useState<PeriodoKey>(periodoInicial)
  const [de, setDe] = useState(deInicial)
  const [ate, setAte] = useState(ateInicial)

  function handleAplicarPersonalizado() {
    startTransition(() => {
      router.push(`/dashboard?periodo=personalizado&de=${de}&ate=${ate}`)
    })
  }

  // Enquanto o usuário ajusta as datas mas ainda não aplicou, mostra o Mês como referência
  const d = dados[periodo] ?? dados.mes!
  const maxTendencia = Math.max(...d.tendencia.map((t) => t.count), 1)

  return (
    <div className="space-y-4">
      <div className={`flex flex-wrap items-center gap-3 transition-opacity ${isPending ? 'opacity-60 pointer-events-none' : ''}`}>
        <div className="inline-flex bg-[#f0f5f4] rounded-full p-1">
          {(Object.keys(LABEL_PERIODO) as PeriodoKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriodo(key)}
              disabled={isPending}
              className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all disabled:cursor-not-allowed ${
                periodo === key
                  ? 'bg-white shadow-sm text-[#006b5a]'
                  : 'text-[#3d4945]/70 hover:text-[#171d1c]'
              }`}
            >
              {LABEL_PERIODO[key]}
            </button>
          ))}
        </div>

        {isPending && (
          <div className="flex items-center gap-1.5 text-[#006b5a] text-xs font-medium">
            <Loader2 size={14} className="animate-spin" />
            Carregando...
          </div>
        )}
      </div>

      {periodo === 'personalizado' && (
        <div className="flex flex-wrap items-end gap-3 bg-white rounded-2xl border border-[#bcc9c4]/30 p-4">
          <div>
            <label className="block text-xs font-semibold text-[#3d4945]/70 mb-1">De</label>
            <input
              type="date"
              value={de}
              max={ate}
              onChange={(e) => setDe(e.target.value)}
              disabled={isPending}
              className={INPUT}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#3d4945]/70 mb-1">Até</label>
            <input
              type="date"
              value={ate}
              min={de}
              onChange={(e) => setAte(e.target.value)}
              disabled={isPending}
              className={INPUT}
            />
          </div>
          <button
            type="button"
            onClick={handleAplicarPersonalizado}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 bg-[#006b5a] hover:bg-[#005548] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Aplicar
          </button>
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href={d.ocupacaoHref}
          className="bg-gradient-to-br from-[#006b5a] to-[#33a68f] p-6 rounded-3xl shadow-lg text-white hover:shadow-xl transition-shadow"
        >
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest opacity-80">Taxa de Ocupação</h3>
            <div className="bg-white/20 p-2 rounded-lg">
              <TrendingUp size={18} />
            </div>
          </div>
          <p className="text-3xl font-bold">{d.taxaOcupacao}%</p>
          <p className="text-xs mt-2 opacity-75">
            {d.fabrilMin > 0
              ? `${Math.round(d.fabrilMin / 60)}h ${d.fabrilMin % 60}m / ${Math.round(d.jornadaMin / 60)}h`
              : '0 / 0'}
          </p>
        </Link>

        <Link
          href={d.agendaHref}
          className="bg-white p-6 rounded-3xl shadow-sm border border-[#bcc9c4]/30 hover:border-[#006b5a]/40 transition-colors"
        >
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xs font-bold text-[#3d4945] uppercase tracking-widest">Agendamentos</h3>
            <CalendarDays size={18} className="text-[#006b5a]" />
          </div>
          <p className="text-3xl font-bold text-[#171d1c]">{d.agendamentos}</p>
          <p className="text-xs mt-2 text-[#3d4945]/70">{d.taxaConclusao}% concluídos</p>
        </Link>

        <Link
          href="/pacientes"
          className="bg-white p-6 rounded-3xl shadow-sm border border-[#bcc9c4]/30 hover:border-[#006b5a]/40 transition-colors"
        >
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xs font-bold text-[#3d4945] uppercase tracking-widest">Pacientes Ativos</h3>
            <Users size={18} className="text-[#006b5a]" />
          </div>
          <p className="text-3xl font-bold text-[#171d1c]">{d.pacientesAtivos}</p>
          <p className="text-xs mt-2 text-[#3d4945]/70">com agenda/sessão no período</p>
        </Link>

        <Link
          href="/pacientes"
          className="bg-white p-6 rounded-3xl shadow-sm border border-[#bcc9c4]/30 hover:border-[#006b5a]/40 transition-colors"
        >
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xs font-bold text-[#3d4945] uppercase tracking-widest">Pacientes Cadastrados</h3>
            <UserPlus size={18} className="text-[#006b5a]" />
          </div>
          <p className="text-3xl font-bold text-[#171d1c]">{d.pacientesCadastrados}</p>
          <p className="text-xs mt-2 text-[#3d4945]/70">novos cadastros no período</p>
        </Link>
      </div>

      {/* Distribuição de Status + Tendência */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#bcc9c4]/30">
          <h3 className="text-sm font-bold text-[#171d1c] uppercase tracking-widest mb-4">Distribuição de Status</h3>
          <div className="space-y-3">
            {[
              { label: 'Concluído', count: d.distribuicao.concluidos, cor: 'bg-green-500' },
              { label: 'Cancelado', count: d.distribuicao.cancelados, cor: 'bg-red-500' },
              { label: 'Falta', count: d.distribuicao.faltas, cor: 'bg-gray-500' },
              { label: 'Em Aberto', count: d.distribuicao.emAberto, cor: 'bg-amber-500' },
            ].map((item) => {
              const pct = d.distribuicao.total > 0 ? Math.round((item.count / d.distribuicao.total) * 100) : 0
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

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#bcc9c4]/30">
          <h3 className="text-sm font-bold text-[#171d1c] uppercase tracking-widest mb-4">Tendência</h3>
          <div className="flex items-end justify-between gap-1 h-32 overflow-x-auto">
            {d.tendencia.map((dia, i) => {
              const alturaTotal = dia.count > 0 ? (dia.count / maxTendencia) * 100 : 5
              const alturaConcluida = dia.concluidos > 0 ? (dia.concluidos / maxTendencia) * 100 : 0
              const outros = dia.count - dia.concluidos
              const tooltip = `${dia.labelCompleto}: ${dia.count} agendamento(s) — ${dia.concluidos} concluído(s), ${outros} em outro status`

              return (
                <div key={i} className="flex flex-col items-center gap-2 flex-1 min-w-[10px] group">
                  <div
                    className="relative w-full h-24 flex items-end justify-center cursor-help"
                    title={tooltip}
                  >
                    <div
                      className="absolute bottom-0 w-full bg-[#cce2da] rounded-sm transition-all group-hover:opacity-80"
                      style={{ height: `${alturaTotal}%` }}
                    />
                    {alturaConcluida > 0 && (
                      <div
                        className="absolute bottom-0 w-full bg-[#006b5a] rounded-sm transition-all group-hover:opacity-80"
                        style={{ height: `${alturaConcluida}%` }}
                      />
                    )}
                  </div>
                  {d.tendencia.length <= 14 && (
                    <span className="text-xs font-semibold text-[#3d4945]/60 capitalize whitespace-nowrap">
                      {dia.label}
                    </span>
                  )}
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

      {/* Funil de Contatos (Apenas Gestor/Master) — reage ao mesmo período selecionado */}
      {d.funil && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#bcc9c4]/30">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-[#f0fcf9] p-2.5 rounded-lg">
                <Target size={18} className="text-[#006b5a]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#171d1c] uppercase tracking-widest">Funil de Contatos</h3>
                <p className="text-xs text-[#3d4945]/60 mt-0.5">
                  {d.funil.total > 0 ? `${d.funil.total} contatos novos no período` : 'Nenhum contato novo neste período'}
                </p>
              </div>
            </div>
            <Link
              href="/contatos/relatorio"
              className="flex items-center gap-2 px-4 py-2 bg-[#f0fcf9] hover:bg-[#e0f9f5] text-[#006b5a] rounded-lg text-xs font-semibold transition-colors"
            >
              Ver relatório
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
            {d.funil.itens.map((item) => (
              <div key={item.label} className={`p-3 rounded-lg ${item.cor} text-center`}>
                <p className="text-lg font-bold">{item.value}</p>
                <p className="text-xs font-medium mt-1 opacity-80">{item.label}</p>
              </div>
            ))}
          </div>

          {d.funil.semResponsavel > 0 && (
            <div className="bg-orange-50 border-l-4 border-orange-500 p-3 rounded-lg">
              <p className="text-sm font-semibold text-orange-700">
                ⚠️ {d.funil.semResponsavel} contato(s) sem responsável atribuído
              </p>
            </div>
          )}
        </div>
      )}

      {/* Ranking da Equipe */}
      {isGestorOuMaster && d.ranking.length > 1 && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#bcc9c4]/30">
          <h3 className="text-sm font-bold text-[#171d1c] uppercase tracking-widest mb-4">Ranking da Equipe</h3>
          <div className="space-y-3">
            {[...d.ranking]
              .sort((a, b) => b.taxaOcupacao - a.taxaOcupacao)
              .map((kpi, idx) => (
                <div key={kpi.profissionalId} className="flex items-center justify-between p-3 bg-[#f9faf8] rounded-xl border border-[#bcc9c4]/20">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-[#006b5a] text-sm">{idx + 1}º</span>
                    <div>
                      <p className="text-sm font-bold text-[#171d1c]">{kpi.nome}</p>
                      <p className="text-xs text-[#3d4945]/60">
                        {kpi.qtdAtendimentos} atendimentos · {kpi.qtdContatos} contatos da base
                      </p>
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
