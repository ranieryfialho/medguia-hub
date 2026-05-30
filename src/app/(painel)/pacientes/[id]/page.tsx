import { BtnVoltar } from '@/components/features/shared'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { FormNovaObservacao } from '@/components/features/prontuarios'
import { FiltrosJornada } from '@/components/features/configuracoes'
import { CartaoAgendamento } from '@/components/features/agenda'
import { CartaoVenda, type VendaTimeline } from '@/components/features/vendas'
import { BtnGerarPdfProntuario } from '@/components/features/shared'
import { requireModulo } from '@/lib/guard'
import { Suspense } from 'react'
import { format } from 'date-fns'
import { buscarProntuariosPorPaciente } from '@/actions/prontuarios'
import { extrairMetadataInativacao } from '@/lib/paciente-inativacao'
import { buildSessaoEfetivaMap } from '@/lib/sessoes'
import {
  AlertTriangle,
  FileText,
  CalendarClock,
  Megaphone
} from 'lucide-react'
import { getAtendimentoStatusKey } from '@/lib/atendimento-status'

// Deriva o status dominante do grupo — mesma lógica de CartaoAgendamento
function getStatusGeralGrupo(sessoes: { status: string }[]): string {
  const contagem: Record<string, number> = {}
  for (const s of sessoes) {
    const key = getAtendimentoStatusKey(s.status)
    contagem[key] = (contagem[key] || 0) + 1
  }
  const ordem = ['em_atendimento', 'aguardando_consulta', 'aguardando', 'confirmado', 'concluido', 'falta', 'reagendado', 'cancelado']
  for (const status of ordem) {
    if (contagem[status]) return status
  }
  return 'desconhecido'
}

const PENDENTE_KEYS = new Set(['em_atendimento', 'aguardando_consulta', 'aguardando', 'confirmado'])

function formatarOrigemPaciente(origem: string | null | undefined) {
  if (!origem) return 'Não informada'

  const [origemBase = '', segundoNivel = '', ...resto] = origem.split('::')
  const baseNormalizada = origemBase.trim().toLowerCase()

  if (baseNormalizada === 'facebook') {
    return ['Facebook', segundoNivel].filter(Boolean).join(' > ')
  }

  if (baseNormalizada !== 'meta') return origem

  const canal = segundoNivel.trim()
  if (canal.toLowerCase() === 'facebook') {
    return ['Facebook', resto.join('::')].filter(Boolean).join(' > ')
  }
  if (canal.toLowerCase() === 'instagram') {
    return 'Instagram'
  }

  return ['Meta', canal, resto.join('::')].filter(Boolean).join(' > ')
}

export default async function PacienteDetailsPage({ 
  params,
  searchParams
}: { 
  params: Promise<{ id: string }>,
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  await requireModulo('pacientes')

  const supabase = await createClient()
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  
  const pacienteId = resolvedParams.id
  const termoBusca = resolvedSearchParams.q as string | undefined
  const statusFiltro = resolvedSearchParams.status as string | undefined
  const ordemFiltro = resolvedSearchParams.ordem as string | undefined

  const { data: paciente, error } = await supabase
    .from('pacientes')
    .select('*')
    .eq('id', pacienteId)
    .single()

  if (error || !paciente) notFound()

  type ProntuarioResumo = {
    queixa_principal: string | null
    evolucao: string | null
    procedimentos: string | null
    escala_dor: number | null
    observacoes: string | null
    updated_at: string | null
  }

  type AtendimentoComRelacoes = {
    id: string
    agendamento_id: string | null
    data_agendamento: string
    status: string
    numero_sessao?: number | null
    total_sessoes?: number | null
    numero_sessao_tipo?: number | null
    total_sessoes_tipo?: number | null
    tipo?: string | null
    observacoes?: string | null
    profissional?: { full_name?: string | null } | null
    agendamento?: { tipo?: string | null; is_recorrente?: boolean | null; plano_saude?: string | null } | null
  }

  const [{ data: atendimentos }, prontuariosRaw, { data: vendasRaw }] = await Promise.all([
    supabase
      .from('atendimentos')
      .select(`*, agendamento:agendamentos(tipo, is_recorrente, plano_saude), profissional:profiles!profissional_id(full_name)`)
      .eq('paciente_id', pacienteId)
      .order('data_agendamento', { ascending: false })
      .order('created_at', { ascending: false }),
    buscarProntuariosPorPaciente(pacienteId),
    supabase
      .from('vendas')
      .select(`
        id,
        origem,
        status,
        medico_referenciador_nome,
        data_venda,
        observacoes,
        profiles:profissional_id(full_name),
        itens_venda(id, quantidade, preco_unitario, numero_atendimentos, produtos(nome))
      `)
      .eq('paciente_id', pacienteId)
      .order('data_venda', { ascending: false }),
  ])

  const prontuarios = prontuariosRaw.map((p) => ({
    atendimento_id: p.atendimento_id,
    queixa_principal: p.queixa_principal,
    evolucao: p.evolucao,
    procedimentos: p.procedimentos,
    escala_dor: p.escala_dor,
    observacoes: p.observacoes,
    updated_at: p.updated_at,
  }))

  const prontuariosMap = new Map(
    prontuarios.map((p) => [p.atendimento_id, p])
  )

  const atendimentosComProntuario = (atendimentos ?? []) as AtendimentoComRelacoes[]
  const agendamentoIds = [...new Set(
    atendimentosComProntuario
      .filter((atend) => !!atend.agendamento_id)
      .map((atend) => atend.agendamento_id) as string[],
  )]
  let sessaoEfetivaMap = new Map<string, {
    sessao_efetiva: number
    total_efetivo: number
    sessao_tipo_efetiva: number
    total_tipo_efetivo: number
  }>()

  if (agendamentoIds.length > 0) {
    const { data: todasSessoes } = await supabase
      .from('atendimentos')
      .select('id, agendamento_id, data_agendamento, status, tipo')
      .in('agendamento_id', agendamentoIds)

    if (todasSessoes) {
      sessaoEfetivaMap = buildSessaoEfetivaMap(todasSessoes)
    }
  }

  const vendas = (vendasRaw ?? []) as unknown as VendaTimeline[]
  const metadataInativacao = extrairMetadataInativacao(paciente.observacoes_gerais)
  const observacoesGeraisLimpa = metadataInativacao.observacoesLimpa

  // Agrupar atendimentos por agendamento_id
  const atendimentoIds = atendimentosComProntuario.map(a => a.id)
  const pastaUrlMap = new Map<string, string>()

  if (atendimentoIds.length > 0) {
    const { data: pastasData } = await supabase
      .from('atendimento_pastas_drive')
      .select('atendimento_id, google_drive_folder_url')
      .in('atendimento_id', atendimentoIds)

    if (pastasData) {
      for (const pasta of pastasData) {
        pastaUrlMap.set(pasta.atendimento_id, pasta.google_drive_folder_url)
      }
    }
  }

  const gruposMap = new Map<string, {
    agendamento_id: string | null
    tipo: string
    plano_saude: string | null
    is_recorrente: boolean
    sessoes: Array<AtendimentoComRelacoes & { prontuario: ProntuarioResumo | null; google_drive_pasta_url: string | null }>
  }>()

  for (const atend of atendimentosComProntuario) {
    const prontuario = prontuariosMap.get(atend.id) ?? null
    const chave = atend.agendamento_id ?? `avulso_${atend.id}`
    if (!gruposMap.has(chave)) {
      gruposMap.set(chave, {
        agendamento_id: atend.agendamento_id ?? null,
        tipo: atend.agendamento?.tipo ?? atend.tipo ?? 'Sessão',
        plano_saude: atend.agendamento?.plano_saude ?? null,
        is_recorrente: atend.agendamento?.is_recorrente ?? false,
        sessoes: [],
      })
    }
    gruposMap.get(chave)!.sessoes.push({
      ...atend,
      numero_sessao: sessaoEfetivaMap.get(atend.id)?.sessao_efetiva ?? atend.numero_sessao ?? null,
      total_sessoes: sessaoEfetivaMap.get(atend.id)?.total_efetivo ?? atend.total_sessoes ?? null,
      numero_sessao_tipo: sessaoEfetivaMap.get(atend.id)?.sessao_tipo_efetiva ?? atend.numero_sessao_tipo ?? null,
      total_sessoes_tipo: sessaoEfetivaMap.get(atend.id)?.total_tipo_efetivo ?? atend.total_sessoes_tipo ?? null,
      prontuario,
      google_drive_pasta_url: pastaUrlMap.get(atend.id) ?? null,
    })
  }

  // Ordenar grupos pela data da sessão mais recente
  const grupos = Array.from(gruposMap.values()).sort((a, b) => {
    const dataA = Math.max(...a.sessoes.map(s => new Date(s.data_agendamento).getTime()))
    const dataB = Math.max(...b.sessoes.map(s => new Date(s.data_agendamento).getTime()))
    return dataB - dataA
  })

  // Filtros
  const gruposFiltrados = grupos.filter((grupo) => {
    const matchesBusca = termoBusca
      ? grupo.tipo.toLowerCase().includes(termoBusca.toLowerCase()) ||
        grupo.sessoes.some(s =>
          s.observacoes?.toLowerCase().includes(termoBusca.toLowerCase()) ||
          s.status.toLowerCase().includes(termoBusca.toLowerCase())
        )
      : true

    const matchesStatus = statusFiltro && statusFiltro !== 'todos'
      ? statusFiltro === 'pendente'
        ? PENDENTE_KEYS.has(getStatusGeralGrupo(grupo.sessoes))
        : getStatusGeralGrupo(grupo.sessoes) === statusFiltro
      : true

    return matchesBusca && matchesStatus
  })

  // Filtrar vendas — ocultar quando há filtro de status de agendamento ativo
  const mostrarVendas = !statusFiltro || statusFiltro === 'todos'
  const vendasFiltradas = mostrarVendas
    ? termoBusca
      ? vendas.filter(v =>
          v.origem?.toLowerCase().includes(termoBusca.toLowerCase()) ||
          v.observacoes?.toLowerCase().includes(termoBusca.toLowerCase())
        )
      : vendas
    : []

  type EventoUnificado =
    | { tipo: 'agendamento'; dataRef: number; grupo: (typeof gruposFiltrados)[0] }
    | { tipo: 'venda'; dataRef: number; venda: VendaTimeline }

  const eventosUnificados: EventoUnificado[] = [
    ...gruposFiltrados.map(grupo => ({
      tipo: 'agendamento' as const,
      dataRef: Math.max(...grupo.sessoes.map(s => new Date(s.data_agendamento).getTime())),
      grupo,
    })),
    ...vendasFiltradas.map(venda => ({
      tipo: 'venda' as const,
      dataRef: new Date(venda.data_venda).getTime(),
      venda,
    })),
  ]

  eventosUnificados.sort((a, b) =>
    ordemFiltro === 'asc' ? a.dataRef - b.dataRef : b.dataRef - a.dataRef
  )

  // Para o resumo clínico e última interação, usar atendimentos flat
  const todosAtendimentos = atendimentosComProntuario

  const calcularIdade = (dataNascimento: string | null) => {
    if (!dataNascimento) return '--'
    const hoje = new Date()
    const nascimento = new Date(dataNascimento)
    let idade = hoje.getFullYear() - nascimento.getFullYear()
    const m = hoje.getMonth() - nascimento.getMonth()
    if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) idade--
    return idade
  }

  const gerarResumoClinico = () => {
    let trechoEventos = 'Paciente recém-cadastrado, ainda sem histórico na jornada de eventos.';
    let trechoObs = '';

    if (todosAtendimentos.length > 0) {
      const statusMaisRecente = todosAtendimentos[0].status.replace(/_/g, ' ');
      trechoEventos = `Paciente possui histórico de ${todosAtendimentos.length} sessão(ões) registrada(s). Última com status "${statusMaisRecente}".`;
    }

    if (observacoesGeraisLimpa) {
      const obsArray = observacoesGeraisLimpa.split('\n').filter((o: string) => o.trim() !== '');
      if (obsArray.length > 0) {
        const ultimaObs = obsArray[obsArray.length - 1];
        const obsLimpa = ultimaObs.replace(/^[•\-]\s*/, '').replace(/^\[.*?\]\s*/, '').trim();
        trechoObs = ` Última nota clínica apontada: "${obsLimpa}".`;
      }
    }

    return `${trechoEventos}${trechoObs}`;
  }

  const iniciais = paciente.nome.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()
  const isAtivo = paciente.ativo !== false
  const origemFormatada = formatarOrigemPaciente(paciente.origem)

  const pdfInput = {
    paciente: {
      nome: paciente.nome,
      cpf: paciente.cpf ?? null,
      data_nascimento: paciente.data_nascimento ?? null,
      convenio: paciente.convenio ?? null,
      origem: origemFormatada,
      observacoes_gerais: observacoesGeraisLimpa || null,
      ativo: isAtivo,
    },
    sessoesParaPdf: todosAtendimentos.map((a) => ({
      id: a.id,
      data_agendamento: a.data_agendamento,
      status: a.status,
      tipo: a.agendamento?.tipo ?? a.tipo ?? 'Sessão',
      is_recorrente: a.agendamento?.is_recorrente ?? false,
      observacoes: a.observacoes ?? null,
    })),
    vendasParaPdf: vendas.map((v) => ({
      id: v.id,
      data_venda: v.data_venda,
      origem: v.origem ?? '',
      medico_referenciador_nome: v.medico_referenciador_nome ?? null,
      observacoes: v.observacoes ?? null,
      profissional_nome: v.profiles?.full_name ?? null,
      itens: v.itens_venda.map((item) => ({
        nome: item.produtos?.nome ?? 'Produto',
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
      })),
    })),
  }

  return (
    <div className="w-full space-y-6">

      {/* TopAppBar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <BtnVoltar />
          <h2 className="text-2xl font-bold tracking-tight text-[#006b5a]">Prontuário Digital</h2>
        </div>

        <BtnGerarPdfProntuario {...pdfInput} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        
        <div className="col-span-1 lg:col-span-3 space-y-6">
          
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-4">
                <div className="w-28 h-28 rounded-3xl bg-[#006b5a] flex items-center justify-center text-3xl font-bold text-white shadow-xl">
                  {iniciais}
                </div>
                {isAtivo ? (
                  <span className="absolute bottom-[-4px] right-[-4px] w-5 h-5 bg-[#25D366] border-4 border-white rounded-full"></span>
                ) : (
                  <span className="absolute bottom-[-4px] right-[-4px] w-5 h-5 bg-red-500 border-4 border-white rounded-full"></span>
                )}
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 leading-tight">{paciente.nome}</h3>
              <p className="text-slate-500 text-sm font-medium mt-1 mb-4">CPF: {paciente.cpf || 'Não informado'}</p>
              
              <div className="grid grid-cols-2 gap-3 w-full">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold block mb-1">Idade</span>
                  <p className="text-slate-900 text-sm font-semibold">{calcularIdade(paciente.data_nascimento)} Anos</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold block mb-1">Convênio</span>
                  <p className="text-slate-900 text-sm font-semibold capitalize truncate" title={paciente.convenio || 'Particular'}>
                    {paciente.convenio || 'Particular'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 mb-4 text-[#006b5a]">
              <FileText size={18} />
              <h4 className="font-bold text-base">Resumo Clínico</h4>
            </div>
            
            <p className="text-sm text-slate-600 leading-relaxed mb-6 whitespace-pre-wrap">
              {gerarResumoClinico()}
            </p>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-emerald-100">
                <div className="flex items-center gap-3">
                  <CalendarClock size={16} className="text-[#33A68F]" />
                  <span className="text-xs font-medium text-slate-600">Última Interação</span>
                </div>
                <span className="text-xs font-bold text-[#006b5a]">
                  {todosAtendimentos.length > 0
                    ? format(new Date(todosAtendimentos[0].data_agendamento), "dd/MM/yyyy")
                    : 'Sem registros'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-emerald-100">
                <div className="flex items-center gap-3">
                  <Megaphone size={16} className="text-[#33A68F]" />
                  <span className="text-xs font-medium text-slate-600">Origem / Captação</span>
                </div>
                <span className="text-xs font-bold text-[#006b5a] capitalize">
                  {origemFormatada}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-5 border-l-4 border-[#006b5a]">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <AlertTriangle size={16} className="text-[#006b5a]" />
                Observações Críticas
              </h4>
              <FormNovaObservacao pacienteId={paciente.id} />
            </div>

            <ul className="space-y-3 text-xs text-slate-600 mt-2">
              {(() => {
                const obsArray = observacoesGeraisLimpa
                  ? observacoesGeraisLimpa.split('\n').filter((o: string) => o.trim() !== '')
                  : [];
                
                if (obsArray.length === 0) {
                  return <li className="text-slate-400 italic">Nenhuma observação registrada.</li>;
                }

                return obsArray.map((obs: string, idx: number) => {
                  const textoLimpo = obs.replace(/^•\s*/, '').trim();
                  return (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#006b5a] mt-1 shrink-0"></span>
                      <span className="flex-1 leading-relaxed">{textoLimpo}</span>
                    </li>
                  )
                });
              })()}
            </ul>
          </div>
        </div>

        <div className="col-span-1 lg:col-span-9">
          <div className="flex flex-col h-full bg-white p-6 md:p-8 rounded-xl shadow-sm border border-slate-100">
            
            <Suspense fallback={null}>
              <FiltrosJornada />
            </Suspense>

            <div className="relative pl-4 md:pl-8 mt-2">
              <div className="absolute left-[24px] md:left-[40px] top-4 bottom-4 w-px border-l-2 border-dashed border-slate-200"></div>

              {eventosUnificados.length === 0 ? (
                <div className="text-sm text-slate-500 pl-8">Nenhum evento encontrado para estes filtros.</div>
              ) : (
                eventosUnificados.map(evento =>
                  evento.tipo === 'agendamento' ? (
                    <CartaoAgendamento
                      key={evento.grupo.agendamento_id ?? evento.grupo.sessoes[0]?.id}
                      grupo={evento.grupo}
                    />
                  ) : (
                    <CartaoVenda
                      key={evento.venda.id}
                      venda={evento.venda}
                    />
                  )
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
