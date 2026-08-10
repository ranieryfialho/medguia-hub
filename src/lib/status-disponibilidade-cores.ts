export type OpcaoStatus = {
  id: string
  slug: string
  label: string
  label_curto: string
  cor: string
  ordem: number
  sistema: boolean
  ativo: boolean
  observacao_obrigatoria: boolean
}

export type CorConfig = {
  dot: string
  bg: string
  text: string
  border: string
  hex: string
  label: string
}

export const COR_CONFIG: Record<string, CorConfig> = {
  emerald:       { dot: 'bg-emerald-500', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', hex: '#10b981', label: 'Verde'       },
  amber:         { dot: 'bg-amber-400',   bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-200',   hex: '#f59e0b', label: 'Amarelo'     },
  slate:         { dot: 'bg-slate-300',   bg: 'bg-slate-100',   text: 'text-slate-500',   border: 'border-slate-200',   hex: '#94a3b8', label: 'Cinza'       },
  'slate-light': { dot: 'bg-slate-200',   bg: 'bg-slate-50',    text: 'text-slate-400',   border: 'border-slate-100',   hex: '#e2e8f0', label: 'Cinza claro' },
  rose:          { dot: 'bg-rose-400',    bg: 'bg-rose-100',    text: 'text-rose-700',    border: 'border-rose-200',    hex: '#fb7185', label: 'Vermelho'    },
  blue:          { dot: 'bg-blue-400',    bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-200',    hex: '#60a5fa', label: 'Azul'        },
  purple:        { dot: 'bg-purple-400',  bg: 'bg-purple-100',  text: 'text-purple-700',  border: 'border-purple-200',  hex: '#c084fc', label: 'Roxo'        },
  teal:          { dot: 'bg-teal-400',    bg: 'bg-teal-100',    text: 'text-teal-700',    border: 'border-teal-200',    hex: '#2dd4bf', label: 'Teal'        },
  orange:        { dot: 'bg-orange-400',  bg: 'bg-orange-100',  text: 'text-orange-700',  border: 'border-orange-200',  hex: '#fb923c', label: 'Laranja'     },
}

export const FALLBACK_COR: CorConfig = COR_CONFIG.slate

export function getCorConfig(cor: string): CorConfig {
  return COR_CONFIG[cor] ?? FALLBACK_COR
}

// Exclui slate-light: reservada para 'ausente' (status de sistema)
export const CORES_SELECIONAVEIS = Object.entries(COR_CONFIG)
  .filter(([key]) => key !== 'slate-light')
  .map(([key, val]) => ({ key, ...val }))

export const DEFAULT_OPCOES: OpcaoStatus[] = [
  { id: 'sys-disponivel', slug: 'disponivel', label: 'Disponível',     label_curto: 'livre',      cor: 'emerald',     ordem: 0,  sistema: true,  ativo: true, observacao_obrigatoria: false },
  { id: 'sys-reuniao',    slug: 'reuniao',    label: 'Em reunião',     label_curto: 'reunião',    cor: 'amber',       ordem: 1,  sistema: false, ativo: true, observacao_obrigatoria: false },
  { id: 'sys-ocupado',    slug: 'ocupado',    label: 'Em atendimento', label_curto: 'atendimento', cor: 'slate',       ordem: 2,  sistema: true,  ativo: true, observacao_obrigatoria: false },
  { id: 'sys-ausente',    slug: 'ausente',    label: 'Ausente',        label_curto: 'ausente',    cor: 'slate-light', ordem: 99, sistema: true,  ativo: true, observacao_obrigatoria: false },
]