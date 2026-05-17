import Link from 'next/link'
import { requireModulo } from '@/lib/guard'
import { listarTiposConsulta } from '@/actions/tipos-consulta'
import { createClient } from '@/lib/supabase/server'
import { listarProtocolosAtendimento } from '@/actions/protocolos-atendimento'
import { TiposConsultaTabs } from '@/components/features/shared'

export default async function TiposConsultaPage() {
  await requireModulo('pacientes')

  const supabase = await createClient()
  const [tipos, protocolosAtendimento, { data: tiposAtivos }] = await Promise.all([
    listarTiposConsulta(),
    listarProtocolosAtendimento(),
    supabase
      .from('tipos_consulta')
      .select('id, nome, ativo')
      .eq('ativo', true)
      .order('ordem', { ascending: true })
      .order('nome', { ascending: true }),
  ])

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
          Gerencie os tipos exibidos no agendamento.
        </p>
      </div>

      <div className="bg-surface rounded-lg shadow-sm border border-border">
        <TiposConsultaTabs
          tipos={tipos}
          protocolosAtendimento={protocolosAtendimento}
          tiposAtivos={tiposAtivos ?? []}
        />
      </div>
    </div>
  )
}
