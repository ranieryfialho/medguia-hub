import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FormEditarPaciente } from '@/components/features/FormEditarPaciente'
import { requireModulo } from '@/lib/guard'

export default async function EditarPacientePage({ params }: { params: Promise<{ id: string }> }) {
  await requireModulo('pacientes')

  const supabase = await createClient()

  const resolvedParams = await params
  const pacienteId = resolvedParams.id

  const { data: paciente, error } = await supabase
    .from('pacientes')
    .select('*')
    .eq('id', pacienteId)
    .single()

  if (error || !paciente) {
    notFound()
  }

  return (
    <div className="relative min-h-full">
      <div className="mb-6">
        <div className="text-xs text-text-secondary mb-2 flex items-center gap-2">
          <Link href="/dashboard" className="hover:text-primary-500 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/pacientes" className="hover:text-primary-500 transition-colors">Pacientes</Link>
          <span>/</span>
          <span className="text-text-primary font-medium">Editar Paciente</span>
        </div>
        
        <h1 className="text-xl font-semibold text-text-primary">Editar: {paciente.nome}</h1>
      </div>

      <div className="bg-surface p-8 rounded-lg shadow-sm border border-border">
        <FormEditarPaciente paciente={paciente} />
      </div>
    </div>
  )
}
