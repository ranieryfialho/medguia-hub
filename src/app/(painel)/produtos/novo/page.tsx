import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FormNovoProduto } from '@/components/features/FormNovoProduto'
import { requireModulo } from '@/lib/guard'

export default async function NovoProdutoPage() {
  await requireModulo('comercial:produtos')

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div>
        <Link
          href="/produtos"
          className="inline-flex items-center gap-1 text-sm text-primary-500 hover:text-primary-600 transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          Voltar
        </Link>

        <h1 className="text-2xl font-semibold text-text-primary">Novo Produto</h1>
        <p className="text-sm text-text-secondary mt-1">Adicione um novo produto ao catálogo</p>
      </div>

      {/* Formulário */}
      <div className="bg-surface rounded-lg border border-border shadow-sm p-6">
        <FormNovoProduto />
      </div>
    </div>
  )
}
