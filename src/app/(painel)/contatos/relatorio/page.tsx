import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { RelatorioContatosClient } from '@/components/features/RelatorioContatosClient'
import { BtnVoltar } from '@/components/features/BtnVoltar'
import {
  criarContagemStatusContato,
  normalizarColunasContato,
  type KanbanColunaContato,
  type StatusContatoPadrao,
} from '@/lib/contatos-kanban'
import { requireModulo } from '@/lib/guard'

type StatusContato = StatusContatoPadrao

type ContatoComDados = {
  paciente_id: string
  paciente_nome: string
  status: StatusContato
  kanban_coluna_chave: string
  kanban_coluna_nome: string
  kanban_coluna_cor_chave: KanbanColunaContato['cor_chave']
  responsavel_id: string | null
  responsavel_nome: string | null
  ultimo_atendimento_data: string | null
  ultimo_atendimento_tipo: string | null
  ultima_nota_criada_em: string | null
}

const HISTORICO_ATENDIMENTOS_ANOS = 2

export default async function RelatorioContatosPage() {
  await requireModulo('contatos:relatorio')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const atendimentoCutoff = new Date()
  atendimentoCutoff.setFullYear(atendimentoCutoff.getFullYear() - HISTORICO_ATENDIMENTOS_ANOS)
  const atendimentoCutoffIso = atendimentoCutoff.toISOString()

  if (!user) notFound()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, nivel_acesso, full_name')
    .eq('id', user.id)
    .single()

  if (!profile) notFound()

  const isGestorOuMaster = profile.nivel_acesso === 'gestor' || profile.nivel_acesso === 'master'

  // Construir query base
  let q = supabase
    .from('contatos_base')
    .select(`
      paciente_id,
      status,
      kanban_coluna_chave,
      responsavel_id,
      atualizado_em,
      pacientes!inner(nome),
      profiles!contatos_base_responsavel_id_fkey(full_name)
    `)

  // Filtrar por responsável se não for gestor/master
  if (!isGestorOuMaster) {
    q = q.eq('responsavel_id', user.id)
  }

  const { data: contatosRaw, error } = await q.order('atualizado_em', { ascending: false })

  if (error || !contatosRaw) {
    console.error('Erro ao buscar contatos:', error)
    notFound()
  }

  const { data: kanbanColumnsRaw } = await supabase
    .from('kanban_colunas_contatos')
    .select('chave, nome, tipo, status_base, cor_chave, ordem')
    .order('ordem', { ascending: true })

  const kanbanColumns = normalizarColunasContato((kanbanColumnsRaw ?? null) as KanbanColunaContato[] | null)
  const kanbanColumnMap = new Map(kanbanColumns.map((column) => [column.chave, column]))

  // Buscar notas para calcular última atividade
  let notasQuery = supabase
    .from('notas_contato')
    .select('paciente_id, criado_em')
    .order('criado_em', { ascending: false })

  if (!isGestorOuMaster) {
    // Para fisio, apenas notas de contatos que são responsáveis
    const pacientesIds = new Set(contatosRaw.map(c => c.paciente_id))
    notasQuery = notasQuery.in('paciente_id', Array.from(pacientesIds))
  }

  const { data: notas } = await notasQuery

  // Mapear notas por paciente (última nota por paciente)
  const ultimaNota = new Map<string, string>()
  if (notas) {
    for (const nota of notas) {
      if (!ultimaNota.has(nota.paciente_id)) {
        ultimaNota.set(nota.paciente_id, nota.criado_em)
      }
    }
  }

  // Buscar atendimentos para cada paciente
  const pacientesIds = contatosRaw.map(c => c.paciente_id)
  const { data: atendimentos } = await supabase
    .from('atendimentos')
    .select('paciente_id, data_agendamento, tipo')
    .in('paciente_id', pacientesIds)
    .gte('data_agendamento', atendimentoCutoffIso)
    .order('data_agendamento', { ascending: false })

  // Mapear último atendimento por paciente
  const ultimoAtendimentoMap = new Map<string, { data_agendamento: string; tipo: string }>()
  if (atendimentos) {
    for (const atend of atendimentos) {
      if (!ultimoAtendimentoMap.has(atend.paciente_id)) {
        ultimoAtendimentoMap.set(atend.paciente_id, {
          data_agendamento: atend.data_agendamento,
          tipo: atend.tipo,
        })
      }
    }
  }

  // Transformar dados para o formato esperado
  const contatos: ContatoComDados[] = contatosRaw.map(c => {
    const paciente = (c.pacientes as unknown as { nome: string } | null)
    const profile = (c.profiles as unknown as { full_name: string } | null)
    const ultimoAtendimento = ultimoAtendimentoMap.get(c.paciente_id) ?? null
    return {
      paciente_id: c.paciente_id,
      paciente_nome: paciente?.nome ?? 'Sem nome',
      status: c.status as StatusContato,
      kanban_coluna_chave: c.kanban_coluna_chave ?? c.status,
      kanban_coluna_nome: kanbanColumnMap.get(c.kanban_coluna_chave ?? c.status)?.nome ?? 'Sem coluna',
      kanban_coluna_cor_chave: kanbanColumnMap.get(c.kanban_coluna_chave ?? c.status)?.cor_chave ?? (c.status as StatusContato),
      responsavel_id: c.responsavel_id,
      responsavel_nome: profile?.full_name ?? null,
      ultimo_atendimento_data: ultimoAtendimento?.data_agendamento ?? null,
      ultimo_atendimento_tipo: ultimoAtendimento?.tipo ?? null,
      ultima_nota_criada_em: ultimaNota.get(c.paciente_id) ?? null,
    }
  })

  // Calcular agregações
  const contagemPorStatus: Record<StatusContato, number> = criarContagemStatusContato()

  for (const c of contatos) {
    contagemPorStatus[c.status]++
  }

  const totalContatos = contatos.length
  const contatosPipeline = totalContatos - contagemPorStatus.sem_interesse
  const taxaConversaoGeral = contatosPipeline > 0
    ? Math.round((contagemPorStatus.agendou / contatosPipeline) * 100)
    : 0

  // Agrupar por responsável
  const contatosPorResponsavel: Array<{
    id: string | null
    nome: string
    total: number
    contagemPorStatus: Record<StatusContato, number>
    taxaConversao: number
  }> = []

  const responsavelMap = new Map<string | null, ContatoComDados[]>()
  for (const c of contatos) {
    const key = c.responsavel_id ?? 'sem_responsavel'
    if (!responsavelMap.has(key)) {
      responsavelMap.set(key, [])
    }
    responsavelMap.get(key)!.push(c)
  }

  for (const [key, conts] of responsavelMap.entries()) {
    const statusCount: Record<StatusContato, number> = criarContagemStatusContato()

    for (const c of conts) {
      statusCount[c.status]++
    }

    const pipelineResp = conts.length - statusCount.sem_interesse
    const taxaResp = pipelineResp > 0 ? Math.round((statusCount.agendou / pipelineResp) * 100) : 0

    contatosPorResponsavel.push({
      id: key === 'sem_responsavel' ? null : (key as string),
      nome: conts[0]?.responsavel_nome ?? 'Sem responsável',
      total: conts.length,
      contagemPorStatus: statusCount,
      taxaConversao: taxaResp,
    })
  }

  // Ordenar por total (descendente)
  contatosPorResponsavel.sort((a, b) => b.total - a.total)

  // Contatos em risco: A Contatar ou Tentativa há >30 dias sem atividade
  const contatosEmRisco = contatos.filter(c => {
    if (!['a_contactar', 'tentativa'].includes(c.status)) return false

    const ultimaAtividade = c.ultima_nota_criada_em ?? c.ultimo_atendimento_data
    if (!ultimaAtividade) return true // Sem atividade = em risco

    const diasSdeUltimaAtividade = Math.floor(
      (new Date().getTime() - new Date(ultimaAtividade).getTime()) / (1000 * 60 * 60 * 24)
    )
    return diasSdeUltimaAtividade > 30
  })

  const contatosSemResponsavel = contatos.filter(c => !c.responsavel_id)
  const contagemPorColuna = kanbanColumns.map((column) => ({
    chave: column.chave,
    nome: column.nome,
    corChave: column.cor_chave,
    total: contatos.filter((contato) => contato.kanban_coluna_chave === column.chave).length,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <BtnVoltar href="/contatos" />
            <h1 className="text-2xl font-bold text-[#171d1c]">Relatório de Contatos</h1>
          </div>
          <p className="text-sm text-[#3d4945]">
            Análise completa do funil de vendas e performance de contatos
          </p>
        </div>
      </div>

      <RelatorioContatosClient
        contatos={contatos}
        contagemPorStatus={contagemPorStatus}
        contatosPorResponsavel={contatosPorResponsavel}
        contatosEmRisco={contatosEmRisco}
        contatosSemResponsavel={contatosSemResponsavel}
        contagemPorColuna={contagemPorColuna}
        taxaConversaoGeral={taxaConversaoGeral}
        totalContatos={totalContatos}
        isGestorOuMaster={isGestorOuMaster}
        userNome={profile.full_name || 'Você'}
      />
    </div>
  )
}
