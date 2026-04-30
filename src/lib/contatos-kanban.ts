export const STATUS_CONTATO_PADRAO = [
  'a_contactar',
  'recuperacao_base',
  'tentativa',
  'em_conversa',
  'sem_interesse',
  'agendou',
] as const

export type StatusContatoPadrao = (typeof STATUS_CONTATO_PADRAO)[number]
export type TipoColunaContato = 'sistema' | 'custom'
export type ColunaCorContato = StatusContatoPadrao

type ColunaVisual = {
  cor: string
  corBg: string
  corBadgeBg: string
  corBadgeText: string
}

export type KanbanColunaContato = {
  chave: string
  nome: string
  tipo: TipoColunaContato
  status_base: StatusContatoPadrao
  cor_chave: ColunaCorContato
  ordem: number
}

const VISUAL_POR_COR: Record<ColunaCorContato, ColunaVisual> = {
  a_contactar: {
    cor: '#6d7a75',
    corBg: '#f0f5f4',
    corBadgeBg: '#dee3e3',
    corBadgeText: '#3d4945',
  },
  recuperacao_base: {
    cor: '#4f46e5',
    corBg: '#f5f3ff',
    corBadgeBg: '#ddd6fe',
    corBadgeText: '#3730a3',
  },
  tentativa: {
    cor: '#b45309',
    corBg: '#fffbeb',
    corBadgeBg: '#fef3c7',
    corBadgeText: '#92400e',
  },
  em_conversa: {
    cor: '#006b5a',
    corBg: '#f0fcf9',
    corBadgeBg: '#c3ede6',
    corBadgeText: '#004f43',
  },
  sem_interesse: {
    cor: '#ba1a1a',
    corBg: '#fff5f5',
    corBadgeBg: '#fecaca',
    corBadgeText: '#991b1b',
  },
  agendou: {
    cor: '#1AAF9A',
    corBg: '#f0fdf9',
    corBadgeBg: '#99f6e4',
    corBadgeText: '#0f766e',
  },
}

export const LABEL_POR_STATUS_CONTATO: Record<StatusContatoPadrao, string> = {
  a_contactar: 'A Contatar',
  recuperacao_base: 'Recuperacao de Base',
  tentativa: 'Tentativa',
  em_conversa: 'Em Conversa',
  sem_interesse: 'Sem Interesse',
  agendou: 'Agendou',
}

export const LABEL_POR_COR_COLUNA: Record<ColunaCorContato, string> = {
  a_contactar: 'Cinza',
  recuperacao_base: 'Indigo',
  tentativa: 'Amber',
  em_conversa: 'Verde',
  sem_interesse: 'Vermelho',
  agendou: 'Turquesa',
}

export const OPCOES_COR_COLUNA = STATUS_CONTATO_PADRAO.map((key) => ({
  key,
  label: LABEL_POR_COR_COLUNA[key],
  visual: VISUAL_POR_COR[key],
}))

export const COLUNAS_SISTEMA_CONTATOS: KanbanColunaContato[] = STATUS_CONTATO_PADRAO.map((status, index) => ({
  chave: status,
  nome: LABEL_POR_STATUS_CONTATO[status],
  tipo: 'sistema',
  status_base: status,
  cor_chave: status,
  ordem: index + 1,
}))

export function isStatusContatoPadrao(value: string): value is StatusContatoPadrao {
  return STATUS_CONTATO_PADRAO.includes(value as StatusContatoPadrao)
}

export function getVisualColunaContato(input: ColunaCorContato | KanbanColunaContato): ColunaVisual {
  const corKey = typeof input === 'string' ? input : input.cor_chave
  return VISUAL_POR_COR[corKey]
}

export function normalizarColunasContato(rawColumns: KanbanColunaContato[] | null | undefined): KanbanColunaContato[] {
  if (!rawColumns?.length) {
    return COLUNAS_SISTEMA_CONTATOS
  }

  const merged = [...rawColumns]
  const byKey = new Map(rawColumns.map((column) => [column.chave, column]))

  for (const systemColumn of COLUNAS_SISTEMA_CONTATOS) {
    if (!byKey.has(systemColumn.chave)) {
      merged.push(systemColumn)
    }
  }

  return merged
    .map((column) => ({
      ...column,
      cor_chave: column.cor_chave ?? column.status_base,
    }))
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))
}

export function criarContagemStatusContato() {
  return {
    a_contactar: 0,
    recuperacao_base: 0,
    tentativa: 0,
    em_conversa: 0,
    sem_interesse: 0,
    agendou: 0,
  } satisfies Record<StatusContatoPadrao, number>
}
