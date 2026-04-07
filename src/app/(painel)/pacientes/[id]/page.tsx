import { BtnVoltar } from '@/components/features/BtnVoltar'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { FormNovoEvento } from '@/components/features/FormNovoEvento'
import { FormRegistrarAvaliacao } from '@/components/features/FormRegistrarAvaliacao'
import { FormNovaObservacao } from '@/components/features/FormNovaObservacao'
import { FiltrosJornada } from '@/components/features/FiltrosJornada'
import { CartaoAgendamento } from '@/components/features/CartaoAgendamento'
import { Suspense } from 'react'
import { format } from 'date-fns'
import { 
  AlertTriangle, 
  FileText, 
  CalendarClock,
  Megaphone
} from 'lucide-react'

export default async function PacienteDetailsPage({ 
  params,
  searchParams
}: { 
  params: Promise<{ id: string }>,
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
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

  const { data: atendimentos } = await supabase
    .from('atendimentos')
    .select(`*, agendamento:agendamentos(tipo, is_recorrente)`)
    .eq('paciente_id', pacienteId)
    .order('data_agendamento', { ascending: false })

  // Agrupar atendimentos por agendamento_id
  const gruposMap = new Map<string, { agendamento_id: string | null; tipo: string; is_recorrente: boolean; sessoes: any[] }>()

  for (const atend of atendimentos ?? []) {
    const chave = atend.agendamento_id ?? `avulso_${atend.id}`
    if (!gruposMap.has(chave)) {
      gruposMap.set(chave, {
        agendamento_id: atend.agendamento_id ?? null,
        tipo: (atend.agendamento as any)?.tipo ?? atend.tipo ?? 'Sessão',
        is_recorrente: (atend.agendamento as any)?.is_recorrente ?? false,
        sessoes: [],
      })
    }
    gruposMap.get(chave)!.sessoes.push(atend)
  }

  // Ordenar grupos pela data da sessão mais recente
  let grupos = Array.from(gruposMap.values()).sort((a, b) => {
    const dataA = Math.max(...a.sessoes.map(s => new Date(s.data_agendamento).getTime()))
    const dataB = Math.max(...b.sessoes.map(s => new Date(s.data_agendamento).getTime()))
    return dataB - dataA
  })

  // Filtros
  let gruposFiltrados = grupos.filter((grupo) => {
    const matchesBusca = termoBusca
      ? grupo.tipo.toLowerCase().includes(termoBusca.toLowerCase()) ||
        grupo.sessoes.some(s =>
          s.observacoes?.toLowerCase().includes(termoBusca.toLowerCase()) ||
          s.status.toLowerCase().includes(termoBusca.toLowerCase())
        )
      : true

    const matchesStatus = statusFiltro && statusFiltro !== 'todos'
      ? grupo.sessoes.some(s => s.status === statusFiltro)
      : true

    return matchesBusca && matchesStatus
  })

  if (ordemFiltro === 'asc') {
    gruposFiltrados = [...gruposFiltrados].reverse()
  }

  // Para o resumo clínico e última interação, usar atendimentos flat
  const todosAtendimentos = atendimentos ?? []

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

    if (paciente.observacoes_gerais) {
      const obsArray = paciente.observacoes_gerais.split('\n').filter((o: string) => o.trim() !== '');
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

  return (
    <div className="w-full space-y-6">
      
      {/* TopAppBar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <BtnVoltar />
          <h2 className="text-2xl font-bold tracking-tight text-[#006b5a]">Prontuário Digital</h2>
        </div>
        
        <div className="flex items-center gap-2">
           <FormRegistrarAvaliacao pacienteId={paciente.id} />
           <FormNovoEvento pacienteId={paciente.id} />
        </div>
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
                  {paciente.origem || 'Não informada'}
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
                const obsArray = paciente.observacoes_gerais
                  ? paciente.observacoes_gerais.split('\n').filter((o: string) => o.trim() !== '')
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

              {gruposFiltrados.length === 0 ? (
                <div className="text-sm text-slate-500 pl-8">Nenhum evento encontrado para estes filtros.</div>
              ) : (
                gruposFiltrados.map((grupo) => (
                  <CartaoAgendamento
                    key={grupo.agendamento_id ?? grupo.sessoes[0]?.id}
                    grupo={grupo}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}