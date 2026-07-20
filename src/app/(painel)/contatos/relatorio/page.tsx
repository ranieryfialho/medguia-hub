import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { RelatorioContatosClient } from '@/components/features/contatos'
import { BtnVoltar, BtnGerarPdfContatos, BtnExportarMdContatos } from '@/components/features/shared'
import type { DadosRelatorioContatos } from '@/lib/relatorios/contatos-relatorio-dados'
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
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  formatAppDateKey,
  parseAppDate,
  startOfAppWeekKey,
  endOfAppWeekKey,
  startOfAppMonthKey,
  endOfAppMonthKey,
  subAppMonthsKey,
} from '@/lib/datetime'

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
      const ini = parseAppDate(startOfAppWeekKey(hojeStr))
      const fim = parseAppDate(endOfAppWeekKey(hojeStr))
      return { dataInicio: ini, dataFim: fim, periodoAtual: 'esta-semana', label: 'Esta semana' }
    }
    case 'mes-passado': {
      const mpStr = subAppMonthsKey(hojeStr, 1)
      const mp = parseAppDate(mpStr)
      return {
        dataInicio: parseAppDate(startOfAppMonthKey(mpStr)),
        dataFim: parseAppDate(endOfAppMonthKey(mpStr)),
        periodoAtual: 'mes-passado',
        label: format(mp, "MMMM 'de' yyyy", { locale: ptBR }),
      }
    }
    case 'personalizado': {
      const de  = typeof params.de  === 'string' ? params.de  : hojeStr
      const ate = typeof params.ate === 'string' ? params.ate : hojeStr
      return {
        dataInicio: parseAppDate(de), dataFim: parseAppDate(ate),
        periodoAtual: 'personalizado',
        label: `${format(parseAppDate(de), 'dd/MM/yyyy')} – ${format(parseAppDate(ate), 'dd/MM/yyyy')}`,
      }
    }
    default: {
      return {
        dataInicio: parseAppDate(startOfAppMonthKey(hojeStr)),
        dataFim: parseAppDate(endOfAppMonthKey(hojeStr)),
        periodoAtual: 'este-mes',
        label: format(parseAppDate(hojeStr), "MMMM 'de' yyyy", { locale: ptBR }),
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

  // Buscar notas para calcular última atividade (sem .in() para evitar 502 no gateway)
  const pacientesIdsSet = new Set(pacientesIds)
  const { data: todasNotas } = await supabase
    .from('notas_contato')
    .select('paciente_id, criado_em')
    .order('criado_em', { ascending: false })
  const notas = (todasNotas ?? []).filter(n => pacientesIdsSet.has(n.paciente_id))

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

  // Anotações (busca todas sem .in() para evitar 502, filtra em JS)
  type AnotacaoRow = { id: string; paciente_id: string; texto: string; criado_em: string; autor_id: string | null }
  const { data: todasAnotacoes } = await supabase
    .from('notas_contato')
    .select('id, paciente_id, texto, criado_em, autor_id')
    .order('criado_em', { ascending: false })
  const anotacoesRaw: AnotacaoRow[] = (todasAnotacoes ?? [])
    .filter(n =>
      pacientesIdsSet.has(n.paciente_id) &&
      !n.texto.toLowerCase().startsWith('status alterado para:') &&
      !n.texto.toLowerCase().startsWith('etapa alterada para:')
    )

  // Montar anotações com nomes de paciente e autor
  const autorIdsAnotacoes = [...new Set(anotacoesRaw.map(n => n.autor_id).filter((id): id is string => id !== null))]
  const profileMapAnotacoes: Record<string, string> = {}
  if (autorIdsAnotacoes.length > 0) {
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', autorIdsAnotacoes)
    for (const p of profilesData ?? []) {
      profileMapAnotacoes[p.id] = p.full_name
    }
  }
  const pacienteNomeMap = new Map(contatos.map(c => [c.paciente_id, c.paciente_nome]))
  const anotacoesPeriodo = anotacoesRaw.map(n => ({
    id: n.id,
    paciente_id: n.paciente_id,
    paciente_nome: pacienteNomeMap.get(n.paciente_id) ?? 'Paciente',
    texto: n.texto,
    criado_em: n.criado_em,
    autor_nome: n.autor_id ? (profileMapAnotacoes[n.autor_id] ?? null) : null,
  }))

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

  // Atividade por período: baseado em status dos contatos, não em notas
  const statusesContatados: StatusContato[] = ['tentativa', 'em_conversa', 'sem_interesse', 'agendou']
  const statusesEfetivos: StatusContato[] = ['em_conversa', 'sem_interesse', 'agendou']

  const totalContatadosPeriodo = contatosPeriodo.filter(c => statusesContatados.includes(c.status)).length
  const totalEfetivosPeriodo   = contatosPeriodo.filter(c => statusesEfetivos.includes(c.status)).length

  const atividadeContatosPorResponsavel = contatosPorResponsavelPeriodo
    .filter(r => r.id !== null)
    .map(r => {
      const contatados = statusesContatados.reduce((sum, s) => sum + (r.contagemPorStatus[s] ?? 0), 0)
      const efetivos   = statusesEfetivos.reduce((sum, s) => sum + (r.contagemPorStatus[s] ?? 0), 0)
      return {
        id: r.id!,
        nome: r.nome,
        carteira: r.total,
        contatados,
        efetivos,
        taxaEfetividade: contatados > 0 ? Math.round((efetivos / contatados) * 100) : 0,
      }
    })
    .sort((a, b) => b.contatados - a.contatados)

  const contatosSemResponsavel = contatos.filter(c => !c.responsavel_id)
  const contagemPorColuna = kanbanColumns.map((column) => ({
    chave: column.chave,
    nome: column.nome,
    corChave: column.cor_chave,
    total: contatos.filter((contato) => contato.kanban_coluna_chave === column.chave).length,
  }))

  // Atividade (contatados/efetivos) considerando a base completa, sem filtro de período
  const totalContatadosGlobal = contatos.filter(c => statusesContatados.includes(c.status)).length
  const totalEfetivosGlobal   = contatos.filter(c => statusesEfetivos.includes(c.status)).length

  const atividadeContatosPorResponsavelGlobal = contatosPorResponsavel
    .filter(r => r.id !== null)
    .map(r => {
      const contatados = statusesContatados.reduce((sum, s) => sum + (r.contagemPorStatus[s] ?? 0), 0)
      const efetivos   = statusesEfetivos.reduce((sum, s) => sum + (r.contagemPorStatus[s] ?? 0), 0)
      return {
        nome: r.nome,
        carteira: r.total,
        contatados,
        efetivos,
        taxaEfetividade: contatados > 0 ? Math.round((efetivos / contatados) * 100) : 0,
      }
    })
    .sort((a, b) => b.contatados - a.contatados)

  const dadosRelatorio: DadosRelatorioContatos = {
    periodoLabel,
    totalContatos,
    totalContatosPeriodo,
    taxaConversaoGeral,
    taxaConversaoPeriodo,
    contatosSemResponsavelCount: contatosSemResponsavel.length,
    contagemPorStatusGlobal: contagemPorStatus,
    contagemPorStatusPeriodo,
    contagemPorColunaGlobal: contagemPorColuna.map(c => ({ nome: c.nome, total: c.total })),
    contagemPorColunaPeriodo: contagemPorColunaPeriodo.map(c => ({ nome: c.nome, total: c.total })),
    contatosPorResponsavelGlobal: contatosPorResponsavel,
    contatosPorResponsavelPeriodo,
    totalContatadosGlobal,
    totalEfetivosGlobal,
    totalContatadosPeriodo,
    totalEfetivosPeriodo,
    atividadeContatosPorResponsavelGlobal,
    atividadeContatosPorResponsavel: atividadeContatosPorResponsavel.map(({ id: _id, ...resto }) => {
      void _id
      return resto
    }),
    contatosEmRisco: contatosEmRisco.map(c => ({
      paciente_nome: c.paciente_nome,
      kanban_coluna_nome: c.kanban_coluna_nome,
      responsavel_nome: c.responsavel_nome,
      dias_sem_atividade: Math.floor(
        (new Date().getTime() - new Date(c.ultima_nota_criada_em ?? c.ultimo_atendimento_data ?? c.atualizado_em).getTime())
          / (1000 * 60 * 60 * 24)
      ),
    })),
    anotacoes: anotacoesPeriodo.map(a => ({
      paciente_nome: a.paciente_nome,
      texto: a.texto,
      autor_nome: a.autor_nome,
      criado_em: a.criado_em,
    })),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <BtnVoltar href="/contatos" />
            <h1 className="text-2xl font-bold text-[#171d1c]">Relatório de Contatos</h1>
          </div>
          <p className="text-sm text-[#3d4945]">
            Análise completa do funil de vendas e performance de contatos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <BtnExportarMdContatos {...dadosRelatorio} />
          <BtnGerarPdfContatos {...dadosRelatorio} />
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
        atividadeContatosPorResponsavel={atividadeContatosPorResponsavel}
        totalContatadosPeriodo={totalContatadosPeriodo}
        totalEfetivosPeriodo={totalEfetivosPeriodo}
        periodoLabel={periodoLabel}
        periodoAtual={periodoAtual}
        contagemPorStatusPeriodo={contagemPorStatusPeriodo}
        contatosPorResponsavelPeriodo={contatosPorResponsavelPeriodo}
        taxaConversaoPeriodo={taxaConversaoPeriodo}
        totalContatosPeriodo={totalContatosPeriodo}
        contagemPorColunaPeriodo={contagemPorColunaPeriodo}
        anotacoesPeriodo={anotacoesPeriodo}
      />
    </div>
  )
}
