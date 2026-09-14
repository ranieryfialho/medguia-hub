export type TagCorConfig = {
  dot: string
  bg: string
  text: string
  border: string
  label: string
}

export const TAG_COR_CONFIG: Record<string, TagCorConfig> = {
  emerald: { dot: 'bg-emerald-500', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Verde' },
  amber:   { dot: 'bg-amber-400',   bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-200',   label: 'Amarelo' },
  slate:   { dot: 'bg-slate-300',   bg: 'bg-slate-100',   text: 'text-slate-500',   border: 'border-slate-200',   label: 'Cinza' },
  rose:    { dot: 'bg-rose-400',    bg: 'bg-rose-100',    text: 'text-rose-700',    border: 'border-rose-200',    label: 'Vermelho' },
  blue:    { dot: 'bg-blue-400',    bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-200',    label: 'Azul' },
  purple:  { dot: 'bg-purple-400',  bg: 'bg-purple-100',  text: 'text-purple-700',  border: 'border-purple-200',  label: 'Roxo' },
  teal:    { dot: 'bg-teal-400',    bg: 'bg-teal-100',    text: 'text-teal-700',    border: 'border-teal-200',    label: 'Teal' },
  orange:  { dot: 'bg-orange-400',  bg: 'bg-orange-100',  text: 'text-orange-700',  border: 'border-orange-200',  label: 'Laranja' },
  pink:    { dot: 'bg-pink-400',    bg: 'bg-pink-100',    text: 'text-pink-700',    border: 'border-pink-200',    label: 'Rosa' },
}

export const FALLBACK_TAG_COR: TagCorConfig = TAG_COR_CONFIG.slate

export function getTagCorConfig(cor: string): TagCorConfig {
  return TAG_COR_CONFIG[cor] ?? FALLBACK_TAG_COR
}

export const TAG_CORES_SELECIONAVEIS = Object.entries(TAG_COR_CONFIG).map(([key, val]) => ({ key, ...val }))
