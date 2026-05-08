const MS_POR_DIA = 1000 * 60 * 60 * 24

export function adicionarMesesPreservandoDiaLocal(dataBase: Date, meses: number) {
  const proxima = new Date(dataBase)
  const diaOriginal = proxima.getDate()

  proxima.setDate(1)
  proxima.setMonth(proxima.getMonth() + meses)

  const ultimoDiaDoMes = new Date(
    proxima.getFullYear(),
    proxima.getMonth() + 1,
    0,
  ).getDate()

  proxima.setDate(Math.min(diaOriginal, ultimoDiaDoMes))
  return proxima
}

export function adicionarMesesPreservandoDiaUTC(dataBase: Date, meses: number) {
  const proxima = new Date(dataBase)
  const diaOriginal = proxima.getUTCDate()

  proxima.setUTCDate(1)
  proxima.setUTCMonth(proxima.getUTCMonth() + meses)

  const ultimoDiaDoMes = new Date(
    Date.UTC(proxima.getUTCFullYear(), proxima.getUTCMonth() + 1, 0),
  ).getUTCDate()

  proxima.setUTCDate(Math.min(diaOriginal, ultimoDiaDoMes))
  return proxima
}

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
