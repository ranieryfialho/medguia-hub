'use client'

import { useState } from 'react'
import { trocarSenhaPrimeiroAcesso } from '@/actions/auth'
import { Lock, ShieldAlert, CheckCircle2 } from 'lucide-react'

export function ModalPrimeiroAcesso() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const res = await trocarSenhaPrimeiroAcesso(formData)

    if (res?.error) {
      if (res.error.includes('different from the old password')) {
        setError('A nova senha deve ser diferente da senha provisória.')
      } else {
        setError(res.error)
      }
      setLoading(false)
    } else if (res?.success) {
      window.location.reload()
    }
  }

  return (
    <div className="fixed inset-0 z-[999] bg-[#171d1c]/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-[#bcc9c4]/30 animate-in zoom-in-95 duration-200">
        
        <div className="w-16 h-16 bg-[#cce2da] text-[#006b5a] rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert size={32} />
        </div>

        <h2 className="text-2xl font-extrabold text-[#171d1c] text-center mb-2">
          Atualização de Segurança Necessária
        </h2>
        <p className="text-sm text-[#3d4945] text-center mb-8 font-medium">
          Este é o seu primeiro acesso. Para garantir a segurança da sua conta, por favor, defina uma nova senha.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-bold text-[#3d4945] block">Nova Senha</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#3d4945]/50">
                <Lock size={18} />
              </div>
              <input
                type="password"
                name="senha"
                required
                placeholder="Mínimo de 6 caracteres"
                className="w-full bg-[#f0f5f4] border border-[#bcc9c4]/50 rounded-xl pl-11 pr-4 py-3 text-[#171d1c] focus:outline-none focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] transition-all font-medium"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-[#3d4945] block">Confirmar Senha</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#3d4945]/50">
                <CheckCircle2 size={18} />
              </div>
              <input
                type="password"
                name="confirmarSenha"
                required
                placeholder="Digite a senha novamente"
                className="w-full bg-[#f0f5f4] border border-[#bcc9c4]/50 rounded-xl pl-11 pr-4 py-3 text-[#171d1c] focus:outline-none focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] transition-all font-medium"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-[#ba1a1a]/10 border border-[#ba1a1a]/20 text-[#ba1a1a] text-sm font-bold text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#006b5a] to-[#33a68f] text-white px-8 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-md shadow-[#006b5a]/20 mt-4 disabled:opacity-70"
          >
            {loading ? 'Atualizando...' : 'Salvar Nova Senha'}
          </button>
        </form>
      </div>
    </div>
  )
}