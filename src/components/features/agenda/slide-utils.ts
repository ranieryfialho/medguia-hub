import { createClient } from '@/lib/supabase/client'
import type { ProtocoloAtendimento } from '@/actions/protocolos-atendimento'

export type Paciente = { id: string; nome: string }
export type Profissional = { id: string; nome: string; cargo: string }
export type SlotLivre = { id: string; data: string; hora_inicio: string; hora_fim: string }
export type ItemProtocoloConfigurado = ProtocoloAtendimento['itens'][number] & { sessoesSelecionadas: number[] }

export interface AtendimentoParaEditar {
  id: string
  paciente_id: string
  profissional_id?: string | null
  agendamento_pai?: { plano_saude?: string | null } | null
  data_agendamento: string
  duracao_minutos?: number | null
  tipo: string
  observacoes?: string | null
  marcou_retorno?: boolean | null
}

export const DIAS_SEMANA = [
  { val: 1, label: 'Seg' }, { val: 2, label: 'Ter' }, { val: 3, label: 'Qua' },
  { val: 4, label: 'Qui' }, { val: 5, label: 'Sex' }, { val: 6, label: 'Sáb' }, { val: 0, label: 'Dom' },
]

export function somarUmaHora(horario: string): string {
  if (!horario || !horario.includes(':')) return ''
  const [horaStr, minutoStr] = horario.split(':')
  const hora = Number(horaStr)
  const minuto = Number(minutoStr)
  if (Number.isNaN(hora) || Number.isNaN(minuto)) return ''
  return `${String((hora + 1) % 24).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`
}

export function normalizarQuantidadeSessao(valor: string | number | undefined): number {
  const quantidade = typeof valor === 'number' ? valor : parseInt(String(valor ?? ''), 10)
  return Math.max(1, Math.min(365, Number.isNaN(quantidade) ? 1 : quantidade))
}

export function normalizarQuantidadeItemProtocolo(valor: string | number | undefined, totalSessoes: number): number {
  const quantidade = typeof valor === 'number' ? valor : parseInt(String(valor ?? ''), 10)
  return Math.max(0, Math.min(totalSessoes, Number.isNaN(quantidade) ? 0 : quantidade))
}

export function normalizarSessoesSelecionadas(sessoes: number[] | undefined, totalSessoes: number): number[] {
  return Array.from(new Set((sessoes ?? []).filter((s) => s >= 1 && s <= totalSessoes)))
    .sort((a, b) => a - b)
}

export function criarSessoesConsecutivas(quantidade: number): number[] {
  return Array.from({ length: quantidade }, (_, i) => i + 1)
}

export function ajustarSessoesParaQuantidade(
  sessoesAtuais: number[] | undefined,
  proximaQuantidade: number,
  totalSessoes: number,
): number[] {
  const normalizadas = normalizarSessoesSelecionadas(sessoesAtuais, totalSessoes)
  if (proximaQuantidade <= normalizadas.length) return normalizadas.slice(0, proximaQuantidade)
  const set = new Set(normalizadas)
  for (let s = 1; s <= totalSessoes && set.size < proximaQuantidade; s++) set.add(s)
  return Array.from(set).sort((a, b) => a - b)
}

export function montarSequenciaProtocolo(
  protocolo: ProtocoloAtendimento | null,
  sessoesPorItem: Record<string, number[]>,
  totalSessoesOverride?: number,
): string[] {
  if (!protocolo) return []
  const total = normalizarQuantidadeSessao(totalSessoesOverride ?? protocolo.total_sessoes)
  const fallback = protocolo.itens[0]?.tipo_consulta_nome?.trim() || protocolo.nome
  return Array.from({ length: total }, (_, i) => {
    const num = i + 1
    const tipos = protocolo.itens
      .filter((item) =>
        normalizarSessoesSelecionadas(
          sessoesPorItem[item.id] ?? criarSessoesConsecutivas(item.quantidade),
          total,
        ).includes(num),
      )
      .map((item) => item.tipo_consulta_nome.trim())
      .filter(Boolean)
    return tipos.length > 0 ? tipos.join(' + ') : fallback
  })
}

export async function buscarPacientesPorNome(
  supabase: ReturnType<typeof createClient>,
  termo: string,
): Promise<Paciente[]> {
  const busca = termo.trim()
  if (!busca) return []
  const { data, error } = await supabase
    .from('pacientes')
    .select('id, nome')
    .eq('ativo', true)
    .ilike('nome', `%${busca}%`)
    .order('nome')
    .range(0, 19)
  if (error) throw error
  return data ?? []
}

export async function buscarPacientePorId(
  supabase: ReturnType<typeof createClient>,
  pacienteId: string,
): Promise<Paciente | null> {
  if (!pacienteId) return null
  const { data, error } = await supabase
    .from('pacientes')
    .select('id, nome')
    .eq('id', pacienteId)
    .maybeSingle()
  if (error) throw error
  return data ?? null
}
