import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireModulo } from '@/lib/guard'
import { listarFisioterapeutas } from '@/actions/agenda'
import { getAppDayRangeUTC } from '@/lib/datetime'
import { CardPreConsultaPendente, type PreConsultaPendente } from '@/components/features/pre-consultas/CardPreConsultaPendente'
import { FiltrosPreConsultas } from '@/components/features/pre-consultas/FiltrosPreConsultas'
import { TabelaHistoricoPreConsultas, type HistoricoPreConsulta } from '@/components/features/pre-consultas/TabelaHistoricoPreConsultas'
import { Stethoscope } from 'lucide-react'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

type PacienteRel = { id: string; nome: string; telefone: string | null }

type AtendimentoRow = {
  id: string
  tipo: string
  status: string | null
  created_at: string
  data_agendamento: string | null
  agendamento_origem_id: string | null
  direcao_encaminhamento: 'pre' | 'pos' | null
  profissional: { full_name: string | null } | { full_name: string | null }[] | null
  fisioterapeuta: { full_name: string | null } | { full_name: string | null }[] | null
  paciente: PacienteRel | PacienteRel[] | null
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

const HISTORICO_POR_PAGINA = 20

export default async function PreConsultasPage({ searchParams }: { searchParams: SearchParams }) {
  await requireModulo('pre_consultas')

  const supabase = await createClient()
  const params = await searchParams

  const aba = params.aba === 'historico' ? 'historico' : 'pendentes'
  const busca = ((params.busca as string) || '').trim()
  const medicoId = (params.medico_id as string) || ''
  const fisioId = (params.fisio_id as string) || ''
  const dataInicio = (params.data_inicio as string) || ''
  const dataFim = (params.data_fim as string) || ''
  const paginaRaw = Number(params.pagina)
  const pagina = Number.isFinite(paginaRaw) && paginaRaw > 0 ? Math.floor(paginaRaw) : 1

  const [fisioterapeutas, { data: medicosRaw }] = await Promise.all([
    listarFisioterapeutas(),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'medico')
      .eq('ativo', true)
      .order('full_name'),
  ])

  const medicos = (medicosRaw ?? []).map((m: { id: string; full_name: string | null }) => ({
    id: m.id,
    nome: m.full_name || 'Sem nome',
  }))

  let pacienteIdsBusca: string[] | null = null
  if (busca) {
    const { data: pacientesEncontrados } = await supabase
      .from('pacientes')
      .select('id')
      .ilike('nome', `%${busca}%`)
    pacienteIdsBusca = (pacientesEncontrados ?? []).map((p: { id: string }) => p.id)
  }

  let origemIdsPorMedico: string[] | null = null
  if (medicoId) {
    const { data: origensDoMedico } = await supabase
      .from('atendimentos')
      .select('id')
      .eq('profissional_id', medicoId)
    origemIdsPorMedico = (origensDoMedico ?? []).map((o: { id: string }) => o.id)
  }

  const buscaSemResultado = pacienteIdsBusca !== null && pacienteIdsBusca.length === 0
  const medicoSemResultado = origemIdsPorMedico !== null && origemIdsPorMedico.length === 0
  const filtrosImpossiveis = buscaSemResultado || medicoSemResultado

  let preConsultas: PreConsultaPendente[] = []
  let historico: HistoricoPreConsulta[] = []
  let totalHistorico = 0

  if (!filtrosImpossiveis && aba === 'pendentes') {
    let query = supabase
      .from('atendimentos')
      .select(`
        id,
        tipo,
        created_at,
        agendamento_origem_id,
        direcao_encaminhamento,
        paciente:pacientes(id, nome, telefone)
      `)
      .eq('status', 'Aguardando Fisioterapeuta')

    if (pacienteIdsBusca) query = query.in('paciente_id', pacienteIdsBusca)
    if (origemIdsPorMedico) query = query.in('agendamento_origem_id', origemIdsPorMedico)
    if (fisioId) query = query.or(`profissional_id.eq.${fisioId},fisioterapeuta_id.eq.${fisioId}`)
    if (dataInicio) query = query.gte('created_at', getAppDayRangeUTC(dataInicio).start)
    if (dataFim) query = query.lte('created_at', getAppDayRangeUTC(dataFim).end)

    const { data: pendentes } = await query.order('created_at', { ascending: true })

    const lista = (pendentes ?? []) as Array<{
      id: string
      tipo: string
      created_at: string
      agendamento_origem_id: string | null
      direcao_encaminhamento: 'pre' | 'pos' | null
      paciente: PacienteRel | PacienteRel[] | null
    }>

    const origemIds = [...new Set(lista.map((p) => p.agendamento_origem_id).filter((id): id is string => !!id))]
    const origensMap = new Map<string, { data_agendamento: string; tipo: string | null; profissionalNome: string | null }>()

    if (origemIds.length > 0) {
      const { data: origens } = await supabase
        .from('atendimentos')
        .select('id, data_agendamento, tipo, profissional:profiles!profissional_id(full_name)')
        .in('id', origemIds)

      for (const origem of (origens ?? []) as Array<{
        id: string
        data_agendamento: string
        tipo: string | null
        profissional: { full_name: string | null } | { full_name: string | null }[] | null
      }>) {
        origensMap.set(origem.id, {
          data_agendamento: origem.data_agendamento,
          tipo: origem.tipo,
          profissionalNome: firstRelation(origem.profissional)?.full_name ?? null,
        })
      }
    }

    preConsultas = lista.map((p) => ({
      id: p.id,
      tipo: p.tipo,
      created_at: p.created_at,
      direcao_encaminhamento: p.direcao_encaminhamento,
      paciente: firstRelation(p.paciente),
      origem: p.agendamento_origem_id ? origensMap.get(p.agendamento_origem_id) ?? null : null,
    }))
  }

  if (!filtrosImpossiveis && aba === 'historico') {
    const buildQuery = () => {
      let query = supabase
        .from('atendimentos')
        .select(`
          id,
          tipo,
          status,
          created_at,
          data_agendamento,
          agendamento_origem_id,
          direcao_encaminhamento,
          profissional:profiles!profissional_id(full_name),
          fisioterapeuta:profiles!fisioterapeuta_id(full_name),
          paciente:pacientes(id, nome, telefone)
        `, { count: 'exact' })
        .not('agendamento_origem_id', 'is', null)

      if (pacienteIdsBusca) query = query.in('paciente_id', pacienteIdsBusca)
      if (origemIdsPorMedico) query = query.in('agendamento_origem_id', origemIdsPorMedico)
      if (fisioId) query = query.or(`profissional_id.eq.${fisioId},fisioterapeuta_id.eq.${fisioId}`)
      if (dataInicio) query = query.gte('data_agendamento', getAppDayRangeUTC(dataInicio).start)
      if (dataFim) query = query.lte('data_agendamento', getAppDayRangeUTC(dataFim).end)

      return query
    }

    const offset = (pagina - 1) * HISTORICO_POR_PAGINA
    const { data: historicoRaw, count } = await buildQuery()
      .order('data_agendamento', { ascending: false, nullsFirst: false })
      .range(offset, offset + HISTORICO_POR_PAGINA - 1)

    totalHistorico = count ?? 0
    const lista = (historicoRaw ?? []) as AtendimentoRow[]

    const origemIds = [...new Set(lista.map((item) => item.agendamento_origem_id).filter((id): id is string => !!id))]
    const origensMap = new Map<string, { data_agendamento: string; profissionalNome: string | null }>()

    if (origemIds.length > 0) {
      const { data: origens } = await supabase
        .from('atendimentos')
        .select('id, data_agendamento, profissional:profiles!profissional_id(full_name)')
        .in('id', origemIds)

      for (const origem of (origens ?? []) as Array<{
        id: string
        data_agendamento: string
        profissional: { full_name: string | null } | { full_name: string | null }[] | null
      }>) {
        origensMap.set(origem.id, {
          data_agendamento: origem.data_agendamento,
          profissionalNome: firstRelation(origem.profissional)?.full_name ?? null,
        })
      }
    }

    historico = lista.map((item) => ({
      id: item.id,
      tipo: item.tipo,
      status: item.status,
      direcao_encaminhamento: item.direcao_encaminhamento,
      data_agendamento: item.data_agendamento,
      paciente: firstRelation(item.paciente),
      fisioterapeutaNome: firstRelation(item.fisioterapeuta)?.full_name ?? firstRelation(item.profissional)?.full_name ?? null,
      origem: item.agendamento_origem_id ? origensMap.get(item.agendamento_origem_id) ?? null : null,
    }))
  }

  const totalPos = preConsultas.filter((p) => p.direcao_encaminhamento === 'pos').length
  const totalPaginasHistorico = Math.max(1, Math.ceil(totalHistorico / HISTORICO_POR_PAGINA))

  function buildTabUrl(novaAba: 'pendentes' | 'historico') {
    const query = new URLSearchParams()
    query.set('aba', novaAba)
    if (busca) query.set('busca', busca)
    if (medicoId) query.set('medico_id', medicoId)
    if (fisioId) query.set('fisio_id', fisioId)
    if (dataInicio) query.set('data_inicio', dataInicio)
    if (dataFim) query.set('data_fim', dataFim)
    return `/pre-consultas?${query.toString()}`
  }

  function buildPaginaUrl(novaPagina: number) {
    const query = new URLSearchParams()
    query.set('aba', 'historico')
    if (busca) query.set('busca', busca)
    if (medicoId) query.set('medico_id', medicoId)
    if (fisioId) query.set('fisio_id', fisioId)
    if (dataInicio) query.set('data_inicio', dataInicio)
    if (dataFim) query.set('data_fim', dataFim)
    query.set('pagina', String(novaPagina))
    return `/pre-consultas?${query.toString()}`
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100">
        <Stethoscope size={22} className="text-[#006b5a] shrink-0" />
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#006b5a]">Pré/Pós-consultas</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {aba === 'pendentes'
              ? `${preConsultas.length} ${preConsultas.length === 1 ? 'pendente' : 'pendentes'} aguardando atribuição de fisioterapeuta${totalPos > 0 ? ` — ${totalPos} ${totalPos === 1 ? 'já é pós-consulta' : 'já são pós-consulta'}` : ''}`
              : `${totalHistorico} ${totalHistorico === 1 ? 'registro encontrado' : 'registros encontrados'}`}
          </p>
        </div>
      </div>

      <div className="inline-flex rounded-2xl bg-[#dee3e3] p-1">
        <Link
          href={buildTabUrl('pendentes')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            aba === 'pendentes' ? 'bg-white text-[#006b5a] shadow-sm' : 'text-[#3d4945] hover:text-[#171d1c]'
          }`}
        >
          Pendentes
        </Link>
        <Link
          href={buildTabUrl('historico')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            aba === 'historico' ? 'bg-white text-[#006b5a] shadow-sm' : 'text-[#3d4945] hover:text-[#171d1c]'
          }`}
        >
          Histórico
        </Link>
      </div>

      <FiltrosPreConsultas
        aba={aba}
        busca={busca}
        medicoId={medicoId}
        fisioId={fisioId}
        dataInicio={dataInicio}
        dataFim={dataFim}
        medicos={medicos}
        fisioterapeutas={fisioterapeutas}
      />

      {aba === 'pendentes' ? (
        preConsultas.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-100 shadow-sm">
            <Stethoscope size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium">Nenhuma pré-consulta pendente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {preConsultas.map((pendente) => (
              <CardPreConsultaPendente key={pendente.id} pendente={pendente} fisioterapeutas={fisioterapeutas} />
            ))}
          </div>
        )
      ) : (
        <>
          <TabelaHistoricoPreConsultas itens={historico} />
          {totalPaginasHistorico > 1 && (
            <div className="flex items-center justify-end gap-1">
              <Link
                href={buildPaginaUrl(pagina - 1)}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  pagina === 1
                    ? 'pointer-events-none bg-slate-100 text-slate-300'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Anterior
              </Link>
              <span className="px-3 py-1.5 text-sm text-slate-500">
                Página {pagina} de {totalPaginasHistorico}
              </span>
              <Link
                href={buildPaginaUrl(pagina + 1)}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  pagina === totalPaginasHistorico
                    ? 'pointer-events-none bg-slate-100 text-slate-300'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Próxima
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
