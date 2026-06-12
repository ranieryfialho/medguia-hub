import Link from 'next/link'
import { requireModulo } from '@/lib/guard'
import { listarTodosTipos, listarTodosTemplates } from '@/actions/follow-ups'
import { FollowUpTemplatesManager } from '@/components/features/follow-ups/FollowUpTemplatesManager'

export default async function FollowUpTemplatesPage() {
  await requireModulo('follow_ups:templates')
  const [tipos, templates] = await Promise.all([
    listarTodosTipos(),
    listarTodosTemplates(),
  ])

  return (
    <div className="relative min-h-full">
      <div className="mb-6">
        <div className="text-xs text-text-secondary mb-2 flex items-center gap-2">
          <Link href="/dashboard" className="hover:text-primary-500 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/follow-ups" className="hover:text-primary-500 transition-colors">Follow-ups</Link>
          <span>/</span>
          <span className="text-text-primary font-medium">Templates</span>
        </div>
        <h1 className="text-xl font-semibold text-text-primary">Templates de Follow-up</h1>
        <p className="text-sm text-text-secondary mt-1">
          Textos pré-definidos por tipo que preenchem automaticamente o campo de descrição.
        </p>
      </div>

      <div className="bg-surface rounded-lg shadow-sm border border-border p-5">
        <FollowUpTemplatesManager tipos={tipos} templates={templates} />
      </div>
    </div>
  )
}