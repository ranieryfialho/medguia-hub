import Link from 'next/link'
import { requireModulo } from '@/lib/guard'
import { listarTiposConsulta } from '@/actions/tipos-consulta'
import { TiposConsultaManager } from '@/components/features/shared'

export default async function TiposConsultaPage() {
  await requireModulo('pacientes')

  const tipos = await listarTiposConsulta()

  return (
    <div className="relative min-h-full">
      <div className="mb-6">
        <div className="text-xs text-text-secondary mb-2 flex items-center gap-2">
          <Link href="/dashboard" className="hover:text-primary-500 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/pacientes" className="hover:text-primary-500 transition-colors">Pacientes</Link>
          <span>/</span>
          <span className="text-text-primary font-medium">Tipos de consulta</span>
        </div>

        <h1 className="text-xl font-semibold text-text-primary">Tipos de Consulta</h1>
        <p className="text-sm text-text-secondary mt-1">
          Gerencie os tipos exibidos no agendamento sem manter opções hardcoded no código.
        </p>
      </div>

      <div className="bg-surface p-6 rounded-lg shadow-sm border border-border">
        <TiposConsultaManager tipos={tipos} />
      </div>
    </div>
  )
}
