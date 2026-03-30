import Link from 'next/link'
import { FormCadastroPaciente } from '@/components/features/FormCadastroPaciente'

export default function NovoPacientePage() {
  return (
    <div className="relative min-h-full">
      <div className="mb-6">
        <div className="text-xs text-text-secondary mb-2 flex items-center gap-2">
          <Link href="/dashboard" className="hover:text-primary-500 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/pacientes" className="hover:text-primary-500 transition-colors">Pacientes</Link>
          <span>/</span>
          <span className="text-text-primary font-medium">Adicionar Pacientes</span>
        </div>
        
        <h1 className="text-xl font-semibold text-text-primary">Adicionar Pacientes</h1>
      </div>

      <div className="bg-surface p-8 rounded-lg shadow-sm border border-border">
        <FormCadastroPaciente />
      </div>
    </div>
  )
}