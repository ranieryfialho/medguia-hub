'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { MoreVertical, Ban, Key, CheckCircle, Eye, EyeOff, X } from 'lucide-react'
import { redefinirSenha } from '@/actions/equipe'
import toast from 'react-hot-toast'

function ModalRedefinirSenha({ id, onClose }: { id: string; onClose: () => void }) {
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro('')

    if (novaSenha !== confirmar) {
      setErro('As senhas não coincidem.')
      return
    }

    setLoading(true)
    const res = await redefinirSenha(id, novaSenha)
    setLoading(false)

    if (res?.error) {
      setErro(res.error)
    } else {
      toast.success('Senha redefinida! O colaborador precisará trocar no próximo acesso.')
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#f0f5f4] flex items-center justify-center text-[#006b5a]">
              <Key size={18} />
            </div>
            <h3 className="font-bold text-[#171d1c] text-base">Redefinir Senha</h3>
          </div>
          <button onClick={onClose} className="text-[#3d4945]/50 hover:text-[#171d1c] transition-colors">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-[#3d4945]/70 mb-5">
          Defina uma nova senha provisória. O colaborador será obrigado a alterá-la no próximo acesso.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1 relative">
            <label className="text-xs font-semibold text-[#6d7a75] absolute -top-2 left-3 bg-white px-1 z-10">
              Nova senha *
            </label>
            <div className="relative">
              <input
                type={mostrarSenha ? 'text' : 'password'}
                value={novaSenha}
                onChange={e => setNovaSenha(e.target.value)}
                required
                minLength={6}
                placeholder="Mínimo 6 caracteres"
                className="w-full bg-white border border-[#bcc9c4] rounded-lg px-4 py-3 pr-10 text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] transition-all font-medium text-sm"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(v => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-[#3d4945]/40 hover:text-[#3d4945] transition-colors"
              >
                {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="space-y-1 relative">
            <label className="text-xs font-semibold text-[#6d7a75] absolute -top-2 left-3 bg-white px-1 z-10">
              Confirmar senha *
            </label>
            <input
              type={mostrarSenha ? 'text' : 'password'}
              value={confirmar}
              onChange={e => setConfirmar(e.target.value)}
              required
              placeholder="Repita a senha"
              className="w-full bg-white border border-[#bcc9c4] rounded-lg px-4 py-3 text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] transition-all font-medium text-sm"
            />
          </div>

          {erro && (
            <p className="text-xs font-bold text-[#ba1a1a] bg-[#ba1a1a]/10 rounded-lg px-3 py-2">{erro}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg font-bold text-[#3d4945] bg-[#f0f5f4] hover:bg-[#dee3e3] transition-colors text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg font-bold text-white bg-[#006b5a] hover:bg-[#005a4c] transition-colors text-sm disabled:opacity-70"
            >
              {loading ? 'Salvando...' : 'Redefinir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function MenuAcoesColaborador({ id, isAtivo }: { id: string, isAtivo: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const [modalSenhaAberto, setModalSenhaAberto] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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
    <>
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

        {isOpen && (
          <div className="absolute right-0 top-12 w-48 bg-white border border-[#bcc9c4]/30 rounded-xl shadow-lg py-2 z-50 animate-in fade-in slide-in-from-top-2">
            <button
              onClick={() => { setIsOpen(false); setModalSenhaAberto(true) }}
              className="w-full px-4 py-2.5 flex items-center gap-3 text-sm font-medium text-[#3d4945] hover:bg-[#f0f5f4] transition-colors"
            >
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

      {modalSenhaAberto && (
        <ModalRedefinirSenha id={id} onClose={() => setModalSenhaAberto(false)} />
      )}
    </>
  )
}