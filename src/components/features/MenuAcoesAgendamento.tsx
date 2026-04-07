'use client'

import { useState, useRef, useEffect } from 'react'
import { MoreVertical, CheckCircle, Hourglass, Stethoscope, CheckCheck, XCircle, UserX, RefreshCw } from 'lucide-react'
import { mudarStatusAgendamento } from '@/actions/agenda'

const OPCOES_STATUS = [
  { valor: 'Confirmado', label: 'Confirmado', Icon: CheckCircle, cor: 'text-[#006b5a]' },
  { valor: 'Aguardando', label: 'Aguardando', Icon: Hourglass, cor: 'text-[#6d7a75]' },
  { valor: 'Em Atendimento', label: 'Em Atendimento', Icon: Stethoscope, cor: 'text-[#406375]' },
  { valor: 'Concluído', label: 'Concluído', Icon: CheckCheck, cor: 'text-[#4f625d]' },
  { valor: 'Cancelado', label: 'Cancelado', Icon: XCircle, cor: 'text-[#ba1a1a]' },
  { valor: 'Falta', label: 'Falta', Icon: UserX, cor: 'text-[#3d4945]' },
  { valor: 'Reposição', label: 'Reposição', Icon: RefreshCw, cor: 'text-[#779aad]' },
]

const MENU_WIDTH = 192  // w-48
const MENU_HEIGHT = 310 // estimated: header + 7 items

export function MenuAcoesAgendamento({ id, statusAtual, onOpenChange }: { id: string, statusAtual: string, onOpenChange?: (open: boolean) => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  function setOpen(value: boolean) {
    setIsOpen(value)
    onOpenChange?.(value)
  }

  useEffect(() => {
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
  }, [])

  function handleOpen(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight

      // Vertical: open downward, flip upward if not enough space below
      const top = vh - rect.bottom > MENU_HEIGHT
        ? rect.bottom + 6
        : Math.max(8, rect.top - MENU_HEIGHT - 6)

      // Horizontal: right-align with button, clamp within viewport
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
    setIsUpdating(true)
    await mudarStatusAgendamento(id, novoStatus)
    setIsUpdating(false)
    setOpen(false)
  }

  return (
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
            const isAtivo = statusAtual.toLowerCase() === opcao.valor.toLowerCase()
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
  )
}
