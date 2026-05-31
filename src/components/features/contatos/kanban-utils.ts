import { differenceInCalendarDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { PreviewPacienteBaseContato, StatusContato } from '@/actions/contatos'
import type { ColunaCorContato, KanbanColunaContato } from '@/lib/contatos-kanban'
import type { ContatoPaciente } from '@/lib/contatos-kanban-data'
import type { OrigemImportacaoContato } from '@/lib/contatos-origens-importacao'

export type Nota = {
  id: string
  texto: string
  criado_em: string
  autor_id: string | null
  autor_nome?: string | null
}

export type Template = {
  id: string
  nome: string
  conteudo: string
  criado_por: string | null
}

export type ColumnFormState = {
  chave: string | null
  nome: string
  statusBase: StatusContato
  corChave: ColunaCorContato
  origensImportacao: OrigemImportacaoContato[]
}

export type ContatoBaseRealtimeRow = {
  paciente_id: string
  status: StatusContato
  kanban_coluna_chave: string
  responsavel_id: string | null
}

export type KanbanColunaRealtimeRow = KanbanColunaContato

export type NotaContatoRealtimeRow = {
  paciente_id: string
}

export type BaseSeedModalState = {
  open: boolean
  columnKey: string
  preview: PreviewPacienteBaseContato[]
  selectedIds: Set<string>
  loading: boolean
  confirming: boolean
}

export const HISTORICO_ATENDIMENTOS_ANOS = 2
export const ATTENDANCE_BATCH_SIZE = 200

const AVATAR_PALETTE = ['#006b5a', '#406375', '#779aad', '#637370', '#2CBFAB', '#b45309', '#7c3aed']

export function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function getAvatarColor(name: string): string {
  let h = 0
  for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h)
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}

export function diasDesde(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = differenceInCalendarDays(new Date(), new Date(dateStr))
  return Math.max(0, diff)
}

export function labelDias(dias: number): string {
  if (dias === 0) return 'Hoje'
  if (dias === 1) return 'Ontem'
  return `${dias}d`
}

export function whatsappLink(tel: string): string {
  const n = tel.replace(/\D/g, '')
  return `https://wa.me/${n.startsWith('55') ? n : '55' + n}`
}

export function whatsappLinkComMsg(tel: string, msg: string): string {
  const n = tel.replace(/\D/g, '')
  const phone = n.startsWith('55') ? n : '55' + n
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
}

export function diasCor(dias: number): string {
  if (dias < 30) return '#006b5a'
  if (dias < 90) return '#b45309'
  return '#ba1a1a'
}

export function interpolarTemplate(conteudo: string, contato: ContatoPaciente): string {
  const dias = diasDesde(contato.ultimo_atendimento_data)
  const dataUltimo = contato.ultimo_atendimento_data
    ? format(new Date(contato.ultimo_atendimento_data), 'dd/MM/yyyy', { locale: ptBR })
    : ''

  return conteudo
    .replace(/\{\{nome\}\}/g, contato.nome)
    .replace(/\{\{dias\}\}/g, dias !== null ? String(dias) : '')
    .replace(/\{\{data_ultimo\}\}/g, dataUltimo)
    .replace(/\{\{ultimo_tipo\}\}/g, contato.ultimo_atendimento_tipo ?? '')
    .replace(/\{\{data\}\}/g, '')
    .replace(/\{\{hora\}\}/g, '')
    .replace(/\{\{profissional\}\}/g, '')
    .replace(/\{\{tipo\}\}/g, '')
    .replace(/\{\{sessao\}\}/g, '')
}

export function defaultColumnForm(): ColumnFormState {
  return {
    chave: null,
    nome: '',
    statusBase: 'a_contactar',
    corChave: 'a_contactar',
    origensImportacao: [],
  }
}

export function sortColumns(cols: KanbanColunaContato[]) {
  return [...cols].sort((a, b) => a.ordem - b.ordem)
}

export function isBaseSeedColumn(chave: string) {
  return chave === 'a_contactar' || chave === 'recuperacao_base'
}
