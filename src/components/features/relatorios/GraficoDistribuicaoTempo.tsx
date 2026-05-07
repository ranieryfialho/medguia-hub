'use client'

type GraficoDistribuicaoTempoProps = {
  tempoFabrilMin: number
  jornadaContratadaMin: number
}

export function GraficoDistribuicaoTempo({
  tempoFabrilMin,
  jornadaContratadaMin,
}: GraficoDistribuicaoTempoProps) {
  const tempoOciosoMin = Math.max(0, jornadaContratadaMin - tempoFabrilMin)
  const percentualFabril = jornadaContratadaMin > 0 ? (tempoFabrilMin / jornadaContratadaMin) * 100 : 0

  const formatarMinutos = (min: number) => {
    if (min === 0) return '0h'
    const h = Math.floor(min / 60)
    const m = min % 60
    return m > 0 ? `${h}h${m}min` : `${h}h`
  }

  // Raio e circunferência para animação do donut
  const radius = 60
  const circumference = 2 * Math.PI * radius
  const offsetFabril = circumference - (percentualFabril / 100) * circumference

  return (
    <div className="bg-white rounded-2xl border border-[#bcc9c4]/30 p-6">
      <h3 className="text-lg font-bold text-[#006b5a] mb-8">Distribuição de Tempo</h3>

      <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
        {/* Donut Chart */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-48 h-48">
            <svg
              className="w-full h-full transform -rotate-90"
              viewBox="0 0 160 160"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Background circle */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke="#f0f5f4"
                strokeWidth="16"
              />
              {/* Fabril circle - animated */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke="url(#gradientFabril)"
                strokeWidth="16"
                strokeDasharray={circumference}
                strokeDashoffset={offsetFabril}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
              {/* Gradient definition */}
              <defs>
                <linearGradient id="gradientFabril" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#006b5a" />
                  <stop offset="100%" stopColor="#33a68f" />
                </linearGradient>
              </defs>
            </svg>

            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-3xl font-bold text-[#006b5a]">{Math.round(percentualFabril)}%</div>
              <div className="text-xs text-[#3d4945] font-semibold">Ocupação</div>
            </div>
          </div>

          {/* Legenda com animação */}
          <div className="text-center space-y-3 w-full">
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#006b5a] to-[#33a68f]" />
              <span className="text-sm font-semibold text-[#171d1c]">Tempo Fábril</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#f0f5f4]" />
              <span className="text-sm font-semibold text-[#3d4945]">Tempo Ocioso</span>
            </div>
          </div>
        </div>

        {/* Detalhes com animação de números */}
        <div className="space-y-6 flex-1">
          {/* Card Fábril */}
          <div className="bg-gradient-to-br from-[#e8f5f2] to-[#f0f5f4] rounded-xl p-5 border border-[#006b5a]/20">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-[#3d4945] mb-1">Tempo Fábril</p>
                <p className="text-2xl font-bold text-[#006b5a] tabular-nums">
                  {formatarMinutos(tempoFabrilMin)}
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-[#006b5a]">{Math.round(percentualFabril)}%</div>
                <p className="text-xs text-[#3d4945]">da jornada</p>
              </div>
            </div>
            <div className="w-full bg-[#bcc9c4]/20 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#006b5a] to-[#33a68f] transition-all duration-1000 ease-out"
                style={{ width: `${percentualFabril}%` }}
              />
            </div>
          </div>

          {/* Card Ocioso */}
          <div className="bg-gradient-to-br from-[#fef3f0] to-[#faf8f7] rounded-xl p-5 border border-[#d97706]/20">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-[#3d4945] mb-1">Tempo Ocioso</p>
                <p className="text-2xl font-bold text-[#d97706] tabular-nums">
                  {formatarMinutos(tempoOciosoMin)}
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-[#d97706]">{Math.round(100 - percentualFabril)}%</div>
                <p className="text-xs text-[#3d4945]">da jornada</p>
              </div>
            </div>
            <div className="w-full bg-[#bcc9c4]/20 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#d97706] to-[#f59e0b] transition-all duration-1000 ease-out"
                style={{ width: `${100 - percentualFabril}%` }}
              />
            </div>
          </div>

          {/* Jornada Total */}
          <div className="bg-[#f9faf8] rounded-xl p-5 border border-[#bcc9c4]/30">
            <p className="text-xs font-semibold text-[#3d4945] mb-2">Jornada Contratada</p>
            <p className="text-2xl font-bold text-[#171d1c] tabular-nums">
              {formatarMinutos(jornadaContratadaMin)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
