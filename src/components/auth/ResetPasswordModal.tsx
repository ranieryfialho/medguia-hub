'use client'

import { useActionState, useEffect, useState } from 'react'
import { verifyEmailForReset, resetPasswordByEmail } from '@/actions/auth'

interface ResetPasswordModalProps {
  isOpen: boolean
  onClose: () => void
}

function Step1({ onVerified }: { onVerified: (email: string, userId: string) => void }) {
  const [state, formAction, isPending] = useActionState(verifyEmailForReset, null)

  useEffect(() => {
    if (state?.success) {
      onVerified(state.email, state.userId)
    }
  }, [state?.success])

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">E-mail</label>
        <input
          type="email"
          name="email"
          required
          autoFocus
          className="w-full bg-input border border-border-input rounded-sm px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
          placeholder="seu@email.com"
        />
      </div>

      {state?.error && (
        <div className="p-3 bg-[#FDEAEA] text-[#E05252] text-xs font-medium rounded-sm">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm py-2.5 px-5 rounded-md transition-colors disabled:opacity-70"
      >
        {isPending ? 'Verificando...' : 'Continuar'}
      </button>
    </form>
  )
}

function Step2({ userId, onSuccess }: { userId: string; onSuccess: () => void }) {
  const [state, formAction, isPending] = useActionState(resetPasswordByEmail, null)

  useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(onSuccess, 1500)
      return () => clearTimeout(timer)
    }
  }, [state?.success])

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="userId" value={userId} />

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Nova senha</label>
        <input
          type="password"
          name="password"
          required
          autoFocus
          className="w-full bg-input border border-border-input rounded-sm px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
          placeholder="••••••••"
        />
        <p className="text-xs text-text-secondary mt-1">Mínimo 6 caracteres</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Confirmar nova senha</label>
        <input
          type="password"
          name="confirmPassword"
          required
          className="w-full bg-input border border-border-input rounded-sm px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
          placeholder="••••••••"
        />
      </div>

      {state?.error && (
        <div className="p-3 bg-[#FDEAEA] text-[#E05252] text-xs font-medium rounded-sm">
          {state.error}
        </div>
      )}

      {state?.success && (
        <div className="p-3 bg-[#E8F5E9] text-[#2E7D32] text-xs font-medium rounded-sm">
          Senha redefinida com sucesso!
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || state?.success}
        className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm py-2.5 px-5 rounded-md transition-colors disabled:opacity-70"
      >
        {isPending ? 'Salvando...' : 'Redefinir senha'}
      </button>
    </form>
  )
}

export function ResetPasswordModal({ isOpen, onClose }: ResetPasswordModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')

  function handleVerified(verifiedEmail: string, verifiedUserId: string) {
    setEmail(verifiedEmail)
    setUserId(verifiedUserId)
    setStep(2)
  }

  function handleClose() {
    setStep(1)
    setUserId('')
    setEmail('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md bg-surface p-8 rounded-xl shadow-lg border border-border">
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-primary-500 mb-2">Recuperar Acesso</h2>
          <p className="text-sm text-text-secondary">
            {step === 1
              ? 'Informe seu e-mail para continuar'
              : `Defina uma nova senha para ${email}`}
          </p>
        </div>

        {step === 1 && <Step1 onVerified={handleVerified} />}
        {step === 2 && <Step2 userId={userId} onSuccess={handleClose} />}

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={handleClose}
            className="text-xs text-text-secondary hover:text-text-primary"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
