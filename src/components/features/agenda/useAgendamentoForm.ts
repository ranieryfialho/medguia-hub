import { useState, useEffect, useId, useMemo, useRef } from 'react'
import { format } from 'date-fns'
import { buscarDetalhesAgendamento, criarAgendamento, editarAtendimento, verificarBloqueioAgenda } from '@/actions/agenda'
import {
  criarPreConsultaPendente,
  buscarConsultaMedicaSemVinculo,
  buscarOcultarAvisoPreConsulta,
  salvarOcultarAvisoPreConsulta,
  type ConsultaMedicaSemVinculo,
} from '@/actions/pre-consultas'
import { createClient } from '@/lib/supabase/client'
import { useProtocolosAtendimento } from '@/components/layout/ProtocolosAtendimentoContext'
import { useTiposConsulta } from '@/components/layout/TiposConsultaContext'
import {
  obterDisponibilidadeDoDia,
  horarioDentroDaDisponibilidade,
  type DisponibilidadeDia,
} from '@/lib/disponibilidade'
import type { TipoConsulta } from '@/actions/tipos-consulta'
import type { ProtocoloAtendimento } from '@/actions/protocolos-atendimento'
import type { PlanoSaude } from '@/actions/planos-saude'
import {
  somarUmaHora,
  somarMinutos,
  normalizarQuantidadeSessao,
  normalizarQuantidadeItemProtocolo,
  normalizarSessoesSelecionadas,
  criarSessoesConsecutivas,
  ajustarSessoesParaQuantidade,
  montarSequenciaProtocolo,
  buscarPacientesPorNome,
  buscarPacientePorId,
  type Paciente,
  type SlotLivre,
  type ItemProtocoloConfigurado,
  type AtendimentoParaEditar,
} from './slide-utils'

export interface SlideProps {
  pacientes?: Paciente[]
  profissionais: { id: string; nome: string; cargo: string }[]
  disponibilidades?: Record<string, Record<number, DisponibilidadeDia>>
  disponibilidadesMensais?: Record<string, Record<string, DisponibilidadeDia | null>>
  tiposConsulta?: TipoConsulta[]
  protocolosAtendimento?: ProtocoloAtendimento[]
  planos?: PlanoSaude[]
  controlledOpen?: boolean
  onControlledClose?: () => void
  defaultPacienteId?: string
  defaultData?: string
  defaultHora?: string
  atendimentoParaEditar?: AtendimentoParaEditar
  /** Cria um NOVO agendamento pré-preenchido com os dados deste atendimento (sem alterá-lo). */
  modeloReagendamento?: AtendimentoParaEditar
}

export function useAgendamentoForm({
  pacientes: pacientesInicial,
  profissionais,
  disponibilidades,
  disponibilidadesMensais,
  tiposConsulta: tiposConsultaProp,
  protocolosAtendimento: protocolosAtendimentoProp,
  planos = [],
  controlledOpen,
  onControlledClose,
  defaultPacienteId,
  defaultData,
  defaultHora,
  atendimentoParaEditar,
  modeloReagendamento,
}: SlideProps) {
  const isControlled = controlledOpen !== undefined
  const modoEdicao = !!atendimentoParaEditar
  const tiposConsultaCtx = useTiposConsulta()
  const protocolosAtendimentoCtx = useProtocolosAtendimento()
  const tiposConsulta = tiposConsultaProp ?? tiposConsultaCtx
  const protocolosAtendimento = protocolosAtendimentoProp ?? protocolosAtendimentoCtx
  const tiposAtivos = tiposConsulta.filter((t) => t.ativo)
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
  const [marcouRetorno, setMarcouRetorno] = useState(false)
  const [bloqueioAgenda, setBloqueioAgenda] = useState<{ mensagem: string } | null>(null)
  const [verificandoBloqueioAgenda, setVerificandoBloqueioAgenda] = useState(false)

  // Prompt "Tem pré-consulta?" — aberto depois de criar uma consulta médica
  const [promptPreConsultaAtendimentoId, setPromptPreConsultaAtendimentoId] = useState<string | null>(null)
  const [criandoPreConsultaPendente, setCriandoPreConsultaPendente] = useState(false)
  const [erroPreConsultaPendente, setErroPreConsultaPendente] = useState('')
  const [ocultarAvisoPreConsulta, setOcultarAvisoPreConsulta] = useState(false)

  // Sugestão automática de vínculo pós-consulta (fisio -> consulta médica recente sem vínculo)
  const [sugestaoConsultaOrigem, setSugestaoConsultaOrigem] = useState<ConsultaMedicaSemVinculo | null>(null)
  const [origemConfirmadaId, setOrigemConfirmadaId] = useState<string | null>(null)
  const [sugestaoDispensada, setSugestaoDispensada] = useState(false)

  // Recorrência
  const [isRecorrente, setIsRecorrente] = useState(false)
  const [modoRecorrencia, setModoRecorrencia] = useState<'padrao' | 'livre'>('padrao')
  const [slotsLivres, setSlotsLivres] = useState<SlotLivre[]>([])
  const [frequencia, setFrequencia] = useState('1')
  const [diasSelecionados, setDiasSelecionados] = useState<number[]>([])
  const [ocorrencias, setOcorrencias] = useState('1')

  // Derived: protocolo
  const protocoloAtendimentoSelecionado =
    protocolosAtendimento.find((p) => p.id === selectedProtocoloAtendimentoId) ?? null

  const totalSessoesConfiguradoNoAgendamento = useMemo(
    () => normalizarQuantidadeSessao(protocoloAtendimentoSelecionado?.id ? totalSessoesAgendamentoProtocolo : 1),
    [protocoloAtendimentoSelecionado?.id, totalSessoesAgendamentoProtocolo],
  )

  const itensProtocoloConfigurados = useMemo<ItemProtocoloConfigurado[]>(
    () =>
      protocoloAtendimentoSelecionado?.itens.map((item) => ({
        ...item,
        sessoesSelecionadas: normalizarSessoesSelecionadas(
          sessoesItensProtocolo[item.id] ?? criarSessoesConsecutivas(item.quantidade),
          totalSessoesConfiguradoNoAgendamento,
        ),
      })) ?? [],
    [protocoloAtendimentoSelecionado, sessoesItensProtocolo, totalSessoesConfiguradoNoAgendamento],
  )

  const tiposDoProtocolo = useMemo(
    () =>
      montarSequenciaProtocolo(
        protocoloAtendimentoSelecionado,
        Object.fromEntries(itensProtocoloConfigurados.map((item) => [item.id, item.sessoesSelecionadas])),
        totalSessoesConfiguradoNoAgendamento,
      ),
    [itensProtocoloConfigurados, protocoloAtendimentoSelecionado, totalSessoesConfiguradoNoAgendamento],
  )

  const protocoloRecorrenteAtivo = !modoEdicao && modoAtendimento === 'protocolo' && tiposDoProtocolo.length > 1

  const open = isControlled ? Boolean(controlledOpen) : isOpen

  const loadingDetalhesAtendimento = Boolean(
    atendimentoParaEditar &&
    (atendimentoParaEditar.duracao_minutos == null || atendimentoParaEditar.observacoes == null) &&
    !detalhesEdicaoCarregados[atendimentoParaEditar.id] &&
    !detalhesEdicaoFalhos[atendimentoParaEditar.id],
  )

  // Derived: disponibilidade
  const disponibilidadeSelecionada = (() => {
    if (!disponibilidades || !selectedProfissionalId || !dataAgendamento) return null
    const profDisp = disponibilidades[selectedProfissionalId]
    if (!profDisp || Object.keys(profDisp).length === 0) return null
    const profDispMensal = disponibilidadesMensais?.[selectedProfissionalId]
    return obterDisponibilidadeDoDia(
      new Map(Object.entries(profDisp).map(([dia, disp]) => [Number(dia), disp])),
      dataAgendamento,
      profDispMensal
        ? new Map(
            Object.entries(profDispMensal).map(([data, disp]) => [
              data,
              disp
                ? { data, jornada_inicio: disp.jornada_inicio, jornada_fim: disp.jornada_fim, intervalo_inicio: disp.intervalo_inicio ?? null, intervalo_fim: disp.intervalo_fim ?? null, ativo: true }
                : { data, jornada_inicio: null, jornada_fim: null, intervalo_inicio: null, intervalo_fim: null, ativo: false },
            ]),
          )
        : undefined,
    )
  })()

  const horarioPreenchido = Boolean(horaInicioValue && horaFimValue)
  const horarioValidoNaDisponibilidade = Boolean(
    disponibilidadeSelecionada?.disponibilidade &&
    horarioPreenchido &&
    horarioDentroDaDisponibilidade(disponibilidadeSelecionada.disponibilidade, horaInicioValue, horaFimValue),
  )

  const opcoesTipoConsulta =
    selectedTipo && !tiposAtivos.some((t) => t.nome === selectedTipo)
      ? [{ id: '__selecionado__', nome: selectedTipo, ativo: true, ordem: -1 }, ...tiposAtivos]
      : tiposAtivos

  const profissionalSelecionado = profissionais.find((p) => p.id === selectedProfissionalId)
  const profissionalSelecionadoEhMedico = profissionalSelecionado?.cargo === 'medico'
  const profissionaisFiltrados = profissionais.filter((p) =>
    tipoProfissional === 'medico' ? p.cargo === 'medico' : p.cargo !== 'medico',
  )
  const pacientesFiltrados = pacientes

  // ── Effects ────────────────────────────────────────────────────────────────

  // Reagendar: novo agendamento reaproveitando profissional, tipo, plano e horário
  // do card. Data e observações ficam vazias; o paciente vem de defaultPacienteId.
  const modeloAplicadoRef = useRef(false)
  useEffect(() => {
    if (!open || !modeloReagendamento) {
      modeloAplicadoRef.current = false
      return
    }
    if (modeloAplicadoRef.current) return
    modeloAplicadoRef.current = true
    queueMicrotask(() => {
      const inicio = new Date(modeloReagendamento.data_agendamento)
      const horaInicio = format(inicio, 'HH:mm')
      const prof = profissionais.find((p) => p.id === modeloReagendamento.profissional_id)
      setSelectedProfissionalId(modeloReagendamento.profissional_id ?? '')
      setTipoProfissional(prof?.cargo === 'medico' ? 'medico' : 'fisioterapeuta')
      setSelectedPlanoSaude(modeloReagendamento.agendamento_pai?.plano_saude ?? '')
      setSelectedTipo(modeloReagendamento.tipo || primeiroTipoDisponivel)
      setObservacoesValue('')
      setHoraInicioValue(horaInicio)
      const duracao = modeloReagendamento.duracao_minutos
      setHoraFimValue(
        duracao
          ? format(new Date(inicio.getTime() + duracao * 60000), 'HH:mm')
          : somarUmaHora(horaInicio),
      )
    })
  }, [open, modeloReagendamento, profissionais, primeiroTipoDisponivel])

  useEffect(() => {
    if (!atendimentoParaEditar) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      const dataObj = new Date(atendimentoParaEditar.data_agendamento)
      setSelectedPacienteId(atendimentoParaEditar.paciente_id)
      const pacienteEdit = pacientes.find((p) => p.id === atendimentoParaEditar.paciente_id)
      if (pacienteEdit) setPacienteSearch(pacienteEdit.nome)
      setSelectedProfissionalId(atendimentoParaEditar.profissional_id ?? '')
      const profEdit = profissionais.find((p) => p.id === atendimentoParaEditar.profissional_id)
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
    return () => { cancelled = true }
  }, [atendimentoParaEditar, pacientes, primeiroTipoDisponivel, profissionais])

  useEffect(() => {
    if (modoEdicao || selectedTipo || !primeiroTipoDisponivel) return
    let cancelled = false
    queueMicrotask(() => { if (!cancelled) setSelectedTipo(primeiroTipoDisponivel) })
    return () => { cancelled = true }
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
        setHoraFimValue(format(new Date(dataObj.getTime() + result.data.duracao_minutos * 60000), 'HH:mm'))
      }
      setObservacoesValue(result.data.observacoes ?? '')
      const pai = Array.isArray(result.data.agendamento) ? result.data.agendamento[0] : result.data.agendamento
      setSelectedPlanoSaude(pai?.plano_saude ?? '')
      setDetalhesEdicaoCarregados((prev) => ({ ...prev, [atendimentoParaEditar.id]: true }))
    })
    return () => { active = false }
  }, [atendimentoParaEditar, loadingDetalhesAtendimento])

  useEffect(() => {
    if (!open) return
    const pacienteIdInicial = atendimentoParaEditar?.paciente_id ?? defaultPacienteId ?? ''
    if (!pacienteIdInicial || pacienteSearch.trim()) return
    let active = true
    buscarPacientePorId(supabase, pacienteIdInicial)
      .then((paciente) => {
        if (!active || !paciente) return
        setPacientes((prev) => prev.some((p) => p.id === paciente.id) ? prev : [paciente, ...prev])
        setPacienteSearch((cur) => cur || paciente.nome)
      })
      .catch(() => { if (active) setErroPacientes('Não foi possível carregar o paciente selecionado.') })
    return () => { active = false }
  }, [atendimentoParaEditar?.paciente_id, defaultPacienteId, open, pacienteSearch, supabase])

  useEffect(() => {
    if (!open || !pacienteDropdownOpen) return
    const termo = pacienteSearch.trim()
    if (termo.length < 2) {
      setPacientes([])
      setLoadingPacientes(false)
      return
    }
    let active = true
    setLoadingPacientes(true)
    setErroPacientes('')
    const id = window.setTimeout(() => {
      buscarPacientesPorNome(supabase, termo)
        .then((data) => { if (active) setPacientes(data) })
        .catch(() => { if (active) { setPacientes([]); setErroPacientes('Não foi possível buscar pacientes agora.') } })
        .finally(() => { if (active) setLoadingPacientes(false) })
    }, 300)
    return () => { active = false; window.clearTimeout(id) }
  }, [open, pacienteDropdownOpen, pacienteSearch, supabase])

  useEffect(() => {
    if (!isControlled || !open) return
    let cancelled = false
    if (defaultPacienteId) queueMicrotask(() => {
      if (cancelled) return
      setSelectedPacienteId(defaultPacienteId)
      const p = pacientes.find((pac) => pac.id === defaultPacienteId)
      if (p) setPacienteSearch(p.nome)
    })
    if (defaultData) queueMicrotask(() => { if (!cancelled) setDataAgendamento(defaultData) })
    if (defaultHora) queueMicrotask(() => {
      if (cancelled) return
      setHoraInicioValue(defaultHora)
      setHoraFimValue(somarUmaHora(defaultHora))
    })
    return () => { cancelled = true }
  }, [isControlled, open, defaultPacienteId, defaultData, defaultHora, pacientes])

  useEffect(() => {
    setSugestaoConsultaOrigem(null)
    setOrigemConfirmadaId(null)
    setSugestaoDispensada(false)
    if (modoEdicao || tipoProfissional !== 'fisioterapeuta' || !selectedPacienteId) return
    let active = true
    buscarConsultaMedicaSemVinculo(selectedPacienteId).then((consulta) => {
      if (active) setSugestaoConsultaOrigem(consulta)
    })
    return () => { active = false }
  }, [modoEdicao, tipoProfissional, selectedPacienteId])

  useEffect(() => {
    let active = true
    buscarOcultarAvisoPreConsulta().then((ocultar) => { if (active) setOcultarAvisoPreConsulta(ocultar) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!open) return
    const orig = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = orig }
  }, [open])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setPacienteDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (isRecorrente && dataAgendamento && diasSelecionados.length === 0) {
      const dateObj = new Date(`${dataAgendamento}T00:00:00`)
      let cancelled = false
      queueMicrotask(() => { if (!cancelled) setDiasSelecionados([dateObj.getDay()]) })
      return () => { cancelled = true }
    }
  }, [isRecorrente, dataAgendamento, diasSelecionados.length])

  useEffect(() => {
    if (modoRecorrencia !== 'livre' || !protocoloRecorrenteAtivo) return
    setSlotsLivres((prev) => {
      const target = totalSessoesConfiguradoNoAgendamento
      if (prev.length === target) return prev
      if (prev.length < target) {
        const last = prev[prev.length - 1]
        return [
          ...prev,
          ...Array.from({ length: target - prev.length }, (_, i) => ({
            id: String(Date.now() + i),
            data: '',
            hora_inicio: last?.hora_inicio ?? '',
            hora_fim: last?.hora_fim ?? '',
          })),
        ]
      }
      return prev.slice(0, target)
    })
  }, [totalSessoesConfiguradoNoAgendamento, modoRecorrencia, protocoloRecorrenteAtivo])

  useEffect(() => {
    setBloqueioAgenda(null)
    if (!selectedProfissionalId || !dataAgendamento || !horaInicioValue || !horaFimValue) {
      setVerificandoBloqueioAgenda(false)
      return
    }
    let active = true
    setVerificandoBloqueioAgenda(true)
    const id = window.setTimeout(() => {
      verificarBloqueioAgenda(selectedProfissionalId, dataAgendamento, horaInicioValue, horaFimValue)
        .then((res) => {
          if (!active) return
          if (res && 'bloqueado' in res && res.bloqueado) {
            setBloqueioAgenda({ mensagem: res.mensagem })
          }
        })
        .finally(() => { if (active) setVerificandoBloqueioAgenda(false) })
    }, 300)
    return () => { active = false; window.clearTimeout(id) }
  }, [selectedProfissionalId, dataAgendamento, horaInicioValue, horaFimValue])

  // ── Handlers ───────────────────────────────────────────────────────────────

  function getDuracaoTipo(tipoNome: string): number {
    return tiposAtivos.find((t) => t.nome === tipoNome)?.duracao_padrao_minutos ?? 60
  }

  function handleHoraInicioChange(v: string) {
    setHoraInicioValue(v)
    setHoraFimValue(somarMinutos(v, getDuracaoTipo(selectedTipo)))
  }

  function handleTipoChange(tipo: string) {
    setSelectedTipo(tipo)
    if (horaInicioValue) {
      setHoraFimValue(somarMinutos(horaInicioValue, getDuracaoTipo(tipo)))
    }
  }

  function selecionarPaciente(p: Paciente) {
    setSelectedPacienteId(p.id)
    setPacienteSearch(p.nome)
    setPacienteDropdownOpen(false)
    setErroPacientes('')
  }

  function toggleDia(val: number) {
    setDiasSelecionados((prev) => prev.includes(val) ? prev.filter((d) => d !== val) : [...prev, val])
  }

  function ajustarOcorrencias(delta: number) {
    const novo = Math.max(1, Math.min(365, (parseInt(ocorrencias) || 1) + delta))
    setOcorrencias(String(novo))
  }

  function handleIsRecorrenteChange(v: boolean) {
    setIsRecorrente(v)
    if (!v) { setModoRecorrencia('padrao'); setSlotsLivres([]) }
  }

  function handleModoRecorrenciaChange(v: 'padrao' | 'livre') {
    setModoRecorrencia(v)
    if (v === 'padrao') {
      setSlotsLivres([])
    } else {
      setSlotsLivres((prev) => {
        if (prev.length > 0) return prev
        const quantidade = protocoloRecorrenteAtivo ? tiposDoProtocolo.length : 1
        return Array.from({ length: quantidade }, (_, i) => ({
          id: String(Date.now() + i),
          data: i === 0 ? (dataAgendamento || '') : '',
          hora_inicio: horaInicioValue || '',
          hora_fim: horaFimValue || '',
        }))
      })
    }
  }

  function handleAddSlot() {
    setSlotsLivres((prev) => [
      ...prev,
      { id: String(Date.now()), data: '', hora_inicio: horaInicioValue || '', hora_fim: horaFimValue || '' },
    ])
  }

  function handleRemoveSlot(id: string) {
    setSlotsLivres((prev) => prev.filter((s) => s.id !== id))
  }

  function handleUpdateSlot(id: string, field: keyof Omit<SlotLivre, 'id'>, value: string) {
    setSlotsLivres((prev) => prev.map((s) => {
      if (s.id !== id) return s
      if (field === 'hora_inicio') return { ...s, hora_inicio: value, hora_fim: somarMinutos(value, getDuracaoTipo(selectedTipo)) }
      return { ...s, [field]: value }
    }))
  }

  function confirmarVinculoOrigem() {
    if (sugestaoConsultaOrigem) setOrigemConfirmadaId(sugestaoConsultaOrigem.id)
  }

  function dispensarVinculoOrigem() {
    setSugestaoDispensada(true)
  }

  function fecharPromptPreConsulta() {
    setPromptPreConsultaAtendimentoId(null)
    setErroPreConsultaPendente('')
  }

  async function confirmarPreConsultaPendente(naoMostrarNovamente: boolean) {
    if (!promptPreConsultaAtendimentoId) return
    setCriandoPreConsultaPendente(true)
    setErroPreConsultaPendente('')
    const res = await criarPreConsultaPendente({
      consultaMedicaAtendimentoId: promptPreConsultaAtendimentoId,
    })
    setCriandoPreConsultaPendente(false)
    if (res.error) {
      setErroPreConsultaPendente(res.error)
      return
    }
    if (naoMostrarNovamente) {
      setOcultarAvisoPreConsulta(true)
      salvarOcultarAvisoPreConsulta(true)
    }
    fecharPromptPreConsulta()
  }

  function handleClose() {
    if (isControlled && onControlledClose) onControlledClose()
    else setIsOpen(false)
  }

  function resetForm() {
    setMarcouRetorno(false)
    setIsRecorrente(false)
    setModoRecorrencia('padrao')
    setSlotsLivres([])
    setFrequencia('1')
    setDiasSelecionados([])
    setOcorrencias('1')
    setModoAtendimento('avulso')
    setSelectedProtocoloAtendimentoId('')
    setTotalSessoesAgendamentoProtocolo(1)
    setSessoesItensProtocolo({})
    setDataAgendamento('')
    if (!defaultPacienteId) { setSelectedPacienteId(''); setPacienteSearch('') }
    setSelectedTipo(primeiroTipoDisponivel)
    setTipoProfissional('fisioterapeuta')
    setSelectedPlanoSaude('')
    setSugestaoConsultaOrigem(null)
    setOrigemConfirmadaId(null)
    setSugestaoDispensada(false)
  }

  function aplicarProtocoloAtendimento(protocoloId: string) {
    setSelectedProtocoloAtendimentoId(protocoloId)
    if (!protocoloId) {
      setTotalSessoesAgendamentoProtocolo(1)
      setSessoesItensProtocolo({})
      setIsRecorrente(false)
      setModoRecorrencia('padrao')
      setSlotsLivres([])
      setOcorrencias('1')
      setSelectedTipo('')
      return
    }
    const protocolo = protocolosAtendimento.find((p) => p.id === protocoloId)
    const total = protocolo?.total_sessoes ?? 1
    setTotalSessoesAgendamentoProtocolo(total)
    const sessoesIniciais = Object.fromEntries(
      (protocolo?.itens ?? []).map((item) => [
        item.id,
        criarSessoesConsecutivas(Math.min(total, normalizarQuantidadeSessao(item.quantidade))),
      ]),
    )
    const sequencia = montarSequenciaProtocolo(protocolo ?? null, sessoesIniciais, total)
    setSessoesItensProtocolo(sessoesIniciais)
    if (sequencia.length > 0) {
      setSelectedTipo(sequencia[0] ?? '')
      setOcorrencias(String(Math.max(1, sequencia.length)))
      setIsRecorrente(sequencia.length > 1)
    }
  }

  function atualizarQuantidadeItemProtocolo(itemId: string, valor: string | number) {
    setSessoesItensProtocolo((prev) => {
      const proxQtd = normalizarQuantidadeItemProtocolo(valor, totalSessoesConfiguradoNoAgendamento)
      const proximo = {
        ...prev,
        [itemId]: ajustarSessoesParaQuantidade(prev[itemId], proxQtd, totalSessoesConfiguradoNoAgendamento),
      }
      if (protocoloAtendimentoSelecionado) {
        const seq = montarSequenciaProtocolo(protocoloAtendimentoSelecionado, proximo, totalSessoesConfiguradoNoAgendamento)
        setSelectedTipo(seq[0] ?? '')
        setOcorrencias(String(Math.max(1, seq.length)))
        setIsRecorrente(seq.length > 1)
      }
      return proximo
    })
  }

  function alternarSessaoItemProtocolo(itemId: string, sessao: number) {
    setSessoesItensProtocolo((prev) => {
      const atuais = normalizarSessoesSelecionadas(prev[itemId], totalSessoesConfiguradoNoAgendamento)
      const proximo = {
        ...prev,
        [itemId]: atuais.includes(sessao) ? atuais.filter((s) => s !== sessao) : [...atuais, sessao].sort((a, b) => a - b),
      }
      if (protocoloAtendimentoSelecionado) {
        const seq = montarSequenciaProtocolo(protocoloAtendimentoSelecionado, proximo, totalSessoesConfiguradoNoAgendamento)
        setSelectedTipo(seq[0] ?? '')
        setOcorrencias(String(Math.max(1, seq.length)))
        setIsRecorrente(seq.length > 1)
      }
      return proximo
    })
  }

  function atualizarTotalSessoesProtocoloAgendamento(valor: string | number) {
    const total = normalizarQuantidadeSessao(valor)
    setTotalSessoesAgendamentoProtocolo(total)
    setSessoesItensProtocolo((prev) => {
      const proximo = Object.fromEntries(
        Object.entries(prev).map(([id, sessoes]) => [id, normalizarSessoesSelecionadas(sessoes, total)]),
      )
      if (protocoloAtendimentoSelecionado) {
        const seq = montarSequenciaProtocolo(protocoloAtendimentoSelecionado, proximo, total)
        setSelectedTipo(seq[0] ?? '')
        setOcorrencias(String(Math.max(1, seq.length)))
        setIsRecorrente(seq.length > 1)
      }
      return proximo
    })
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
    if (tipoProfissional === 'medico') formData.set('plano_saude', selectedPlanoSaude)
    if (tipoProfissional === 'fisioterapeuta' && origemConfirmadaId && !sugestaoDispensada) {
      formData.set('agendamento_origem_id', origemConfirmadaId)
    }

    if (!selectedPacienteId || !selectedProfissionalId) {
      setError('Preencha todos os campos obrigatórios.')
      setLoading(false)
      return
    }
    if (modoRecorrencia !== 'livre' && (!dataAgendamento || !horaInicioValue || !horaFimValue)) {
      setError('Preencha todos os campos obrigatórios.')
      setLoading(false)
      return
    }
    if (modoRecorrencia === 'livre' && !modoEdicao) {
      if (slotsLivres.length === 0) {
        setError('Adicione ao menos uma data no modo de datas livres.')
        setLoading(false)
        return
      }
      if (slotsLivres.find((s) => !s.data || !s.hora_inicio || !s.hora_fim)) {
        setError('Preencha data e horário de todas as sessões.')
        setLoading(false)
        return
      }
    }
    if (!selectedTipo) {
      setError('Cadastre e selecione um tipo de atendimento.')
      setLoading(false)
      return
    }
    if (bloqueioAgenda) {
      setError(bloqueioAgenda.mensagem)
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
      if (isRecorrente && modoRecorrencia === 'livre') {
        formData.set('data', slotsLivres[0].data)
        formData.set('hora_inicio', slotsLivres[0].hora_inicio)
        formData.set('hora_fim', slotsLivres[0].hora_fim)
        formData.set('frequencia', 'livre')
        formData.set('dias_semana', '')
        formData.set('termina_em', 'ocorrencias')
        formData.set('ocorrencias', String(slotsLivres.length))
        formData.set('slots_livre_json', JSON.stringify(slotsLivres.map((s) => ({ data: s.data, hora_inicio: s.hora_inicio, hora_fim: s.hora_fim }))))
      } else if (isRecorrente) {
        formData.set('frequencia', frequencia)
        formData.set('dias_semana', diasSelecionados.join(','))
        formData.set('termina_em', 'ocorrencias')
        formData.set('ocorrencias', ocorrencias)
        if (!frequencia) { setError('Selecione a frequência da recorrência.'); setLoading(false); return }
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
      const atendimentoCriadoId = (res as { atendimentoCriadoId?: string } | undefined)?.atendimentoCriadoId
      if (!modoEdicao && profissionalSelecionadoEhMedico && atendimentoCriadoId) {
        setPromptPreConsultaAtendimentoId(atendimentoCriadoId)
      }
      handleClose()
      setLoading(false)
      if (!modoEdicao) resetForm()
    }
  }

  return {
    // Refs
    comboboxRef,
    // Form
    formId,
    open,
    loading,
    error,
    isControlled,
    modoEdicao,
    setIsOpen,
    handleClose,
    handleSubmit,
    // Paciente
    pacientes,
    pacientesFiltrados,
    loadingPacientes,
    erroPacientes,
    selectedPacienteId,
    pacienteSearch,
    setPacienteSearch,
    setSelectedPacienteId,
    pacienteDropdownOpen,
    setPacienteDropdownOpen,
    selecionarPaciente,
    // Profissional
    tipoProfissional,
    setTipoProfissional,
    selectedProfissionalId,
    setSelectedProfissionalId,
    profissionalSelecionado,
    profissionalSelecionadoEhMedico,
    profissionaisFiltrados,
    selectedPlanoSaude,
    setSelectedPlanoSaude,
    // Tipo de atendimento
    modoAtendimento,
    setModoAtendimento,
    selectedTipo,
    setSelectedTipo,
    handleTipoChange,
    opcoesTipoConsulta,
    tiposAtivos,
    // Protocolo
    selectedProtocoloAtendimentoId,
    protocoloAtendimentoSelecionado,
    itensProtocoloConfigurados,
    tiposDoProtocolo,
    totalSessoesConfiguradoNoAgendamento,
    protocoloRecorrenteAtivo,
    aplicarProtocoloAtendimento,
    atualizarQuantidadeItemProtocolo,
    alternarSessaoItemProtocolo,
    atualizarTotalSessoesProtocoloAgendamento,
    // Data / hora
    dataAgendamento,
    setDataAgendamento,
    diaDoMes,
    horaInicioValue,
    horaFimValue,
    setHoraFimValue,
    handleHoraInicioChange,
    // Disponibilidade
    disponibilidadeSelecionada,
    horarioPreenchido,
    horarioValidoNaDisponibilidade,
    bloqueioAgenda,
    verificandoBloqueioAgenda,
    // Recorrência
    isRecorrente,
    modoRecorrencia,
    slotsLivres,
    frequencia,
    setFrequencia,
    diasSelecionados,
    ocorrencias,
    setOcorrencias,
    handleIsRecorrenteChange,
    handleModoRecorrenciaChange,
    handleAddSlot,
    handleRemoveSlot,
    handleUpdateSlot,
    toggleDia,
    ajustarOcorrencias,
    // Outros
    marcouRetorno,
    setMarcouRetorno,
    observacoesValue,
    setObservacoesValue,
    loadingDetalhesAtendimento,
    planos,
    protocolosAtendimento,
    // Prompt "Tem pré-consulta?"
    promptPreConsultaAtendimentoId,
    criandoPreConsultaPendente,
    erroPreConsultaPendente,
    ocultarAvisoPreConsulta,
    confirmarPreConsultaPendente,
    fecharPromptPreConsulta,
    // Sugestão de vínculo pós-consulta
    sugestaoConsultaOrigem,
    origemConfirmadaId,
    sugestaoDispensada,
    confirmarVinculoOrigem,
    dispensarVinculoOrigem,
  }
}
