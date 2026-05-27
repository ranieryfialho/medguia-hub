'use client'

import { useState, useEffect, useId, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { buscarDetalhesAgendamento, criarAgendamento, editarAtendimento } from '@/actions/agenda'
import { createClient } from '@/lib/supabase/client'
import { X, CalendarPlus, User, Minus, Plus, Search, Clock, LoaderCircle } from 'lucide-react'
import { format } from 'date-fns'
import {
  horarioDentroDaDisponibilidade,
  obterDisponibilidadeDoDia,
  type DisponibilidadeDia,
} from '@/lib/disponibilidade'
import { formatarFaixasJornada } from '@/lib/jornada'
import { useProtocolosAtendimento } from '@/components/layout/ProtocolosAtendimentoContext'
import { useTiposConsulta } from '@/components/layout/TiposConsultaContext'
import type { ProtocoloAtendimento } from '@/actions/protocolos-atendimento'
import type { TipoConsulta } from '@/actions/tipos-consulta'
import type { PlanoSaude } from '@/actions/planos-saude'

type Paciente = { id: string, nome: string }
type Profissional = { id: string, nome: string, cargo: string }

function somarUmaHora(horario: string) {
  if (!horario || !horario.includes(':')) return ''

  const [horaStr, minutoStr] = horario.split(':')
  const hora = Number(horaStr)
  const minuto = Number(minutoStr)

  if (Number.isNaN(hora) || Number.isNaN(minuto)) return ''

  return `${String((hora + 1) % 24).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`
}

function normalizarQuantidadeSessao(valor: string | number | undefined) {
  const quantidade = typeof valor === 'number' ? valor : parseInt(String(valor ?? ''), 10)
  return Math.max(1, Math.min(365, Number.isNaN(quantidade) ? 1 : quantidade))
}

function normalizarQuantidadeItemProtocolo(
  valor: string | number | undefined,
  totalSessoes: number,
) {
  const quantidade = typeof valor === 'number' ? valor : parseInt(String(valor ?? ''), 10)
  return Math.max(0, Math.min(totalSessoes, Number.isNaN(quantidade) ? 0 : quantidade))
}

function normalizarSessoesSelecionadas(sessoes: number[] | undefined, totalSessoes: number) {
  return Array.from(new Set((sessoes ?? []).filter((sessao) => sessao >= 1 && sessao <= totalSessoes)))
    .sort((a, b) => a - b)
}

function criarSessoesConsecutivas(quantidade: number) {
  return Array.from({ length: quantidade }, (_, index) => index + 1)
}

function ajustarSessoesParaQuantidade(
  sessoesAtuais: number[] | undefined,
  proximaQuantidade: number,
  totalSessoes: number,
) {
  const sessoesNormalizadas = normalizarSessoesSelecionadas(sessoesAtuais, totalSessoes)

  if (proximaQuantidade <= sessoesNormalizadas.length) {
    return sessoesNormalizadas.slice(0, proximaQuantidade)
  }

  const sessoesSelecionadas = new Set(sessoesNormalizadas)
  for (let sessao = 1; sessao <= totalSessoes && sessoesSelecionadas.size < proximaQuantidade; sessao += 1) {
    sessoesSelecionadas.add(sessao)
  }

  return Array.from(sessoesSelecionadas).sort((a, b) => a - b)
}

function montarSequenciaProtocolo(
  protocolo: ProtocoloAtendimento | null,
  sessoesPorItem: Record<string, number[]>,
  totalSessoesOverride?: number,
) {
  if (!protocolo) return []

  const totalSessoes = normalizarQuantidadeSessao(totalSessoesOverride ?? protocolo.total_sessoes)
  const fallbackTipo = protocolo.itens[0]?.tipo_consulta_nome?.trim() || protocolo.nome

  return Array.from({ length: totalSessoes }, (_, index) => {
    const sessaoNumero = index + 1
    const tiposDaSessao = protocolo.itens
      .filter((item) => {
        const sessoesSelecionadas = normalizarSessoesSelecionadas(
          sessoesPorItem[item.id] ?? criarSessoesConsecutivas(item.quantidade),
          totalSessoes,
        )
        return sessoesSelecionadas.includes(sessaoNumero)
      })
      .map((item) => item.tipo_consulta_nome.trim())
      .filter(Boolean)

    return tiposDaSessao.length > 0 ? tiposDaSessao.join(' + ') : fallbackTipo
  })
}

async function buscarPacientesPorNome(
  supabase: ReturnType<typeof createClient>,
  termo: string,
): Promise<Paciente[]> {
  const busca = termo.trim()
  if (!busca) return []

  const { data, error } = await supabase
    .from('pacientes')
    .select('id, nome')
    .eq('ativo', true)
    .ilike('nome', `%${busca}%`)
    .order('nome')
    .range(0, 19)

  if (error) throw error
  return data ?? []
}

async function buscarPacientePorId(
  supabase: ReturnType<typeof createClient>,
  pacienteId: string,
): Promise<Paciente | null> {
  if (!pacienteId) return null

  const { data, error } = await supabase
    .from('pacientes')
    .select('id, nome')
    .eq('id', pacienteId)
    .maybeSingle()

  if (error) throw error
  return data ?? null
}

interface AtendimentoParaEditar {
  id: string
  paciente_id: string
  profissional_id?: string | null
  agendamento_pai?: { plano_saude?: string | null } | null
  data_agendamento: string
  duracao_minutos?: number | null
  tipo: string
  observacoes?: string | null
  marcou_retorno?: boolean | null
}

interface SlideProps {
  pacientes?: Paciente[]
  profissionais: Profissional[]
  disponibilidades?: Record<string, Record<number, DisponibilidadeDia>>
  disponibilidadesMensais?: Record<string, Record<string, DisponibilidadeDia | null>>
  tiposConsulta?: TipoConsulta[]
  protocolosAtendimento?: ProtocoloAtendimento[]
  planos?: PlanoSaude[]
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

export function SlideNovoAgendamento({ pacientes: pacientesInicial, profissionais, disponibilidades, disponibilidadesMensais, tiposConsulta: tiposConsultaProp, protocolosAtendimento: protocolosAtendimentoProp, planos = [], controlledOpen, onControlledClose, defaultPacienteId, defaultData, defaultHora, atendimentoParaEditar }: SlideProps) {
  const isControlled = controlledOpen !== undefined
  const modoEdicao = !!atendimentoParaEditar
  const tiposConsultaContexto = useTiposConsulta()
  const protocolosAtendimentoContexto = useProtocolosAtendimento()
  const tiposConsulta = tiposConsultaProp ?? tiposConsultaContexto
  const protocolosAtendimento = protocolosAtendimentoProp ?? protocolosAtendimentoContexto
  const tiposAtivos = tiposConsulta.filter((tipo) => tipo.ativo)
  const primeiroTipoDisponivel = tiposAtivos[0]?.nome ?? ''
  const formId = useId()
  const [supabase] = useState(createClient)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pacientes, setPacientes] = useState<Paciente[]>(pacientesInicial ?? [])
  const [loadingPacientes, setLoadingPacientes] = useState(false)
  const [erroPacientes, setErroPacientes] = useState('')
  const [detalhesEdicaoCarregados, setDetalhesEdicaoCarregados] = useState<Record<string, true>>({})
  const [detalhesEdicaoFalhos, setDetalhesEdicaoFalhos] = useState<Record<string, true>>({})

  const [dataAgendamento, setDataAgendamento] = useState('')
  const diaDoMes = dataAgendamento ? dataAgendamento.split('-')[2] : '--'
  const [selectedPacienteId, setSelectedPacienteId] = useState(defaultPacienteId ?? '')
  const [pacienteSearch, setPacienteSearch] = useState('')
  const [pacienteDropdownOpen, setPacienteDropdownOpen] = useState(false)
  const comboboxRef = useRef<HTMLDivElement>(null)
  const [tipoProfissional, setTipoProfissional] = useState<'fisioterapeuta' | 'medico'>('fisioterapeuta')
  const [selectedProfissionalId, setSelectedProfissionalId] = useState('')
  const [modoAtendimento, setModoAtendimento] = useState<'avulso' | 'protocolo'>('avulso')
  const [selectedProtocoloAtendimentoId, setSelectedProtocoloAtendimentoId] = useState('')
  const [totalSessoesAgendamentoProtocolo, setTotalSessoesAgendamentoProtocolo] = useState(1)
  const [sessoesItensProtocolo, setSessoesItensProtocolo] = useState<Record<string, number[]>>({})
  const [selectedTipo, setSelectedTipo] = useState(primeiroTipoDisponivel)
  const [horaInicioValue, setHoraInicioValue] = useState('')
  const [horaFimValue, setHoraFimValue] = useState('')
  const [observacoesValue, setObservacoesValue] = useState('')
  const [selectedPlanoSaude, setSelectedPlanoSaude] = useState('')

  function handleHoraInicioChange(novaHoraInicio: string) {
    setHoraInicioValue(novaHoraInicio)
    setHoraFimValue(somarUmaHora(novaHoraInicio))
  }

  const [marcouRetorno, setMarcouRetorno] = useState(false)

  // Estados da Recorrência
  const [isRecorrente, setIsRecorrente] = useState(false)
  const [frequencia, setFrequencia] = useState('1')
  const [diasSelecionados, setDiasSelecionados] = useState<number[]>([])
  const [ocorrencias, setOcorrencias] = useState('1')
  const protocoloAtendimentoSelecionado = protocolosAtendimento.find((protocolo) => protocolo.id === selectedProtocoloAtendimentoId) ?? null
  const totalSessoesConfiguradoNoAgendamento = useMemo(
    () => normalizarQuantidadeSessao(
      protocoloAtendimentoSelecionado?.id ? totalSessoesAgendamentoProtocolo : 1,
    ),
    [protocoloAtendimentoSelecionado?.id, totalSessoesAgendamentoProtocolo],
  )
  const itensProtocoloConfigurados = useMemo(
    () => protocoloAtendimentoSelecionado?.itens.map((item) => ({
      ...item,
      sessoesSelecionadas: normalizarSessoesSelecionadas(
        sessoesItensProtocolo[item.id] ?? criarSessoesConsecutivas(item.quantidade),
        totalSessoesConfiguradoNoAgendamento,
      ),
    })) ?? [],
    [protocoloAtendimentoSelecionado, sessoesItensProtocolo, totalSessoesConfiguradoNoAgendamento],
  )
  const tiposDoProtocolo = useMemo(
    () => montarSequenciaProtocolo(
      protocoloAtendimentoSelecionado,
      Object.fromEntries(itensProtocoloConfigurados.map((item) => [item.id, item.sessoesSelecionadas])),
      totalSessoesConfiguradoNoAgendamento,
    ),
    [itensProtocoloConfigurados, protocoloAtendimentoSelecionado, totalSessoesConfiguradoNoAgendamento],
  )
  const protocoloRecorrenteAtivo = !modoEdicao && modoAtendimento === 'protocolo' && tiposDoProtocolo.length > 1
  const precisaCarregarDetalhesEdicao = Boolean(
    atendimentoParaEditar &&
    (atendimentoParaEditar.duracao_minutos == null || atendimentoParaEditar.observacoes == null),
  )
  const open = isControlled ? Boolean(controlledOpen) : isOpen
  const loadingDetalhesAtendimento = Boolean(
    atendimentoParaEditar &&
    precisaCarregarDetalhesEdicao &&
    !detalhesEdicaoCarregados[atendimentoParaEditar.id] &&
    !detalhesEdicaoFalhos[atendimentoParaEditar.id],
  )

  // Inicializa campos quando em modo edição
  useEffect(() => {
    if (!atendimentoParaEditar) return

    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return

      const dataObj = new Date(atendimentoParaEditar.data_agendamento)
      setSelectedPacienteId(atendimentoParaEditar.paciente_id)
      const pacienteEdit = pacientes.find(p => p.id === atendimentoParaEditar.paciente_id)
      if (pacienteEdit) setPacienteSearch(pacienteEdit.nome)
      setSelectedProfissionalId(atendimentoParaEditar.profissional_id ?? '')
      const profEdit = profissionais.find(p => p.id === atendimentoParaEditar.profissional_id)
      setTipoProfissional(profEdit?.cargo === 'medico' ? 'medico' : 'fisioterapeuta')
      setSelectedPlanoSaude(atendimentoParaEditar.agendamento_pai?.plano_saude ?? '')
      setDataAgendamento(format(dataObj, 'yyyy-MM-dd'))
      setHoraInicioValue(format(dataObj, 'HH:mm'))
      if (atendimentoParaEditar.duracao_minutos) {
        const fim = new Date(dataObj.getTime() + atendimentoParaEditar.duracao_minutos * 60000)
        setHoraFimValue(format(fim, 'HH:mm'))
      }
      setSelectedTipo(atendimentoParaEditar.tipo ?? primeiroTipoDisponivel)
      setObservacoesValue(atendimentoParaEditar.observacoes ?? '')
      setMarcouRetorno(atendimentoParaEditar.marcou_retorno ?? false)
    })

    return () => {
      cancelled = true
    }
  }, [atendimentoParaEditar, pacientes, primeiroTipoDisponivel, profissionais])

  useEffect(() => {
    if (modoEdicao || selectedTipo || !primeiroTipoDisponivel) return

    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setSelectedTipo(primeiroTipoDisponivel)
    })

    return () => {
      cancelled = true
    }
  }, [modoEdicao, primeiroTipoDisponivel, selectedTipo])

  useEffect(() => {
    if (!atendimentoParaEditar || !loadingDetalhesAtendimento) return

    let active = true

    buscarDetalhesAgendamento(atendimentoParaEditar.id).then((result) => {
      if (!active) return
      if (!result || 'error' in result || !result.data) {
        setDetalhesEdicaoFalhos((prev) => ({ ...prev, [atendimentoParaEditar.id]: true }))
        return
      }

      const dataObj = new Date(result.data.data_agendamento)
      if (result.data.duracao_minutos) {
        const fim = new Date(dataObj.getTime() + result.data.duracao_minutos * 60000)
        setHoraFimValue(format(fim, 'HH:mm'))
      }
      setObservacoesValue(result.data.observacoes ?? '')
      const agendamentoPai = Array.isArray(result.data.agendamento)
        ? result.data.agendamento[0]
        : result.data.agendamento
      setSelectedPlanoSaude(agendamentoPai?.plano_saude ?? '')
      setDetalhesEdicaoCarregados((prev) => ({ ...prev, [atendimentoParaEditar.id]: true }))
    })

    return () => {
      active = false
    }
  }, [atendimentoParaEditar, loadingDetalhesAtendimento])

  useEffect(() => {
    if (!open) return

    const pacienteIdInicial = atendimentoParaEditar?.paciente_id ?? defaultPacienteId ?? ''
    if (!pacienteIdInicial || pacienteSearch.trim()) return

    let active = true

    buscarPacientePorId(supabase, pacienteIdInicial)
      .then((paciente) => {
        if (!active || !paciente) return
        setPacientes((prev) => prev.some((item) => item.id === paciente.id) ? prev : [paciente, ...prev])
        setPacienteSearch((current) => current || paciente.nome)
      })
      .catch(() => {
        if (!active) return
        setErroPacientes('Não foi possível carregar o paciente selecionado.')
      })

    return () => {
      active = false
    }
  }, [atendimentoParaEditar?.paciente_id, defaultPacienteId, open, pacienteSearch, supabase])

  useEffect(() => {
    if (!open || !pacienteDropdownOpen) return

    const termoBusca = pacienteSearch.trim()
    if (termoBusca.length < 2) {
      queueMicrotask(() => {
        setPacientes([])
        setLoadingPacientes(false)
      })
      return
    }

    let active = true
    const timeoutId = window.setTimeout(() => {
      setLoadingPacientes(true)
      setErroPacientes('')

      buscarPacientesPorNome(supabase, termoBusca)
        .then((data) => {
          if (!active) return
          setPacientes(data)
        })
        .catch(() => {
          if (!active) return
          setPacientes([])
          setErroPacientes('Não foi possível buscar pacientes agora.')
        })
        .finally(() => {
          if (!active) return
          setLoadingPacientes(false)
        })
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timeoutId)
    }
  }, [open, pacienteDropdownOpen, pacienteSearch, supabase])

  useEffect(() => {
    if (!isControlled || !open) return

    let cancelled = false
    if (defaultPacienteId) {
      queueMicrotask(() => {
        if (cancelled) return
        setSelectedPacienteId(defaultPacienteId)
        const p = pacientes.find((paciente) => paciente.id === defaultPacienteId)
        if (p) setPacienteSearch(p.nome)
      })
    }
    if (defaultData) {
      queueMicrotask(() => {
        if (!cancelled) setDataAgendamento(defaultData)
      })
    }
    if (defaultHora) {
      queueMicrotask(() => {
        if (cancelled) return
        setHoraInicioValue(defaultHora)
        setHoraFimValue(somarUmaHora(defaultHora))
      })
    }

    return () => {
      cancelled = true
    }
  }, [isControlled, open, defaultPacienteId, defaultData, defaultHora, pacientes])

  useEffect(() => {
    if (!open) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [open])

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

  const pacientesFiltrados = pacientes

  function selecionarPaciente(p: Paciente) {
    setSelectedPacienteId(p.id)
    setPacienteSearch(p.nome)
    setPacienteDropdownOpen(false)
    setErroPacientes('')
  }

  useEffect(() => {
    if (isRecorrente && dataAgendamento && diasSelecionados.length === 0) {
      const dateObj = new Date(`${dataAgendamento}T00:00:00`)
      let cancelled = false
      queueMicrotask(() => {
        if (!cancelled) setDiasSelecionados([dateObj.getDay()])
      })
      return () => {
        cancelled = true
      }
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
    setMarcouRetorno(false)
    setIsRecorrente(false)
    setFrequencia('1')
    setDiasSelecionados([])
    setOcorrencias('1')
    setModoAtendimento('avulso')
    setSelectedProtocoloAtendimentoId('')
    setTotalSessoesAgendamentoProtocolo(1)
    setSessoesItensProtocolo({})
    setDataAgendamento('')
    if (!defaultPacienteId) {
      setSelectedPacienteId('')
      setPacienteSearch('')
    }
    setSelectedTipo(primeiroTipoDisponivel)
    setTipoProfissional('fisioterapeuta')
    setSelectedPlanoSaude('')
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    formData.set('paciente_id', selectedPacienteId)
    formData.set('profissional_id', selectedProfissionalId)
    formData.set('data', dataAgendamento)
    formData.set('hora_inicio', horaInicioValue)
    formData.set('hora_fim', horaFimValue)
    formData.set('tipo', selectedTipo)
    formData.set('protocolo_atendimento_tipos_json', JSON.stringify(modoAtendimento === 'protocolo' ? tiposDoProtocolo : []))
    formData.set('protocolo_atendimento_nome', modoAtendimento === 'protocolo' ? (protocoloAtendimentoSelecionado?.nome ?? '') : '')
    formData.set('observacoes', observacoesValue)
    formData.set('marcou_retorno', marcouRetorno ? 'on' : 'off')
    if (tipoProfissional === 'medico') {
      formData.set('plano_saude', selectedPlanoSaude)
    }

    if (!selectedPacienteId || !selectedProfissionalId || !dataAgendamento || !horaInicioValue || !horaFimValue) {
      setError('Preencha todos os campos obrigatórios.')
      setLoading(false)
      return
    }

    if (!selectedTipo) {
      setError('Cadastre e selecione um tipo de atendimento.')
      setLoading(false)
      return
    }

    if (!modoEdicao && modoAtendimento === 'protocolo' && protocoloAtendimentoSelecionado && tiposDoProtocolo.length > 1) {
      formData.set('is_recorrente', 'true')
      formData.set('ocorrencias', String(tiposDoProtocolo.length))
    }

    let res
    if (modoEdicao && atendimentoParaEditar) {
      res = await editarAtendimento(atendimentoParaEditar.id, formData)
    } else {
      formData.set('is_recorrente', String(isRecorrente))
      if (isRecorrente) {
        formData.set('frequencia', frequencia)
        formData.set('dias_semana', diasSelecionados.join(','))
        formData.set('termina_em', 'ocorrencias')
        formData.set('ocorrencias', ocorrencias)

        if (!frequencia) {
          setError('Selecione a frequência da recorrência.')
          setLoading(false)
          return
        }

        if (frequencia !== 'mes' && diasSelecionados.length === 0) {
          setError('Selecione ao menos um dia da semana para a recorrência.')
          setLoading(false)
          return
        }
      }
      res = await criarAgendamento(formData)
    }

    if (res && 'error' in res) {
      setError(res.error ?? 'Não foi possível salvar o agendamento.')
      setLoading(false)
    } else {
      handleClose()
      setLoading(false)
      if (!modoEdicao) resetForm()
    }
  }

  function aplicarProtocoloAtendimento(protocoloId: string) {
    setSelectedProtocoloAtendimentoId(protocoloId)

    if (!protocoloId) {
      setTotalSessoesAgendamentoProtocolo(1)
      setSessoesItensProtocolo({})
      setIsRecorrente(false)
      setOcorrencias('1')
      setSelectedTipo('')
      return
    }

    const protocolo = protocolosAtendimento.find((item) => item.id === protocoloId)
    const totalSessoesProtocolo = protocolo?.total_sessoes ?? 1
    setTotalSessoesAgendamentoProtocolo(totalSessoesProtocolo)
    const sessoesIniciais = Object.fromEntries(
      (protocolo?.itens ?? []).map((item) => [item.id, criarSessoesConsecutivas(Math.min(
        totalSessoesProtocolo,
        normalizarQuantidadeSessao(item.quantidade),
      ))]),
    )
    const sequencia = montarSequenciaProtocolo(protocolo ?? null, sessoesIniciais, totalSessoesProtocolo)

    setSessoesItensProtocolo(sessoesIniciais)

    if (sequencia.length > 0) {
      setSelectedTipo(sequencia[0] ?? '')
      setOcorrencias(String(Math.max(1, sequencia.length)))
      setIsRecorrente(sequencia.length > 1)
    }
  }

  function atualizarQuantidadeItemProtocolo(itemId: string, valor: string | number) {
    setSessoesItensProtocolo((prev) => {
      const proximaQuantidade = normalizarQuantidadeItemProtocolo(valor, totalSessoesConfiguradoNoAgendamento)
      const proximo = {
        ...prev,
        [itemId]: ajustarSessoesParaQuantidade(prev[itemId], proximaQuantidade, totalSessoesConfiguradoNoAgendamento),
      }

      if (protocoloAtendimentoSelecionado) {
        const proximaSequencia = montarSequenciaProtocolo(
          protocoloAtendimentoSelecionado,
          proximo,
          totalSessoesConfiguradoNoAgendamento,
        )

        setSelectedTipo(proximaSequencia[0] ?? '')
        setOcorrencias(String(Math.max(1, proximaSequencia.length)))
        setIsRecorrente(proximaSequencia.length > 1)
      }

      return proximo
    })
  }

  function alternarSessaoItemProtocolo(itemId: string, sessao: number) {
    setSessoesItensProtocolo((prev) => {
      const sessoesAtuais = normalizarSessoesSelecionadas(prev[itemId], totalSessoesConfiguradoNoAgendamento)
      const proximoItem = sessoesAtuais.includes(sessao)
        ? sessoesAtuais.filter((itemSessao) => itemSessao !== sessao)
        : [...sessoesAtuais, sessao].sort((a, b) => a - b)

      const proximo = {
        ...prev,
        [itemId]: proximoItem,
      }

      if (protocoloAtendimentoSelecionado) {
        const proximaSequencia = montarSequenciaProtocolo(
          protocoloAtendimentoSelecionado,
          proximo,
          totalSessoesConfiguradoNoAgendamento,
        )

        setSelectedTipo(proximaSequencia[0] ?? '')
        setOcorrencias(String(Math.max(1, proximaSequencia.length)))
        setIsRecorrente(proximaSequencia.length > 1)
      }

      return proximo
    })
  }

  function atualizarTotalSessoesProtocoloAgendamento(valor: string | number) {
    const totalNormalizado = normalizarQuantidadeSessao(valor)
    setTotalSessoesAgendamentoProtocolo(totalNormalizado)

    setSessoesItensProtocolo((prev) => {
      const proximo = Object.fromEntries(
        Object.entries(prev).map(([itemId, sessoes]) => [
          itemId,
          normalizarSessoesSelecionadas(sessoes, totalNormalizado),
        ]),
      )

      if (protocoloAtendimentoSelecionado) {
        const proximaSequencia = montarSequenciaProtocolo(
          protocoloAtendimentoSelecionado,
          proximo,
          totalNormalizado,
        )

        setSelectedTipo(proximaSequencia[0] ?? '')
        setOcorrencias(String(Math.max(1, proximaSequencia.length)))
        setIsRecorrente(proximaSequencia.length > 1)
      }

      return proximo
    })
  }

  const disponibilidadeSelecionada = (() => {
    if (!disponibilidades || !selectedProfissionalId || !dataAgendamento) return null
    const profDisp = disponibilidades[selectedProfissionalId]
    if (!profDisp || Object.keys(profDisp).length === 0) return null
    const profDispMensal = disponibilidadesMensais?.[selectedProfissionalId]
    return obterDisponibilidadeDoDia(
      new Map(Object.entries(profDisp).map(([dia, disp]) => [Number(dia), disp])),
      dataAgendamento,
      profDispMensal ? new Map(
        Object.entries(profDispMensal).map(([data, disp]) => [
            data,
            disp
              ? {
                  data,
                  jornada_inicio: disp.jornada_inicio,
                  jornada_fim: disp.jornada_fim,
                  intervalo_inicio: disp.intervalo_inicio ?? null,
                  intervalo_fim: disp.intervalo_fim ?? null,
                  ativo: true,
                }
              : {
                  data,
                  jornada_inicio: null,
                  jornada_fim: null,
                  intervalo_inicio: null,
                  intervalo_fim: null,
                  ativo: false,
                },
          ]),
      ) : undefined,
    )
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
  const opcoesTipoConsulta = selectedTipo && !tiposAtivos.some((tipo) => tipo.nome === selectedTipo)
    ? [{ id: '__selecionado__', nome: selectedTipo, ativo: true, ordem: -1 }, ...tiposAtivos]
    : tiposAtivos

  const profissionalSelecionado = profissionais.find((p) => p.id === selectedProfissionalId)
  const profissionalSelecionadoEhMedico = profissionalSelecionado?.cargo === 'medico'
  const profissionaisFiltrados = profissionais.filter(p =>
    tipoProfissional === 'medico' ? p.cargo === 'medico' : p.cargo !== 'medico',
  )

  const slide = open ? (
    <div className="fixed inset-0 z-[500] pointer-events-none">
      <button
        type="button"
        aria-label="Fechar agendamento"
        onClick={handleClose}
        className="absolute inset-0 bg-[#171d1c]/40 backdrop-blur-sm pointer-events-auto"
      />
      <div className="absolute inset-y-0 right-0 w-full max-w-lg pointer-events-auto">
        <div className="flex h-full w-full flex-col bg-white shadow-2xl">

          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-[#bcc9c4]/30 flex items-center justify-between bg-white shrink-0 safe-top">
            <h2 className="text-lg sm:text-xl font-bold text-[#083142]">{modoEdicao ? 'Editar agendamento' : 'Novo agendamento'}</h2>
            <button type="button" onClick={handleClose} className="p-2 border border-[#bcc9c4] text-[#3d4945] hover:bg-[#dee3e3] rounded-lg transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-8 sm:py-6 scrollbar-thin scrollbar-thumb-slate-200 overscroll-contain">
            <form id={formId} onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">

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
                  disabled={loadingPacientes && pacientes.length === 0}
                  className="w-full bg-white border border-[#bcc9c4] rounded-lg pl-11 pr-4 py-3 text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] transition-all font-medium shadow-sm"
                />
                <input type="hidden" name="paciente_id" value={selectedPacienteId} />
                {loadingPacientes && pacienteSearch.trim().length >= 2 && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-[#6d7a75]">
                    <LoaderCircle size={14} className="animate-spin" />
                    <span>Buscando pacientes...</span>
                  </div>
                )}
                {erroPacientes && (
                  <div className="mt-2 text-sm text-red-600">{erroPacientes}</div>
                )}

                {pacienteDropdownOpen && (
                  <div className="absolute z-[520] w-full mt-1 bg-white border border-[#bcc9c4] rounded-lg shadow-xl max-h-56 overflow-y-auto">
                    {pacienteSearch.trim().length < 2 ? (
                      <p className="px-4 py-3 text-sm text-[#6d7a75]">
                        Digite pelo menos 2 letras para buscar.
                      </p>
                    ) : loadingPacientes ? (
                      <div className="px-4 py-3 text-sm text-[#6d7a75] flex items-center gap-2">
                        <LoaderCircle size={14} className="animate-spin" />
                        <span>Buscando pacientes...</span>
                      </div>
                    ) : erroPacientes ? (
                      <p className="px-4 py-3 text-sm text-red-600">{erroPacientes}</p>
                    ) : pacientesFiltrados.length > 0 ? (
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

            <div className="space-y-3">
              <div className="flex rounded-lg border border-[#bcc9c4] overflow-hidden shadow-sm">
                <button
                  type="button"
                  onClick={() => { setTipoProfissional('fisioterapeuta'); setSelectedProfissionalId('') }}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${tipoProfissional === 'fisioterapeuta' ? 'bg-[#006b5a] text-white' : 'bg-white text-[#6d7a75] hover:bg-[#f0f5f4]'}`}
                >
                  Fisioterapeuta
                </button>
                <button
                  type="button"
                  onClick={() => { setTipoProfissional('medico'); setSelectedProfissionalId('') }}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-colors border-l border-[#bcc9c4] ${tipoProfissional === 'medico' ? 'bg-[#006b5a] text-white' : 'bg-white text-[#6d7a75] hover:bg-[#f0f5f4]'}`}
                >
                  Médico
                </button>
              </div>
              <div className="space-y-1 relative">
                <label className="text-xs font-semibold text-[#6d7a75] absolute -top-2 left-3 bg-white px-1 z-10">Profissional *</label>
                <select name="profissional_id" required value={selectedProfissionalId} onChange={e => setSelectedProfissionalId(e.target.value)} className="w-full bg-white border border-[#bcc9c4] rounded-lg px-4 py-3 text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] transition-all font-medium appearance-none shadow-sm">
                  <option value="">Selecione uma opção</option>
                  {profissionaisFiltrados.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              {tipoProfissional === 'medico' && (
                <div className="space-y-1 relative">
                  <label className="text-xs font-semibold text-[#6d7a75] absolute -top-2 left-3 bg-white px-1 z-10">Plano de Saúde</label>
                  <select
                    name="plano_saude"
                    value={selectedPlanoSaude}
                    onChange={e => setSelectedPlanoSaude(e.target.value)}
                    className="w-full bg-white border border-[#bcc9c4] rounded-lg px-4 py-3 text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] transition-all font-medium appearance-none shadow-sm"
                  >
                    <option value="">Selecione um plano...</option>
                    {planos.map(p => (
                      <option key={p.id} value={p.nome}>{p.nome}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-[#6d7a75]">Tipo de atendimento *</p>
              {!modoEdicao && protocolosAtendimento.length > 0 && (
                <div className="mb-4 space-y-4">
                  <div className="space-y-2">
                    <span className="block text-xs font-semibold text-[#6d7a75]">Como deseja montar o atendimento?</span>
                    <div className="grid grid-cols-2 rounded-lg border border-[#bcc9c4] bg-[#f5faf9] p-1">
                      <button
                        type="button"
                        onClick={() => {
                          setModoAtendimento('avulso')
                          setSelectedProtocoloAtendimentoId('')
                          setTotalSessoesAgendamentoProtocolo(1)
                          setSessoesItensProtocolo({})
                          setIsRecorrente(false)
                          setOcorrencias('1')
                          setSelectedTipo(primeiroTipoDisponivel)
                        }}
                        className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                          modoAtendimento === 'avulso'
                            ? 'bg-white text-[#006b5a] shadow-sm'
                            : 'text-[#6d7a75] hover:text-[#083142]'
                        }`}
                      >
                        Atendimento avulso
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setModoAtendimento('protocolo')
                          if (!selectedProtocoloAtendimentoId) {
                            setSelectedTipo('')
                          }
                        }}
                        className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                          modoAtendimento === 'protocolo'
                            ? 'bg-white text-[#006b5a] shadow-sm'
                            : 'text-[#6d7a75] hover:text-[#083142]'
                        }`}
                      >
                        Protocolo
                      </button>
                    </div>
                  </div>

                  {modoAtendimento === 'protocolo' && (
                    <div className="space-y-1 relative">
                  <label className="text-xs font-semibold text-[#6d7a75] absolute -top-2 left-3 bg-white px-1 z-10">Protocolo de atendimento</label>
                  <select
                    value={selectedProtocoloAtendimentoId}
                    onChange={e => aplicarProtocoloAtendimento(e.target.value)}
                    className="w-full bg-white border border-[#bcc9c4] rounded-lg px-4 py-3 text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 transition-all font-medium appearance-none shadow-sm"
                  >
                    <option value="">Selecione um protocolo...</option>
                    {protocolosAtendimento.map((protocolo) => (
                      <option key={protocolo.id} value={protocolo.id}>
                        {protocolo.nome} ({protocolo.total_sessoes} sessoes)
                      </option>
                    ))}
                  </select>
                  {protocoloAtendimentoSelecionado && (
                    <div className="rounded-lg border border-[#006b5a]/20 bg-[#f0fcf9] px-3 py-2 text-xs text-[#006b5a]">
                      <p className="font-semibold">{protocoloAtendimentoSelecionado.nome}</p>
                      <p className="mt-1 font-medium">Total de atendimentos deste protocolo: <span className="font-bold">{protocoloAtendimentoSelecionado.total_sessoes}</span></p>
                      <p className="mt-1 text-[11px] text-[#4d635b]">
                        Ajuste a quantidade como atalho e, se precisar, escolha manualmente em quais sessoes cada item acontece.
                      </p>
                      <div className="mt-3 space-y-2">
                        {itensProtocoloConfigurados.map((item) => (
                          <div key={item.id} className="rounded-lg border border-[#006b5a]/15 bg-white/70 px-3 py-2">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-semibold text-[#083142]">{item.tipo_consulta_nome}</p>
                                <p className="text-[11px] text-[#4d635b]">Escolha livremente em quais sessoes esse item aparece</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => atualizarQuantidadeItemProtocolo(item.id, item.sessoesSelecionadas.length - 1)}
                                  className="flex h-8 w-8 items-center justify-center rounded-md border border-[#bcc9c4] bg-white text-[#6d7a75] transition-colors hover:bg-[#f0f5f4]"
                                >
                                  <Minus size={14} strokeWidth={1.8} />
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  max={totalSessoesConfiguradoNoAgendamento}
                                  value={item.sessoesSelecionadas.length}
                                  onChange={(e) => atualizarQuantidadeItemProtocolo(item.id, e.target.value)}
                                  onBlur={(e) => atualizarQuantidadeItemProtocolo(item.id, e.target.value)}
                                  className="h-8 w-16 rounded-md border border-[#bcc9c4] bg-white px-2 text-center text-sm font-semibold text-[#171d1c] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => atualizarQuantidadeItemProtocolo(item.id, item.sessoesSelecionadas.length + 1)}
                                  className="flex h-8 w-8 items-center justify-center rounded-md border border-[#bcc9c4] bg-white text-[#6d7a75] transition-colors hover:bg-[#f0f5f4]"
                                >
                                  <Plus size={14} strokeWidth={1.8} />
                                </button>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {Array.from({ length: totalSessoesConfiguradoNoAgendamento }, (_, index) => {
                                const sessao = index + 1
                                const selecionada = item.sessoesSelecionadas.includes(sessao)
                                return (
                                  <button
                                    key={`${item.id}-${sessao}`}
                                    type="button"
                                    onClick={() => alternarSessaoItemProtocolo(item.id, sessao)}
                                    className={`min-w-9 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                                      selecionada
                                        ? 'border-[#006b5a] bg-[#f0fcf9] text-[#006b5a]'
                                        : 'border-[#bcc9c4] bg-white text-[#6d7a75] hover:border-[#6d7a75]'
                                    }`}
                                  >
                                    {sessao}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 rounded-lg border border-[#006b5a]/15 bg-white/70 px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-[#083142]">Total de atendimentos deste agendamento</p>
                            <p className="text-[11px] text-[#4d635b]">O protocolo sugere um padrao, mas voce pode ajustar para este paciente.</p>
                          </div>
                          <input
                            type="number"
                            min="1"
                            max="365"
                            value={totalSessoesConfiguradoNoAgendamento}
                            onChange={(e) => atualizarTotalSessoesProtocoloAgendamento(e.target.value)}
                            onBlur={(e) => atualizarTotalSessoesProtocoloAgendamento(e.target.value)}
                            className="h-8 w-20 rounded-md border border-[#bcc9c4] bg-white px-2 text-center text-sm font-semibold text-[#171d1c] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                        <p className="mt-2 text-[11px] text-[#4d635b]">
                          Padrao do protocolo: {protocoloAtendimentoSelecionado.total_sessoes} atendimento{protocoloAtendimentoSelecionado.total_sessoes === 1 ? '' : 's'}.
                        </p>
                      </div>
                      <p className="mt-2 text-[11px] text-[#4d635b]">
                        A sazonalidade deste caso continua sendo definida na recorrencia abaixo: frequencia e dias da semana.
                      </p>
                    </div>
                  )}
                </div>
                  )}
                </div>
              )}
              {(modoEdicao || modoAtendimento !== 'protocolo') && (
                <>
              <select name="tipo" required value={selectedTipo} onChange={e => setSelectedTipo(e.target.value)} className="w-full bg-white border border-[#bcc9c4] rounded-lg px-4 py-3 text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 transition-all font-medium appearance-none shadow-sm">
                <option value="">Selecione uma opção</option>
                {opcoesTipoConsulta.map((tipo) => (
                  <option key={tipo.id} value={tipo.nome}>{tipo.nome}</option>
                ))}
              </select>
              {opcoesTipoConsulta.length === 0 && (
                <p className="text-xs text-amber-700 font-medium mt-2">
                  Nenhum tipo ativo cadastrado. Use `Pacientes &gt; Tipos de consulta`.
                </p>
              )}
                </>
              )}
            </div>

            <div className="grid grid-cols-12 gap-3 sm:gap-4">
              <div className="col-span-12 sm:col-span-6 space-y-1 relative mt-2">
                <label className="text-xs font-semibold text-[#6d7a75] absolute -top-2 left-3 bg-white px-1 z-10">Data *</label>
                <input
                  type="date"
                  name="data"
                  value={dataAgendamento}
                  onChange={(e) => setDataAgendamento(e.target.value)}
                  required
                  className="w-full min-w-0 bg-white border border-[#bcc9c4] rounded-lg px-4 py-2.5 text-sm text-[#171d1c] focus:ring-2 focus:ring-[#006b5a] transition-all font-medium shadow-sm"
                />
              </div>
              <div className="col-span-6 sm:col-span-3 space-y-1 relative mt-2">
                <label className="text-xs font-semibold text-[#6d7a75] absolute -top-2 left-3 bg-white px-1 z-10">Início *</label>
                <input type="time" name="hora_inicio" required value={horaInicioValue} onChange={e => handleHoraInicioChange(e.target.value)} className="w-full min-w-0 bg-white border border-[#bcc9c4] rounded-lg px-3 py-2.5 text-sm text-[#171d1c] focus:ring-2 focus:ring-[#006b5a] transition-all font-medium shadow-sm" />
              </div>
              <div className="col-span-6 sm:col-span-3 space-y-1 relative mt-2">
                <label className="text-xs font-semibold text-[#6d7a75] absolute -top-2 left-3 bg-white px-1 z-10">Fim *</label>
                <input type="time" name="hora_fim" required value={horaFimValue} onChange={e => setHoraFimValue(e.target.value)} className="w-full min-w-0 bg-white border border-[#bcc9c4] rounded-lg px-3 py-2.5 text-sm text-[#171d1c] focus:ring-2 focus:ring-[#006b5a] transition-all font-medium shadow-sm" />
              </div>
            </div>

            {/* Hint de disponibilidade do profissional */}
            {(() => {
              if (!selectedProfissionalId || !dataAgendamento) return null
              if (profissionalSelecionadoEhMedico) return null

              const nomeProfissional = profissionalSelecionado?.nome ?? 'Profissional'
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
                      O horário escolhido cruza um período indisponível, como o intervalo do dia.
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
                  <input type="checkbox" className="sr-only peer" checked={isRecorrente} onChange={(e) => setIsRecorrente(e.target.checked)} disabled={protocoloRecorrenteAtivo} />
                  <div className="w-11 h-6 bg-[#dee3e3] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#006b5a]"></div>
                </div>
                <span className="font-semibold text-[#083142]">Agendamento recorrente</span>
              </label>
              {protocoloRecorrenteAtivo && (
                <p className="text-xs text-[#006b5a] font-medium -mt-3">
                  Este protocolo possui múltiplas consultas e ativa a recorrência automaticamente.
                </p>
              )}

              {protocoloRecorrenteAtivo && (
                <p className="text-xs text-[#4d635b] -mt-2">
                  O numero de atendimentos vem do protocolo/agendamento. Aqui voce define apenas a sazonalidade: frequencia e dias da semana.
                </p>
              )}
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
                      <div className="flex items-center gap-3">
                        <input type="radio" checked readOnly className="w-4 h-4 text-[#006b5a] focus:ring-[#006b5a] shrink-0" />
                        <div className="flex items-center gap-3">
                          <div className="border border-[#bcc9c4] rounded-lg flex items-center justify-between w-[120px] bg-white h-11">
                            <button
                              type="button"
                              onClick={() => ajustarOcorrencias(-1)}
                              disabled={protocoloRecorrenteAtivo}
                              className="w-10 h-full flex items-center justify-center text-[#6d7a75] hover:bg-[#f0f5f4] transition-colors rounded-l-lg disabled:opacity-40"
                            >
                              <Minus size={18} strokeWidth={1.5} />
                            </button>
                            <input
                              type="number"
                              name="ocorrencias"
                              value={ocorrencias}
                              onChange={(e) => setOcorrencias(e.target.value)}
                              onBlur={() => {
                                const num = Math.max(1, Math.min(365, parseInt(ocorrencias) || 1))
                                setOcorrencias(String(num))
                              }}
                              className="flex-1 w-full text-center focus:outline-none bg-transparent text-base font-medium text-[#171d1c] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0 m-0"
                              min="1"
                              max="365"
                              disabled={protocoloRecorrenteAtivo}
                            />
                            <button
                              type="button"
                              onClick={() => ajustarOcorrencias(1)}
                              disabled={protocoloRecorrenteAtivo}
                              className="w-10 h-full flex items-center justify-center text-[#6d7a75] hover:bg-[#f0f5f4] transition-colors rounded-r-lg disabled:opacity-40"
                            >
                              <Plus size={18} strokeWidth={1.5} />
                            </button>
                          </div>
                          <span className="text-sm font-medium text-[#6d7a75]">
                            atendimentos <span className="font-normal opacity-70">(Limite igual a 365)</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>
            )}

            {/* Toggle de Retorno */}
            <div className="pt-4 border-t border-[#bcc9c4]/30">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={marcouRetorno}
                    onChange={(e) => setMarcouRetorno(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-[#dee3e3] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4f46e5]"></div>
                </div>
                <div>
                  <span className="font-semibold text-[#083142]">Retorno</span>
                  <p className="text-xs text-[#6d7a75]">Marque se este é um agendamento de retorno</p>
                </div>
              </label>
            </div>

            <div className="space-y-1 relative pt-4">
              <label className="text-xs font-semibold text-[#6d7a75] absolute top-2 left-3 bg-white px-1 z-10">Observações</label>
              <textarea name="observacoes" rows={3} value={observacoesValue} onChange={e => setObservacoesValue(e.target.value)} placeholder="Motivo da consulta, queixas principais..." className="w-full bg-white border border-[#bcc9c4] rounded-lg px-4 py-3 pt-6 text-[#171d1c] focus:ring-2 focus:ring-[#006b5a] transition-all font-medium resize-none shadow-sm"></textarea>
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

          <div className="px-4 sm:px-6 border-t border-[#bcc9c4]/30 bg-[#f5faf9] shrink-0" style={{ paddingTop: '14px', paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))' }}>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3">
              <button type="button" onClick={handleClose} className="w-full sm:w-auto px-6 py-2.5 rounded-lg font-bold text-[#3d4945] bg-white border border-[#bcc9c4] hover:bg-[#dee3e3] transition-colors">
                Cancelar
              </button>
              <button form={formId} type="submit" disabled={loading} className="w-full sm:w-auto bg-[#006b5a] text-white px-8 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-[#004f43] transition-colors shadow-md disabled:opacity-70">
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      {!isControlled && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full bg-white text-[#006b5a] border-2 border-[#006b5a] rounded-xl py-3 font-bold flex items-center justify-center gap-2 hover:bg-[#f0f5f4] transition-colors"
        >
          <CalendarPlus size={20} />
          <span>Novo Agendamento</span>
        </button>
      )}

      {typeof document !== 'undefined' ? createPortal(slide, document.body) : null}
    </>
  )
}
