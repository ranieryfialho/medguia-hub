import Link from 'next/link'
import { requireModulo } from '@/lib/guard'
import { listarTagsPaciente } from '@/actions/paciente-tags'
import { GerenciadorTagsPaciente } from '@/components/features/pacientes/GerenciadorTagsPaciente'

export default async function TagsPacientePage() {
  await requireModulo('pacientes')

  const tags = await listarTagsPaciente()

  return (
    <div className="relative min-h-full">
      <div className="mb-6">
        <div className="text-xs text-text-secondary mb-2 flex items-center gap-2">
          <Link href="/dashboard" className="hover:text-primary-500 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/pacientes" className="hover:text-primary-500 transition-colors">Pacientes</Link>
          <span>/</span>
          <span className="text-text-primary font-medium">Tags</span>
        </div>

        <h1 className="text-xl font-semibold text-text-primary">Tags de Paciente</h1>
        <p className="text-sm text-text-secondary mt-1">
          Crie, edite e remova as tags usadas para marcar pacientes na lista e na jornada.
        </p>
      </div>

      <div className="bg-surface p-6 rounded-lg shadow-sm border border-border">
        <GerenciadorTagsPaciente tags={tags} />
      </div>
    </div>
  )
}
