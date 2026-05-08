export type AtendimentoStatusKey =
  | 'confirmado'
  | 'aguardando'
  | 'em_atendimento'
  | 'concluido'
  | 'cancelado'
  | 'falta'
  | 'reposicao'
  | 'reagendado'
  | 'desconhecido'

const STATUS_LABELS: Record<Exclude<AtendimentoStatusKey, 'desconhecido'>, string> = {
  confirmado: 'Confirmado',
  aguardando: 'Aguardando',
  em_atendimento: 'Em Atendimento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  falta: 'Falta',
  reposicao: 'Reposição',
  reagendado: 'Reagendado',
}

function lowerSafe(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

function removerAcentos(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalizarBruto(value: string | null | undefined) {
  const lower = lowerSafe(value)
  const reparado = lower
    .replaceAll('concluã­do', 'concluído')
    .replaceAll('reposiã§ã£o', 'reposição')

  return removerAcentos(reparado).replace(/\s+/g, ' ').trim()
}

export function getAtendimentoStatusKey(value: string | null | undefined): AtendimentoStatusKey {
  const normalizado = normalizarBruto(value)

  switch (normalizado) {
    case 'confirmado':
      return 'confirmado'
    case 'aguardando':
      return 'aguardando'
    case 'em atendimento':
      return 'em_atendimento'
    case 'concluido':
      return 'concluido'
    case 'cancelado':
      return 'cancelado'
    case 'falta':
      return 'falta'
    case 'reposicao':
      return 'reposicao'
    case 'reagendado':
      return 'reagendado'
    default:
      return 'desconhecido'
  }
}

export function normalizeAtendimentoStatus(value: string | null | undefined) {
  const key = getAtendimentoStatusKey(value)
  if (key === 'desconhecido') return value?.trim() || 'Agendado'
  return STATUS_LABELS[key]
}

export function isStatusConcluido(value: string | null | undefined) {
  return getAtendimentoStatusKey(value) === 'concluido'
}

export function isStatusCancelado(value: string | null | undefined) {
  return getAtendimentoStatusKey(value) === 'cancelado'
}

export function isStatusFalta(value: string | null | undefined) {
  return getAtendimentoStatusKey(value) === 'falta'
}

export function isStatusNaoEfetivo(value: string | null | undefined) {
  const key = getAtendimentoStatusKey(value)
  return key === 'falta' || key === 'cancelado'
}

export function isStatusFabril(value: string | null | undefined) {
  const key = getAtendimentoStatusKey(value)
  return key === 'concluido' || key === 'em_atendimento'
}

export const STATUS_CONCLUIDO_RAW_VALUES = ['Concluído', 'Concluido', 'concluído', 'concluido']

export const STATUS_NAO_BLOQUEIAM_RAW_VALUES = [
  'Cancelado',
  'cancelado',
  'Falta',
  'falta',
  'Reagendado',
  'reagendado',
]

export const STATUS_NAO_BLOQUEIAM_RAW_SQL = `(${STATUS_NAO_BLOQUEIAM_RAW_VALUES.map((value) => `"${value}"`).join(',')})`
