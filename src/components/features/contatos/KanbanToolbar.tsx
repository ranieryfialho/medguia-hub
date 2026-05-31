'use client'

import { Plus, Search, UserCircle2, X } from 'lucide-react'
import { getVisualColunaContato, type KanbanColunaContato } from '@/lib/contatos-kanban'
import type { ProfileSimples } from '@/lib/contatos-kanban-data'
import { getAvatarColor, getInitials } from './kanban-utils'

type ProfileComContagem = ProfileSimples & { count: number }

type KanbanToolbarProps = {
  search: string
  onSearchChange: (v: string) => void
  responsavelFilter: string | null
  onResponsavelFilterChange: (v: string | null) => void
  teamFilterOpen: boolean
  onTeamFilterOpenChange: (v: boolean) => void
  profiles: ProfileSimples[]
  profilesComContagem: ProfileComContagem[]
  semResponsavelCount: number
  columns: KanbanColunaContato[]
  columnTotals: Record<string, number>
  totalFiltered: number
  contatosCount: number
  loadingBoard: boolean
  loadingBaseBatches: Record<string, boolean>
  totalAvailableBaseCards: number
  baseSeedColumnKey: string
  canManageColumns: boolean
  onAddBaseBatch: (columnKey: string) => void
  onOpenCreateColumnModal: () => void
}

export function KanbanToolbar({
  search, onSearchChange,
  responsavelFilter, onResponsavelFilterChange,
  teamFilterOpen, onTeamFilterOpenChange,
  profiles, profilesComContagem, semResponsavelCount,
  columns, columnTotals, totalFiltered, contatosCount,
  loadingBoard, loadingBaseBatches, totalAvailableBaseCards, baseSeedColumnKey,
  canManageColumns,
  onAddBaseBatch, onOpenCreateColumnModal,
}: KanbanToolbarProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#dee3e3] p-3 sm:p-4 shadow-sm flex flex-col gap-2.5 sm:gap-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BB0AD] pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar paciente..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 border border-[#dee3e3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#006b5a]/20 focus:border-[#006b5a] bg-[#f8faf9] transition-all"
          />
        </div>

        {profiles.length > 0 && (
          <button
            onClick={() => onTeamFilterOpenChange(!teamFilterOpen)}
            className={`sm:hidden relative shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border transition-all ${
              teamFilterOpen || responsavelFilter
                ? 'bg-[#006b5a] border-[#006b5a] text-white'
                : 'bg-white border-[#dee3e3] text-[#6d7a75]'
            }`}
            title="Filtrar por responsavel"
          >
            <UserCircle2 size={18} />
            {responsavelFilter && !teamFilterOpen && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-white border border-[#006b5a]" />
            )}
          </button>
        )}

        {(search || responsavelFilter) && (
          <button
            onClick={() => { onSearchChange(''); onResponsavelFilterChange(null); onTeamFilterOpenChange(false) }}
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl text-[#ba1a1a] bg-[#ba1a1a]/8 hover:bg-[#ba1a1a]/15 border border-[#ba1a1a]/20 transition-colors"
            title="Limpar filtros"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        )}

        <button
          onClick={() => onAddBaseBatch(baseSeedColumnKey)}
          disabled={loadingBoard || loadingBaseBatches[baseSeedColumnKey] || totalAvailableBaseCards <= 0}
          className="shrink-0 h-10 px-3 sm:px-4 flex items-center justify-center gap-2 rounded-xl border border-[#dee3e3] bg-white text-[#083142] text-sm font-bold hover:border-[#006b5a]/35 hover:text-[#006b5a] transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          title={totalAvailableBaseCards > 0 ? 'Adicionar cards da base' : 'Nenhum paciente disponivel para adicionar'}
        >
          <Plus size={16} strokeWidth={2.5} />
          <span className="hidden sm:inline">Adicionar cards</span>
          <span className="rounded-full bg-[#f0f5f4] px-2 py-0.5 text-[11px] text-[#6d7a75]">
            {totalAvailableBaseCards}
          </span>
        </button>

        {canManageColumns && (
          <button
            onClick={onOpenCreateColumnModal}
            className="shrink-0 w-10 h-10 sm:w-auto sm:px-4 flex items-center justify-center gap-2 rounded-xl bg-[#006b5a] text-white text-sm font-bold hover:bg-[#004f43] transition-all shadow-sm active:scale-95"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span className="hidden sm:inline">Nova coluna</span>
          </button>
        )}

        <div className="hidden lg:flex items-center gap-2.5 border-l border-[#dee3e3] pl-3 shrink-0">
          {columns.map((column) => {
            const count = columnTotals[column.chave] ?? 0
            const visual = getVisualColunaContato(column)
            return (
              <span key={column.chave} className="text-[11px] font-bold" style={{ color: visual.cor }}>
                {count}
              </span>
            )
          })}
          <span className="text-[11px] font-bold text-[#9BB0AD] bg-[#f0f5f4] px-2 py-1 rounded-lg border border-[#dee3e3]">
            {totalFiltered} total
          </span>
        </div>
      </div>

      {profiles.length > 0 && (
        <div className={`${teamFilterOpen ? 'flex' : 'hidden'} sm:flex items-center gap-2 sm:gap-3`}>
          <span className="text-[10px] text-[#9BB0AD] font-bold uppercase tracking-wider shrink-0 hidden sm:block">
            Equipe
          </span>
          <div className="relative flex-1 min-w-0">
            <div className="flex gap-2 overflow-x-auto hide-scrollbar snap-x py-1 pr-6">
              <button
                onClick={() => onResponsavelFilterChange(responsavelFilter === '__none__' ? null : '__none__')}
                className={`relative shrink-0 snap-start w-9 h-9 rounded-full border-2 border-dashed flex items-center justify-center transition-all ${
                  responsavelFilter === '__none__'
                    ? 'border-[#006b5a] bg-[#f0fcf9] ring-2 ring-offset-1 ring-[#006b5a] z-10'
                    : 'border-[#bcc9c4] hover:border-[#9BB0AD] bg-white'
                }`}
                title="Sem responsavel"
              >
                <UserCircle2 size={15} className="text-[#9BB0AD]" />
                {semResponsavelCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-[#dee3e3] text-[#3d4945] text-[9px] font-extrabold rounded-full flex items-center justify-center">
                    {semResponsavelCount > 99 ? '99+' : semResponsavelCount}
                  </span>
                )}
              </button>
              {profilesComContagem.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onResponsavelFilterChange(responsavelFilter === p.id ? null : p.id)}
                  style={{ backgroundColor: getAvatarColor(p.full_name) }}
                  className={`relative shrink-0 snap-start w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-bold transition-all shadow-sm ${
                    responsavelFilter === p.id
                      ? 'ring-2 ring-offset-2 ring-[#006b5a] scale-110 z-10'
                      : p.count === 0 ? 'opacity-35 hover:opacity-60' : 'opacity-90 hover:opacity-100 hover:scale-105'
                  }`}
                  title={`${p.full_name} (${p.count})`}
                >
                  {getInitials(p.full_name)}
                  {p.count > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-white/95 text-[#1A2E2B] text-[9px] font-extrabold rounded-full flex items-center justify-center border border-[#f0f5f4]">
                      {p.count > 99 ? '99+' : p.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none" />
          </div>
          {(search || responsavelFilter) && (
            <button
              onClick={() => { onSearchChange(''); onResponsavelFilterChange(null) }}
              className="hidden sm:flex items-center gap-1 text-xs text-[#ba1a1a] hover:text-[#ba1a1a] bg-[#ba1a1a]/8 hover:bg-[#ba1a1a]/15 font-bold transition-colors px-3 py-1.5 rounded-lg border border-[#ba1a1a]/20 shrink-0 whitespace-nowrap"
            >
              <X size={12} strokeWidth={2.5} />
              Limpar
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 sm:hidden">
        <span className="text-[11px] text-[#9BB0AD] font-medium">
          {contatosCount} de {totalFiltered} pacientes
        </span>
        {responsavelFilter && (
          <button
            onClick={() => onResponsavelFilterChange(null)}
            className="flex items-center gap-1 text-[11px] font-bold text-[#006b5a] bg-[#f0fcf9] px-2 py-0.5 rounded-full border border-[#c3ede6]"
          >
            Equipe ativa
            <X size={9} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  )
}
