import Link from 'next/link'
import { requireModulo } from '@/lib/guard'
import { listarTagsVenda } from '@/actions/venda-tags'
import { GerenciadorTagsVenda } from '@/components/features/vendas/GerenciadorTagsVenda'

export default async function TagsVendaPage() {
  await requireModulo('comercial:vendas')

  const tags = await listarTagsVenda()

  return (
    <div className="relative min-h-full">
      <div className="mb-6">
        <div className="text-xs text-text-secondary mb-2 flex items-center gap-2">
          <Link href="/dashboard" className="hover:text-primary-500 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/vendas" className="hover:text-primary-500 transition-colors">Vendas</Link>
          <span>/</span>
          <span className="text-text-primary font-medium">Tags</span>
        </div>

        <h1 className="text-xl font-semibold text-text-primary">Tags de Venda</h1>
        <p className="text-sm text-text-secondary mt-1">
          Crie, edite e remova as tags usadas para marcar vendas na lista e no detalhe.
        </p>
      </div>

      <div className="bg-surface p-6 rounded-lg shadow-sm border border-border">
        <GerenciadorTagsVenda tags={tags} />
      </div>
    </div>
  )
}
