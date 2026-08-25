'use server'

import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { buildAppDateTimeISO, formatAppDateKey } from '@/lib/datetime'
import {
  normalizarDisponibilidade,
  validarHorarioDisponibilidade,
  type BloqueioHorario,
  type BloqueiosPorDataMap,
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
  TRANSICOES_VALIDAS,
  getPreRequisitoTransicao,
} from '@/lib/atendimento-status'
import { isGestorSistema } from '@/lib/permissoes'
import { criarPastasAtendimentosLote } from '@/actions/google-drive'

function extractTimePart(dateTime: string) {
  const [, timePart = '00:00:00'] = dateTime.split('T')
  return timePart.replace(/([+-]\d{2}:\d{2}|Z)$/, '')
}

type ResultadoExclusao = { success?: true; error?: string }

// Motivo de exclusão obrigatório em todo escopo (US-010 a US-013). A
// categoria e a exigência de observação são validadas no servidor por
// fn_excluir_atendimentos (AC-045, AC-057) — este tipo só descreve o que a
// Server Action repassa para a RPC.
export type MotivoExclusao = {
  categoria: string
  observacao?: string
}

async function requirePermissaoAgendaAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Não autenticado.' as const }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('ativo, nivel_acesso, modulos_liberados, full_name')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.ativo) {
    return { error: 'Usuário inativo.' as const }
  }

  const modulos = profile.modulos_liberados ?? []
  const temModuloAgenda = modulos.length === 0 || modulos.includes('agenda')
  const podeGerirAgendaEquipe = isGestorSistema(profile.nivel_acesso)
  const podeGerirAgenda = temModuloAgenda || podeGerirAgendaEquipe

  if (!podeGerirAgenda) {
    return { error: 'Sem permissão para gerenciar agendamentos.' as const }
  }

  const supabaseAdmin = createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  return {
    supabase,
    supabaseAdmin,
    userId: user.id,
    userNome: profile.full_name ?? null,
    podeGerirAgendaEquipe,
  }
}

// Casca fina sobre fn_excluir_atendimentos (T-035): usuario_id/usuario_nome
// vêm sempre do contexto autenticado, nunca de parâmetro do cliente (RFC
// 003, C3 — AC-056). A função no banco valida motivo, bloqueia "Concluído"
// em qualquer escopo (AC-049, AC-050, AC-052) e grava o log na mesma
// transação da exclusão (AC-046, AC-047, AC-048, AC-051).
async function executarExclusaoTransacional(
  // `any`: `ReturnType<typeof createSupabaseAdminClient>` fixa uma instância
  // genérica do client que não bate estruturalmente com a instância já
  // criada em requirePermissaoAgendaAdmin() (mesma função de fábrica,
  // instanciações genéricas diferentes) — sem arquivo de tipos gerado para
  // Database neste projeto, não há generic comum a fixar aqui.
  supabaseAdmin: any,
  params: {
    ids: string[]
    acao: string
    motivo: MotivoExclusao
    usuarioId: string
    usuarioNome: string | null
  },
): Promise<{ error?: string; excluidos?: number; serieRemovida?: boolean }> {
  // O cliente admin (createSupabaseAdminClient, sem generic de Database) não
  // conhece fn_excluir_atendimentos — não há arquivo de tipos gerado neste
  // projeto para RPCs criadas via SQL Editor. `as never` é o mesmo workaround
  // documentado pelo supabase-js para chamar uma função não presente nos
  // tipos; o retorno é retipado explicitamente logo abaixo.
  const { data, error } = (await supabaseAdmin.rpc('fn_excluir_atendimentos' as never, {
    p_ids: params.ids,
    p_acao: params.acao,
    p_motivo_categoria: params.motivo.categoria,
    p_motivo_observacao: params.motivo.observacao ?? null,
    p_usuario_id: params.usuarioId,
    p_usuario_nome: params.usuarioNome,
  } as never)) as {
    data: Array<{ excluidos: number; serie_removida: boolean }> | null
    error: { code: string; message: string; details?: string } | null
  }

  if (error) {
    console.error(`[fn_excluir_atendimentos] erro (${params.acao}) ids=${params.ids.join(', ')}: [${error.code}] ${error.message}`, error.details ?? '')
    return { error: error.message }
  }

  const resultado = Array.isArray(data) ? data[0] : data

  return {
    excluidos: resultado?.excluidos ?? 0,
    serieRemovida: resultado?.serie_removida ?? false,
  }
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

async function carregarBloqueiosProfissional(
  profissionalId: string,
  dataInicio: string,
  dataFim: string,
) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('jornada_mensal_bloqueio')
    .select('data, hora_inicio, hora_fim')
    .eq('profissional_id', profissionalId)
    .gte('data', dataInicio)
    .lte('data', dataFim)

  const bloqueios = new Map() as BloqueiosPorDataMap
  for (const item of (data ?? []) as { data: string; hora_inicio: string; hora_fim: string }[]) {
    const bloqueio: BloqueioHorario = { hora_inicio: item.hora_inicio, hora_fim: item.hora_fim }
    const doDia = bloqueios.get(item.data) ?? []
    doDia.push(bloqueio)
    bloqueios.set(item.data, doDia)
  }

  return bloqueios
}

function validarOcorrenciasNaDisponibilidade(
  disponibilidades: Map<number, DisponibilidadeDia>,
  disponibilidadesMensais: DisponibilidadeMensalMap,
  ocorrencias: { data: string; hora_inicio: string; hora_fim: string }[],
  bloqueios?: BloqueiosPorDataMap,
) {
  for (const ocorrencia of ocorrencias) {
    const validacao = validarHorarioDisponibilidade(
      disponibilidades,
      ocorrencia.data,
      ocorrencia.hora_inicio,
      ocorrencia.hora_fim,
      disponibilidadesMensais,
      bloqueios?.get(ocorrencia.data),
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
  const ctx = await requirePermissaoAgendaAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { supabaseAdmin, userId, podeGerirAgendaEquipe } = ctx

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
  const slotsLivreJson = (formData.get('slots_livre_json') as string | null) ?? ''
  const slotsLivre: Array<{ data: string; hora_inicio: string; hora_fim: string }> = []
  if (frequencia === 'livre' && slotsLivreJson) {
    try {
      const parsed = JSON.parse(slotsLivreJson) as unknown
      if (Array.isArray(parsed)) {
        for (const s of parsed) {
          if (s && typeof s === 'object' && 'data' in s && 'hora_inicio' in s && 'hora_fim' in s) {
            slotsLivre.push(s as { data: string; hora_inicio: string; hora_fim: string })
          }
        }
      }
    } catch {
      return { error: 'Erro ao processar datas livres.' }
    }
  }
  if (frequencia === 'livre' && slotsLivre.length === 0) {
    return { error: 'Adicione ao menos uma data no modo de datas livres.' }
  }
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

  if (frequencia === 'livre') {
    ocorrencias = slotsLivre.length
  } else if (tiposDoProtocolo.length > 0) {
    ocorrencias = tiposDoProtocolo.length
  }

  if (!paciente_id || !profissional_id || !dataStr || !horaInicio || !horaFim) {
    return { error: 'Preencha todos os campos obrigatórios.' }
  }

  if (!podeGerirAgendaEquipe && profissional_id !== userId) {
    return { error: 'Você só pode criar agendamentos para a sua própria agenda.' }
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
      criado_por: userId,
      gerou_venda,
      marcou_retorno,
      agendamento_id: '',
      data: dataStr,
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      numero_sessao: 1,
      total_sessoes: 1,
    })
  } else if (frequencia === 'livre') {
    // AGENDAMENTO RECORRENTE — DATAS LIVRES
    for (const [index, slot] of slotsLivre.entries()) {
      const slotStart = new Date(`1970-01-01T${slot.hora_inicio}:00`)
      const slotEnd = new Date(`1970-01-01T${slot.hora_fim}:00`)
      let duracaoSlot = (slotEnd.getTime() - slotStart.getTime()) / 60000
      if (duracaoSlot <= 0) duracaoSlot = 30
      atendimentosParaInserir.push({
        paciente_id,
        profissional_id,
        data_agendamento: buildAppDateTimeISO(slot.data, slot.hora_inicio),
        tipo: tiposDoProtocolo[index] ?? tipo,
        duracao_minutos: duracaoSlot,
        observacoes,
        status: 'Aguardando',
        criado_por: userId,
        gerou_venda,
        marcou_retorno,
        agendamento_id: '',
        data: slot.data,
        hora_inicio: slot.hora_inicio,
        hora_fim: slot.hora_fim,
      })
    }
  } else {
    // AGENDAMENTO RECORRENTE — PADRÃO
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
          criado_por: userId, gerou_venda, marcou_retorno, agendamento_id: '',
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
              criado_por: userId, gerou_venda, marcou_retorno, agendamento_id: '',
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
    const [disponibilidadesMensais, bloqueios] = await Promise.all([
      carregarDisponibilidadesMensaisProfissional(
        profissional_id,
        datasOcorrencias[0],
        datasOcorrencias[datasOcorrencias.length - 1],
      ),
      carregarBloqueiosProfissional(
        profissional_id,
        datasOcorrencias[0],
        datasOcorrencias[datasOcorrencias.length - 1],
      ),
    ])
    const erroDisponibilidade = validarOcorrenciasNaDisponibilidade(
      disponibilidades,
      disponibilidadesMensais,
      atendimentosParaInserir.map((a) => ({
        data: a.data,
        hora_inicio: a.hora_inicio,
        hora_fim: a.hora_fim,
      })),
      bloqueios,
    )

    if (erroDisponibilidade) {
      return erroDisponibilidade
    }
  }

  const erroConflito = await validarConflitosProfissional(
    supabaseAdmin,
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

  const { data: agendamentoPai, error: erroAgendamento } = await supabaseAdmin
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
      criado_por: userId,
    })
    .select('id')
    .single()

  if (erroAgendamento || !agendamentoPai) {
    console.error('Erro ao criar agendamento pai:', erroAgendamento?.message)
    return { error: `Erro ao criar agendamento: ${erroAgendamento?.message ?? 'Resposta vazia do banco'}` }
  }

  const { data: atendimentosCriados, error } = await supabaseAdmin
    .from('atendimentos')
    .insert(
      atendimentosParaInserir.map((atendimento) =>
        removerMetadadosDisponibilidade({
          ...atendimento,
          agendamento_id: agendamentoPai.id,
        }),
      ),
    )
    .select('id, data_agendamento, tipo')

  if (error) {
    console.error('Erro ao agendar:', error.message)
    return { error: `Erro ao salvar atendimento(s): ${error.message}` }
  }

  if (atendimentosCriados?.length) {
    void criarPastasAtendimentosLote(atendimentosCriados, paciente_id)
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
      profissional:profiles!profissional_id(full_name, role),
      fisioterapeuta_executor:profiles!fisioterapeuta_id(full_name)
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

export async function deletarAgendamento(id: string, motivo: MotivoExclusao): Promise<ResultadoExclusao> {
  const ctx = await requirePermissaoAgendaAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { supabaseAdmin, userId, userNome } = ctx

  const resultado = await executarExclusaoTransacional(supabaseAdmin, {
    ids: [id],
    acao: 'exclusao_avulso',
    motivo,
    usuarioId: userId,
    usuarioNome: userNome,
  })

  if (resultado.error) {
    return { error: resultado.error }
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

export async function deletarAtendimentoPontualDaRecorrencia(id: string, motivo: MotivoExclusao): Promise<ResultadoExclusao> {
  const ctx = await requirePermissaoAgendaAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { supabaseAdmin, userId, userNome } = ctx

  const { data: atual } = await supabaseAdmin
    .from('atendimentos')
    .select('agendamento_id, data_agendamento')
    .eq('id', id)
    .single()

  const agendamento = atual?.agendamento_id
    ? (
        await supabaseAdmin
          .from('agendamentos')
          .select('frequencia, dias_semana, data_inicio, duracao_minutos, paciente_id, profissional_id, tipo, observacoes, gerou_venda, marcou_retorno, is_recorrente')
          .eq('id', atual.agendamento_id)
          .single()
      ).data
    : null

  const resultado = await executarExclusaoTransacional(supabaseAdmin, {
    ids: [id],
    acao: 'exclusao_sessao_recorrente',
    motivo,
    usuarioId: userId,
    usuarioNome: userNome,
  })

  if (resultado.error) {
    return { error: resultado.error }
  }

  // Reposição da sessão pontual: best-effort, fora da transação da RPC,
  // rodando só depois de a exclusão já estar confirmada (design.md,
  // "Reposição de sessão pontual" — falha aqui não desfaz a exclusão).
  if (atual?.agendamento_id && agendamento?.is_recorrente && agendamento?.frequencia && agendamento.frequencia !== 'livre') {
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

export async function deletarTodasRecorrencias(agendamentoId: string, motivo: MotivoExclusao): Promise<ResultadoExclusao> {
  const ctx = await requirePermissaoAgendaAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { supabaseAdmin, userId, userNome } = ctx

  const { data: atendimentos, error: erroBusca } = await supabaseAdmin
    .from('atendimentos')
    .select('id')
    .eq('agendamento_id', agendamentoId)

  if (erroBusca) {
    console.error(`[deletarTodasRecorrencias] erro ao buscar atendimentos da série ${agendamentoId}: [${erroBusca.code}] ${erroBusca.message}`, erroBusca.details ?? '')
    return { error: 'Não foi possível excluir os agendamentos.' }
  }

  const ids = (atendimentos ?? []).map((a) => a.id)
  if (ids.length === 0) {
    return { error: 'Nenhum agendamento encontrado nessa série.' }
  }

  // Bloqueio de sessões "Concluído" (AC-049, AC-052) e limpeza da linha
  // órfã de `agendamentos` (AC-048) acontecem dentro da própria RPC.
  const resultado = await executarExclusaoTransacional(supabaseAdmin, {
    ids,
    acao: 'exclusao_serie_completa',
    motivo,
    usuarioId: userId,
    usuarioNome: userNome,
  })

  if (resultado.error) {
    return { error: resultado.error }
  }

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

export async function deletarAtendimentosSelecionados(ids: string[], agendamentoId: string, motivo: MotivoExclusao): Promise<ResultadoExclusao> {
  const ctx = await requirePermissaoAgendaAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { supabaseAdmin, userId, userNome } = ctx

  void agendamentoId // linha órfã de `agendamentos` já é limpa dentro da RPC (v_agendamento_ids)

  // Bloqueio de sessões "Concluído" no lote (AC-050) e exclusão do lote
  // pendente com log do escopo (AC-051) acontecem dentro da própria RPC.
  const resultado = await executarExclusaoTransacional(supabaseAdmin, {
    ids,
    acao: 'exclusao_lote',
    motivo,
    usuarioId: userId,
    usuarioNome: userNome,
  })

  if (resultado.error) {
    return { error: resultado.error }
  }

  revalidatePath('/agenda')
  revalidatePath('/confirmacoes')
  return { success: true }
}

export async function editarAtendimento(id: string, formData: FormData) {
  const ctx = await requirePermissaoAgendaAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { supabaseAdmin, userId, podeGerirAgendaEquipe } = ctx

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

  if (!podeGerirAgendaEquipe && profissional_id !== userId) {
    return { error: 'Você só pode editar agendamentos da sua própria agenda.' }
  }

  const roleProfissional = await carregarRoleProfissional(profissional_id)
  if (roleProfissional !== 'medico') {
    const disponibilidades = await carregarDisponibilidadesProfissional(profissional_id)
    const [disponibilidadesMensais, bloqueios] = await Promise.all([
      carregarDisponibilidadesMensaisProfissional(profissional_id, dataStr, dataStr),
      carregarBloqueiosProfissional(profissional_id, dataStr, dataStr),
    ])
    const erroDisponibilidade = validarOcorrenciasNaDisponibilidade(
      disponibilidades,
      disponibilidadesMensais,
      [{ data: dataStr, hora_inicio: horaInicio, hora_fim: horaFim }],
      bloqueios,
    )

    if (erroDisponibilidade) {
      return erroDisponibilidade
    }
  }

  const erroConflito = await validarConflitosProfissional(
    supabaseAdmin,
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

  const { data: atendimentoAtual, error: atendimentoAtualError } = await supabaseAdmin
    .from('atendimentos')
    .select('agendamento_id, profissional_id')
    .eq('id', id)
    .maybeSingle()

  if (atendimentoAtualError) {
    console.error('Erro ao localizar agendamento pai:', atendimentoAtualError.message)
    return { error: 'Não foi possível editar o agendamento.' }
  }

  if (!podeGerirAgendaEquipe && atendimentoAtual?.profissional_id !== userId) {
    return { error: 'Você só pode editar agendamentos da sua própria agenda.' }
  }

  const marcou_retorno = formData.get('marcou_retorno') === 'on'

  const { error } = await supabaseAdmin
    .from('atendimentos')
    .update({
      profissional_id: profissional_id || null,
      data_agendamento: buildAppDateTimeISO(dataStr, horaInicio),
      tipo: tipo || 'Sessão',
      duracao_minutos: duracao,
      observacoes: observacoes || null,
      marcou_retorno,
    })
    .eq('id', id)

  if (error) {
    console.error('Erro ao editar:', error.message)
    return { error: 'Não foi possível editar o agendamento.' }
  }

  if (atendimentoAtual?.agendamento_id) {
    const [{ data: agendamentoPai, error: parentLookupError }, { count: totalFilhos, error: filhosError }] = await Promise.all([
      supabaseAdmin
        .from('agendamentos')
        .select('is_recorrente')
        .eq('id', atendimentoAtual.agendamento_id)
        .maybeSingle(),
      supabaseAdmin
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
      const { error: parentError } = await supabaseAdmin
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
  const ctx = await requirePermissaoAgendaAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { supabaseAdmin, userId, podeGerirAgendaEquipe } = ctx
  const statusKey = getAtendimentoStatusKey(novoStatus)
  if (statusKey === 'desconhecido') {
    return { error: `Status inválido: ${novoStatus}` }
  }

  const statusCanonico = normalizeAtendimentoStatus(novoStatus)

  // Busca status atual para validar transição (e checar permissão de profissional)
  const { data: atendimentoAlvo } = await supabaseAdmin
    .from('atendimentos')
    .select('profissional_id, fisioterapeuta_id, status')
    .eq('id', id)
    .maybeSingle()

  const isResponsavel = atendimentoAlvo?.profissional_id === userId
  const isExecutor = atendimentoAlvo?.fisioterapeuta_id === userId
  if (!podeGerirAgendaEquipe && !isResponsavel && !isExecutor) {
    return { error: 'Você só pode alterar o status dos seus próprios agendamentos.' }
  }

  // Valida transição de fluxo
  const statusAtualKey = getAtendimentoStatusKey(atendimentoAlvo?.status)
  if (statusAtualKey !== 'desconhecido') {
    const validas = TRANSICOES_VALIDAS[statusAtualKey]
    if (!validas.includes(statusKey)) {
      const prereq = getPreRequisitoTransicao(statusAtualKey, statusKey)
      if (prereq) {
        return { error: `Para marcar "${statusCanonico}", passe primeiro por: ${prereq}.` }
      }
      return { error: `Não é possível alterar de "${normalizeAtendimentoStatus(atendimentoAlvo?.status)}" para "${statusCanonico}".` }
    }
  }

  const agora = new Date().toISOString()
  const updatePayload =
    statusKey === 'aguardando_consulta'
      ? { status: statusCanonico, aguardando_desde: agora, em_atendimento_desde: null }
      : statusKey === 'em_atendimento'
      ? { status: statusCanonico, em_atendimento_desde: agora }
      : ['confirmado', 'aguardando'].includes(statusKey)
      ? { status: statusCanonico, aguardando_desde: null, em_atendimento_desde: null }
      // concluido/cancelado/falta/reagendado: congela o contador (em_atendimento_desde = agora)
      // para que o badge mostre "Esperou X" em vez de continuar contando
      : { status: statusCanonico, em_atendimento_desde: agora }

  const { data: updatedRows, error } = await supabaseAdmin
    .from('atendimentos')
    .update(updatePayload)
    .eq('id', id)
    .select('id')

  if (error) {
    console.error('Erro ao mudar status:', error.message)
    return { error: `Não foi possível alterar o status para "${statusCanonico}": ${error.message}` }
  }

  if (!updatedRows || updatedRows.length === 0) {
    return { error: 'O status não foi alterado. Atualize a agenda e tente novamente.' }
  }

  revalidatePath('/agenda')
  return { success: true }
}

export async function buscarSessoesRecorrencia(agendamentoPaiId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { data, error } = await supabase
    .from('atendimentos')
    .select('id, data_agendamento, numero_sessao, total_sessoes, profissional_id, duracao_minutos, status')
    .eq('agendamento_id', agendamentoPaiId)
    .order('data_agendamento', { ascending: true })

  if (error) return { error: 'Não foi possível buscar as sessões.' }
  return { data: data ?? [] }
}

export async function editarSessoesDaSerie(
  updates: { id: string; data: string; hora_inicio: string; hora_fim: string; profissional_id: string }[]
) {
  const ctx = await requirePermissaoAgendaAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { supabaseAdmin } = ctx

  const resultados = await Promise.all(
    updates.map(({ id, data, hora_inicio, hora_fim, profissional_id }) => {
      const start = new Date(`1970-01-01T${hora_inicio}:00`)
      const end = new Date(`1970-01-01T${hora_fim}:00`)
      let duracao = (end.getTime() - start.getTime()) / 60000
      if (duracao <= 0) duracao = 30

      return supabaseAdmin
        .from('atendimentos')
        .update({
          profissional_id: profissional_id || null,
          data_agendamento: buildAppDateTimeISO(data, hora_inicio),
          duracao_minutos: duracao,
        })
        .eq('id', id)
        .then(({ error }) => error)
    })
  )

  const erros = resultados.filter(Boolean).length
  if (erros > 0) return { error: `Não foi possível salvar ${erros} sessão(ões).` }

  revalidatePath('/agenda')
  return { success: true }
}

export async function chamarPaciente(id: string) {
  const ctx = await requirePermissaoAgendaAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { supabaseAdmin } = ctx

  const { error } = await supabaseAdmin
    .from('atendimentos')
    .update({ chamado_em: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/painel')
  return { success: true }
}

export async function listarFisioterapeutas(): Promise<{ id: string; nome: string }[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'fisioterapeuta')
    .eq('ativo', true)
    .order('full_name', { ascending: true })

  return (data ?? []).map(p => ({ id: p.id, nome: p.full_name ?? '' }))
}

export async function atribuirFisioterapeutaAtendimento(
  atendimentoId: string,
  fisioterapeutaId: string | null,
): Promise<{ error?: string }> {
  const ctx = await requirePermissaoAgendaAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { supabaseAdmin } = ctx

  const { error } = await supabaseAdmin
    .from('atendimentos')
    .update({ fisioterapeuta_id: fisioterapeutaId })
    .eq('id', atendimentoId)

  if (error) return { error: error.message }

  revalidatePath('/agenda')
  revalidatePath('/pacientes')
  return {}
}
