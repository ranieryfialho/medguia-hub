const MS_POR_DIA = 1000 * 60 * 60 * 24

export function recorrenciaSemanalAtiva(
  dataAtual: Date,
  dataInicio: Date,
  semanasPulo: number,
) {
  const diffTime = dataAtual.getTime() - dataInicio.getTime()
  const diffDias = Math.floor(diffTime / MS_POR_DIA)

  if (diffDias < 0) return false

  const diffSemanas = Math.floor(diffDias / 7)
  return diffSemanas % semanasPulo === 0
}
