'use client'

import { useActionState } from 'react'
import { login } from '@/actions/auth'

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(login, null)

  return (
    <div className="min-h-screen flex items-center justify-center bg-page p-4">
      <div className="w-full max-w-md bg-surface p-8 rounded-xl shadow-md border border-border">
        
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-primary-500 mb-2">MedGuia Hub</h1>
          <p className="text-sm text-text-secondary">Faça login para acessar o sistema</p>
        </div>

        <form action={formAction} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              E-mail
            </label>
            <input
              type="email"
              name="email"
              required
              className="w-full bg-input border border-border-input rounded-sm px-[14px] py-[10px] text-sm text-text-primary focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Senha
            </label>
            <input
              type="password"
              name="password"
              required
              className="w-full bg-input border border-border-input rounded-sm px-[14px] py-[10px] text-sm text-text-primary focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
              placeholder="••••••••"
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
            className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm py-[10px] px-[20px] rounded-md transition-colors disabled:opacity-70 mt-2"
          >
            {isPending ? 'Entrando...' : 'Entrar no sistema'}
          </button>
        </form>
      </div>
    </div>
  )
}