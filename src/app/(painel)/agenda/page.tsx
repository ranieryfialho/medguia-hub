import { 
  ChevronLeft, 
  ChevronRight, 
  User, 
  Stethoscope, 
  Hourglass, 
  CalendarCheck, 
  PlusCircle, 
  MoreVertical
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { 
  format, 
  startOfWeek, 
  endOfWeek,
  addDays, 
  subDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  isSameDay, 
  startOfDay, 
  endOfDay,
  parseISO,
  isValid,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameMonth
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

const getStatusConfig = (status: string) => {
  const configs: Record<string, any> = {
    'confirmado': { 
      cardBg: 'bg-[#cce2da]', border: 'border-[#006b5a]', iconText: 'text-[#006b5a]', 
      titleText: 'text-[#00342b]', subText: 'text-[#00342b]/70', badgeBg: 'bg-[#006b5a]', 
      label: 'Confirmado', Icon: User 
    },
    'em_atendimento': { 
      cardBg: 'bg-[#c3e8fd]', border: 'border-[#406375]', iconText: 'text-[#406375]', 
      titleText: 'text-[#083142]', subText: 'text-[#083142]/70', badgeBg: 'bg-[#406375]', 
      label: 'Em Atend.', Icon: Stethoscope 
    },
    'aguardando': { 
      cardBg: 'bg-[#dee3e3]', border: 'border-[#6d7a75]', iconText: 'text-[#6d7a75]', 
      titleText: 'text-[#171d1c]', subText: 'text-[#3d4945]', badgeBg: 'bg-[#6d7a75]', 
      label: 'Aguardando', Icon: Hourglass 
    },
    'default': { 
      cardBg: 'bg-[#dee3e3]', border: 'border-[#3d4945]', iconText: 'text-[#3d4945]', 
      titleText: 'text-[#171d1c]', subText: 'text-[#3d4945]', badgeBg: 'bg-[#3d4945]', 
      label: 'Agendado', Icon: CalendarCheck 
    }
  }
  return configs[status?.toLowerCase()] || configs['default']
}

const HORAS_DIA = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function AgendaPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  
  const params = await searchParams
  const view = typeof params.view === 'string' ? params.view : 'dia'
  const dataParam = typeof params.data === 'string' ? params.data : undefined

  let dataSelecionada = new Date()
  if (dataParam) {
    const dataParseada = parseISO(dataParam)
    if (isValid(dataParseada)) {
      dataSelecionada = dataParseada
    }
  }

  const dataString = format(dataSelecionada, 'yyyy-MM-dd')
  
  let prevDate, nextDate
  if (view === 'mes') {
    prevDate = subMonths(dataSelecionada, 1)
    nextDate = addMonths(dataSelecionada, 1)
  } else if (view === 'semana') {
    prevDate = subWeeks(dataSelecionada, 1)
    nextDate = addWeeks(dataSelecionada, 1)
  } else {
    prevDate = subDays(dataSelecionada, 1)
    nextDate = addDays(dataSelecionada, 1)
  }

  const prevUrl = `?view=${view}&data=${format(prevDate, 'yyyy-MM-dd')}`
  const nextUrl = `?view=${view}&data=${format(nextDate, 'yyyy-MM-dd')}`

  const inicioDaSemana = startOfWeek(dataSelecionada, { weekStartsOn: 0 }) 
  const diasDaSemana = Array.from({ length: 7 }, (_, i) => addDays(inicioDaSemana, i))
  
  const mesAnoAtual = format(dataSelecionada, "MMMM, yyyy", { locale: ptBR })
  const diaFormatadoSelecionado = format(dataSelecionada, "dd MMM", { locale: ptBR })
  const mesAnoLateral = format(dataSelecionada, "MMMM yyyy", { locale: ptBR })

  const inicioDoMes = startOfMonth(dataSelecionada)
  const fimDoMes = endOfMonth(dataSelecionada)
  const diasDoMes = eachDayOfInterval({ start: inicioDoMes, end: fimDoMes })
  const diaDaSemanaInicio = getDay(inicioDoMes)
  const diasVaziosInicio = Array.from({ length: diaDaSemanaInicio }, (_, i) => subDays(inicioDoMes, diaDaSemanaInicio - i)).reverse()
  const todosDiasMes = [...diasVaziosInicio, ...diasDoMes]

  let fetchInicio = startOfDay(dataSelecionada)
  let fetchFim = endOfDay(dataSelecionada)

  if (view === 'semana') {
    fetchInicio = startOfDay(inicioDaSemana)
    fetchFim = endOfDay(endOfWeek(dataSelecionada, { weekStartsOn: 0 }))
  } else if (view === 'mes') {
    fetchInicio = startOfDay(inicioDoMes)
    fetchFim = endOfDay(fimDoMes)
  }

  const { data: agendamentos, error } = await supabase
    .from('agendamentos') 
    .select(`id, data_hora, status, tipo_consulta, pacientes (nome)`)
    .gte('data_hora', fetchInicio.toISOString())
    .lte('data_hora', fetchFim.toISOString())
    .order('data_hora', { ascending: true })

  const agendamentosHoje = agendamentos?.filter(a => isSameDay(new Date(a.data_hora), dataSelecionada)) || []
  const totalAgendamentos = agendamentosHoje.length
  const atendidos = agendamentosHoje.filter(a => a.status === 'concluido').length
  const pendentes = totalAgendamentos - atendidos

  return (
    <div className="space-y-6">
      
      <h2 className="font-bold text-2xl text-[#171d1c]">Agenda de Atendimento</h2>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <div className="col-span-1 lg:col-span-8 space-y-6">
          
          <div className="bg-[#f0f5f4] rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href={prevUrl} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#dee3e3] transition-colors text-[#171d1c]">
                <ChevronLeft size={24} />
              </Link>
              <h3 className="font-extrabold text-2xl text-[#006b5a] tracking-tight capitalize w-48 text-center">
                {mesAnoAtual}
              </h3>
              <Link href={nextUrl} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#dee3e3] transition-colors text-[#171d1c]">
                <ChevronRight size={24} />
              </Link>
            </div>
            
            <div className="flex bg-[#dee3e3] p-1 rounded-full">
              <Link 
                href={`?view=dia&data=${dataString}`}
                className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${view === 'dia' ? 'bg-white shadow-sm text-[#006b5a]' : 'text-[#3d4945] hover:text-[#171d1c]'}`}
              >
                Dia
              </Link>
              <Link 
                href={`?view=semana&data=${dataString}`}
                className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${view === 'semana' ? 'bg-white shadow-sm text-[#006b5a]' : 'text-[#3d4945] hover:text-[#171d1c]'}`}
              >
                Semana
              </Link>
              <Link 
                href={`?view=mes&data=${dataString}`}
                className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${view === 'mes' ? 'bg-white shadow-sm text-[#006b5a]' : 'text-[#3d4945] hover:text-[#171d1c]'}`}
              >
                Mês
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-4 shadow-sm border border-[#bcc9c4]/30 overflow-hidden min-h-[600px]">

            {view === 'dia' && (
              <>
                <div className="grid grid-cols-7 border-b border-[#bcc9c4]/30 mb-4 pb-4">
                  {diasDaSemana.map((dia) => {
                    const diaNome = format(dia, 'eee', { locale: ptBR })
                    const diaNumero = format(dia, 'd')
                    const isSelecionado = isSameDay(dia, dataSelecionada)
                    return (
                      <Link href={`?view=dia&data=${format(dia, 'yyyy-MM-dd')}`} key={dia.toString()} className="text-center group cursor-pointer block">
                        <p className="text-[10px] font-bold text-[#3d4945] uppercase tracking-tighter mb-1">{diaNome.replace('.', '')}</p>
                        <div className={`w-10 h-10 flex items-center justify-center mx-auto rounded-xl text-lg font-bold transition-colors ${
                          isSelecionado ? 'bg-[#006b5a] text-white shadow-lg shadow-[#006b5a]/30' : 'text-[#bcc9c4] group-hover:bg-[#f0f5f4] group-hover:text-[#171d1c]'
                        }`}>
                          {diaNumero}
                        </div>
                      </Link>
                    )
                  })}
                </div>

                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                  {agendamentosHoje.length > 0 ? (
                    agendamentosHoje.map((agendamento) => {
                      const config = getStatusConfig(agendamento.status)
                      const Icone = config.Icon
                      const hora = format(new Date(agendamento.data_hora), 'HH:mm')
                      const nomePaciente = Array.isArray(agendamento.pacientes) ? agendamento.pacientes[0]?.nome : (agendamento.pacientes as any)?.nome || 'Paciente não identificado'

                      return (
                        <div key={agendamento.id} className="grid grid-cols-[80px_1fr] gap-4 group">
                          <div className="text-sm font-bold text-[#3d4945]/60 flex items-start justify-end pt-2">{hora}</div>
                          <div className="relative py-4 border-t border-dashed border-[#bcc9c4]/50 flex items-center">
                            <div className={`${config.cardBg} border-l-4 ${config.border} p-4 rounded-xl w-full flex items-center justify-between hover:scale-[1.01] transition-transform cursor-pointer`}>
                              <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm ${config.iconText}`}><Icone size={20} /></div>
                                <div>
                                  <p className={`text-sm font-bold ${config.titleText} leading-none`}>{nomePaciente}</p>
                                  <p className={`text-[11px] ${config.subText} mt-1 font-medium italic`}>{agendamento.tipo_consulta}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`px-3 py-1 ${config.badgeBg} text-white text-[10px] font-bold rounded-full uppercase tracking-widest`}>{config.label}</span>
                                <MoreVertical size={18} className={`${config.titleText} opacity-40`} />
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="py-10 text-center text-[#3d4945]/50 text-sm font-medium">Nenhum agendamento para este dia.</div>
                  )}
                  <div className="grid grid-cols-[80px_1fr] gap-4 group">
                    <div className="text-sm font-bold text-[#3d4945]/60 flex items-start justify-end pt-2">--:--</div>
                    <div className="relative py-4 border-t border-dashed border-[#bcc9c4]/50 flex items-center">
                      <div className="w-full h-16 border-2 border-dashed border-[#bcc9c4]/50 rounded-xl flex items-center justify-center text-[#3d4945]/50 hover:bg-[#f0f5f4] transition-colors cursor-pointer">
                        <span className="text-xs font-bold uppercase tracking-widest">+ Disponível para agendamento</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {view === 'semana' && (
              <div className="overflow-x-auto pb-4">
                <div className="min-w-[800px]">
                  <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-2 mb-4 border-b border-[#bcc9c4]/30 pb-4">
                    <div></div>
                    {diasDaSemana.map((dia) => {
                       const isSelecionado = isSameDay(dia, dataSelecionada)
                       return (
                        <div key={dia.toString()} className="text-center">
                          <p className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${isSelecionado ? 'text-[#006b5a]' : 'text-[#3d4945]'}`}>
                            {format(dia, 'eee', { locale: ptBR }).replace('.', '')}
                          </p>
                          <p className={`text-xl font-extrabold ${isSelecionado ? 'text-[#006b5a]' : 'text-[#171d1c]'}`}>
                            {format(dia, 'd')}
                          </p>
                        </div>
                       )
                    })}
                  </div>
                  
                  <div className="space-y-0">
                    {HORAS_DIA.map((horaStr) => {
                      const horaNum = parseInt(horaStr.split(':')[0])
                      return (
                        <div key={horaStr} className="grid grid-cols-[60px_repeat(7,1fr)] gap-2 group min-h-[80px]">
                          <div className="text-xs font-bold text-[#3d4945]/50 text-right pr-2 pt-2 border-t border-dashed border-[#bcc9c4]/30">
                            {horaStr}
                          </div>
                          {diasDaSemana.map((dia) => {
                            const agendamentosNestaHora = agendamentos?.filter(a => {
                              const dataAgendamento = new Date(a.data_hora)
                              return isSameDay(dataAgendamento, dia) && dataAgendamento.getHours() === horaNum
                            }) || []

                            return (
                              <div key={dia.toString()} className="border-t border-l border-dashed border-[#bcc9c4]/30 p-1 relative bg-[#f9fbfb]/50 group-hover:bg-[#f0f5f4]/50 transition-colors">
                                {agendamentosNestaHora.map(agendamento => {
                                  const config = getStatusConfig(agendamento.status)
                                  const nomePaciente = Array.isArray(agendamento.pacientes) ? agendamento.pacientes[0]?.nome : (agendamento.pacientes as any)?.nome || 'Paciente'
                                  const primeiroNome = nomePaciente.split(' ')[0]
                                  return (
                                    <div key={agendamento.id} className={`${config.cardBg} border-l-4 ${config.border} p-2 rounded-lg mb-1 shadow-sm cursor-pointer hover:scale-[1.02] transition-transform`}>
                                      <p className={`text-[10px] font-bold ${config.titleText} truncate`}>{primeiroNome}</p>
                                      <p className={`text-[9px] ${config.subText} truncate`}>{agendamento.tipo_consulta}</p>
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {view === 'mes' && (
              <div className="flex flex-col h-full">
                <div className="grid grid-cols-7 mb-4">
                  {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map(dia => (
                    <div key={dia} className="text-center text-xs font-bold text-[#3d4945] uppercase tracking-wider py-2">
                      {dia}
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-7 gap-3">
                  {todosDiasMes.map((dia, idx) => {
                    const isMesmoMes = isSameMonth(dia, dataSelecionada)
                    const isSelecionado = isSameDay(dia, dataSelecionada)
                    const isHoje = isSameDay(dia, new Date())
                    
                    const agendamentosDoDia = agendamentos?.filter(a => isSameDay(new Date(a.data_hora), dia)) || []
                    const qtdAgendamentos = agendamentosDoDia.length

                    if (!isMesmoMes) {
                      return (
                        <div key={`vazio-${idx}`} className="min-h-[100px] bg-[#f0f5f4]/50 rounded-2xl p-3 opacity-40">
                          <span className="text-sm font-bold text-[#3d4945]">{format(dia, 'd')}</span>
                        </div>
                      )
                    }

                    return (
                      <Link 
                        href={`?view=dia&data=${format(dia, 'yyyy-MM-dd')}`}
                        key={`dia-${idx}`} 
                        className={`min-h-[100px] border border-[#bcc9c4]/30 rounded-2xl p-3 flex flex-col transition-all hover:border-[#006b5a] hover:shadow-md cursor-pointer ${
                          isSelecionado ? 'bg-[#cce2da] border-[#006b5a]/50' : 'bg-white'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className={`text-sm font-bold ${isHoje ? 'bg-[#006b5a] text-white w-6 h-6 flex items-center justify-center rounded-full' : 'text-[#171d1c]'}`}>
                            {format(dia, 'd')}
                          </span>
                          {qtdAgendamentos > 0 && (
                            <span className="text-[10px] font-bold bg-[#f0f5f4] text-[#006b5a] px-2 py-1 rounded-full">
                              {qtdAgendamentos}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex-1 space-y-1 overflow-hidden mt-1">
                          {agendamentosDoDia.slice(0, 3).map(agendamento => {
                             const config = getStatusConfig(agendamento.status)
                             return (
                               <div key={agendamento.id} className={`w-full h-1.5 rounded-full ${config.badgeBg} opacity-80`}></div>
                             )
                          })}
                          {qtdAgendamentos > 3 && (
                            <div className="text-[9px] font-bold text-[#3d4945]/60 pt-1">+ {qtdAgendamentos - 3} mais</div>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

          </div>
        </div>

        <div className="col-span-1 lg:col-span-4 space-y-8">
          
          <div className="bg-gradient-to-br from-[#006b5a] to-[#33a68f] p-6 rounded-3xl shadow-xl shadow-[#006b5a]/20 text-white">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                  {view === 'mes' ? mesAnoAtual : diaFormatadoSelecionado}
                </p>
                <h4 className="text-3xl font-extrabold mt-1">{totalAgendamentos.toString().padStart(2, '0')} <span className="text-lg">Agendamentos</span></h4>
              </div>
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                <CalendarCheck size={24} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/10 p-3 rounded-2xl">
                <p className="text-xs opacity-70">Atendidos</p>
                <p className="text-xl font-bold">{atendidos.toString().padStart(2, '0')}</p>
              </div>
              <div className="bg-white/10 p-3 rounded-2xl">
                <p className="text-xs opacity-70">Pendentes</p>
                <p className="text-xl font-bold">{pendentes.toString().padStart(2, '0')}</p>
              </div>
            </div>
            <button className="w-full bg-white text-[#006b5a] rounded-2xl py-4 mt-6 font-bold flex items-center justify-center gap-2 hover:bg-[#f5faf9] transition-all active:scale-95 shadow-sm">
              <PlusCircle size={20} />
              Novo Agendamento
            </button>
          </div>

          <div className="bg-[#f0f5f4] rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-[#3d4945] uppercase tracking-widest capitalize">{mesAnoLateral}</h4>
              <div className="flex gap-1 text-[#3d4945]">
                <Link href={`?view=${view}&data=${format(subMonths(dataSelecionada, 1), 'yyyy-MM-dd')}`}>
                  <ChevronLeft size={18} className="cursor-pointer hover:text-[#006b5a]" />
                </Link>
                <Link href={`?view=${view}&data=${format(addMonths(dataSelecionada, 1), 'yyyy-MM-dd')}`}>
                  <ChevronRight size={18} className="cursor-pointer hover:text-[#006b5a]" />
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((dia, i) => (
                <span key={`header-${i}`} className="text-[10px] font-bold text-[#3d4945]/60 py-1 uppercase">{dia}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {todosDiasMes.map((dia, i) => {
                const isMesmoMes = isSameMonth(dia, dataSelecionada)
                const isSelecionado = isSameDay(dia, dataSelecionada)
                const diaNumero = format(dia, 'd')
                const linkUrl = `?view=${view}&data=${format(dia, 'yyyy-MM-dd')}`

                if (!isMesmoMes) {
                  return <span key={`vazio-${i}`} className="text-xs font-medium py-2 text-[#3d4945]/40">{diaNumero}</span>
                }

                return (
                  <Link 
                    key={`dia-${i}`} 
                    href={linkUrl}
                    className={`text-xs font-medium py-2 rounded-lg cursor-pointer block transition-colors ${
                      isSelecionado 
                        ? 'bg-[#006b5a] text-white font-bold shadow-md shadow-[#006b5a]/20' 
                        : 'hover:bg-white text-[#171d1c]'
                    }`}
                  >
                    {diaNumero}
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="bg-white border border-[#bcc9c4]/30 rounded-3xl p-6 shadow-sm">
            <h4 className="text-xs font-bold text-[#3d4945] uppercase tracking-widest mb-4">Legenda de Status</h4>
            <ul className="space-y-3">
              {[
                { cor: 'bg-[#006b5a]', label: 'Confirmado' },
                { cor: 'bg-[#6d7a75]', label: 'Aguardando' },
                { cor: 'bg-[#406375]', label: 'Em Atendimento' },
                { cor: 'bg-[#4f625d]', label: 'Concluído' },
                { cor: 'bg-[#ba1a1a]', label: 'Cancelado' },
                { cor: 'bg-[#3d4945]', label: 'Falta' },
                { cor: 'bg-[#779aad]', label: 'Reposição' },
              ].map((item, i) => (
                <li key={`legenda-${i}`} className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${item.cor}`}></span>
                  <span className="text-sm font-semibold text-[#3d4945]">{item.label}</span>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </div>
  )
}