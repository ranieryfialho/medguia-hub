'use client'

import { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronUp, ChevronDown, Eye, ChevronRight } from 'lucide-react'
import { Tooltip } from '../shared'
import { getCorConfig, type OpcaoStatus } from '@/lib/status-disponibilidade-cores'
import { formatAppDate, formatAppTime } from '@/lib/datetime'
import { classificarBloco, LIMITE_BLOCO_MIN } from '@/lib/status-disponibilidade-regras'

type AtendimentoDetalheKPI = {
  id: string
  pacienteNome: string
  tipo: string
  duracaoMinutos: number
  data: string
}

type StatusDetalheKPI = {
  id: string
  status: string
  observacao: string | null
  inicio: string
  fim: string | null
  duracaoMinutos: number
  aberto: boolean
  /** AC-041: minutos tirados por também terem sido contados como atendimento. */
  descontadoMinutos: number
}

type KPIsProfissional = {
  profissionalId: string
  nome: string
  jornadaContratadaMin: number
  tempoFabrilMin: number
  horasAgendamentoMin: number
  tempoReuniaoMin: number
  tempoStatusMin: Record<string, number>
  taxaOcupacao: number
  qtdAtendimentos: number
  tempoMedioMin: number
  diasSubutilizados: number
  detalheAtendimentos: AtendimentoDetalheKPI[]
  detalheStatus: StatusDetalheKPI[]
}

// Mesmo cap do fallback automático (job "fechar-status-esquecidos") — usado só
// pra destacar visualmente entradas suspeitas, não afeta nenhum cálculo.
/**
 * Acima disto, o bloco é anômalo de verdade — não apenas esquecido (AC-035).
 *
 * O valor era 110 fixo, calibrado quando o teto era 2h e qualquer bloco perto
 * dele merecia olhar. Depois o teto foi a 1h (10/08) e o alerta virou inalcançável
 * para blocos novos; com o teto de volta a 2h (11/08), 110 passaria a pintar de
 * vermelho TODO bloco capado pelo cron — que agora tem rótulo próprio, "expirou".
 *
 * O que sobra como anomalia é o bloco fechado ACIMA do teto. Isso não deveria
 * existir: o cron capa em `inicio + 2h`. Um bloco de 3h fechado significa ou que
 * o cron não rodou por muito tempo, ou que o gatilho fechou com `fim = NOW()` —
 * a inversão de ordem que AC-006 existe para impedir e que inflaria o Tempo
 * Fábril. É o mesmo `duracao_minutos > 121` da conferência do roteiro de
 * aplicação, e merece o vermelho.
 */
const LIMITE_ALERTA_MIN = LIMITE_BLOCO_MIN + 1

type TabelaTempoFabrilProps = {
  kpis: KPIsProfissional[]
  statusOpcoes: OpcaoStatus[]
}

type OrderBy = 'nome' | 'taxa' | 'fabril' | 'contratada' | 'qtd' | 'media' | 'agendamento'
type OrderDir = 'asc' | 'desc'

function formatarMinutos(min: number): string {
  if (min === 0) return '0h'
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h${m}min` : `${h}h`
}

function getBadgeColor(taxa: number): string {
  if (taxa >= 70) return 'bg-green-50 text-green-700 border-green-300'
  if (taxa >= 40) return 'bg-yellow-50 text-yellow-700 border-yellow-300'
  return 'bg-red-50 text-red-700 border-red-300'
}

function SortIcon({
  col,
  orderBy,
  orderDir,
}: {
  col: OrderBy
  orderBy: OrderBy
  orderDir: OrderDir
}) {
  if (orderBy !== col) {
    return <div className="w-4 h-4" />
  }

  return orderDir === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />
}

export function TabelaTempoFabril({ kpis, statusOpcoes }: TabelaTempoFabrilProps) {
  // Status não-sistema que têm tempo > 0 em qualquer profissional no período
  const statusComTempo = statusOpcoes
    .filter(op => !op.sistema && kpis.some(k => (k.tempoStatusMin[op.slug] ?? 0) > 0))
    .sort((a, b) => a.ordem - b.ordem)
  const router = useRouter()
  const [orderBy, setOrderBy] = useState<OrderBy>('nome')
  const [orderDir, setOrderDir] = useState<OrderDir>('asc')
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  const toggleExpandido = (profissionalId: string) => {
    setExpandidos((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(profissionalId)) {
        proximo.delete(profissionalId)
      } else {
        proximo.add(profissionalId)
      }
      return proximo
    })
  }

  const handleSort = (col: OrderBy) => {
    if (orderBy === col) {
      setOrderDir(orderDir === 'asc' ? 'desc' : 'asc')
    } else {
      setOrderBy(col)
      setOrderDir('asc')
    }
  }

  const sortedKpis = [...kpis].sort((a, b) => {
    let aVal: string | number
    let bVal: string | number

    switch (orderBy) {
      case 'nome':
        aVal = a.nome.toLowerCase()
        bVal = b.nome.toLowerCase()
        break
      case 'taxa':
        aVal = a.taxaOcupacao
        bVal = b.taxaOcupacao
        break
      case 'fabril':
        aVal = a.tempoFabrilMin
        bVal = b.tempoFabrilMin
        break
      case 'contratada':
        aVal = a.jornadaContratadaMin
        bVal = b.jornadaContratadaMin
        break
      case 'qtd':
        aVal = a.qtdAtendimentos
        bVal = b.qtdAtendimentos
        break
      case 'media':
        aVal = a.tempoMedioMin
        bVal = b.tempoMedioMin
        break
      case 'agendamento':
        aVal = a.horasAgendamentoMin
        bVal = b.horasAgendamentoMin
        break
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return orderDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    }

    const numA = aVal as number
    const numB = bVal as number
    return orderDir === 'asc' ? numA - numB : numB - numA
  })

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#bcc9c4]/30 overflow-hidden print:shadow-none print:border-[#bcc9c4]/50">
      {/* Desktop: Table tradicional */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gradient-to-r from-[#f0f5f4] to-white border-b border-[#bcc9c4]/30">
            <tr>
              <th className="px-4 py-4 text-left font-semibold text-[#171d1c] whitespace-nowrap">
                <button
                  onClick={() => handleSort('nome')}
                  className="flex items-center gap-1.5 hover:text-[#006b5a] transition-colors"
                >
                  Profissional
                  <SortIcon col="nome" orderBy={orderBy} orderDir={orderDir} />
                </button>
              </th>
              <th className="px-4 py-4 text-left font-semibold text-[#171d1c] whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <button
                  onClick={() => handleSort('contratada')}
                  className="flex items-center gap-1.5 hover:text-[#006b5a] transition-colors"
                >
                  Jornada
                  <SortIcon col="contratada" orderBy={orderBy} orderDir={orderDir} />
                </button>
                  <Tooltip texto="Horas totais contratadas no período" />
                </div>
              </th>
              <th className="px-4 py-4 text-left font-semibold text-[#171d1c] whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <button
                  onClick={() => handleSort('fabril')}
                  className="flex items-center gap-1.5 hover:text-[#006b5a] transition-colors"
                >
                  Tempo Fábril
                  <SortIcon col="fabril" orderBy={orderBy} orderDir={orderDir} />
                </button>
                  <Tooltip texto="Horas em atendimento (Concluído ou Em atendimento) + status personalizados (reunião, hora administrativa, etc.)" />
                </div>
              </th>
              <th className="px-4 py-4 text-left font-semibold text-[#171d1c] whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <button
                  onClick={() => handleSort('agendamento')}
                  className="flex items-center gap-1.5 hover:text-[#006b5a] transition-colors"
                >
                  Horas de Agendamento
                  <SortIcon col="agendamento" orderBy={orderBy} orderDir={orderDir} />
                </button>
                  <Tooltip texto="Somatória das horas de consultas concluídas ou em atendimento" />
                </div>
              </th>
              {statusComTempo.map(op => {
                const cfg = getCorConfig(op.cor)
                return (
                  <th key={op.slug} className="px-4 py-4 text-left font-semibold text-[#171d1c] whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                      <span>{op.label}</span>
                      <Tooltip texto={`Tempo total com status "${op.label}" no período`} />
                    </div>
                  </th>
                )
              })}
              <th className="px-4 py-4 text-left font-semibold text-[#171d1c] whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <button
                  onClick={() => handleSort('taxa')}
                  className="flex items-center gap-1.5 hover:text-[#006b5a] transition-colors"
                >
                  Taxa
                  <SortIcon col="taxa" orderBy={orderBy} orderDir={orderDir} />
                </button>
                  <Tooltip texto="Percentual do tempo fábril em relação à jornada contratada" />
                </div>
              </th>
              <th className="px-4 py-4 text-left font-semibold text-[#171d1c] whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <button
                  onClick={() => handleSort('qtd')}
                  className="flex items-center gap-1.5 hover:text-[#006b5a] transition-colors"
                >
                  Atendimentos
                  <SortIcon col="qtd" orderBy={orderBy} orderDir={orderDir} />
                </button>
                  <Tooltip texto="Quantidade total de atendimentos realizados" />
                </div>
              </th>
              <th className="px-4 py-4 text-left font-semibold text-[#171d1c] whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <button
                  onClick={() => handleSort('media')}
                  className="flex items-center gap-1.5 hover:text-[#006b5a] transition-colors"
                >
                  Tempo Médio
                  <SortIcon col="media" orderBy={orderBy} orderDir={orderDir} />
                </button>
                  <Tooltip texto="Horas de agendamento dividido pela quantidade de atendimentos" />
                </div>
              </th>
              <th className="px-4 py-4 text-left font-semibold text-[#171d1c] whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <span>Dias Subutilizados</span>
                  <Tooltip texto="Dias com ocupação menor que 50%" />
                </div>
              </th>
              <th className="px-4 py-4 text-center font-semibold text-[#171d1c]">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#bcc9c4]/30">
            {sortedKpis.map(kpi => {
              const expandido = expandidos.has(kpi.profissionalId)
              return (
                <Fragment key={kpi.profissionalId}>
                  <tr className="hover:bg-[#f9faf8] transition-colors">
                    <td className="px-4 py-3 font-semibold text-[#171d1c]">
                      <button
                        onClick={() => toggleExpandido(kpi.profissionalId)}
                        className="flex items-center gap-1.5 hover:text-[#006b5a] transition-colors"
                        aria-expanded={expandido}
                      >
                        <ChevronRight
                          size={16}
                          className={`shrink-0 transition-transform text-[#6d7a75] ${expandido ? 'rotate-90' : ''}`}
                        />
                        {kpi.nome}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-[#3d4945]">{formatarMinutos(kpi.jornadaContratadaMin)}</td>
                    <td className="px-4 py-3 text-[#3d4945]">{formatarMinutos(kpi.tempoFabrilMin)}</td>
                    <td className="px-4 py-3 text-[#3d4945]">{formatarMinutos(kpi.horasAgendamentoMin)}</td>
                    {statusComTempo.map(op => {
                      const min = kpi.tempoStatusMin[op.slug] ?? 0
                      const cfg = getCorConfig(op.cor)
                      return (
                        <td key={op.slug} className={`px-4 py-3 font-medium ${cfg.text}`}>
                          {min > 0 ? formatarMinutos(min) : <span className="text-slate-300">—</span>}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${getBadgeColor(kpi.taxaOcupacao)}`}
                      >
                        {kpi.taxaOcupacao}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#3d4945] text-center font-medium">{kpi.qtdAtendimentos}</td>
                    <td className="px-4 py-3 text-[#3d4945]">{formatarMinutos(kpi.tempoMedioMin)}</td>
                    <td className="px-4 py-3 text-[#3d4945] text-center font-medium">{kpi.diasSubutilizados}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => router.push(`/relatorios/tempo-fabril?profissional=${kpi.profissionalId}&visao=individual`)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#006b5a] text-white text-xs font-semibold hover:bg-[#005247] transition-colors"
                      >
                        <Eye size={16} />
                        Ver Detalhes
                      </button>
                    </td>
                  </tr>
                  {expandido && (
                    <tr>
                      <td colSpan={9 + statusComTempo.length} className="bg-[#f9faf8] px-4 py-4 space-y-4">
                        <div>
                          <p className="text-xs font-semibold text-[#6d7a75] uppercase tracking-wide mb-2">Atendimentos</p>
                          <DetalheAtendimentos atendimentos={kpi.detalheAtendimentos} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[#6d7a75] uppercase tracking-wide mb-2">Conferência de status</p>
                          <DetalheStatus statusDetalhe={kpi.detalheStatus} statusOpcoes={statusOpcoes} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: Cards com informações */}
      <div className="md:hidden divide-y divide-[#bcc9c4]/30">
        {sortedKpis.map(kpi => {
          const expandido = expandidos.has(kpi.profissionalId)
          return (
          <div key={kpi.profissionalId} className="p-4 space-y-3 hover:bg-[#f9faf8] transition-colors">
            {/* Nome + Taxa (principal) */}
            <div className="flex items-start justify-between gap-3">
              <button
                onClick={() => toggleExpandido(kpi.profissionalId)}
                className="flex-1 flex items-center gap-1.5 text-left hover:text-[#006b5a] transition-colors"
                aria-expanded={expandido}
              >
                <ChevronRight
                  size={16}
                  className={`shrink-0 transition-transform text-[#6d7a75] ${expandido ? 'rotate-90' : ''}`}
                />
                <p className="font-semibold text-[#171d1c]">{kpi.nome}</p>
              </button>
              <span
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${getBadgeColor(kpi.taxaOcupacao)}`}
              >
                {kpi.taxaOcupacao}%
              </span>
            </div>

            {/* Grid 2x3 com dados */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs font-semibold text-[#6d7a75] mb-1">Jornada</p>
                <p className="font-medium text-[#171d1c]">{formatarMinutos(kpi.jornadaContratadaMin)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#6d7a75] mb-1">Tempo Fábril</p>
                <p className="font-medium text-[#171d1c]">{formatarMinutos(kpi.tempoFabrilMin)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#6d7a75] mb-1">Horas de Agendamento</p>
                <p className="font-medium text-[#171d1c]">{formatarMinutos(kpi.horasAgendamentoMin)}</p>
              </div>
              {statusComTempo.map(op => {
                const min = kpi.tempoStatusMin[op.slug] ?? 0
                const cfg = getCorConfig(op.cor)
                return (
                  <div key={op.slug}>
                    <p className="text-xs font-semibold text-[#6d7a75] mb-1">{op.label}</p>
                    <p className={`font-medium ${cfg.text}`}>{min > 0 ? formatarMinutos(min) : '—'}</p>
                  </div>
                )
              })}
              <div>
                <p className="text-xs font-semibold text-[#6d7a75] mb-1">Atendimentos</p>
                <p className="font-medium text-[#171d1c]">{kpi.qtdAtendimentos}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#6d7a75] mb-1">Tempo Médio</p>
                <p className="font-medium text-[#171d1c]">{formatarMinutos(kpi.tempoMedioMin)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#6d7a75] mb-1">Dias Subutilizados</p>
                <p className="font-medium text-[#171d1c]">{kpi.diasSubutilizados}</p>
              </div>
            </div>

            {expandido && (
              <div className="pt-2 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-[#6d7a75] uppercase tracking-wide mb-2">Atendimentos</p>
                  <DetalheAtendimentos atendimentos={kpi.detalheAtendimentos} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#6d7a75] uppercase tracking-wide mb-2">Conferência de status</p>
                  <DetalheStatus statusDetalhe={kpi.detalheStatus} statusOpcoes={statusOpcoes} />
                </div>
              </div>
            )}

            {/* Botão de Ações */}
            <button
              onClick={() => router.push(`/relatorios/tempo-fabril?profissional=${kpi.profissionalId}&visao=individual`)}
              className="w-full px-3 py-2.5 rounded-lg bg-[#006b5a] text-white text-xs font-semibold hover:bg-[#005247] transition-colors flex items-center justify-center gap-2 mt-4"
            >
              <Eye size={16} />
              Ver Detalhes Completos
            </button>
          </div>
          )
        })}
      </div>
    </div>
  )
}

function DetalheAtendimentos({ atendimentos }: { atendimentos: AtendimentoDetalheKPI[] }) {
  if (atendimentos.length === 0) {
    return <p className="text-sm text-[#6d7a75] italic">Nenhum atendimento fábril no período.</p>
  }

  return (
    <div className="max-h-80 overflow-y-auto rounded-lg border border-[#bcc9c4]/30">
      <table className="w-full text-sm">
        <thead className="bg-white sticky top-0">
          <tr className="text-left text-xs font-semibold text-[#6d7a75] uppercase">
            <th className="px-3 py-2">Paciente</th>
            <th className="px-3 py-2">Tipo de Consulta</th>
            <th className="px-3 py-2">Dia</th>
            <th className="px-3 py-2 text-right">Tempo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#bcc9c4]/30 bg-white">
          {atendimentos.map((a) => (
            <tr key={a.id}>
              <td className="px-3 py-2 text-[#171d1c] font-medium">{a.pacienteNome}</td>
              <td className="px-3 py-2 text-[#3d4945]">{a.tipo}</td>
              <td className="px-3 py-2 text-[#3d4945] whitespace-nowrap">
                {formatAppDate(a.data)} {formatAppTime(a.data)}
              </td>
              <td className="px-3 py-2 text-[#3d4945] text-right whitespace-nowrap">
                {formatarMinutos(a.duracaoMinutos)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DetalheStatus({
  statusDetalhe,
  statusOpcoes,
}: {
  statusDetalhe: StatusDetalheKPI[]
  statusOpcoes: OpcaoStatus[]
}) {
  if (statusDetalhe.length === 0) {
    return <p className="text-sm text-[#6d7a75] italic">Nenhum status personalizado registrado no período.</p>
  }

  // AC-041: os totais da conferência somam o tempo LÍQUIDO, que é o que entrou
  // no Tempo Fábril. Somar o bruto faria esta tabela discordar das colunas da
  // tabela principal justamente nos profissionais com sobreposição — e a
  // conferência existe para explicar aqueles números, não para contradizê-los.
  const liquidoDoBloco = (s: StatusDetalheKPI) =>
    Math.max(0, s.duracaoMinutos - s.descontadoMinutos)

  const totalGeralMin = statusDetalhe.reduce((acc, s) => acc + liquidoDoBloco(s), 0)
  const totalDescontadoMin = statusDetalhe.reduce((acc, s) => acc + s.descontadoMinutos, 0)
  const totaisPorStatus = new Map<string, number>()
  for (const s of statusDetalhe) {
    totaisPorStatus.set(s.status, (totaisPorStatus.get(s.status) ?? 0) + liquidoDoBloco(s))
  }
  const statusOrdenados = [...totaisPorStatus.entries()].sort((a, b) => b[1] - a[1])

  return (
    <div className="rounded-lg border border-[#bcc9c4]/30 overflow-hidden">
      <div className="max-h-80 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-white sticky top-0">
            <tr className="text-left text-xs font-semibold text-[#6d7a75] uppercase">
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Motivo</th>
              <th className="px-3 py-2">Início</th>
              <th className="px-3 py-2">Fim</th>
              <th className="px-3 py-2 text-right">Duração</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#bcc9c4]/30 bg-white">
            {statusDetalhe.map((s) => {
              const opcao = statusOpcoes.find((o) => o.slug === s.status)
              const cfg = getCorConfig(opcao?.cor ?? 'slate')
              // AC-035: expirado é fato esperado do desenho (a pessoa esqueceu de
              // encerrar), não anomalia. Só o que passa do teto sem explicação
              // fica em vermelho — com o teto em 2h, pintar todo bloco capado de
              // vermelho deixaria o relatório inteiro vermelho.
              const classificacao = classificarBloco(s.duracaoMinutos, s.aberto)
              const anomalo = !s.aberto && s.duracaoMinutos >= LIMITE_ALERTA_MIN
              return (
                <tr key={s.id}>
                  <td className="px-3 py-2 text-[#171d1c] font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                      {opcao?.label ?? s.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[#3d4945] max-w-[280px]">
                    {s.observacao ? (
                      <span className="block break-words">{s.observacao}</span>
                    ) : (
                      <span className="text-[#6d7a75]/60">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[#3d4945] whitespace-nowrap">
                    {formatAppDate(s.inicio)} {formatAppTime(s.inicio)}
                  </td>
                  <td className="px-3 py-2 text-[#3d4945] whitespace-nowrap">
                    {s.aberto ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-300">
                        Em aberto
                      </span>
                    ) : classificacao === 'expirado' ? (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap">
                        {formatAppDate(s.fim!)} {formatAppTime(s.fim!)}
                        <span
                          title="Fechado automaticamente no teto de 2h — a pessoa não encerrou o status"
                          className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200"
                        >
                          expirou
                        </span>
                      </span>
                    ) : (
                      <>{formatAppDate(s.fim!)} {formatAppTime(s.fim!)}</>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <span className={anomalo ? 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-300' : 'text-[#3d4945]'}>
                      {formatarMinutos(liquidoDoBloco(s))}
                    </span>
                    {/* AC-041: o bloco não encolhe em silêncio. Sem esta linha o
                        gestor veria a duração menor que a diferença entre início
                        e fim, sem nada explicando a subtração. */}
                    {s.descontadoMinutos > 0 && (
                      <span
                        title={`${formatarMinutos(s.descontadoMinutos)} deste bloco também foram contados como atendimento e entram uma vez só, do lado do atendimento`}
                        className="block text-[10px] font-semibold text-[#6d7a75] mt-0.5"
                      >
                        −{formatarMinutos(s.descontadoMinutos)} em atendimento
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Totais: por status (bate com as colunas da tabela principal) + geral */}
      <div className="bg-[#f9faf8] border-t border-[#bcc9c4]/30 px-3 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5">
        {statusOrdenados.map(([slug, min]) => {
          const opcao = statusOpcoes.find((o) => o.slug === slug)
          const cfg = getCorConfig(opcao?.cor ?? 'slate')
          return (
            <span key={slug} className="inline-flex items-center gap-1.5 text-xs font-medium text-[#3d4945]">
              <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
              {opcao?.label ?? slug}: <span className="font-bold text-[#171d1c]">{formatarMinutos(min)}</span>
            </span>
          )
        })}
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#006b5a] ml-auto">
          Total: <span className="font-bold">{formatarMinutos(totalGeralMin)}</span>
        </span>
        {/* AC-041: o rodapé diz de onde veio a diferença. Sem ele, o gestor que
            somasse as durações à mão chegaria a um número maior que o total e
            não teria como saber por quê. */}
        {totalDescontadoMin > 0 && (
          <span className="w-full text-[11px] text-[#6d7a75]">
            {formatarMinutos(totalDescontadoMin)} não entram neste total por
            terem acontecido durante atendimento — contam uma vez, do lado do
            atendimento.
          </span>
        )}
      </div>
    </div>
  )
}
