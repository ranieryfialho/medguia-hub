'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical, CheckCircle, Hourglass, Stethoscope, CheckCheck, XCircle, UserX, RefreshCw } from 'lucide-react'
import { mudarStatusAgendamento } from '@/actions/agenda'
import { obterProximaData, registrarContato, criarAtendimentoReagendado, adicionarSessaoReposicao } from '@/actions/confirmacoes'
import { ModalSessaoReposicao } from '../shared'
import { ConfirmacaoFaltaModal } from './AgendamentoItem'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const OPCOES_STATUS = [
  { valor: 'Confirmado', label: 'Confirmado', Icon: CheckCircle, cor: 'text-[#006b5a]' },
  { valor: 'Aguardando', label: 'Aguardando', Icon: Hourglass, cor: 'text-[#6d7a75]' },
  { valor: 'Em Atendimento', label: 'Em Atendimento', Icon: Stethoscope, cor: 'text-[#406375]' },
  { valor: 'Concluído', label: 'Concluído', Icon: CheckCheck, cor: 'text-[#4f625d]' },
  { valor: 'Cancelado', label: 'Cancelado', Icon: XCircle, cor: 'text-[#ba1a1a]' },
  { valor: 'Falta', label: 'Falta', Icon: UserX, cor: 'text-[#3d4945]' },
  { valor: '__reagendar__', label: 'Reagendar', Icon: RefreshCw, cor: 'text-[#779aad]' },
]

const MENU_WIDTH = 192  // w-48
const MENU_HEIGHT = 310 // estimated: header + 7 items

interface MenuAcoesAgendamentoProps {
  id: string
  statusAtual: string
  onOpenChange?: (open: boolean) => void
  atendimentoId?: string
  agendamentoId?: string
  pacienteNome?: string
  dataAgendamento?: string
}

export function MenuAcoesAgendamento({ id, statusAtual, onOpenChange, atendimentoId, agendamentoId, pacienteNome, dataAgendamento }: MenuAcoesAgendamentoProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [modalAberto, setModalAberto] = useState<'confirmacao_falta' | 'reagendamento' | null>(null)
  const [proximaData, setProximaData] = useState<string | undefined>()
  const [proximaHora, setProximaHora] = useState<string | undefined>()
  const [mounted, setMounted] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  function setOpen(value: boolean) {
    setIsOpen(value)
    onOpenChange?.(value)
  }

  // Fecha o menu ao clicar fora — desativado quando modal está aberto
  useEffect(() => {
    if (modalAberto) return

    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(event.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [modalAberto])

  function handleOpen(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
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
    setOpen(!isOpen)
  }

  async function handleMudarStatus(novoStatus: string) {
    if (novoStatus === statusAtual) {
      setOpen(false)
      return
    }

    // "Falta": abre modal de confirmação com opção de reagendar
    if (novoStatus === 'Falta') {
      setModalAberto('confirmacao_falta')
      setOpen(false)
      return
    }

    // "Reagendamento": abre modal para escolher nova data (recorrente ou único)
    if (novoStatus === '__reagendar__' && atendimentoId && dataAgendamento) {
      const horaAtual = format(new Date(dataAgendamento), 'HH:mm')
      setProximaData(undefined)
      setProximaHora(horaAtual)
      setModalAberto('reagendamento')
      setOpen(false)
      return
    }

    // Demais status: muda diretamente
    setIsUpdating(true)
    await mudarStatusAgendamento(id, novoStatus)
    setIsUpdating(false)
    setOpen(false)
  }

  async function handleConfirmarFalta(reagendar: boolean) {
    setModalAberto(null)
    setIsUpdating(true)
    await mudarStatusAgendamento(id, 'Falta')
    setIsUpdating(false)
    toast.success(`${pacienteNome} — Falta registrada`)
    if (reagendar && atendimentoId && dataAgendamento) {
      const proxima = agendamentoId ? await obterProximaData(atendimentoId) : null
      const horaAtual = format(new Date(dataAgendamento), 'HH:mm')
      setProximaData(proxima?.data ?? undefined)
      setProximaHora(horaAtual)
      setModalAberto('reagendamento')
    }
  }

  async function handleModalClose(agendado: boolean) {
    const tipo = modalAberto
    setModalAberto(null)
    setProximaData(undefined)
    setProximaHora(undefined)

    if (!atendimentoId) return

    if (tipo === 'reagendamento') {
      if (agendado) {
        const res = await registrarContato(atendimentoId, 'reagendou')
        if (res.error) {
          toast.error(res.error)
        } else {
          toast.success(`${pacienteNome} — Reagendado`)
        }
      }
    }
  }

  return (
    <>
      <div className="flex items-center">
        <button
          ref={buttonRef}
          onClick={handleOpen}
          disabled={isUpdating}
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${isOpen ? 'bg-[#dee3e3] text-[#171d1c]' : 'text-[#3d4945]/50 hover:text-[#171d1c] hover:bg-[#dee3e3]'} ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
        >
          <MoreVertical size={18} />
        </button>

        {isOpen && pos && (
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
            className="w-48 bg-white border border-[#bcc9c4]/30 rounded-xl shadow-lg py-2"
          >
            <div className="px-3 py-1.5 mb-1 text-[10px] font-bold text-[#3d4945]/50 uppercase tracking-widest border-b border-[#bcc9c4]/20">
              Alterar Status
            </div>

            {OPCOES_STATUS.map((opcao) => {
              const isAtivo = opcao.valor !== '__reagendar__' && statusAtual.toLowerCase() === opcao.valor.toLowerCase()
              const Icone = opcao.Icon

              return (
                <button
                  key={opcao.valor}
                  onClick={(e) => {
                    e.preventDefault()
                    handleMudarStatus(opcao.valor)
                  }}
                  disabled={isAtivo}
                  className={`w-full px-3 py-2 flex items-center gap-2 text-xs font-bold transition-colors ${
                    isAtivo
                      ? 'bg-[#f0f5f4] text-[#171d1c] cursor-default'
                      : `text-[#3d4945] hover:bg-[#f0f5f4] hover:${opcao.cor}`
                  }`}
                >
                  <Icone size={14} className={isAtivo ? opcao.cor : 'opacity-70'} />
                  {opcao.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {mounted && modalAberto === 'confirmacao_falta' && createPortal(
        <ConfirmacaoFaltaModal
          onConfirmar={handleConfirmarFalta}
          onCancelar={() => setModalAberto(null)}
        />,
        document.body
      )}

      {mounted && modalAberto === 'reagendamento' && atendimentoId && createPortal(
        <ModalSessaoReposicao
          pacienteNome={pacienteNome || 'Paciente'}
          defaultData={proximaData}
          defaultHora={proximaHora}
          onClose={() => handleModalClose(false)}
          onSaved={() => handleModalClose(true)}
          onSalvarCustom={
            agendamentoId && atendimentoId
              ? (data, hora) => adicionarSessaoReposicao(agendamentoId, atendimentoId, data, hora)
              : (data, hora) => criarAtendimentoReagendado(atendimentoId ?? '', data, hora)
          }
        />,
        document.body
      )}
    </>
  )
}
