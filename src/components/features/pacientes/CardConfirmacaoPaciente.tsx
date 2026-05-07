'use client'

import { useState, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import { MoreVertical, CheckCircle, XCircle, Phone, RefreshCw, AlertCircle, User } from 'lucide-react'
import { BtnWhatsApp } from '../shared'
import { ModalSessaoReposicao } from '../shared'
import { registrarContato, obterProximaData, adicionarSessaoReposicao, criarAtendimentoReagendado } from '@/actions/confirmacoes'
import toast from 'react-hot-toast'

type Paciente = {
  id: string
  nome: string
  telefone: string
  data_agendamento: string
  tipo: string
  atendimento_id: string
  agendamento_id?: string | null
  profissional_nome?: string
  numero_sessao?: number
  total_sessoes?: number
  contato_confirmacao?: string | null
}

type Props = {
  paciente: Paciente
  showDate?: boolean
}

const OPCOES_CONTATO = [
  { valor: 'confirmou', label: 'Confirmou presença', Icon: CheckCircle, cor: 'text-[#006b5a]' },
  { valor: 'vai_faltar', label: 'Vai faltar', Icon: XCircle, cor: 'text-red-500' },
  { valor: 'nao_atendeu', label: 'Não atendeu', Icon: Phone, cor: 'text-slate-500' },
  { valor: 'reagendou', label: 'Reagendou', Icon: RefreshCw, cor: 'text-slate-600' },
]

const MENU_WIDTH = 200
const MENU_HEIGHT = 180

export function CardConfirmacaoPaciente({ paciente, showDate = false }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [modalAberto, setModalAberto] = useState<'vai_faltar' | 'reagendou' | null>(null)
  const [proximaData, setProximaData] = useState<string | undefined>()
  const [proximaHora, setProximaHora] = useState<string | undefined>()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const naoAtendeu = paciente.contato_confirmacao === 'nao_atendeu'

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(event.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleOpen(e: React.MouseEvent) {
    e.preventDefault()
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight

      const top = vh - rect.bottom > MENU_HEIGHT
        ? rect.bottom + 6
        : Math.max(8, rect.top - MENU_HEIGHT - 6)

      const left = Math.min(
        Math.max(8, rect.right - MENU_WIDTH),
        vw - MENU_WIDTH - 8
      )

      setPos({ top, left })
    }
    setIsOpen(prev => !prev)
  }

  async function handleRegistrarContato(resultado: 'confirmou' | 'vai_faltar' | 'nao_atendeu' | 'reagendou') {
    setIsOpen(false)

    const horaAtual = format(new Date(paciente.data_agendamento), 'HH:mm')

    if (resultado === 'vai_faltar' || resultado === 'reagendou') {
      setIsUpdating(true)
      const proxima = await obterProximaData(paciente.atendimento_id)
      setIsUpdating(false)
      setProximaData(proxima?.data ?? undefined)
      setProximaHora(horaAtual)
      setModalAberto(resultado)
      return
    }

    setIsUpdating(true)
    const res = await registrarContato(paciente.atendimento_id, resultado)
    setIsUpdating(false)

    if (res.error) {
      toast.error(res.error)
      return
    }

    if (resultado === 'nao_atendeu') {
      toast(`${paciente.nome} — Não atendeu. Card mantido como prioridade.`, {
        icon: '📵',
        duration: 4000,
      })
    } else {
      const opcao = OPCOES_CONTATO.find(o => o.valor === resultado)
      toast.success(`${paciente.nome} — ${opcao?.label ?? resultado}`)
    }
  }

  async function handleModalClose(agendado: boolean) {
    const tipo = modalAberto
    setModalAberto(null)
    setProximaData(undefined)
    setProximaHora(undefined)

    if (!tipo || !agendado) return

    const res = await registrarContato(paciente.atendimento_id, tipo)
    if (res.error) {
      toast.error(res.error)
    } else {
      const label = tipo === 'vai_faltar' ? 'Falta registrada' : 'Reagendamento registrado'
      toast.success(`${paciente.nome} — ${label}`)
    }
  }

  const iniciais = paciente.nome.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()

  return (
    <>
      <div className={`bg-white rounded-xl shadow-sm border transition-shadow hover:shadow-md ${
        naoAtendeu
          ? 'border-orange-300 ring-1 ring-orange-200'
          : 'border-slate-100'
      }`}>
        {/* Banner de "Não atendeu" */}
        {naoAtendeu && (
          <div className="flex items-center gap-2 px-4 pt-3 pb-0">
            <AlertCircle size={14} className="text-orange-500 shrink-0" />
            <span className="text-xs font-semibold text-orange-600">Não atendeu — tentativa anterior</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 p-4">
          {/* Info do paciente */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
              naoAtendeu ? 'bg-orange-100 text-orange-600' : 'bg-[#006b5a]/10 text-[#006b5a]'
            }`}>
              {iniciais}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 truncate">{paciente.nome}</h3>
                {paciente.total_sessoes && paciente.total_sessoes > 1 && (
                  <span className="text-xs font-medium px-2 py-0.5 bg-[#006b5a]/10 text-[#006b5a] rounded-full whitespace-nowrap">
                    {paciente.numero_sessao}/{paciente.total_sessoes}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {paciente.tipo} •{' '}
                {showDate
                  ? format(new Date(paciente.data_agendamento), "dd/MM 'às' HH:mm")
                  : format(new Date(paciente.data_agendamento), 'HH:mm')}
              </p>
              {paciente.profissional_nome && (
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 truncate">
                  <User size={12} className="shrink-0" />
                  <span className="truncate">{paciente.profissional_nome}</span>
                </p>
              )}
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-2 shrink-0">
            <BtnWhatsApp numero={paciente.telefone} paciente={paciente} />

            <button
              ref={buttonRef}
              onClick={handleOpen}
              disabled={isUpdating}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                isOpen ? 'bg-slate-100 text-[#171d1c]' : 'text-[#3d4945]/50 hover:text-[#171d1c] hover:bg-slate-100'
              } ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
              title="Opções"
            >
              <MoreVertical size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && pos && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="w-52 bg-white border border-slate-200 rounded-xl shadow-lg py-2"
        >
          {OPCOES_CONTATO.map((opcao) => {
            const Icone = opcao.Icon
            const isAtual = paciente.contato_confirmacao === opcao.valor
            return (
              <button
                key={opcao.valor}
                onClick={() => handleRegistrarContato(opcao.valor as any)}
                disabled={isUpdating || isAtual}
                className={`w-full px-4 py-2.5 flex items-center gap-3 text-sm font-medium transition-colors ${
                  isAtual
                    ? 'bg-slate-50 text-slate-400 cursor-default'
                    : 'hover:bg-slate-50 text-slate-700'
                } disabled:opacity-50`}
              >
                <Icone size={16} className={isAtual ? 'text-slate-400' : opcao.cor} />
                {opcao.label}
                {isAtual && <span className="ml-auto text-[10px] text-slate-400">atual</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* Modal de sessão de reposição */}
      {modalAberto && paciente.agendamento_id && (
        <ModalSessaoReposicao
          pacienteNome={paciente.nome}
          defaultData={proximaData}
          defaultHora={proximaHora}
          onClose={() => handleModalClose(false)}
          onSaved={() => handleModalClose(true)}
          onSalvarCustom={
            paciente.agendamento_id
              ? (data, hora) => adicionarSessaoReposicao(paciente.agendamento_id!, paciente.atendimento_id, data, hora)
              : (data, hora) => criarAtendimentoReagendado(paciente.atendimento_id, data, hora)
          }
        />
      )}
    </>
  )
}
