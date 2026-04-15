export type JornadaDia = {
  hora_inicio: string
  hora_fim: string
  almoco_inicio?: string | null
  almoco_fim?: string | null
}

export type IntervaloMinutos = {
  inicio: number
  fim: number
}

export function toMin(hora: string): number {
  const [hh, mm] = hora.slice(0, 5).split(':').map(Number)
  return hh * 60 + mm
}

export function intervaloAlmocoValido(jornada: JornadaDia) {
  if (!jornada.almoco_inicio || !jornada.almoco_fim) {
    return false
  }

  const inicioJornada = toMin(jornada.hora_inicio)
  const fimJornada = toMin(jornada.hora_fim)
  const inicioAlmoco = toMin(jornada.almoco_inicio)
  const fimAlmoco = toMin(jornada.almoco_fim)

  return (
    inicioAlmoco > inicioJornada &&
    fimAlmoco < fimJornada &&
    fimAlmoco > inicioAlmoco
  )
}

export function obterIntervalosJornada(jornada: JornadaDia): IntervaloMinutos[] {
  const inicioJornada = toMin(jornada.hora_inicio)
  const fimJornada = toMin(jornada.hora_fim)

  if (fimJornada <= inicioJornada) {
    return []
  }

  if (!intervaloAlmocoValido(jornada)) {
    return [{ inicio: inicioJornada, fim: fimJornada }]
  }

  const inicioAlmoco = toMin(jornada.almoco_inicio!)
  const fimAlmoco = toMin(jornada.almoco_fim!)

  return [
    { inicio: inicioJornada, fim: inicioAlmoco },
    { inicio: fimAlmoco, fim: fimJornada },
  ].filter((intervalo) => intervalo.fim > intervalo.inicio)
}

export function calcularMinutosJornada(jornada: JornadaDia): number {
  return obterIntervalosJornada(jornada).reduce(
    (acc, intervalo) => acc + (intervalo.fim - intervalo.inicio),
    0,
  )
}

export function formatarFaixasJornada(jornada: JornadaDia): string {
  return obterIntervalosJornada(jornada)
    .map((intervalo) => `${toHora(intervalo.inicio)} – ${toHora(intervalo.fim)}`)
    .join(' • ')
}

export function toHora(min: number): string {
  const hh = Math.floor(min / 60).toString().padStart(2, '0')
  const mm = (min % 60).toString().padStart(2, '0')
  return `${hh}:${mm}`
}

export function sobrepoeIntervalo(
  inicioA: number,
  fimA: number,
  inicioB: number,
  fimB: number,
) {
  return inicioA < fimB && fimA > inicioB
}
