import Link from 'next/link'
import { requireModulo } from '@/lib/guard'
import { listarObjecoes } from '@/actions/objecoes'
import { ObjecoesManager } from '@/components/features/objecoes'

export default async function ObjecoesPage() {
  await requireModulo('comercial:objecoes')

  const objecoes = await listarObjecoes()

  return (
    <div className="relative min-h-full">
      <div className="mb-6">
        <div className="text-xs text-text-secondary mb-2 flex items-center gap-2">
          <Link href="/dashboard" className="hover:text-primary-500 transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-text-primary font-medium">Objeções de Orçamento</span>
        </div>

        <h1 className="text-xl font-semibold text-text-primary">Objeções de Orçamento</h1>
        <p className="text-sm text-text-secondary mt-1">
          Gerencie os motivos exibidos ao criar um orçamento em Vendas.
        </p>
      </div>

      <ObjecoesManager objecoes={objecoes} />
    </div>
  )
}
