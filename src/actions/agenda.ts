'use server'

import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { buildAppDateTimeISO, formatAppDateKey } from '@/lib/datetime'
import {
  normalizarDisponibilidade,
  validarHorarioDisponibilidade,
  type DisponibilidadeMensalMap,
  type DisponibilidadeDia,
} from '@/lib/disponibilidade'
import { validarConflitosProfissional } from '@/lib/agendamento-conflitos'
import {
  adicionarMesesPreservandoDiaLocal,
  adicionarMesesPreservandoDiaUTC,
  recorrenciaSemanalAtiva,
} from '@/lib/recorrencia'
import {
  getAtendimentoStatusKey,
  STATUS_CONCLUIDO_RAW_VALUES,
  STATUS_NAO_BLOQUEIAM_RAW_VALUES,
  isStatusNaoEfetivo,
  normalizeAtendimentoStatus,
} from '@/lib/atendimento-status'
import { isGestorSistema } from '@/lib/permissoes'

function extractTimePart(dateTime: string) {
  const [, timePart = '00:00:00'] = dateTime.split('T')
  return timePart.replace(/([+-]\d{2}:\d{2}|Z)$/, '')
}

type ResultadoExclusao = { success?: true; error?: string }

async function requirePermissaoAgendaAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Não autenticado.' as const }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('ativo, nivel_acesso, modulos_liberados')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.ativo) {
    return { error: 'Usuário inativo.' as const }
  }

  const modulos = profile.modulos_liberados ?? []
  const temModuloAgenda = modulos.length === 0 || modulos.includes('agenda')
  const podeGerirAgenda = temModuloAgenda || isGestorSistema(profile.nivel_acesso)

  if (!podeGerirAgenda) {
    return { error: 'Sem permissão para excluir agendamentos.' as const }
  }

  const supabaseAdmin = createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  return { supabaseAdmin }
}

async function carregarDisponibilidadesProfissional(profissionalId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('disponibilidade_profissional')
    .select('dia_semana, jornada_inicio, jornada_fim, intervalo_inicio, intervalo_fim')
    .eq('profissional_id', profissionalId)
    .eq('ativo', true)

  const disponibilidades = new Map<number, DisponibilidadeDia>()
  for (const item of data ?? []) {
    disponibilidades.set(item.dia_semana, normalizarDisponibilidade(item))
  }

  return disponibilidades
}

async function carregarDisponibilidadesMensaisProfissional(
  profissionalId: string,
  dataInicio: string,
  dataFim: string,
) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('jornada_mensal_profissional')
    .select('profissional_id, data, jornada_inicio, jornada_fim, intervalo_inicio, intervalo_fim, ativo')
    .eq('profissional_id', profissionalId)
    .gte('data', dataInicio)
    .lte('data', dataFim)

  const disponibilidades = new Map() as DisponibilidadeMensalMap
  for (const item of data ?? []) {
    disponibilidades.set(item.data, item)
  }

  return disponibilidades
}

async function carregarRoleProfissional(profissionalId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', profissionalId)
    .maybeSingle()

  return data?.role ?? null
}

function validarOcorrenciasNaDisponibilidade(
  disponibilidades: Map<number, DisponibilidadeDia>,
  disponibilidadesMensais: DisponibilidadeMensalMap,
  ocorrencias: { data: string; hora_inicio: string; hora_fim: string }[],
) {
  for (const ocorrencia of ocorrencias) {
    const validacao = validarHorarioDisponibilidade(
      disponibilidades,
      ocorrencia.data,
      ocorrencia.hora_inicio,
      ocorrencia.hora_fim,
      disponibilidadesMensais,
    )

    if (!validacao.ok) {
      if (validacao.motivo === 'sem_jornada') {
        return {
          error: `O profissional não possui disponibilidade cadastrada em ${ocorrencia.data}.`,
        }
      }

      return {
        error: `O horário ${ocorrencia.hora_inicio}–${ocorrencia.hora_fim} em ${ocorrencia.data} está fora da disponibilidade. Faixas permitidas: ${validacao.faixas}.`,
      }
    }
  }

  return null
}

function removerMetadadosDisponibilidade(atendimento: {
  data: string
  hora_inicio: string
  hora_fim: string
  [key: string]: boolean | number | string | null | undefined
}) {
  const { data, hora_inicio, hora_fim, ...semMetadados } = atendimento
  void data
  void hora_inicio
  void hora_fim
  return semMetadados
}

export async function criarAgendamento(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const paciente_id = formData.get('paciente_id') as string
  const profissional_id = formData.get('profissional_id') as string
  const dataStr = formData.get('data') as string // YYYY-MM-DD
  const horaInicio = formData.get('hora_inicio') as string // HH:mm
  const horaFim = formData.get('hora_fim') as string // HH:mm
  const tipo = formData.get('tipo') as string
  const protocoloAtendimentoTiposJson = (formData.get('protocolo_atendimento_tipos_json') as string) || ''
  const protocoloAtendimentoNome = ((formData.get('protocolo_atendimento_nome') as string) || '').trim()
  const observacoes = formData.get('observacoes') as string
  const plano_saude = ((formData.get('plano_saude') as string) || '').trim()
  const gerou_venda = formData.get('gerou_venda') === 'on'
  const marcou_retorno = formData.get('marcou_retorno') === 'on'

  // Campos de recorrência
  const isRecorrente = formData.get('is_recorrente') === 'true'
  const frequencia = formData.get('frequencia') as string // '1', '2', '3', ou 'mes'
  const diasSemana = formData.get('dias_semana') as string // ex: "1,3,5"
  let ocorrencias = Math.max(1, Math.min(365, parseInt(formData.get('ocorrencias') as string) || 1))
  let tiposDoProtocolo: string[] = []

  if (protocoloAtendimentoTiposJson) {
    try {
      const parsed = JSON.parse(protocoloAtendimentoTiposJson) as unknown
      if (Array.isArray(parsed)) {
        tiposDoProtocolo = parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      }
    } catch {
      return { error: 'Erro ao processar protocolo de atendimento.' }
    }
  }

  if (tiposDoProtocolo.length > 0) {
    ocorrencias = tiposDoProtocolo.length
  }

  if (!paciente_id || !profissional_id || !dataStr || !horaInicio || !horaFim) {
    return { error: 'Preencha todos os campos obrigatórios.' }
  }

  const roleProfissional = await carregarRoleProfissional(profissional_id)
  const exigeDisponibilidade = roleProfissional !== 'medico'

  // Calcula a duração em minutos
  const start = new Date(`1970-01-01T${horaInicio}:00`)
  const end = new Date(`1970-01-01T${horaFim}:00`)
  let duracao = (end.getTime() - start.getTime()) / 60000
  if (duracao <= 0) duracao = 30 // Fallback de segurança

  let atendimentosParaInserir: Array<{
    paciente_id: string
    profissional_id: string
    data_agendamento: string
    tipo: string
    duracao_minutos: number
    observacoes: string
    status: string
    criado_por: string | null
    gerou_venda: boolean
    marcou_retorno: boolean
    agendamento_id: string
    numero_sessao?: number
    total_sessoes?: number
    data: string
    hora_inicio: string
    hora_fim: string
  }> = []

  if (!isRecorrente) {
    // AGENDAMENTO ÚNICO
    atendimentosParaInserir.push({
      paciente_id,
      profissional_id,
      data_agendamento: buildAppDateTimeISO(dataStr, horaInicio),
      tipo: tiposDoProtocolo[0] ?? tipo,
      duracao_minutos: duracao,
      observacoes,
      status: 'Aguardando',
      criado_por: user?.id ?? null,
      gerou_venda,
      marcou_retorno,
      agendamento_id: '',
      data: dataStr,
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      numero_sessao: 1,
      total_sessoes: 1,
    })
  } else {
    // AGENDAMENTO RECORRENTE
    const dataInicio = new Date(`${dataStr}T00:00:00-03:00`)
    let count = 0

    if (frequencia === 'mes') {
      // LÓGICA MENSAL (Cria exatamente 1 agendamento no mesmo dia do mês)
      let mesesAdicionados = 0
      while (count < ocorrencias) {
        const dataBase = adicionarMesesPreservandoDiaLocal(dataInicio, mesesAdicionados)

        const dataFormatada = formatAppDateKey(dataBase)
        atendimentosParaInserir.push({
          paciente_id, profissional_id, tipo: tiposDoProtocolo[count] ?? tipo, duracao_minutos: duracao, observacoes, status: 'Aguardando',
          criado_por: user?.id ?? null, gerou_venda, marcou_retorno, agendamento_id: '',
          data_agendamento: buildAppDateTimeISO(dataFormatada, horaInicio),
          data: dataFormatada,
          hora_inicio: horaInicio,
          hora_fim: horaFim,
        })

        count++
        mesesAdicionados++
      }

    } else {
      // LÓGICA SEMANAL (Lida com pulos de 1, 2 ou 3 semanas)
      const diasArray = diasSemana ? diasSemana.split(',').map(Number) : []
      if (diasArray.length === 0) return { error: 'Selecione ao menos um dia da semana.' }

      const semanasPulo = parseInt(frequencia)
      const dataAtual = new Date(`${dataStr}T00:00:00-03:00`)

      while (count < ocorrencias) {
        if (diasArray.includes(dataAtual.getDay())) {
          if (recorrenciaSemanalAtiva(dataAtual, dataInicio, semanasPulo)) {
            const dataFormatada = formatAppDateKey(dataAtual)
            atendimentosParaInserir.push({
              paciente_id, profissional_id, tipo: tiposDoProtocolo[count] ?? tipo, duracao_minutos: duracao, observacoes, status: 'Aguardando',
              criado_por: user?.id ?? null, gerou_venda, marcou_retorno, agendamento_id: '',
              data_agendamento: buildAppDateTimeISO(dataFormatada, horaInicio),
              data: dataFormatada,
              hora_inicio: horaInicio,
              hora_fim: horaFim,
            })
            count++
          }
        }
        dataAtual.setDate(dataAtual.getDate() + 1)
      }
    }
  }

  // Para agendamentos recorrentes, numerar as sessões
  if (isRecorrente && atendimentosParaInserir.length > 0) {
    const total = atendimentosParaInserir.length
    atendimentosParaInserir = atendimentosParaInserir.map((a, idx) => ({
      ...a,
      numero_sessao: idx + 1,
      total_sessoes: total,
    }))
  }

  if (exigeDisponibilidade) {
    const disponibilidades = await carregarDisponibilidadesProfissional(profissional_id)
    const datasOcorrencias = atendimentosParaInserir.map((a) => a.data).sort()
    const disponibilidadesMensais = await carregarDisponibilidadesMensaisProfissional(
      profissional_id,
      datasOcorrencias[0],
      datasOcorrencias[datasOcorrencias.length - 1],
    )
    const erroDisponibilidade = validarOcorrenciasNaDisponibilidade(
      disponibilidades,
      disponibilidadesMensais,
      atendimentosParaInserir.map((a) => ({
        data: a.data,
        hora_inicio: a.hora_inicio,
        hora_fim: a.hora_fim,
      })),
    )

    if (erroDisponibilidade) {
      return erroDisponibilidade
    }
  }

  const erroConflito = await validarConflitosProfissional(
    supabase,
    profissional_id,
    atendimentosParaInserir.map((a) => ({
      data: a.data,
      hora_inicio: a.hora_inicio,
      hora_fim: a.hora_fim,
    })),
  )

  if (erroConflito) {
    return erroConflito
  }

  const { data: agendamentoPai, error: erroAgendamento } = await supabase
    .from('agendamentos')
    .insert({
      paciente_id,
      profissional_id,
      tipo: protocoloAtendimentoNome || (tiposDoProtocolo[0] ?? tipo) || 'Sessao',
      data_inicio: dataStr,
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      duracao_minutos: duracao,
      is_recorrente: isRecorrente,
      frequencia: isRecorrente ? frequencia : null,
      dias_semana: isRecorrente ? diasSemana : null,
      termina_em: isRecorrente ? 'ocorrencias' : null,
      data_fim: null,
      total_ocorrencias: isRecorrente ? ocorrencias : null,
      observacoes,
      plano_saude: plano_saude || null,
      gerou_venda,
      marcou_retorno,
      criado_por: user?.id ?? null,
    })
    .select('id')
    .single()

  if (erroAgendamento || !agendamentoPai) {
    console.error('Erro ao criar agendamento pai:', erroAgendamento?.message)
    return { error: `Erro ao criar agendamento: ${erroAgendamento?.message ?? 'Resposta vazia do banco'}` }
  }

  const { error } = await supabase.from('atendimentos').insert(
    atendimentosParaInserir.map((atendimento) =>
      removerMetadadosDisponibilidade({
        ...atendimento,
        agendamento_id: agendamentoPai.id,
      }),
    ),
  )

  if (error) {
    console.error('Erro ao agendar:', error.message)
    return { error: `Erro ao salvar atendimento(s): ${error.message}` }
  }

  revalidatePath('/agenda')
  return { success: true }
}

export async function buscarDetalhesAgendamento(atendimentoId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('atendimentos')
    .select(`
      id,
      paciente_id,
      profissional_id,
      agendamento_id,
      criado_por,
      data_agendamento,
      created_at,
      status,
      tipo,
      duracao_minutos,
      observacoes,
      agendamento:agendamentos(plano_saude, tipo, criado_por, created_at),
      numero_sessao,
      total_sessoes,
      pacientes (nome, telefone, email),
      profissional:profiles!profissional_id(full_name, role)
    `)
    .eq('id', atendimentoId)
    .maybeSingle()

  if (error) {
    return { error: error.message }
  }

  if (!data) {
    return { data }
  }

  const agendamentoPai = Array.isArray(data.agendamento) ? data.agendamento[0] ?? null : data.agendamento
  const criadorId = agendamentoPai?.criado_por ?? data.criado_por ?? null

  let criador: { full_name?: string | null } | null = null

  if (criadorId) {
    const { data: criadorProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', criadorId)
      .maybeSingle()

    criador = criadorProfile ?? null
  }

  return {
    data: {
      ...data,
      agendamento: agendamentoPai,
      criador,
      created_at: agendamentoPai?.created_at ?? data.created_at ?? null,
    },
  }
}

export async function contarAtendimentosPaciente(pacienteId: string): Promise<{ total: number; cancelados: number }> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('atendimentos')
    .select('status')
    .eq('paciente_id', pacienteId)
  const total = data?.length ?? 0
  const cancelados = data?.filter(a => isStatusNaoEfetivo(a.status)).length ?? 0
  return { total, cancelados }
}

export type HistoricoPacienteResumo = {
  metricas: {
    consultas_total: number
    consultas_concluidas: number
    consultas_nao_efetivas: number
    vendas_realizadas: number
    orcamentos_passados: number
    valor_total_vendas: number
  }
  resumo_tipos: Array<{
    tipo: string
    total: number
    statuses: Array<{
      status: string
      total: number
    }>
  }>
  consultas: Array<{
    id: string
    data_agendamento: string
    status: string
    tipo: string | null
    profissional_nome: string | null
  }>
  evolucoes: Array<{
    atendimento_id: string
    data_agendamento: string
    tipo: string | null
    profissional_nome: string | null
    escala_dor: number | null
    evolucao: string | null
    procedimentos: string | null
    observacoes: string | null
    updated_at: string | null
  }>
  comercial: Array<{
    id: string
    data_venda: string
    status: string
    origem: string | null
    profissional_nome: string | null
    total: number
    itens_resumo: string[]
  }>
}

export async function buscarHistoricoPacienteResumo(pacienteId: string): Promise<{ data?: HistoricoPacienteResumo; error?: string }> {
  const supabase = await createClient()

  const [
    { count: consultasTotal, error: consultasTotalError },
    { count: consultasConcluidas, error: consultasConcluidasError },
    { count: consultasNaoEfetivas, error: consultasNaoEfetivasError },
    { data: atendimentosResumo, error: atendimentosResumoError },
    { data: atendimentos, error: atendimentosError },
    { data: prontuarios, error: prontuariosError },
    { count: vendasRealizadas, error: vendasRealizadasError },
    { count: orcamentosPassados, error: orcamentosPassadosError },
    { data: vendasConfirmadas, error: vendasConfirmadasError },
    { data: vendas, error: vendasError },
  ] = await Promise.all([
    supabase
      .from('atendimentos')
      .select('id', { count: 'exact', head: true })
      .eq('paciente_id', pacienteId),
    supabase
      .from('atendimentos')
      .select('id', { count: 'exact', head: true })
      .eq('paciente_id', pacienteId)
      .in('status', STATUS_CONCLUIDO_RAW_VALUES),
    supabase
      .from('atendimentos')
      .select('id', { count: 'exact', head: true })
      .eq('paciente_id', pacienteId)
      .in('status', STATUS_NAO_BLOQUEIAM_RAW_VALUES),
    supabase
      .from('atendimentos')
      .select('tipo, status')
      .eq('paciente_id', pacienteId),
    supabase
      .from('atendimentos')
      .select('id, data_agendamento, status, tipo, profissional:profiles!profissional_id(full_name)')
      .eq('paciente_id', pacienteId)
      .order('data_agendamento', { ascending: false })
      .limit(5),
    supabase
      .from('prontuarios')
      .select(`
        atendimento_id,
        evolucao,
        escala_dor,
        procedimentos,
        observacoes,
        updated_at,
        atendimentos!inner(data_agendamento, tipo, status, profissional:profiles!profissional_id(full_name))
      `)
      .eq('paciente_id', pacienteId)
      .in('atendimentos.status', STATUS_CONCLUIDO_RAW_VALUES)
      .order('updated_at', { ascending: false })
      .limit(4),
    supabase
      .from('vendas')
      .select('id', { count: 'exact', head: true })
      .eq('paciente_id', pacienteId)
      .eq('status', 'venda_confirmada'),
    supabase
      .from('vendas')
      .select('id', { count: 'exact', head: true })
      .eq('paciente_id', pacienteId)
      .in('status', ['orcamento_pendente', 'orcamento_recusado']),
    supabase
      .from('vendas')
      .select('itens_venda(quantidade, preco_unitario)')
      .eq('paciente_id', pacienteId)
      .eq('status', 'venda_confirmada'),
    supabase
      .from('vendas')
      .select(`
        id,
        data_venda,
        status,
        origem,
        profiles:profissional_id(full_name),
        itens_venda(quantidade, preco_unitario, produtos(nome))
      `)
      .eq('paciente_id', pacienteId)
      .order('data_venda', { ascending: false })
      .limit(4),
  ])

  if (consultasTotalError) return { error: consultasTotalError.message }
  if (consultasConcluidasError) return { error: consultasConcluidasError.message }
  if (consultasNaoEfetivasError) return { error: consultasNaoEfetivasError.message }
  if (atendimentosResumoError) return { error: atendimentosResumoError.message }
  if (atendimentosError) return { error: atendimentosError.message }
  if (prontuariosError) return { error: prontuariosError.message }
  if (vendasRealizadasError) return { error: vendasRealizadasError.message }
  if (orcamentosPassadosError) return { error: orcamentosPassadosError.message }
  if (vendasConfirmadasError) return { error: vendasConfirmadasError.message }
  if (vendasError) return { error: vendasError.message }

  const atendimentosLista = (atendimentos ?? []) as Array<{
    id: string
    data_agendamento: string
    status: string
    tipo?: string | null
    profissional?: { full_name?: string | null } | { full_name?: string | null }[] | null
  }>
  const atendimentosResumoLista = (atendimentosResumo ?? []) as Array<{
    tipo?: string | null
    status?: string | null
  }>
  const prontuariosLista = (prontuarios ?? []) as Array<{
    atendimento_id: string
    evolucao?: string | null
    escala_dor?: number | null
    procedimentos?: string | null
    observacoes?: string | null
    updated_at?: string | null
    atendimentos?: {
      data_agendamento?: string | null
      tipo?: string | null
      status?: string | null
      profissional?: { full_name?: string | null } | { full_name?: string | null }[] | null
    } | {
      data_agendamento?: string | null
      tipo?: string | null
      status?: string | null
      profissional?: { full_name?: string | null } | { full_name?: string | null }[] | null
    }[] | null
  }>
  const vendasConfirmadasLista = (vendasConfirmadas ?? []) as Array<{
    itens_venda?: Array<{
      quantidade?: number | null
      preco_unitario?: number | null
    }> | null
  }>
  const vendasLista = (vendas ?? []) as Array<{
    id: string
    data_venda: string
    status?: string | null
    origem?: string | null
    profiles?: { full_name?: string | null } | null
    itens_venda?: Array<{
      quantidade?: number | null
      preco_unitario?: number | null
      produtos?: { nome?: string | null } | null
    }> | null
  }>

  const valorTotalVendas = vendasConfirmadasLista.reduce((acc, venda) => {
    const totalVenda = (venda.itens_venda ?? []).reduce((sum, item) =>
      sum + (item.quantidade ?? 0) * (item.preco_unitario ?? 0), 0)
    return acc + totalVenda
  }, 0)
  const statusOrder = [
    'Concluído',
    'Confirmado',
    'Aguardando',
    'Aguardando Consulta',
    'Em Atendimento',
    'Cancelado',
    'Falta',
    'Reagendado',
  ]
  const resumoPorTipoMap = new Map<string, { total: number; statusMap: Map<string, number> }>()

  for (const atendimento of atendimentosResumoLista) {
    const tipo = atendimento.tipo?.trim() || 'Sessão'
    const status = normalizeAtendimentoStatus(atendimento.status)
    const atual = resumoPorTipoMap.get(tipo) ?? { total: 0, statusMap: new Map<string, number>() }

    atual.total += 1
    atual.statusMap.set(status, (atual.statusMap.get(status) ?? 0) + 1)
    resumoPorTipoMap.set(tipo, atual)
  }

  const resumoTipos = Array.from(resumoPorTipoMap.entries())
    .map(([tipo, resumo]) => ({
      tipo,
      total: resumo.total,
      statuses: Array.from(resumo.statusMap.entries())
        .sort((a, b) => {
          const orderA = statusOrder.indexOf(a[0])
          const orderB = statusOrder.indexOf(b[0])
          const posA = orderA === -1 ? Number.MAX_SAFE_INTEGER : orderA
          const posB = orderB === -1 ? Number.MAX_SAFE_INTEGER : orderB
          if (posA !== posB) return posA - posB
          return b[1] - a[1]
        })
        .map(([status, total]) => ({ status, total })),
    }))
    .sort((a, b) => b.total - a.total || a.tipo.localeCompare(b.tipo, 'pt-BR'))

  const evolucoes = prontuariosLista
    .map((prontuario) => {
      const atendimento = Array.isArray(prontuario.atendimentos)
        ? prontuario.atendimentos[0] ?? null
        : prontuario.atendimentos ?? null
      if (!atendimento?.data_agendamento) return null
      const profissional = Array.isArray(atendimento.profissional)
        ? atendimento.profissional[0] ?? null
        : atendimento.profissional ?? null
      const temConteudo = !!(
        prontuario.evolucao?.trim() ||
        prontuario.procedimentos?.trim() ||
        prontuario.observacoes?.trim() ||
        prontuario.escala_dor !== null
      )
      if (!temConteudo) return null
      return {
        atendimento_id: prontuario.atendimento_id,
        data_agendamento: atendimento.data_agendamento,
        tipo: atendimento.tipo ?? null,
        profissional_nome: profissional?.full_name ?? null,
        escala_dor: prontuario.escala_dor ?? null,
        evolucao: prontuario.evolucao ?? null,
        procedimentos: prontuario.procedimentos ?? null,
        observacoes: prontuario.observacoes ?? null,
        updated_at: prontuario.updated_at ?? null,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .slice(0, 4)

  return {
    data: {
      metricas: {
        consultas_total: consultasTotal ?? 0,
        consultas_concluidas: consultasConcluidas ?? 0,
        consultas_nao_efetivas: consultasNaoEfetivas ?? 0,
        vendas_realizadas: vendasRealizadas ?? 0,
        orcamentos_passados: orcamentosPassados ?? 0,
        valor_total_vendas: valorTotalVendas,
      },
      resumo_tipos: resumoTipos,
      consultas: atendimentosLista.map((item) => ({
        id: item.id,
        data_agendamento: item.data_agendamento,
        status: item.status,
        tipo: item.tipo ?? null,
        profissional_nome: Array.isArray(item.profissional)
          ? item.profissional[0]?.full_name ?? null
          : item.profissional?.full_name ?? null,
      })),
      evolucoes,
      comercial: vendasLista.map((venda) => {
        const itens = venda.itens_venda ?? []
        return {
          id: venda.id,
          data_venda: venda.data_venda,
          status: venda.status ?? 'venda_confirmada',
          origem: venda.origem ?? null,
          profissional_nome: venda.profiles?.full_name ?? null,
          total: itens.reduce((sum, item) => sum + (item.quantidade ?? 0) * (item.preco_unitario ?? 0), 0),
          itens_resumo: itens
            .map((item) => item.produtos?.nome?.trim())
            .filter((nome): nome is string => Boolean(nome))
            .slice(0, 3),
        }
      }),
    },
  }
}

export async function deletarAgendamento(id: string): Promise<ResultadoExclusao> {
  const ctx = await requirePermissaoAgendaAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { supabaseAdmin } = ctx

  const { data: atendimento } = await supabaseAdmin
    .from('atendimentos')
    .select('agendamento_id')
    .eq('id', id)
    .maybeSingle()

  const { data: deletedRows, error } = await supabaseAdmin
    .from('atendimentos')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) {
    console.error('Erro ao deletar:', error.message)
    return { error: 'Não foi possível excluir o agendamento.' }
  }

  if (!deletedRows || deletedRows.length === 0) {
    return { error: 'O agendamento não foi removido. Verifique as permissões ou tente atualizar a agenda.' }
  }

  if (atendimento?.agendamento_id) {
    const { count } = await supabaseAdmin
      .from('atendimentos')
      .select('id', { count: 'exact', head: true })
      .eq('agendamento_id', atendimento.agendamento_id)

    if (count === 0) {
      await supabaseAdmin.from('agendamentos').delete().eq('id', atendimento.agendamento_id)
    }
  }

  revalidatePath('/agenda')
  return { success: true }
}

function calcularProximaDataAgenda(
  ultimaDataStr: string,
  dataInicioStr: string,
  diasSemanaStr: string | null,
  frequencia: string
): string | null {
  const toUTC = (s: string) => new Date(`${s.split('T')[0]}T00:00:00Z`)
  const ultimaData = toUTC(ultimaDataStr)

  if (frequencia === 'mes') {
    const next = adicionarMesesPreservandoDiaUTC(ultimaData, 1)
    return next.toISOString().split('T')[0]
  }

  if (!diasSemanaStr) return null

  const diasArray = diasSemanaStr.split(',').map(Number)
  const semanasPulo = parseInt(frequencia)
  const dataInicio = toUTC(dataInicioStr)

  const dataAtual = new Date(ultimaData)
  dataAtual.setUTCDate(dataAtual.getUTCDate() + 1)

  for (let i = 0; i < 365; i++) {
    const dayOfWeek = dataAtual.getUTCDay()
    if (diasArray.includes(dayOfWeek)) {
      if (recorrenciaSemanalAtiva(dataAtual, dataInicio, semanasPulo)) {
        return dataAtual.toISOString().split('T')[0]
      }
    }
    dataAtual.setUTCDate(dataAtual.getUTCDate() + 1)
  }

  return null
}

export async function deletarAtendimentoPontualDaRecorrencia(id: string): Promise<ResultadoExclusao> {
  const ctx = await requirePermissaoAgendaAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { supabaseAdmin } = ctx

  const { data: atual } = await supabaseAdmin
    .from('atendimentos')
    .select('agendamento_id, data_agendamento')
    .eq('id', id)
    .single()

  if (!atual?.agendamento_id) {
    const { data: deletedRows, error } = await supabaseAdmin
      .from('atendimentos')
      .delete()
      .eq('id', id)
      .select('id')
    if (error) return { error: 'Não foi possível excluir o agendamento.' }
    if (!deletedRows || deletedRows.length === 0) {
      return { error: 'O agendamento não foi removido. Verifique as permissões ou tente atualizar a agenda.' }
    }
    revalidatePath('/agenda')
    return { success: true }
  }

  const { data: agendamento } = await supabaseAdmin
    .from('agendamentos')
    .select('frequencia, dias_semana, data_inicio, duracao_minutos, paciente_id, profissional_id, tipo, observacoes, gerou_venda, marcou_retorno, is_recorrente')
    .eq('id', atual.agendamento_id)
    .single()

  const { data: deletedRows, error: deleteError } = await supabaseAdmin
    .from('atendimentos')
    .delete()
    .eq('id', id)
    .select('id')
  if (deleteError) return { error: 'Não foi possível excluir o agendamento.' }
  if (!deletedRows || deletedRows.length === 0) {
    return { error: 'O agendamento não foi removido. Verifique as permissões ou tente atualizar a agenda.' }
  }

  if (agendamento?.is_recorrente && agendamento?.frequencia) {
    const { data: ultimaSessao } = await supabaseAdmin
      .from('atendimentos')
      .select('data_agendamento, numero_sessao, total_sessoes')
      .eq('agendamento_id', atual.agendamento_id)
      .order('data_agendamento', { ascending: false })
      .limit(1)
      .single()

    if (ultimaSessao) {
      const proximaDataStr = calcularProximaDataAgenda(
        ultimaSessao.data_agendamento,
        agendamento.data_inicio,
        agendamento.dias_semana,
        agendamento.frequencia
      )

      if (proximaDataStr) {
        const timeStr = ultimaSessao.data_agendamento.includes('T')
          ? extractTimePart(ultimaSessao.data_agendamento)
          : '00:00:00'
        const novaDataISO = `${proximaDataStr}T${timeStr}`
        const novoNumero = (ultimaSessao.numero_sessao ?? 1) + 1
        const novoTotal = (ultimaSessao.total_sessoes ?? novoNumero - 1) + 1

        const { error: insertError } = await supabaseAdmin.from('atendimentos').insert({
          paciente_id: agendamento.paciente_id,
          profissional_id: agendamento.profissional_id,
          data_agendamento: novaDataISO,
          tipo: agendamento.tipo,
          duracao_minutos: agendamento.duracao_minutos,
          observacoes: agendamento.observacoes,
          status: 'Aguardando',
          agendamento_id: atual.agendamento_id,
          numero_sessao: novoNumero,
          total_sessoes: novoTotal,
          gerou_venda: agendamento.gerou_venda ?? false,
          marcou_retorno: agendamento.marcou_retorno ?? false,
        })

        if (!insertError) {
          await supabaseAdmin
            .from('atendimentos')
            .update({ total_sessoes: novoTotal })
            .eq('agendamento_id', atual.agendamento_id)
        }
      }
    }
  }

  revalidatePath('/agenda')
  revalidatePath('/confirmacoes')
  return { success: true }
}

export async function deletarTodasRecorrencias(agendamentoId: string): Promise<ResultadoExclusao> {
  const ctx = await requirePermissaoAgendaAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { supabaseAdmin } = ctx

  const { error } = await supabaseAdmin
    .from('atendimentos')
    .delete()
    .eq('agendamento_id', agendamentoId)

  if (error) return { error: 'Não foi possível excluir os agendamentos.' }

  await supabaseAdmin.from('agendamentos').delete().eq('id', agendamentoId)

  revalidatePath('/agenda')
  revalidatePath('/confirmacoes')
  return { success: true }
}

export async function buscarAtendimentosPendentesRecorrencia(agendamentoId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('atendimentos')
    .select('id, data_agendamento, numero_sessao, total_sessoes, status')
    .eq('agendamento_id', agendamentoId)
    .neq('status', 'Concluído')
    .order('data_agendamento', { ascending: true })
  if (error) return { error: 'Não foi possível buscar os agendamentos.' }
  return { data: data ?? [] }
}

export async function deletarAtendimentosSelecionados(ids: string[], agendamentoId: string): Promise<ResultadoExclusao> {
  const ctx = await requirePermissaoAgendaAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { supabaseAdmin } = ctx

  const { data: deletedRows, error } = await supabaseAdmin
    .from('atendimentos')
    .delete()
    .in('id', ids)
    .select('id')
  if (error) return { error: 'Não foi possível excluir os agendamentos.' }
  if (!deletedRows || deletedRows.length === 0) {
    return { error: 'Nenhum atendimento foi removido. Verifique as permissões ou tente atualizar a agenda.' }
  }
  const { count } = await supabaseAdmin
    .from('atendimentos')
    .select('id', { count: 'exact', head: true })
    .eq('agendamento_id', agendamentoId)
  if (count === 0) {
    await supabaseAdmin.from('agendamentos').delete().eq('id', agendamentoId)
  }
  revalidatePath('/agenda')
  revalidatePath('/confirmacoes')
  return { success: true }
}

export async function editarAtendimento(id: string, formData: FormData) {
  const supabase = await createClient()

  const profissional_id = formData.get('profissional_id') as string
  const dataStr = formData.get('data') as string
  const horaInicio = formData.get('hora_inicio') as string
  const horaFim = formData.get('hora_fim') as string
  const tipo = formData.get('tipo') as string
  const observacoes = formData.get('observacoes') as string
  const plano_saude = ((formData.get('plano_saude') as string) || '').trim()

  if (!dataStr || !horaInicio || !horaFim) {
    return { error: 'Preencha todos os campos obrigatórios.' }
  }

  if (!profissional_id) {
    return { error: 'Selecione um profissional.' }
  }

  const roleProfissional = await carregarRoleProfissional(profissional_id)
  if (roleProfissional !== 'medico') {
    const disponibilidades = await carregarDisponibilidadesProfissional(profissional_id)
    const disponibilidadesMensais = await carregarDisponibilidadesMensaisProfissional(
      profissional_id,
      dataStr,
      dataStr,
    )
    const erroDisponibilidade = validarOcorrenciasNaDisponibilidade(disponibilidades, disponibilidadesMensais, [
      { data: dataStr, hora_inicio: horaInicio, hora_fim: horaFim },
    ])

    if (erroDisponibilidade) {
      return erroDisponibilidade
    }
  }

  const erroConflito = await validarConflitosProfissional(
    supabase,
    profissional_id,
    [{ data: dataStr, hora_inicio: horaInicio, hora_fim: horaFim }],
    { ignorarAtendimentoId: id },
  )

  if (erroConflito) {
    return erroConflito
  }

  const start = new Date(`1970-01-01T${horaInicio}:00`)
  const end = new Date(`1970-01-01T${horaFim}:00`)
  let duracao = (end.getTime() - start.getTime()) / 60000
  if (duracao <= 0) duracao = 30

  const { data: atendimentoAtual, error: atendimentoAtualError } = await supabase
    .from('atendimentos')
    .select('agendamento_id')
    .eq('id', id)
    .maybeSingle()

  if (atendimentoAtualError) {
    console.error('Erro ao localizar agendamento pai:', atendimentoAtualError.message)
    return { error: 'Não foi possível editar o agendamento.' }
  }

  const { error } = await supabase
    .from('atendimentos')
    .update({
      profissional_id: profissional_id || null,
      data_agendamento: buildAppDateTimeISO(dataStr, horaInicio),
      tipo: tipo || 'Sessão',
      duracao_minutos: duracao,
      observacoes: observacoes || null,
    })
    .eq('id', id)

  if (error) {
    console.error('Erro ao editar:', error.message)
    return { error: 'Não foi possível editar o agendamento.' }
  }

  if (atendimentoAtual?.agendamento_id) {
    const [{ data: agendamentoPai, error: parentLookupError }, { count: totalFilhos, error: filhosError }] = await Promise.all([
      supabase
        .from('agendamentos')
        .select('is_recorrente')
        .eq('id', atendimentoAtual.agendamento_id)
        .maybeSingle(),
      supabase
        .from('atendimentos')
        .select('id', { count: 'exact', head: true })
        .eq('agendamento_id', atendimentoAtual.agendamento_id),
    ])

    if (parentLookupError || filhosError) {
      console.error('Erro ao avaliar sincronização do agendamento pai:', parentLookupError?.message ?? filhosError?.message)
      return { error: 'O atendimento foi atualizado, mas não foi possível validar a sincronização do agendamento.' }
    }

    const deveSincronizarPai = !agendamentoPai?.is_recorrente && (totalFilhos ?? 0) <= 1

    if (deveSincronizarPai) {
      const { error: parentError } = await supabase
        .from('agendamentos')
        .update({
          profissional_id: profissional_id || null,
          tipo: tipo || 'Sessão',
          data_inicio: dataStr,
          hora_inicio: horaInicio,
          hora_fim: horaFim,
          duracao_minutos: duracao,
          observacoes: observacoes || null,
          plano_saude: plano_saude || null,
        })
        .eq('id', atendimentoAtual.agendamento_id)

      if (parentError) {
        console.error('Erro ao editar agendamento pai:', parentError.message)
        return { error: 'O atendimento foi atualizado, mas não foi possível sincronizar o agendamento.' }
      }
    }
  }

  revalidatePath('/agenda')
  return { success: true }
}

export async function mudarStatusAgendamento(id: string, novoStatus: string) {
  const supabase = await createClient()
  const statusKey = getAtendimentoStatusKey(novoStatus)
  if (statusKey === 'desconhecido') {
    return { error: `Status inválido: ${novoStatus}` }
  }

  const statusCanonico = normalizeAtendimentoStatus(novoStatus)

  const { error } = await supabase
    .from('atendimentos')
    .update({ status: statusCanonico })
    .eq('id', id)

  if (error) {
    console.error('Erro ao mudar status:', error.message)
    return { error: `Não foi possível alterar o status para "${statusCanonico}": ${error.message}` }
  }

  revalidatePath('/agenda')
  return { success: true }
}
