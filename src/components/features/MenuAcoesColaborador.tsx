'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { MoreVertical, Edit, Ban, Key, CheckCircle } from 'lucide-react'

export function MenuAcoesColaborador({ id, isAtivo }: { id: string, isAtivo: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Fecha o menu ao clicar fora dele
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative flex items-center gap-2" ref={menuRef}>
      <Link 
        href={`/equipe/${id}/editar`}
        className="px-4 py-2 text-sm font-bold text-[#006b5a] bg-[#cce2da]/50 hover:bg-[#cce2da] rounded-lg transition-colors"
      >
        Editar
      </Link>
      
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${isOpen ? 'bg-[#dee3e3] text-[#171d1c]' : 'text-[#3d4945]/50 hover:text-[#171d1c] hover:bg-[#dee3e3]'}`}
      >
        <MoreVertical size={18} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-48 bg-white border border-[#bcc9c4]/30 rounded-xl shadow-lg py-2 z-50 animate-in fade-in slide-in-from-top-2">
          <button className="w-full px-4 py-2.5 flex items-center gap-3 text-sm font-medium text-[#3d4945] hover:bg-[#f0f5f4] transition-colors">
            <Key size={16} className="text-[#006b5a]" />
            Redefinir Senha
          </button>
          
          <div className="h-px bg-[#bcc9c4]/30 my-1 mx-2"></div>
          
          <button className={`w-full px-4 py-2.5 flex items-center gap-3 text-sm font-medium transition-colors ${isAtivo ? 'text-[#ba1a1a] hover:bg-[#ba1a1a]/10' : 'text-[#006b5a] hover:bg-[#006b5a]/10'}`}>
            {isAtivo ? (
              <>
                <Ban size={16} />
                Inativar Acesso
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                Reativar Acesso
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}