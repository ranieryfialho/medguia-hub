import {
  CalendarClock, CheckCheck, CheckCircle, Hourglass, RefreshCw,
  Stethoscope, Timer, User, UserX, XCircle,
} from 'lucide-react'
import { getAtendimentoStatusKey } from '@/lib/atendimento-status'

export type MidiaItem = {
  id: string
  google_drive_file_id: string
  google_drive_file_url: string | null
  nome: string
  mime_type: string
  tamanho_bytes: number | null
  criado_em: string
}

export type AgendamentoDetalhe = {
  id: string
  paciente_id: string
  profissional_id?: string | null
  agendamento_id?: string | null
  agendamento_pai?: { plano_saude?: string | null; tipo?: string | null } | null
  data_agendamento: string
  created_at?: string | null
  status: string
  tipo: string
  duracao_minutos?: number | null
  observacoes?: string | null
  numero_sessao?: number | null
  total_sessoes?: number | null
  numero_sessao_tipo?: number | null
  total_sessoes_tipo?: number | null
  marcou_retorno?: boolean | null
  google_drive_pasta_url?: string | null
  aguardando_desde?: string | null
  em_atendimento_desde?: string | null
  pacientes: { nome: string; telefone?: string | null; email?: string | null } | null
  profissional?: { full_name?: string | null; role?: string | null } | null
  fisioterapeuta_id?: string | null
  fisioterapeuta_executor?: { full_name?: string | null } | null
  criador?: { full_name?: string | null } | null
}

export const STATUS_CONFIG: Record<string, {
  cardBg: string; border: string; iconText: string; titleText: string
  subText: string; badgeBg: string; label: string; Icon: React.ElementType
}> = {
  confirmado:          { cardBg: 'bg-green-50',  border: 'border-green-600',  iconText: 'text-green-700',  titleText: 'text-green-900',  subText: 'text-green-800/70',  badgeBg: 'bg-green-600',  label: 'Confirmado',   Icon: User },
  aguardando:          { cardBg: 'bg-amber-50',  border: 'border-amber-500',  iconText: 'text-amber-600',  titleText: 'text-amber-900',  subText: 'text-amber-800/70',  badgeBg: 'bg-amber-500',  label: 'Aguardando',   Icon: Hourglass },
  aguardando_consulta: { cardBg: 'bg-teal-50',   border: 'border-teal-500',   iconText: 'text-teal-600',   titleText: 'text-teal-900',   subText: 'text-teal-800/70',   badgeBg: 'bg-teal-500',   label: 'Ag. Consulta', Icon: Timer },
  em_atendimento:      { cardBg: 'bg-blue-50',   border: 'border-blue-600',   iconText: 'text-blue-600',   titleText: 'text-blue-900',   subText: 'text-blue-800/70',   badgeBg: 'bg-blue-600',   label: 'Em Atend.',    Icon: Stethoscope },
  concluido:           { cardBg: 'bg-violet-50', border: 'border-violet-600', iconText: 'text-violet-600', titleText: 'text-violet-900', subText: 'text-violet-800/70', badgeBg: 'bg-violet-600', label: 'Concluído',    Icon: CheckCheck },
  cancelado:           { cardBg: 'bg-red-50',    border: 'border-red-600',    iconText: 'text-red-600',    titleText: 'text-red-900',    subText: 'text-red-800/70',    badgeBg: 'bg-red-600',    label: 'Cancelado',    Icon: XCircle },
  falta:               { cardBg: 'bg-gray-100',  border: 'border-gray-500',   iconText: 'text-gray-500',   titleText: 'text-gray-800',   subText: 'text-gray-600/70',   badgeBg: 'bg-gray-500',   label: 'Falta',        Icon: UserX },
  reagendado:          { cardBg: 'bg-orange-50', border: 'border-orange-500', iconText: 'text-orange-600', titleText: 'text-orange-900', subText: 'text-orange-800/70', badgeBg: 'bg-orange-500', label: 'Reagendado',   Icon: CalendarClock },
}

export const CONFIG_DEFAULT = {
  cardBg: 'bg-gray-100', border: 'border-gray-400', iconText: 'text-gray-500',
  titleText: 'text-gray-800', subText: 'text-gray-600', badgeBg: 'bg-gray-400',
  label: 'Agendado', Icon: CheckCircle,
}

export const OPCOES_STATUS = [
  { valor: 'Confirmado',          label: 'Confirmado',          Icon: CheckCircle, cor: 'text-[#006b5a]' },
  { valor: 'Aguardando',          label: 'Aguardando',          Icon: Hourglass,   cor: 'text-[#6d7a75]' },
  { valor: 'Aguardando Consulta', label: 'Aguardando Consulta', Icon: Timer,       cor: 'text-teal-600' },
  { valor: 'Em Atendimento',      label: 'Em Atendimento',      Icon: Stethoscope, cor: 'text-[#406375]' },
  { valor: 'Concluído',           label: 'Concluído',           Icon: CheckCheck,  cor: 'text-[#4f625d]' },
  { valor: 'Cancelado',           label: 'Cancelado',           Icon: XCircle,     cor: 'text-[#ba1a1a]' },
  { valor: 'Falta',               label: 'Falta',               Icon: UserX,       cor: 'text-[#3d4945]' },
  { valor: '__reagendar__',       label: 'Reagendar',           Icon: RefreshCw,   cor: 'text-[#779aad]' },
]

export function getConfig(status: string) {
  return STATUS_CONFIG[getAtendimentoStatusKey(status)] || CONFIG_DEFAULT
}

export function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export function formatarTipoComContagem(agendamento: AgendamentoDetalhe) {
  return agendamento.tipo
}

export function deveExibirContagemTipoSeparada(agendamento: AgendamentoDetalhe) {
  if (!agendamento.agendamento_pai?.tipo?.trim()) return false
  if (!agendamento.total_sessoes_tipo || agendamento.total_sessoes_tipo <= 1) return false
  const totalGeral = agendamento.total_sessoes ?? null
  const numeroGeral = agendamento.numero_sessao ?? null
  const totalTipo = agendamento.total_sessoes_tipo
  const numeroTipo = agendamento.numero_sessao_tipo ?? null
  return totalGeral !== totalTipo || numeroGeral !== numeroTipo
}

export function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatarStatusComercial(status: string) {
  if (status === 'orcamento_pendente') return 'Orçamento pendente'
  if (status === 'orcamento_recusado') return 'Orçamento recusado'
  return 'Venda realizada'
}

export function formatarEscalaDor(escalaDor: number | null) {
  if (escalaDor === null) return null
  return `EVA ${escalaDor}/10`
}

export function getResumoStatusBadgeClass(status: string) {
  switch (getAtendimentoStatusKey(status)) {
    case 'concluido': return 'bg-violet-100 text-violet-700'
    case 'cancelado': return 'bg-red-100 text-red-700'
    case 'falta': return 'bg-slate-200 text-slate-700'
    case 'reagendado': return 'bg-orange-100 text-orange-700'
    case 'em_atendimento': return 'bg-blue-100 text-blue-700'
    case 'confirmado': return 'bg-green-100 text-green-700'
    case 'aguardando_consulta': return 'bg-teal-100 text-teal-700'
    case 'aguardando': return 'bg-amber-100 text-amber-700'
    default: return 'bg-[#f0f5f4] text-[#3d4945]'
  }
}
