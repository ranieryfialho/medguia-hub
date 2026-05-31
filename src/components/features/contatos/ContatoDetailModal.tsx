'use client'

import { ChevronDown, ChevronUp, ExternalLink, MessageCircle, Send, StickyNote, UserCircle2, X } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { getVisualColunaContato, type KanbanColunaContato } from '@/lib/contatos-kanban'
import type { ContatoPaciente, ProfileSimples } from '@/lib/contatos-kanban-data'
import { getAvatarColor, getInitials, interpolarTemplate, whatsappLink, whatsappLinkComMsg, type Nota, type Template } from './kanban-utils'

type ContatoDetailModalProps = {
  selected: ContatoPaciente
  selectedColumn: KanbanColunaContato | null
  notas: Nota[]
  loadingNotas: boolean
  novaNotaTexto: string
  onNovaNotaTextoChange: (v: string) => void
  mobileModalTab: 'detalhes' | 'notas'
  onMobileModalTabChange: (tab: 'detalhes' | 'notas') => void
  columns: KanbanColunaContato[]
  profiles: ProfileSimples[]
  localTemplates: Template[]
  templatePickerOpen: boolean
  onTemplatePickerOpenChange: (v: boolean) => void
  onClose: () => void
  onMoveContato: (pacienteId: string, columnKey: string) => void
  onResponsavelChange: (responsavelId: string) => void
  onAddNota: () => void
  onMoveTemplate: (id: string, dir: 'up' | 'down') => void
}

export function ContatoDetailModal({
  selected, selectedColumn,
  notas, loadingNotas, novaNotaTexto, onNovaNotaTextoChange,
  mobileModalTab, onMobileModalTabChange,
  columns, profiles, localTemplates,
  templatePickerOpen, onTemplatePickerOpenChange,
  onClose, onMoveContato, onResponsavelChange, onAddNota, onMoveTemplate,
}: ContatoDetailModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-[#171d1c]/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-7xl max-h-[95vh] flex flex-col lg:flex-row overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile header */}
        <div className="w-full border-b border-[#dee3e3] bg-white/95 backdrop-blur-sm lg:hidden rounded-t-2xl sm:rounded-none">
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-12 h-1.5 rounded-full bg-[#dee3e3]"></div>
          </div>
          <div className="px-4 pb-4 flex items-start gap-3 mt-1">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ backgroundColor: getAvatarColor(selected.nome) }}
            >
              {getInitials(selected.nome)}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-[#083142] truncate">{selected.nome}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {selectedColumn && (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      color: getVisualColunaContato(selectedColumn).cor,
                      backgroundColor: getVisualColunaContato(selectedColumn).corBadgeBg,
                    }}
                  >
                    {selectedColumn.nome}
                  </span>
                )}
                {selected.telefone && (
                  <span className="text-xs text-[#6d7a75] truncate">{selected.telefone}</span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#f0f5f4] text-[#9BB0AD] hover:text-[#3d4945] transition-colors shrink-0"
            >
              <X size={16} />
            </button>
          </div>
          <div className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-2 bg-[#f0f5f4] p-1 rounded-xl">
              <button
                onClick={() => onMobileModalTabChange('detalhes')}
                className={`px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${mobileModalTab === 'detalhes' ? 'bg-white text-[#006b5a] shadow-sm' : 'text-[#6d7a75]'}`}
              >
                Detalhes
              </button>
              <button
                onClick={() => onMobileModalTabChange('notas')}
                className={`px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${mobileModalTab === 'notas' ? 'bg-white text-[#006b5a] shadow-sm' : 'text-[#6d7a75]'}`}
              >
                Notas
              </button>
            </div>
          </div>
        </div>

        {/* Notes panel */}
        <div className={`${mobileModalTab === 'notas' ? 'flex' : 'hidden'} lg:flex flex-1 flex-col min-w-0 min-h-0`}>
          <div className="hidden lg:flex px-5 py-4 border-b border-[#dee3e3] items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ backgroundColor: getAvatarColor(selected.nome) }}
            >
              {getInitials(selected.nome)}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-[#083142] truncate">{selected.nome}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                {selectedColumn && (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      color: getVisualColunaContato(selectedColumn).cor,
                      backgroundColor: getVisualColunaContato(selectedColumn).corBadgeBg,
                    }}
                  >
                    {selectedColumn.nome}
                  </span>
                )}
                {selected.telefone && (
                  <span className="text-xs text-[#6d7a75]">{selected.telefone}</span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="ml-auto p-1.5 rounded-lg hover:bg-[#f0f5f4] text-[#9BB0AD] hover:text-[#3d4945] transition-colors shrink-0"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {loadingNotas ? (
              <div className="flex items-center justify-center h-24 text-sm text-[#9BB0AD]">
                Carregando notas...
              </div>
            ) : notas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-[#9BB0AD]">
                <StickyNote size={28} strokeWidth={1.5} />
                <p className="text-sm">Nenhuma nota ainda. Adicione a primeira abaixo.</p>
              </div>
            ) : (
              notas.map((nota) => (
                <div key={nota.id} className="bg-[#f0f5f4] rounded-xl px-4 py-3">
                  <p className="text-sm text-[#1A2E2B] whitespace-pre-wrap">{nota.texto}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[11px] text-[#9BB0AD]">
                      {format(new Date(nota.criado_em), "dd 'de' MMM 'as' HH:mm", { locale: ptBR })}
                    </p>
                    {nota.autor_nome && (
                      <p className="text-[10px] font-semibold text-[#006b5a] bg-white px-2 py-1 rounded">
                        {nota.autor_nome}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="px-5 py-3 border-t border-[#dee3e3] flex gap-2">
            <input
              type="text"
              value={novaNotaTexto}
              onChange={(e) => onNovaNotaTextoChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  onAddNota()
                }
              }}
              placeholder="Adicionar nota de contato..."
              className="flex-1 border border-[#dee3e3] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#006b5a] bg-[#f0f5f4]/50"
            />
            <button
              onClick={onAddNota}
              disabled={!novaNotaTexto.trim()}
              className="px-3 py-2 bg-[#006b5a] text-white rounded-lg hover:bg-[#004f43] transition-colors disabled:opacity-40 flex items-center gap-1.5 text-sm font-semibold"
            >
              <Send size={14} />
            </button>
          </div>
        </div>

        {/* Details panel */}
        <div className={`${mobileModalTab === 'detalhes' ? 'block' : 'hidden'} lg:block lg:w-96 flex-none border-t lg:border-t-0 lg:border-l border-[#dee3e3] bg-[#f0f5f4]/40 p-4 lg:p-5 space-y-4 lg:space-y-5 overflow-y-auto max-h-[95vh] lg:max-h-none`}>
          <div>
            <p className="text-[10px] text-[#9BB0AD] font-semibold uppercase tracking-wider mb-1.5">Etapa</p>
            <select
              value={selected.kanban_coluna_chave}
              onChange={(e) => onMoveContato(selected.id, e.target.value)}
              className="w-full border border-[#dee3e3] rounded-lg px-2.5 py-2 text-sm text-[#1A2E2B] focus:outline-none focus:border-[#006b5a] bg-white"
            >
              {columns.map((column) => (
                <option key={column.chave} value={column.chave}>{column.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-[10px] text-[#9BB0AD] font-semibold uppercase tracking-wider mb-1.5">Responsavel</p>
            <select
              value={selected.responsavel_id ?? ''}
              onChange={(e) => onResponsavelChange(e.target.value)}
              className="w-full border border-[#dee3e3] rounded-lg px-2.5 py-2 text-sm text-[#1A2E2B] focus:outline-none focus:border-[#006b5a] bg-white"
            >
              <option value="">Sem responsavel</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-[10px] text-[#9BB0AD] font-semibold uppercase tracking-wider mb-1.5">Ultimo atendimento</p>
            {selected.ultimo_atendimento_data ? (
              <>
                <p className="text-sm font-semibold text-[#1A2E2B]">
                  {format(new Date(selected.ultimo_atendimento_data), "dd 'de' MMM, yyyy", { locale: ptBR })}
                </p>
                {selected.ultimo_atendimento_tipo && (
                  <p className="text-xs text-[#6d7a75] mt-0.5">{selected.ultimo_atendimento_tipo}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-[#9BB0AD]">Nenhum registro</p>
            )}
          </div>

          {selected.telefone && (
            <div>
              <p className="text-[10px] text-[#9BB0AD] font-semibold uppercase tracking-wider mb-2">Contato rapido</p>
              <a
                href={whatsappLink(selected.telefone)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 w-full px-3 py-2 bg-[#25D366] text-white rounded-lg text-xs font-bold hover:bg-[#1da851] transition-colors"
              >
                <MessageCircle size={13} />
                WhatsApp
              </a>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-[#9BB0AD] font-semibold uppercase tracking-wider">Mensagem pronta</p>
              <a
                href="/confirmacoes/mensagens"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-0.5 text-[10px] text-[#006b5a] hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Gerenciar
                <ExternalLink size={9} />
              </a>
            </div>

            {localTemplates.length === 0 ? (
              <p className="text-xs text-[#9BB0AD]">Nenhum template cadastrado.</p>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => onTemplatePickerOpenChange(!templatePickerOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-white border border-[#dee3e3] rounded-lg text-xs font-medium text-[#1A2E2B] hover:border-[#006b5a]/40 transition-colors"
                >
                  <span>Escolher modelo</span>
                  <ChevronDown size={13} className={`transition-transform ${templatePickerOpen ? 'rotate-180' : ''}`} />
                </button>

                {templatePickerOpen && selected.telefone && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {localTemplates.map((t, idx) => (
                      <div
                        key={t.id}
                        className="bg-white border border-[#dee3e3] rounded-lg p-3 hover:border-[#25D366]/50 hover:bg-[#f0fdf9] transition-colors flex items-start gap-2"
                      >
                        <div className="flex flex-col shrink-0 mt-0.5 -ml-0.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); onMoveTemplate(t.id, 'up') }}
                            disabled={idx === 0}
                            className="p-0.5 text-[#c3d0ce] hover:text-[#006b5a] disabled:opacity-25 disabled:cursor-default transition-colors"
                          >
                            <ChevronUp size={12} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onMoveTemplate(t.id, 'down') }}
                            disabled={idx === localTemplates.length - 1}
                            className="p-0.5 text-[#c3d0ce] hover:text-[#006b5a] disabled:opacity-25 disabled:cursor-default transition-colors"
                          >
                            <ChevronDown size={12} />
                          </button>
                        </div>
                        <a
                          href={whatsappLinkComMsg(selected.telefone, interpolarTemplate(t.conteudo, selected))}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-start gap-2 flex-1 min-w-0"
                        >
                          <MessageCircle size={14} className="shrink-0 mt-1 text-[#25D366]" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-[#1A2E2B]">{t.nome}</p>
                            <p className="text-[10px] text-[#9BB0AD] mt-1.5 whitespace-pre-wrap leading-relaxed line-clamp-4">
                              {interpolarTemplate(t.conteudo, selected)}
                            </p>
                          </div>
                        </a>
                      </div>
                    ))}
                  </div>
                )}

                {templatePickerOpen && !selected.telefone && (
                  <p className="text-xs text-[#9BB0AD] px-1">Paciente sem telefone cadastrado.</p>
                )}
              </div>
            )}
          </div>

          {selected.email && (
            <div>
              <p className="text-[10px] text-[#9BB0AD] font-semibold uppercase tracking-wider mb-1.5">Email</p>
              <p className="text-xs text-[#1A2E2B] break-all">{selected.email}</p>
            </div>
          )}

          {!selected.telefone && !selected.email && (
            <div className="flex flex-col items-center gap-2 py-4 text-[#9BB0AD]">
              <UserCircle2 size={28} strokeWidth={1.5} />
              <p className="text-xs text-center">Nenhum contato cadastrado</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
