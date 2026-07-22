'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'

type GraficoComparativoMediaProps = {
  nome: string
  taxaOcupacaoProfissional: number
  mediaTaxaOcupacao: number
  tempoFabrilProfissional: number
  tempoFabrilMedio: number
}

export function GraficoComparativoMedia({
  nome,
  taxaOcupacaoProfissional,
  mediaTaxaOcupacao,
  tempoFabrilProfissional,
  tempoFabrilMedio,
}: GraficoComparativoMediaProps) {
  const diferencaTaxa = taxaOcupacaoProfissional - mediaTaxaOcupacao
  const estaAcimaMedia = diferencaTaxa >= 0
  const percentualDiferenca = Math.abs(diferencaTaxa)

  const formatarMinutos = (min: number) => {
    if (min === 0) return '0h'
    const h = Math.floor(min / 60)
    const m = min % 60
    return m > 0 ? `${h}h${m}min` : `${h}h`
  }

  return (
    <div className="bg-white rounded-2xl border border-[#bcc9c4]/30 p-6">
      <h3 className="text-lg font-bold text-[#006b5a] mb-8">Desempenho vs Equipe</h3>

      <div className="space-y-8">
        {/* Comparação de Taxa de Ocupação */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#171d1c]">Taxa de Ocupação</p>
              <p className="text-xs text-[#3d4945] mt-1">Percentual da jornada em atendimento</p>
            </div>
            <div className="flex items-center gap-2">
              {estaAcimaMedia ? (
                <TrendingUp size={20} className="text-green-600" />
              ) : (
                <TrendingDown size={20} className="text-red-600" />
              )}
              <span className={`text-sm font-bold ${estaAcimaMedia ? 'text-green-600' : 'text-red-600'}`}>
                {estaAcimaMedia ? '+' : ''}{diferencaTaxa.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {/* Barra do Profissional */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#171d1c]">{nome}</span>
                <span className="text-sm font-bold text-[#006b5a]">{Math.round(taxaOcupacaoProfissional)}%</span>
              </div>
              <div className="w-full bg-[#f0f5f4] rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#006b5a] to-[#33a68f] rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${Math.min(taxaOcupacaoProfissional, 100)}%` }}
                />
              </div>
            </div>

            {/* Barra da Média */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#3d4945]">Média da Equipe</span>
                <span className="text-sm font-bold text-[#3d4945]">{Math.round(mediaTaxaOcupacao)}%</span>
              </div>
              <div className="w-full bg-[#f0f5f4] rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#bcc9c4] to-[#a8b5b0] rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${Math.min(mediaTaxaOcupacao, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card de Status */}
          <div
            className={`rounded-lg p-4 border ${
              estaAcimaMedia
                ? 'bg-green-50 border-green-200'
                : 'bg-orange-50 border-orange-200'
            }`}
          >
            <p className={`text-sm font-semibold ${estaAcimaMedia ? 'text-green-700' : 'text-orange-700'}`}>
              {estaAcimaMedia
                ? `🎯 Desempenho acima da média em ${percentualDiferenca.toFixed(1)}%`
                : `⚠️ Desempenho ${percentualDiferenca.toFixed(1)}% abaixo da média`}
            </p>
          </div>
        </div>

        {/* Comparação de Tempo Fábril */}
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-[#171d1c]">Tempo Fábril Total</p>
            <p className="text-xs text-[#3d4945] mt-1">Atendimentos + status personalizados (reunião, hora administrativa, etc.)</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Card Profissional */}
            <div className="bg-gradient-to-br from-[#e8f5f2] to-[#f0f5f4] rounded-lg p-4 border border-[#006b5a]/20">
              <p className="text-xs font-semibold text-[#3d4945] mb-2">{nome}</p>
              <p className="text-2xl font-bold text-[#006b5a] tabular-nums">
                {formatarMinutos(tempoFabrilProfissional)}
              </p>
              <div className="mt-3 h-1 bg-[#bcc9c4]/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#006b5a] to-[#33a68f] transition-all duration-1000 ease-out"
                  style={{
                    width: `${Math.min((tempoFabrilProfissional / Math.max(tempoFabrilProfissional, tempoFabrilMedio, 1)) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* Card Média */}
            <div className="bg-gradient-to-br from-[#f3f4f3] to-[#faf8f7] rounded-lg p-4 border border-[#bcc9c4]/30">
              <p className="text-xs font-semibold text-[#3d4945] mb-2">Média</p>
              <p className="text-2xl font-bold text-[#3d4945] tabular-nums">
                {formatarMinutos(tempoFabrilMedio)}
              </p>
              <div className="mt-3 h-1 bg-[#bcc9c4]/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#bcc9c4] to-[#a8b5b0] transition-all duration-1000 ease-out"
                  style={{
                    width: `${Math.min((tempoFabrilMedio / Math.max(tempoFabrilProfissional, tempoFabrilMedio, 1)) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
