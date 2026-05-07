'use client'

import { Search, ListFilter } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'

const CHIPS = [
  { label: 'Todos', value: 'todos' },
  { label: 'Ativos', value: 'tratamento_ativo' },
  { label: 'Pausados', value: 'pausado' },
  { label: 'Aguardando', value: 'aguardando_avaliacao' },
  { label: 'Finalizados', value: 'alta' },
]

export function FiltrosJornada() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'todos')
  
  const [ordem, setOrdem] = useState(searchParams.get('ordem') || 'desc')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const parts: string[] = []
      if (searchTerm) parts.push(`q=${encodeURIComponent(searchTerm)}`)
      if (statusFilter && statusFilter !== 'todos') parts.push(`status=${statusFilter}`)
      if (ordem && ordem !== 'desc') parts.push(`ordem=${ordem}`)
      router.replace(parts.length ? `?${parts.join('&')}` : '?', { scroll: false })
    }, 500)

    return () => clearTimeout(delayDebounceFn)
  }, [searchTerm, statusFilter, ordem, router])

  return (
    <div className="flex flex-col gap-5 mb-8">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-extrabold text-slate-900">Jornada do Paciente</h3>
          <p className="text-slate-500 text-sm">Histórico completo de atendimentos e status</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar eventos..." 
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-full text-sm w-48 focus:ring-[#006b5a] focus:border-[#006b5a] outline-none transition-all"
            />
          </div>

          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`p-2 rounded-lg border transition-colors cursor-pointer shadow-sm flex items-center gap-2 ${
                isDropdownOpen || ordem !== 'desc' 
                  ? 'bg-[#006b5a] border-[#006b5a] text-white' 
                  : 'bg-white border-slate-200 text-slate-500 hover:border-[#006b5a] hover:text-[#006b5a]'
              }`}
              title="Ordenar eventos"
            >
              <ListFilter size={18} />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 mb-1">
                  Ordenar Jornada
                </div>
                <button 
                  onClick={() => { setOrdem('desc'); setIsDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors flex items-center justify-between ${ordem === 'desc' ? 'text-[#006b5a] font-bold bg-slate-50' : 'text-slate-600'}`}
                >
                  Mais recentes primeiro
                  {ordem === 'desc' && <span className="w-1.5 h-1.5 rounded-full bg-[#006b5a]"></span>}
                </button>
                <button 
                  onClick={() => { setOrdem('asc'); setIsDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors flex items-center justify-between ${ordem === 'asc' ? 'text-[#006b5a] font-bold bg-slate-50' : 'text-slate-600'}`}
                >
                  Mais antigos primeiro
                  {ordem === 'asc' && <span className="w-1.5 h-1.5 rounded-full bg-[#006b5a]"></span>}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {CHIPS.map((chip) => {
          const isActive = statusFilter === chip.value
          return (
            <button
              key={chip.value}
              onClick={() => setStatusFilter(chip.value)}
              className={`px-4 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-all ${
                isActive 
                  ? 'bg-[#006b5a] text-white border border-[#006b5a] shadow-md shadow-[#006b5a]/20' 
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-[#33A68F] hover:text-[#006b5a]'
              }`}
            >
              {chip.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}