'use client'

type EvolucaoSemanalProps = {
  evolucao: { label: string; fabrilMin: number; jornadaMin: number; pct: number }[]
}

export function EvolucaoSemanal({ evolucao }: EvolucaoSemanalProps) {
  const formatarMinutos = (min: number) => {
    const h = Math.floor(min / 60)
    const m = min % 60
    return m > 0 ? `${h}h${m}min` : `${h}h`
  }

  return (
    <div className="bg-white rounded-2xl border border-[#bcc9c4]/30 p-6">
      <h3 className="text-lg font-bold text-[#006b5a] mb-4">Evolução Semanal</h3>
      <div className="space-y-4">
        {evolucao.map((sem, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs w-24 shrink-0 font-semibold text-[#3d4945]">{sem.label}</span>
            <div className="flex-1 bg-[#f0f5f4] rounded-full h-6 relative overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#006b5a] to-[#33a68f] rounded-full transition-all"
                style={{ width: `${Math.min(sem.pct, 100)}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mix-blend-difference">
                {sem.pct}%
              </span>
            </div>
            <span className="text-xs text-[#3d4945] w-32 shrink-0 text-right">
              {formatarMinutos(sem.fabrilMin)} / {formatarMinutos(sem.jornadaMin)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
