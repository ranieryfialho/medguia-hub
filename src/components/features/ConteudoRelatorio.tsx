'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { AbasVisualizacao } from './AbasVisualizacao'
import { TabelaTempoFabril } from './TabelaTempoFabril'
import { EvolucaoSemanal } from './EvolucaoSemanal'
import { GraficoDistribuicaoTempo } from './GraficoDistribuicaoTempo'
import { GraficoComparativoMedia } from './GraficoComparativoMedia'

type KPIsProfissional = {
  profissionalId: string
  nome: string
  jornadaContratadaMin: number
  tempoFabrilMin: number
  tempoReuniaoMin: number
  taxaOcupacao: number
  qtdAtendimentos: number
  tempoMedioMin: number
  diasSubutilizados: number
  evolucaoPorSemana: { label: string; fabrilMin: number; jornadaMin: number; pct: number }[]
}

type ConteudoRelatorioProps = {
  kpis: KPIsProfissional[]
  kpisEquipe: KPIsProfissional[]
  profFiltro: string
}

export function ConteudoRelatorio({ kpis, kpisEquipe, profFiltro }: ConteudoRelatorioProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const visaoUrl = searchParams.get('visao')
  const visaoAtiva: 'geral' | 'individual' = visaoUrl === 'individual' ? 'individual' : 'geral'

  const handleChangeVisao = (novaVisao: 'geral' | 'individual') => {
    const params = new URLSearchParams(searchParams)
    params.set('visao', novaVisao)

    // Se voltando para "geral", remove filtro de profissional para mostrar todos
    if (novaVisao === 'geral') {
      params.delete('profissional')
    }

    router.push(`?${params.toString()}`)
  }

  const kpiIndividual = profFiltro !== 'todos' && kpis.length > 0 ? kpis[0] : null
  const mostrarIndividual = kpiIndividual !== null

  return (
    <div className="space-y-6">
      {/* Abas */}
      <AbasVisualizacao
        visaoAtiva={visaoAtiva}
        onChangeVisao={handleChangeVisao}
        mostrarIndividual={mostrarIndividual}
      />

      {/* Conteúdo baseado na aba ativa */}
      {visaoAtiva === 'individual' && kpiIndividual ? (
        <div className="space-y-6">
          {/* Card do profissional selecionado */}
          <div className="bg-white rounded-2xl border border-[#bcc9c4]/30 p-6">
            <h3 className="text-lg font-bold text-[#006b5a] mb-4">{kpiIndividual.nome}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <DetailCard label="Jornada Contratada" value={formatarMinutos(kpiIndividual.jornadaContratadaMin)} />
              <DetailCard label="Tempo Fábril" value={formatarMinutos(kpiIndividual.tempoFabrilMin)} />
              <DetailCard label="Taxa de Ocupação" value={`${kpiIndividual.taxaOcupacao}%`} highlight />
              <DetailCard label="Em Reunião" value={kpiIndividual.tempoReuniaoMin > 0 ? formatarMinutos(kpiIndividual.tempoReuniaoMin) : '—'} />
              <DetailCard label="Qtd. Atendimentos" value={String(kpiIndividual.qtdAtendimentos)} />
              <DetailCard label="Tempo Médio" value={formatarMinutos(kpiIndividual.tempoMedioMin)} />
              <DetailCard label="Dias Subutilizados" value={String(kpiIndividual.diasSubutilizados)} />
            </div>
          </div>

          {/* Gráfico de Distribuição de Tempo */}
          <GraficoDistribuicaoTempo
            tempoFabrilMin={kpiIndividual.tempoFabrilMin}
            jornadaContratadaMin={kpiIndividual.jornadaContratadaMin}
          />

          {/* Gráfico Comparativo com Média */}
          <GraficoComparativoMedia
            nome={kpiIndividual.nome}
            taxaOcupacaoProfissional={kpiIndividual.taxaOcupacao}
            mediaTaxaOcupacao={calcularMediaTaxaOcupacao(kpisEquipe)}
            tempoFabrilProfissional={kpiIndividual.tempoFabrilMin}
            tempoFabrilMedio={calcularMediaTempoFabril(kpisEquipe)}
          />

          {/* Evolução semanal */}
          <EvolucaoSemanal evolucao={kpiIndividual.evolucaoPorSemana} />
        </div>
      ) : (
        /* Visão Geral - Tabela */
        <TabelaTempoFabril kpis={kpis} />
      )}
    </div>
  )
}

function DetailCard({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-4 ${highlight ? 'bg-gradient-to-br from-[#e8f5f2] to-[#f0f5f4]' : 'bg-[#f9faf8]'}`}>
      <p className="text-xs font-semibold text-[#6d7a75] mb-1">{label}</p>
      <p className="text-lg font-bold text-[#171d1c]">{value}</p>
    </div>
  )
}

function formatarMinutos(min: number): string {
  if (min === 0) return '0h'
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h${m}min` : `${h}h`
}

function calcularMediaTaxaOcupacao(kpis: KPIsProfissional[]): number {
  if (kpis.length === 0) return 0
  const soma = kpis.reduce((acc, kpi) => acc + kpi.taxaOcupacao, 0)
  return Math.round(soma / kpis.length)
}

function calcularMediaTempoFabril(kpis: KPIsProfissional[]): number {
  if (kpis.length === 0) return 0
  const soma = kpis.reduce((acc, kpi) => acc + kpi.tempoFabrilMin, 0)
  return Math.round(soma / kpis.length)
}
