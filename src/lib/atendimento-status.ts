export type AtendimentoStatusKey =
  | 'confirmado'
  | 'aguardando'
  | 'aguardando_consulta'
  | 'em_atendimento'
  | 'concluido'
  | 'cancelado'
  | 'falta'
  | 'reagendado'
  | 'desconhecido'

// Transições válidas por status atual
export const TRANSICOES_VALIDAS: Record<Exclude<AtendimentoStatusKey, 'desconhecido'>, AtendimentoStatusKey[]> = {
  aguardando:          ['confirmado', 'aguardando_consulta', 'cancelado', 'falta', 'reagendado'],
  confirmado:          ['aguardando', 'aguardando_consulta', 'cancelado', 'falta', 'reagendado'],
  aguardando_consulta: ['em_atendimento', 'cancelado', 'falta'],
  em_atendimento:      ['concluido'],
  concluido:           [],
  cancelado:           [],
  falta:               ['reagendado'],
  reagendado:          [],
}

// Retorna o status que precisa vir antes de `para`, dado o status atual
export function getPreRequisitoTransicao(
  de: AtendimentoStatusKey,
  para: AtendimentoStatusKey,
): string | null {
  const validas = de === 'desconhecido' ? [] : TRANSICOES_VALIDAS[de]
  if (validas.includes(para)) return null
  if (para === 'concluido' && de === 'aguardando_consulta') return 'Em Atendimento'
  if (para === 'concluido' && (de === 'aguardando' || de === 'confirmado')) return 'Aguardando Consulta → Em Atendimento'
  if ((para === 'cancelado' || para === 'falta') && de === 'em_atendimento') return null // bloqueado sem pré-requisito
  if (para === 'em_atendimento' && (de === 'aguardando' || de === 'confirmado')) return 'Aguardando Consulta'
  return null
}

export const STATUS_PENDENTE_KEYS = [
  'confirmado',
  'aguardando',
  'aguardando_consulta',
] as const satisfies readonly Exclude<AtendimentoStatusKey, 'desconhecido'>[]

const STATUS_LABELS: Record<Exclude<AtendimentoStatusKey, 'desconhecido'>, string> = {
  confirmado:          'Confirmado',
  aguardando:          'Aguardando',
  aguardando_consulta: 'Aguardando Consulta',
  em_atendimento:      'Em Atendimento',
  concluido:           'Concluído',
  cancelado:           'Cancelado',
  falta:               'Falta',
  reagendado:          'Reagendado',
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
    case 'aguardando consulta':
      return 'aguardando_consulta'
    case 'em atendimento':
      return 'em_atendimento'
    case 'concluido':
      return 'concluido'
    case 'cancelado':
      return 'cancelado'
    case 'falta':
      return 'falta'
    case 'reposicao':
      return 'reagendado'
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

export function isStatusPendente(value: string | null | undefined) {
  const key = getAtendimentoStatusKey(value)
  return STATUS_PENDENTE_KEYS.includes(key as (typeof STATUS_PENDENTE_KEYS)[number])
}

export function isStatusReagendado(value: string | null | undefined) {
  return getAtendimentoStatusKey(value) === 'reagendado'
}

export function isStatusNaoEfetivo(value: string | null | undefined) {
  const key = getAtendimentoStatusKey(value)
  return key === 'falta' || key === 'cancelado' || key === 'reagendado'
}

export function isStatusFabril(value: string | null | undefined) {
  const key = getAtendimentoStatusKey(value)
  return key === 'concluido' || key === 'em_atendimento'
}

export const STATUS_RAW_VALUES_BY_KEY: Record<Exclude<AtendimentoStatusKey, 'desconhecido'>, string[]> = {
  confirmado:          ['Confirmado', 'confirmado'],
  aguardando:          ['Aguardando', 'aguardando'],
  aguardando_consulta: ['Aguardando Consulta', 'aguardando consulta'],
  em_atendimento:      ['Em Atendimento', 'em atendimento'],
  concluido:           ['Concluído', 'Concluido', 'concluído', 'concluido'],
  cancelado:           ['Cancelado', 'cancelado'],
  falta:               ['Falta', 'falta'],
  reagendado:          ['Reagendado', 'reagendado', 'Reposição', 'reposição', 'reposicao', 'reposiçao'],
}

export function getStatusRawValuesForKeys(keys: AtendimentoStatusKey[]) {
  const values = new Set<string>()
  for (const key of keys) {
    if (key === 'desconhecido') continue
    for (const value of STATUS_RAW_VALUES_BY_KEY[key]) {
      values.add(value)
    }
  }
  return [...values]
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
