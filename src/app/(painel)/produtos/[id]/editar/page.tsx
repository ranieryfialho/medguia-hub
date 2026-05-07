import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FormEditarProduto } from '@/components/features/produtos'
import { requireModulo } from '@/lib/guard'

export default async function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireModulo('comercial:produtos')

  const supabase = await createClient()
  const { id } = await params

  const { data: produto } = await supabase
    .from('produtos')
    .select('*')
    .eq('id', id)
    .single()

  if (!produto) {
    return (
      <div className="space-y-4">
        <Link
          href="/produtos"
          className="inline-flex items-center gap-1 text-sm text-primary-500 hover:text-primary-600"
        >
          <ArrowLeft size={16} />
          Voltar para Produtos
        </Link>
        <div className="text-center py-12">
          <p className="text-text-secondary">Produto não encontrado</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <div>
        <Link
          href="/produtos"
          className="inline-flex items-center gap-1 text-sm text-primary-500 hover:text-primary-600 transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          Voltar
        </Link>

        <h1 className="text-2xl font-semibold text-text-primary">Editar Produto</h1>
        <p className="text-sm text-text-secondary mt-1">{produto.nome}</p>
      </div>

      {/* Formulário */}
      <div className="bg-surface rounded-lg border border-border shadow-sm p-6">
        <FormEditarProduto produtoInicial={produto} />
      </div>
    </div>
  )
}
