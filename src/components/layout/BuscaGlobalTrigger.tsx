'use client'

import { Search } from 'lucide-react'

export function BuscaGlobalTrigger({ className }: { className?: string }) {
  function abrir() {
    window.dispatchEvent(new CustomEvent('busca:abrir'))
  }

  return (
    <button
      type="button"
      onClick={abrir}
      className={`flex items-center gap-2.5 bg-[#f0f5f4] rounded-full pl-4 pr-3 py-2.5 text-sm text-[#3d4945]/50 hover:bg-[#e8eeec] transition-colors cursor-text ${className ?? ''}`}
    >
      <Search size={16} className="shrink-0 text-[#3d4945]/60" />
      <span className="flex-1 text-left truncate">Buscar paciente, médico, fisioterapeuta...</span>
      <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] font-bold border border-[#dee3e3] bg-white/60 rounded px-1.5 py-0.5 text-[#3d4945]/50 shrink-0">
        Ctrl K
      </kbd>
    </button>
  )
}
