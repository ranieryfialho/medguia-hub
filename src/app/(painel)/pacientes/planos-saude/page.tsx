import Link from 'next/link'
import { requireModulo } from '@/lib/guard'
import { listarPlanosSaude } from '@/actions/planos-saude'
import { PlanosSaudeManager } from '@/components/features/shared'

export default async function PlanosSaudePage() {
  await requireModulo('pacientes')

  const planos = await listarPlanosSaude()

  return (
    <div className="relative min-h-full">
      <div className="mb-6">
        <div className="text-xs text-text-secondary mb-2 flex items-center gap-2">
          <Link href="/dashboard" className="hover:text-primary-500 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/pacientes" className="hover:text-primary-500 transition-colors">Pacientes</Link>
          <span>/</span>
          <span className="text-text-primary font-medium">Planos de Saúde</span>
        </div>

        <h1 className="text-xl font-semibold text-text-primary">Planos de Saúde</h1>
        <p className="text-sm text-text-secondary mt-1">
          Gerencie os planos de saúde exibidos no cadastro de pacientes.
        </p>
      </div>

      <div className="bg-surface p-6 rounded-lg shadow-sm border border-border">
        <PlanosSaudeManager planos={planos} />
      </div>
    </div>
  )
}
