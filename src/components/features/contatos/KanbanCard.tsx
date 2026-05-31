'use client'

import { Calendar, ChevronLeft, ChevronRight, Clock, MessageCircle } from 'lucide-react'
import { format } from 'date-fns'
import type { ContatoPaciente } from '@/lib/contatos-kanban-data'
import { diasCor, diasDesde, getAvatarColor, getInitials, labelDias, whatsappLink } from './kanban-utils'

type KanbanCardProps = {
  contato: ContatoPaciente
  colIdx: number
  columnsLength: number
  onSelect: (contato: ContatoPaciente) => void
  onMoveLeft: (id: string, columnKey: string) => void
  onMoveRight: (id: string, columnKey: string) => void
}

export function KanbanCard({ contato, colIdx, columnsLength, onSelect, onMoveLeft, onMoveRight }: KanbanCardProps) {
  const dias = diasDesde(contato.ultimo_atendimento_data)
  const cor = dias !== null ? diasCor(dias) : '#9BB0AD'

  return (
    <div
      onClick={() => onSelect(contato)}
      className="bg-white rounded-lg border border-[#dee3e3] p-3.5 cursor-pointer hover:border-[#006b5a]/40 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start gap-2.5 mb-2.5">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 mt-0.5"
          style={{ backgroundColor: getAvatarColor(contato.nome) }}
        >
          {getInitials(contato.nome)}
        </div>
        <span className="font-semibold text-[#1A2E2B] text-sm leading-snug flex-1 line-clamp-2">
          {contato.nome}
        </span>
        {contato.telefone && (
          <a
            href={whatsappLink(contato.telefone)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/25 transition-colors opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
            title="Abrir WhatsApp"
          >
            <MessageCircle size={13} />
          </a>
        )}
      </div>

      {contato.telefone && (
        <div className="flex items-center gap-1.5 text-xs text-[#6d7a75] mb-2.5">
          <MessageCircle size={11} className="shrink-0 text-[#25D366]" />
          <span>{contato.telefone}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        {contato.ultimo_atendimento_data ? (
          <div className="flex items-center gap-1 text-xs text-[#9BB0AD]">
            <Calendar size={11} />
            <span>{format(new Date(contato.ultimo_atendimento_data), 'dd/MM/yy')}</span>
          </div>
        ) : (
          <span className="text-xs text-[#9BB0AD]">Sem atendimento</span>
        )}

        {dias !== null && (
          <div
            className="flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ color: cor, backgroundColor: cor + '18' }}
          >
            <Clock size={10} />
            <span>{labelDias(dias)}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#dee3e3]">
        {contato.responsavel_nome ? (
          <div className="flex items-center gap-1.5">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
              style={{ backgroundColor: getAvatarColor(contato.responsavel_nome) }}
              title={contato.responsavel_nome}
            >
              {getInitials(contato.responsavel_nome)}
            </div>
            <span className="text-[11px] text-[#6d7a75] truncate max-w-[100px]">
              {contato.responsavel_nome.split(' ')[0]}
            </span>
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full border border-dashed border-[#bcc9c4] flex items-center justify-center">
            <span className="text-[8px] text-[#9BB0AD]">?</span>
          </div>
        )}

        <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
          {colIdx > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMoveLeft(contato.id, contato.kanban_coluna_chave)
              }}
              className="w-7 h-7 lg:w-5 lg:h-5 flex items-center justify-center rounded bg-[#f0f5f4] hover:bg-[#dee3e3] text-[#6d7a75] transition-colors"
              title="Mover para coluna anterior"
            >
              <ChevronLeft size={11} />
            </button>
          )}
          {colIdx < columnsLength - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMoveRight(contato.id, contato.kanban_coluna_chave)
              }}
              className="w-7 h-7 lg:w-5 lg:h-5 flex items-center justify-center rounded bg-[#f0f5f4] hover:bg-[#dee3e3] text-[#6d7a75] transition-colors"
              title="Mover para proxima coluna"
            >
              <ChevronRight size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
