import Link from 'next/link'
import { requireModulo } from '@/lib/guard'
import { listarTodosTipos } from '@/actions/follow-ups'
import { FollowUpTiposManager } from '@/components/features/follow-ups/FollowUpTiposManager'

export default async function FollowUpTiposPage() {
  await requireModulo('follow_ups:tipos')
  const tipos = await listarTodosTipos()

  return (
    <div className="relative min-h-full">
      <div className="mb-6">
        <div className="text-xs text-text-secondary mb-2 flex items-center gap-2">
          <Link href="/dashboard" className="hover:text-primary-500 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/follow-ups" className="hover:text-primary-500 transition-colors">Follow-ups</Link>
          <span>/</span>
          <span className="text-text-primary font-medium">Tipos</span>
        </div>
        <h1 className="text-xl font-semibold text-text-primary">Tipos de Follow-up</h1>
        <p className="text-sm text-text-secondary mt-1">
          Gerencie os tipos disponíveis ao registrar um follow-up.
        </p>
      </div>

      <div className="bg-surface rounded-lg shadow-sm border border-border p-5">
        <FollowUpTiposManager tipos={tipos} />
      </div>
    </div>
  )
}