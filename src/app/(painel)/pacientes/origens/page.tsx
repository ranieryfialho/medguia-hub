import Link from 'next/link'
import { requireModulo } from '@/lib/guard'
import { listarOrigensPaciente } from '@/actions/origens-paciente'
import { OrigensManager } from '@/components/features/OrigensManager'

export default async function OriginsPacientePage() {
  await requireModulo('pacientes')

  const origens = await listarOrigensPaciente()

  return (
    <div className="relative min-h-full">
      <div className="mb-6">
        <div className="text-xs text-text-secondary mb-2 flex items-center gap-2">
          <Link href="/dashboard" className="hover:text-primary-500 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/pacientes" className="hover:text-primary-500 transition-colors">Pacientes</Link>
          <span>/</span>
          <span className="text-text-primary font-medium">Origens</span>
        </div>

        <h1 className="text-xl font-semibold text-text-primary">Origens dos Pacientes</h1>
        <p className="text-sm text-text-secondary mt-1">
          Gerencie as opções de origem exibidas no cadastro de pacientes.
        </p>
      </div>

      <div className="bg-surface p-6 rounded-lg shadow-sm border border-border">
        <OrigensManager origens={origens} />
      </div>
    </div>
  )
}
