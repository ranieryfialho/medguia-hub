import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { RelatorioContatosClient } from '@/components/features/contatos'
import { BtnVoltar } from '@/components/features/shared'
import {
  criarContagemStatusContato,
  normalizarColunasContato,
  type KanbanColunaContato,
  type StatusContatoPadrao,
} from '@/lib/contatos-kanban'
import {
  criarMapaUltimoAtendimento,
  listarUltimosAtendimentosPorPacientes,
  type UltimoAtendimentoClient,
} from '@/lib/ultimo-atendimento'
import { requireModulo } from '@/lib/guard'
import { isGestorSistema } from '@/lib/permissoes'
import {
  format, parseISO,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  subMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatAppDateKey } from '@/lib/datetime'

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
  atualizado_em: string
}

const HISTORICO_ATENDIMENTOS_ANOS = 2

function resolverPeriodoContatos(params: Record<string, string | string[] | undefined>) {
  const hojeStr = formatAppDateKey(new Date())
  const periodo = typeof params.periodo === 'string' ? params.periodo : 'este-mes'

  switch (periodo) {
    case 'esta-semana': {
      const ini = startOfWeek(parseISO(hojeStr), { weekStartsOn: 0 })
      const fim = endOfWeek(parseISO(hojeStr), { weekStartsOn: 0 })
      return { dataInicio: ini, dataFim: fim, periodoAtual: 'esta-semana', label: 'Esta semana' }
    }
    case 'mes-passado': {
      const mp = subMonths(parseISO(hojeStr), 1)
      return {
        dataInicio: startOfMonth(mp), dataFim: endOfMonth(mp),
        periodoAtual: 'mes-passado',
        label: format(mp, "MMMM 'de' yyyy", { locale: ptBR }),
      }
    }
    case 'personalizado': {
      const de  = typeof params.de  === 'string' ? params.de  : hojeStr
      const ate = typeof params.ate === 'string' ? params.ate : hojeStr
      return {
        dataInicio: parseISO(de), dataFim: parseISO(ate),
        periodoAtual: 'personalizado',
        label: `${format(parseISO(de), 'dd/MM/yyyy')} – ${format(parseISO(ate), 'dd/MM/yyyy')}`,
      }
    }
    default: {
      return {
        dataInicio: startOfMonth(parseISO(hojeStr)),
        dataFim: endOfMonth(parseISO(hojeStr)),
        periodoAtual: 'este-mes',
        label: format(parseISO(hojeStr), "MMMM 'de' yyyy", { locale: ptBR }),
      }
    }
  }
}

export default async function RelatorioContatosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { user, profile } = await requireModulo('contatos:relatorio')
  const params = await searchParams
  const { dataInicio, dataFim, periodoAtual, label: periodoLabel } = resolverPeriodoContatos(params)
  const utcInicio = new Date(`${formatAppDateKey(dataInicio)}T00:00:00-03:00`).toISOString()
  const utcFim    = new Date(`${formatAppDateKey(dataFim)}T23:59:59.999-03:00`).toISOString()

  const supabase = await createClient()
  const atendimentoCutoff = new Date()
  atendimentoCutoff.setFullYear(atendimentoCutoff.getFullYear() - HISTORICO_ATENDIMENTOS_ANOS)
  const atendimentoCutoffIso = atendimentoCutoff.toISOString()

  const isGestorOuMaster = isGestorSistema(profile?.nivel_acesso)

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
  const pacientesIds = contatosRaw.map(c => c.paciente_id)

  // Buscar notas para calcular última atividade
  let notasQuery = supabase
    .from('notas_contato')
    .select('paciente_id, criado_em')
    .order('criado_em', { ascending: false })

  if (pacientesIds.length > 0) {
    notasQuery = notasQuery.in('paciente_id', pacientesIds)
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
  const atendimentos = await listarUltimosAtendimentosPorPacientes(
    supabase as unknown as UltimoAtendimentoClient,
    pacientesIds,
    atendimentoCutoffIso
  )
  const ultimoAtendimentoMap = criarMapaUltimoAtendimento(atendimentos)

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
      ultimo_atendimento_data: ultimoAtendimento?.data ?? null,
      ultimo_atendimento_tipo: ultimoAtendimento?.tipo ?? null,
      ultima_nota_criada_em: ultimaNota.get(c.paciente_id) ?? null,
      atualizado_em: c.atualizado_em,
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

  // Métricas do período (Performance Geral filtrada por atualizado_em)
  const pacientesPeriodo = new Set(
    contatosRaw
      .filter(c => c.atualizado_em >= utcInicio && c.atualizado_em <= utcFim)
      .map(c => c.paciente_id)
  )
  const contatosPeriodo = contatos.filter(c => pacientesPeriodo.has(c.paciente_id))

  const contagemPorStatusPeriodo: Record<StatusContato, number> = criarContagemStatusContato()
  for (const c of contatosPeriodo) contagemPorStatusPeriodo[c.status]++

  const totalContatosPeriodo = contatosPeriodo.length
  const pipelinePeriodo = totalContatosPeriodo - contagemPorStatusPeriodo.sem_interesse
  const taxaConversaoPeriodo = pipelinePeriodo > 0
    ? Math.round((contagemPorStatusPeriodo.agendou / pipelinePeriodo) * 100)
    : 0

  const responsavelMapPeriodo = new Map<string, ContatoComDados[]>()
  for (const c of contatosPeriodo) {
    const key = c.responsavel_id ?? 'sem_responsavel'
    if (!responsavelMapPeriodo.has(key)) responsavelMapPeriodo.set(key, [])
    responsavelMapPeriodo.get(key)!.push(c)
  }
  const contatosPorResponsavelPeriodo: Array<{
    id: string | null; nome: string; total: number
    contagemPorStatus: Record<StatusContato, number>; taxaConversao: number
  }> = []
  for (const [key, conts] of responsavelMapPeriodo.entries()) {
    const sc = criarContagemStatusContato()
    for (const c of conts) sc[c.status]++
    const pl = conts.length - sc.sem_interesse
    contatosPorResponsavelPeriodo.push({
      id: key === 'sem_responsavel' ? null : key,
      nome: conts[0]?.responsavel_nome ?? 'Sem responsável',
      total: conts.length,
      contagemPorStatus: sc,
      taxaConversao: pl > 0 ? Math.round((sc.agendou / pl) * 100) : 0,
    })
  }
  contatosPorResponsavelPeriodo.sort((a, b) => b.total - a.total)

  const contagemPorColunaPeriodo = kanbanColumns.map(col => ({
    chave: col.chave,
    nome: col.nome,
    corChave: col.cor_chave,
    total: contatosPeriodo.filter(c => c.kanban_coluna_chave === col.chave).length,
  }))

  // Contatos em risco: A Contatar ou Tentativa há >30 dias sem atividade
  const contatosEmRisco = contatos.filter(c => {
    if (!['a_contactar', 'tentativa'].includes(c.status)) return false

    // Usa atualizado_em como fallback: contatos recém-criados não são risco
    const ultimaAtividade = c.ultima_nota_criada_em ?? c.ultimo_atendimento_data ?? c.atualizado_em

    const diasSdeUltimaAtividade = Math.floor(
      (new Date().getTime() - new Date(ultimaAtividade).getTime()) / (1000 * 60 * 60 * 24)
    )
    return diasSdeUltimaAtividade > 30
  })

  // IDs dos responsáveis (lista pequena — evita URL longa com centenas de paciente_ids)
  const profissionalIds = contatosPorResponsavel
    .filter(r => r.id !== null)
    .map(r => r.id!)

  // Notas feitas no período filtradas pelo autor (fisio), não pelo paciente
  const { data: notasPeriodo } = profissionalIds.length > 0
    ? await supabase
        .from('notas_contato')
        .select('paciente_id, autor_id')
        .in('autor_id', profissionalIds)
        .gte('criado_em', utcInicio)
        .lte('criado_em', utcFim)
    : { data: [] }

  // Atividade no período por responsável
  const atividadePorResponsavel = contatosPorResponsavel
    .filter(r => r.id !== null)
    .map(r => {
      const pacientesCarteira = new Set(
        (responsavelMap.get(r.id!) ?? []).map(c => c.paciente_id)
      )
      const notasDoResp = (notasPeriodo ?? []).filter(
        n => n.autor_id === r.id && pacientesCarteira.has(n.paciente_id)
      )
      const pacientesContatados = new Set(notasDoResp.map(n => n.paciente_id)).size
      return {
        id: r.id!,
        nome: r.nome,
        carteira: r.total,
        notasPeriodo: notasDoResp.length,
        pacientesContatados,
        taxaAtividade: r.total > 0 ? Math.round((pacientesContatados / r.total) * 100) : 0,
      }
    })
    .sort((a, b) => b.notasPeriodo - a.notasPeriodo)

  const totalNotasPeriodo = atividadePorResponsavel.reduce((acc, r) => acc + r.notasPeriodo, 0)
  const totalPacientesContatados = new Set(
    (notasPeriodo ?? []).map(n => n.paciente_id)
  ).size

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
        atividadePorResponsavel={atividadePorResponsavel}
        periodoLabel={periodoLabel}
        periodoAtual={periodoAtual}
        totalNotasPeriodo={totalNotasPeriodo}
        totalPacientesContatados={totalPacientesContatados}
        contagemPorStatusPeriodo={contagemPorStatusPeriodo}
        contatosPorResponsavelPeriodo={contatosPorResponsavelPeriodo}
        taxaConversaoPeriodo={taxaConversaoPeriodo}
        totalContatosPeriodo={totalContatosPeriodo}
        contagemPorColunaPeriodo={contagemPorColunaPeriodo}
      />
    </div>
  )
}
