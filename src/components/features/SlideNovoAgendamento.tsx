'use client'

import { useState, useEffect, useId, useRef } from 'react'
import { buscarDetalhesAgendamento, criarAgendamento, editarAtendimento } from '@/actions/agenda'
import { createClient } from '@/lib/supabase/client'
import { X, CalendarPlus, User, Minus, Plus, Search, Clock } from 'lucide-react'
import { format } from 'date-fns'
import {
  horarioDentroDaDisponibilidade,
  obterDisponibilidadeDoDia,
  type DisponibilidadeDia,
} from '@/lib/disponibilidade'
import { formatarFaixasJornada } from '@/lib/jornada'

type Paciente = { id: string, nome: string }
type Profissional = { id: string, nome: string, cargo: string }

async function fetchAllPacientes(
  supabase: ReturnType<typeof createClient>,
): Promise<Paciente[]> {
  const SIZE = 1000
  const acc: Paciente[] = []
  let page = 0
  while (true) {
    const { data } = await supabase
      .from('pacientes')
      .select('id, nome')
      .eq('ativo', true)
      .order('nome')
      .range(page * SIZE, (page + 1) * SIZE - 1)
    if (!data?.length) break
    acc.push(...data)
    if (data.length < SIZE) break
    page++
  }
  return acc
}

interface AtendimentoParaEditar {
  id: string
  paciente_id: string
  profissional_id?: string | null
  data_agendamento: string
  duracao_minutos?: number | null
  tipo: string
  observacoes?: string | null
}

interface SlideProps {
  pacientes?: Paciente[]
  profissionais: Profissional[]
  disponibilidades?: Record<string, Record<number, DisponibilidadeDia>>
  controlledOpen?: boolean
  onControlledClose?: () => void
  defaultPacienteId?: string
  defaultData?: string // 'yyyy-MM-dd' — pré-preenche a data e o campo de hora se combinado com defaultHora
  defaultHora?: string // 'HH:mm' — pré-preenche o horário de início
  atendimentoParaEditar?: AtendimentoParaEditar
}

const DIAS_SEMANA = [
  { val: 1, label: 'Seg' }, { val: 2, label: 'Ter' }, { val: 3, label: 'Qua' },
  { val: 4, label: 'Qui' }, { val: 5, label: 'Sex' }, { val: 6, label: 'Sáb' }, { val: 0, label: 'Dom' },
]

export function SlideNovoAgendamento({ pacientes: pacientesInicial, profissionais, disponibilidades, controlledOpen, onControlledClose, defaultPacienteId, defaultData, defaultHora, atendimentoParaEditar }: SlideProps) {
  const isControlled = controlledOpen !== undefined
  const modoEdicao = !!atendimentoParaEditar
  const formId = useId()
  const [supabase] = useState(createClient)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingPacientes, setLoadingPacientes] = useState(false)
  const [loadingDetalhesAtendimento, setLoadingDetalhesAtendimento] = useState(false)
  const [error, setError] = useState('')
  const [pacientes, setPacientes] = useState<Paciente[]>(pacientesInicial ?? [])

  const [dataAgendamento, setDataAgendamento] = useState('')
  const diaDoMes = dataAgendamento ? dataAgendamento.split('-')[2] : '--'
  const [selectedPacienteId, setSelectedPacienteId] = useState(defaultPacienteId ?? '')
  const [pacienteSearch, setPacienteSearch] = useState('')
  const [pacienteDropdownOpen, setPacienteDropdownOpen] = useState(false)
  const comboboxRef = useRef<HTMLDivElement>(null)
  const [selectedProfissionalId, setSelectedProfissionalId] = useState('')
  const [selectedTipo, setSelectedTipo] = useState('FOT Fisioterapia')
  const [horaInicioValue, setHoraInicioValue] = useState('')
  const [horaFimValue, setHoraFimValue] = useState('')
  const [observacoesValue, setObservacoesValue] = useState('')

  // Estados da Recorrência
  const [isRecorrente, setIsRecorrente] = useState(false)
  const [frequencia, setFrequencia] = useState('1')
  const [diasSelecionados, setDiasSelecionados] = useState<number[]>([])
  const [terminaEm, setTerminaEm] = useState<'data' | 'ocorrencias' | 'sem_fim'>('sem_fim')
  const [ocorrencias, setOcorrencias] = useState('1')
  const precisaCarregarDetalhesEdicao = Boolean(
    atendimentoParaEditar &&
    (atendimentoParaEditar.duracao_minutos == null || atendimentoParaEditar.observacoes == null),
  )

  // Inicializa campos quando em modo edição
  useEffect(() => {
    if (atendimentoParaEditar) {
      const dataObj = new Date(atendimentoParaEditar.data_agendamento)
      setSelectedPacienteId(atendimentoParaEditar.paciente_id)
      const pacienteEdit = pacientes.find(p => p.id === atendimentoParaEditar.paciente_id)
      if (pacienteEdit) setPacienteSearch(pacienteEdit.nome)
      setSelectedProfissionalId(atendimentoParaEditar.profissional_id ?? '')
      setDataAgendamento(format(dataObj, 'yyyy-MM-dd'))
      setHoraInicioValue(format(dataObj, 'HH:mm'))
      if (atendimentoParaEditar.duracao_minutos) {
        const fim = new Date(dataObj.getTime() + atendimentoParaEditar.duracao_minutos * 60000)
        setHoraFimValue(format(fim, 'HH:mm'))
      }
      setSelectedTipo(atendimentoParaEditar.tipo ?? 'Consulta Padrão')
      setObservacoesValue(atendimentoParaEditar.observacoes ?? '')
    }
  }, [atendimentoParaEditar, pacientes])

  useEffect(() => {
    if (!atendimentoParaEditar || !precisaCarregarDetalhesEdicao) return

    let active = true
    setLoadingDetalhesAtendimento(true)

    buscarDetalhesAgendamento(atendimentoParaEditar.id).then((result) => {
      if (!active) return
      setLoadingDetalhesAtendimento(false)

      if (!result || 'error' in result || !result.data) return

      const dataObj = new Date(result.data.data_agendamento)
      if (result.data.duracao_minutos) {
        const fim = new Date(dataObj.getTime() + result.data.duracao_minutos * 60000)
        setHoraFimValue(format(fim, 'HH:mm'))
      }
      setObservacoesValue(result.data.observacoes ?? '')
    })

    return () => {
      active = false
    }
  }, [atendimentoParaEditar, precisaCarregarDetalhesEdicao])

  // Fetch de pacientes quando o modal abre (modo controlado ou autônomo)
  useEffect(() => {
    const isOpening = isControlled ? !!controlledOpen : isOpen
    if (!isOpening || pacientes.length > 0) return

    setLoadingPacientes(true)
    fetchAllPacientes(supabase)
      .then(setPacientes)
      .finally(() => setLoadingPacientes(false))
  }, [isControlled, controlledOpen, isOpen, pacientes.length, supabase])

  // Sincroniza estado aberto com prop controlada
  useEffect(() => {
    if (isControlled) {
      setIsOpen(controlledOpen!)
      if (controlledOpen) {
        if (defaultPacienteId) {
          setSelectedPacienteId(defaultPacienteId)
          const p = pacientes.find(p => p.id === defaultPacienteId)
          if (p) setPacienteSearch(p.nome)
        }
        if (defaultData) setDataAgendamento(defaultData)
        if (defaultHora) setHoraInicioValue(defaultHora)
      }
    }
  }, [isControlled, controlledOpen, defaultPacienteId, defaultData, defaultHora, pacientes])

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setPacienteDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const pacientesFiltrados = pacienteSearch
    ? pacientes.filter(p => p.nome.toLowerCase().includes(pacienteSearch.toLowerCase()))
    : pacientes

  function selecionarPaciente(p: Paciente) {
    setSelectedPacienteId(p.id)
    setPacienteSearch(p.nome)
    setPacienteDropdownOpen(false)
  }

  useEffect(() => {
    if (isRecorrente && dataAgendamento && diasSelecionados.length === 0) {
      const dateObj = new Date(`${dataAgendamento}T00:00:00`)
      setDiasSelecionados([dateObj.getDay()])
    }
  }, [isRecorrente, dataAgendamento, diasSelecionados.length])

  const toggleDia = (val: number) => {
    setDiasSelecionados(prev =>
      prev.includes(val) ? prev.filter(d => d !== val) : [...prev, val]
    )
  }

  const ajustarOcorrencias = (delta: number) => {
    const atual = parseInt(ocorrencias) || 1
    const novo = Math.max(1, Math.min(365, atual + delta))
    setOcorrencias(String(novo))
  }

  function handleClose() {
    if (isControlled && onControlledClose) {
      onControlledClose()
    } else {
      setIsOpen(false)
    }
  }

  function resetForm() {
    setIsRecorrente(false)
    setFrequencia('1')
    setDiasSelecionados([])
    setTerminaEm('sem_fim')
    setOcorrencias('1')
    setDataAgendamento('')
    if (!defaultPacienteId) {
      setSelectedPacienteId('')
      setPacienteSearch('')
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)

    let res
    if (modoEdicao && atendimentoParaEditar) {
      res = await editarAtendimento(atendimentoParaEditar.id, formData)
    } else {
      formData.append('is_recorrente', String(isRecorrente))
      if (isRecorrente) {
        formData.append('frequencia', frequencia)
        formData.append('dias_semana', diasSelecionados.join(','))
        formData.append('termina_em', terminaEm)
        formData.append('ocorrencias', ocorrencias)
      }
      res = await criarAgendamento(formData)
    }

    if (res && 'error' in res) {
      setError(res.error)
      setLoading(false)
    } else {
      handleClose()
      setLoading(false)
      if (!modoEdicao) resetForm()
    }
  }

  const disponibilidadeSelecionada = (() => {
    if (!disponibilidades || !selectedProfissionalId || !dataAgendamento) return null
    const profDisp = disponibilidades[selectedProfissionalId]
    if (!profDisp || Object.keys(profDisp).length === 0) return null
    return obterDisponibilidadeDoDia(new Map(Object.entries(profDisp).map(([dia, disp]) => [Number(dia), disp])), dataAgendamento)
  })()

  const horarioPreenchido = Boolean(horaInicioValue && horaFimValue)
  const horarioValidoNaDisponibilidade = Boolean(
    disponibilidadeSelecionada?.disponibilidade &&
    horarioPreenchido &&
    horarioDentroDaDisponibilidade(
      disponibilidadeSelecionada.disponibilidade,
      horaInicioValue,
      horaFimValue,
    ),
  )

  return (
    <>
      {/* Botão trigger — apenas no modo autônomo */}
      {!isControlled && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-full bg-white text-[#006b5a] border-2 border-[#006b5a] rounded-xl py-3 font-bold flex items-center justify-center gap-2 hover:bg-[#f0f5f4] transition-colors"
        >
          <CalendarPlus size={20} />
          <span>Novo Agendamento</span>
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-[500] bg-[#171d1c]/40 backdrop-blur-sm transition-opacity" onClick={handleClose} />
      )}

      <div className={`fixed inset-y-0 right-0 z-[510] w-full max-w-lg bg-white transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0 shadow-2xl' : 'translate-x-full'}`}>

        <div className="px-6 py-5 border-b border-[#bcc9c4]/30 flex items-center justify-between bg-white shrink-0">
          <h2 className="text-xl font-bold text-[#083142]">{modoEdicao ? 'Editar agendamento' : 'Novo agendamento'}</h2>
          <button type="button" onClick={handleClose} className="p-2 border border-[#bcc9c4] text-[#3d4945] hover:bg-[#dee3e3] rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6 scrollbar-thin scrollbar-thumb-slate-200">
          <form id={formId} onSubmit={handleSubmit} className="space-y-6">

            {!modoEdicao && (
              <div className="flex w-full border border-[#bcc9c4]/50 rounded-lg overflow-hidden mb-6">
                <div className="flex-1 text-center py-2 bg-[#f0fcf9] text-[#006b5a] font-medium border-r border-[#bcc9c4]/50">Paciente</div>
                <div className="flex-1 text-center py-2 bg-white text-[#6d7a75] font-medium">Evento</div>
              </div>
            )}

            <div className="space-y-1 relative">
              <label className="text-xs font-semibold text-[#6d7a75] absolute -top-2 left-3 bg-white px-1 z-10">Paciente *</label>
              <div className="relative" ref={comboboxRef}>
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#3d4945]/50">
                  {selectedPacienteId ? <User size={18} /> : <Search size={18} />}
                </div>
                <input
                  type="text"
                  placeholder="Pesquisar paciente pelo nome..."
                  value={pacienteSearch}
                  onChange={e => {
                    setPacienteSearch(e.target.value)
                    setSelectedPacienteId('')
                    setPacienteDropdownOpen(true)
                  }}
                  onFocus={() => setPacienteDropdownOpen(true)}
                  className="w-full bg-white border border-[#bcc9c4] rounded-lg pl-11 pr-4 py-3 text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] transition-all font-medium shadow-sm"
                />
                <input type="hidden" name="paciente_id" value={selectedPacienteId} />

                {pacienteDropdownOpen && (
                  <div className="absolute z-[520] w-full mt-1 bg-white border border-[#bcc9c4] rounded-lg shadow-xl max-h-56 overflow-y-auto">
                    {pacientesFiltrados.length > 0 ? (
                      pacientesFiltrados.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={() => selecionarPaciente(p)}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors font-medium ${
                            selectedPacienteId === p.id
                              ? 'bg-[#f0fcf9] text-[#006b5a]'
                              : 'text-[#171d1c] hover:bg-[#f0f5f4]'
                          }`}
                        >
                          {p.nome}
                        </button>
                      ))
                    ) : (
                      <p className="px-4 py-3 text-sm text-[#6d7a75]">Nenhum paciente encontrado.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1 relative">
              <label className="text-xs font-semibold text-[#6d7a75] absolute -top-2 left-3 bg-white px-1 z-10">Profissional / Serviço *</label>
              <select name="profissional_id" required value={selectedProfissionalId} onChange={e => setSelectedProfissionalId(e.target.value)} className="w-full bg-white border border-[#bcc9c4] rounded-lg px-4 py-3 text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] transition-all font-medium appearance-none shadow-sm">
                <option value="">Selecione uma opção</option>
                {profissionais.map(p => <option key={p.id} value={p.id}>{p.nome} ({p.cargo})</option>)}
              </select>
            </div>

            <div className="space-y-1 relative">
              <label className="text-xs font-semibold text-[#6d7a75] absolute -top-2 left-3 bg-white px-1 z-10">Tipo de atendimento *</label>
              <select name="tipo" required value={selectedTipo} onChange={e => setSelectedTipo(e.target.value)} className="w-full bg-white border border-[#bcc9c4] rounded-lg px-4 py-3 text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 transition-all font-medium appearance-none shadow-sm">
                <option value="FOT Fisioterapia">FOT Fisioterapia</option>
                <option value="FOT Avaliação">FOT Avaliação</option>
                <option value="CTA">CTA</option>
                <option value="Consulta">Consulta</option>
                <option value="Laser">Laser</option>
                <option value="Ondas de Choque">Ondas de Choque</option>
                <option value="Reavaliação">Reavaliação</option>
                <option value="Ativação Base 2026">Ativação Base 2026</option>
              </select>
            </div>

            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-6 space-y-1 relative mt-2">
                <label className="text-xs font-semibold text-[#6d7a75] absolute -top-2 left-3 bg-white px-1 z-10">Data *</label>
                <input
                  type="date"
                  name="data"
                  value={dataAgendamento}
                  onChange={(e) => setDataAgendamento(e.target.value)}
                  required
                  className="w-full bg-white border border-[#bcc9c4] rounded-lg px-4 py-3 text-[#171d1c] focus:ring-2 focus:ring-[#006b5a] transition-all font-medium shadow-sm"
                />
              </div>
              <div className="col-span-3 space-y-1 relative mt-2">
                <label className="text-xs font-semibold text-[#6d7a75] absolute -top-2 left-3 bg-white px-1 z-10">Início *</label>
                <input type="time" name="hora_inicio" required value={horaInicioValue} onChange={e => setHoraInicioValue(e.target.value)} className="w-full bg-white border border-[#bcc9c4] rounded-lg px-3 py-3 text-[#171d1c] focus:ring-2 focus:ring-[#006b5a] transition-all font-medium shadow-sm" />
              </div>
              <div className="col-span-3 space-y-1 relative mt-2">
                <label className="text-xs font-semibold text-[#6d7a75] absolute -top-2 left-3 bg-white px-1 z-10">Fim *</label>
                <input type="time" name="hora_fim" required value={horaFimValue} onChange={e => setHoraFimValue(e.target.value)} className="w-full bg-white border border-[#bcc9c4] rounded-lg px-3 py-3 text-[#171d1c] focus:ring-2 focus:ring-[#006b5a] transition-all font-medium shadow-sm" />
              </div>
            </div>

            {/* Hint de disponibilidade do profissional */}
            {(() => {
              if (!selectedProfissionalId || !dataAgendamento) return null
              const nomeProfissional = profissionais.find(p => p.id === selectedProfissionalId)?.nome ?? 'Profissional'
              const NOMES_DIA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
              const diaSemana = disponibilidadeSelecionada?.diaSemana ?? new Date(`${dataAgendamento}T00:00:00`).getDay()
              const disp = disponibilidadeSelecionada?.disponibilidade ?? null

              if (disponibilidadeSelecionada === null) return null
              if (!disp) {
                return (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-700 font-semibold">
                    <Clock size={13} />
                    {nomeProfissional.split(' ')[0]} não atende às {NOMES_DIA[diaSemana]}s
                  </div>
                )
              }

              const faixas = formatarFaixasJornada(disp)
              return (
                <div className={`px-3 py-2 rounded-lg border text-xs font-semibold ${
                  horarioPreenchido && !horarioValidoNaDisponibilidade
                    ? 'bg-red-50 border-red-300 text-red-700'
                    : 'bg-[#f0fcf9] border-[#006b5a]/20 text-[#006b5a]'
                }`}>
                  <div className="flex items-center gap-2">
                    <Clock size={13} />
                    Disponível: {faixas}
                  </div>
                  {horarioPreenchido && !horarioValidoNaDisponibilidade && (
                    <p className="mt-1">
                      O horário escolhido cruza um período indisponível, como o almoço.
                    </p>
                  )}
                </div>
              )
            })()}

            {/* SEÇÃO DE RECORRÊNCIA */}
            {!modoEdicao && (
            <div className="pt-4 border-t border-[#bcc9c4]/30 space-y-6">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input type="checkbox" className="sr-only peer" checked={isRecorrente} onChange={(e) => setIsRecorrente(e.target.checked)} />
                  <div className="w-11 h-6 bg-[#dee3e3] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#006b5a]"></div>
                </div>
                <span className="font-semibold text-[#083142]">Agendamento recorrente</span>
              </label>

              {isRecorrente && (
                <div className="pl-3 border-l-4 border-[#006b5a]/20 space-y-6 animate-in fade-in slide-in-from-left-2 duration-300">

                  <div className="space-y-1 relative">
                    <label className="text-xs font-semibold text-[#6d7a75] absolute -top-2 left-3 bg-white px-1 z-10">Repetir a cada</label>
                    <select
                      name="frequencia"
                      value={frequencia}
                      onChange={(e) => setFrequencia(e.target.value)}
                      className="w-full bg-white border border-[#bcc9c4] rounded-lg px-4 py-3 text-[#171d1c] shadow-sm appearance-none focus:ring-2 focus:ring-[#006b5a]"
                    >
                      <option value="1">Semana</option>
                      <option value="2">Duas semanas</option>
                      <option value="3">Três semanas</option>
                      <option value="mes">Mês no dia {diaDoMes}</option>
                    </select>
                  </div>

                  {frequencia !== 'mes' && (
                    <div>
                      <label className="text-sm font-semibold text-[#083142] block mb-2">Repetir nos dias</label>
                      <div className="flex flex-wrap gap-2">
                        {DIAS_SEMANA.map((dia) => (
                          <button
                            type="button"
                            key={dia.val}
                            onClick={() => toggleDia(dia.val)}
                            className={`w-11 h-10 rounded-lg text-sm font-bold transition-all border ${
                              diasSelecionados.includes(dia.val)
                                ? 'bg-[#f0fcf9] text-[#006b5a] border-[#006b5a]'
                                : 'bg-white text-[#6d7a75] border-[#bcc9c4] hover:border-[#6d7a75]'
                            }`}
                          >
                            {dia.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-semibold text-[#083142] block mb-3">Termina em:</label>
                    <div className="space-y-4">

                      {/* Opção: Data */}
                      <div className="flex items-center gap-3">
                        <input type="radio" checked={terminaEm === 'data'} onChange={() => setTerminaEm('data')} className="w-4 h-4 text-[#006b5a] focus:ring-[#006b5a] shrink-0" />
                        <div className="relative flex-1 max-w-[180px]">
                          <label className="text-[10px] font-semibold text-[#6d7a75] absolute -top-2 left-3 bg-white px-1 z-10 cursor-default" onClick={() => setTerminaEm('data')}>Data</label>
                          <input type="date" name="data_fim" onClick={() => setTerminaEm('data')} disabled={terminaEm !== 'data'} className="w-full bg-white border border-[#bcc9c4] rounded-lg px-3 py-2 text-sm text-[#171d1c] focus:ring-2 focus:ring-[#006b5a] disabled:opacity-50" />
                        </div>
                      </div>

                      {/* Opção: Ocorrências */}
                      <div className="flex items-center gap-3">
                        <input type="radio" checked={terminaEm === 'ocorrencias'} onChange={() => setTerminaEm('ocorrencias')} className="w-4 h-4 text-[#006b5a] focus:ring-[#006b5a] shrink-0" />
                        <div className="flex items-center gap-3">
                          <div className={`border border-[#bcc9c4] rounded-lg flex items-center justify-between w-[120px] bg-white h-11 transition-opacity ${terminaEm !== 'ocorrencias' ? 'opacity-50' : ''}`}>
                            <button
                              type="button"
                              onClick={() => { setTerminaEm('ocorrencias'); ajustarOcorrencias(-1) }}
                              disabled={terminaEm !== 'ocorrencias'}
                              className="w-10 h-full flex items-center justify-center text-[#6d7a75] hover:bg-[#f0f5f4] disabled:cursor-not-allowed transition-colors rounded-l-lg"
                            >
                              <Minus size={18} strokeWidth={1.5} />
                            </button>
                            <input
                              type="number"
                              name="ocorrencias"
                              value={ocorrencias}
                              onClick={() => setTerminaEm('ocorrencias')}
                              onChange={(e) => setOcorrencias(e.target.value)}
                              onBlur={() => {
                                const num = Math.max(1, Math.min(365, parseInt(ocorrencias) || 1))
                                setOcorrencias(String(num))
                              }}
                              disabled={terminaEm !== 'ocorrencias'}
                              className="flex-1 w-full text-center focus:outline-none bg-transparent disabled:opacity-50 text-base font-medium text-[#171d1c] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0 m-0"
                              min="1"
                              max="365"
                            />
                            <button
                              type="button"
                              onClick={() => { setTerminaEm('ocorrencias'); ajustarOcorrencias(1) }}
                              disabled={terminaEm !== 'ocorrencias'}
                              className="w-10 h-full flex items-center justify-center text-[#6d7a75] hover:bg-[#f0f5f4] disabled:cursor-not-allowed transition-colors rounded-r-lg"
                            >
                              <Plus size={18} strokeWidth={1.5} />
                            </button>
                          </div>
                          <span onClick={() => setTerminaEm('ocorrencias')} className="text-sm font-medium text-[#6d7a75] cursor-pointer hover:text-[#006b5a] transition-colors">
                            atendimentos <span className="font-normal opacity-70">(Limite igual a 365)</span>
                          </span>
                        </div>
                      </div>

                      {/* Opção: Sem Fim */}
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input type="radio" checked={terminaEm === 'sem_fim'} onChange={() => setTerminaEm('sem_fim')} className="w-4 h-4 text-[#006b5a] focus:ring-[#006b5a]" />
                        <span className="text-sm font-semibold text-[#3d4945] group-hover:text-[#006b5a] transition-colors">Sem final definido - Máximo de 12 meses por recorrência</span>
                      </label>
                    </div>
                  </div>

                </div>
              )}
            </div>
            )}

            <div className="space-y-1 relative pt-4">
              <label className="text-xs font-semibold text-[#6d7a75] absolute top-2 left-3 bg-white px-1 z-10">Observações</label>
              <textarea name="observacoes" rows={3} value={observacoesValue} onChange={e => setObservacoesValue(e.target.value)} placeholder="Motivo da consulta, queixas principais..." className="w-full bg-white border border-[#bcc9c4] rounded-lg px-4 py-3 pt-6 text-[#171d1c] focus:ring-2 focus:ring-[#006b5a] transition-all font-medium resize-none shadow-sm"></textarea>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" name="gerou_venda" className="w-4 h-4 rounded border-[#bcc9c4] text-[#006b5a] focus:ring-[#006b5a]" />
                <span className="text-sm font-semibold text-[#3d4945] group-hover:text-[#006b5a] transition-colors">Gerou venda</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" name="marcou_retorno" className="w-4 h-4 rounded border-[#bcc9c4] text-[#006b5a] focus:ring-[#006b5a]" />
                <span className="text-sm font-semibold text-[#3d4945] group-hover:text-[#006b5a] transition-colors">Marcou retorno</span>
              </label>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-[#ba1a1a]/10 border border-[#ba1a1a]/20 text-[#ba1a1a] text-sm font-bold text-center">
                {error}
              </div>
            )}
            {loadingDetalhesAtendimento && (
              <div className="p-3 rounded-lg bg-[#006b5a]/10 border border-[#006b5a]/20 text-[#006b5a] text-sm font-semibold text-center">
                Carregando detalhes do atendimento...
              </div>
            )}
          </form>
        </div>

        <div className="px-6 py-4 border-t border-[#bcc9c4]/30 bg-[#f5faf9] shrink-0">
          <div className="flex justify-end gap-3">
            <button type="button" onClick={handleClose} className="px-6 py-2.5 rounded-lg font-bold text-[#3d4945] bg-white border border-[#bcc9c4] hover:bg-[#dee3e3] transition-colors">
              Cancelar
            </button>
            <button form={formId} type="submit" disabled={loading} className="bg-[#006b5a] text-white px-8 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-[#004f43] transition-colors shadow-md disabled:opacity-70">
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>

      </div>
    </>
  )
}
