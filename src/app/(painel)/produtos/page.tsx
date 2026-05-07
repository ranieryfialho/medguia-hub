import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { BtnDeletarProduto } from '@/components/features/produtos'
import { requireModulo } from '@/lib/guard'

export default async function ProdutosListPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  await requireModulo('comercial:produtos')

  const supabase = await createClient()

  const resolvedParams = await searchParams
  const busca = ((resolvedParams.busca as string) || '').trim()
  const limite = Math.max(1, parseInt((resolvedParams.limite as string) || '25'))
  const pagina = Math.max(1, parseInt((resolvedParams.pagina as string) || '1'))
  const offset = (pagina - 1) * limite
  const mostrarInativos = resolvedParams.inativos === 'true'

  let query = supabase
    .from('produtos')
    .select('*', { count: 'exact' })
    .order('nome')

  if (!mostrarInativos) {
    query = query.eq('ativo', true)
  }

  if (busca) {
    query = query.ilike('nome', `%${busca}%`)
  }

  const { data: produtos, count } = await query.range(offset, offset + limite - 1)

  const total = count ?? 0
  const totalPaginas = Math.ceil(total / limite)

  return (
    <div className="space-y-6">
      {/* Breadcrumb e Título */}
      <div>
        <div className="text-xs text-text-secondary mb-2 flex items-center gap-2">
          <Link href="/dashboard" className="hover:text-primary-500 transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-text-primary font-medium">Produtos</span>
        </div>

        <div className="flex items-center justify-between bg-surface p-4 rounded-t-lg border-b border-border">
          <h1 className="text-lg lg:text-xl font-semibold text-text-primary">Produtos</h1>
          <Link
            href="/produtos/novo"
            className="bg-[#0A4D68] hover:bg-[#083d53] text-white flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Novo Produto</span>
            <span className="sm:hidden">Novo</span>
          </Link>
        </div>
      </div>

      <div className="bg-surface rounded-b-lg shadow-sm border border-border -mt-6">
        {/* Filtros */}
        <div className="p-4 border-b border-border space-y-3">
          <form action="" method="get" className="space-y-3">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <input
                  type="text"
                  name="busca"
                  defaultValue={busca}
                  placeholder="Buscar por nome..."
                  className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
                />
              </div>

              <select
                name="limite"
                defaultValue={String(limite)}
                className="bg-input border border-border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
              >
                {[10, 25, 50].map((n) => (
                  <option key={n} value={String(n)}>
                    {n} por página
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  name="inativos"
                  value="true"
                  defaultChecked={mostrarInativos}
                  className="rounded border-border-input text-primary-500"
                />
                Exibir inativos
              </label>

              <button
                type="submit"
                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-md text-sm font-medium transition-colors"
              >
                Filtrar
              </button>
            </div>
          </form>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-border bg-page/50">
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Nome</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Atendimentos</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase text-right">Preço Padrão</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Status</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {produtos && produtos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-text-secondary">
                    {busca ? `Nenhum produto encontrado para "${busca}".` : 'Nenhum produto encontrado.'}
                  </td>
                </tr>
              ) : (
                produtos?.map((produto: any) => (
                  <tr key={produto.id} className={`hover:bg-page/50 transition-colors ${!produto.ativo ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4 text-sm text-text-primary font-medium">{produto.nome}</td>
                    <td className="px-6 py-4 text-sm text-text-secondary">{produto.numero_atendimentos || '—'}</td>
                    <td className="px-6 py-4 text-sm text-text-primary text-right font-medium">
                      R$ {produto.preco_padrao.toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        produto.ativo
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {produto.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/produtos/${produto.id}/editar`}
                          className="p-2 text-text-secondary hover:text-primary-500 hover:bg-page rounded transition-colors"
                          title="Editar"
                        >
                          <Edit size={16} />
                        </Link>
                        <BtnDeletarProduto id={produto.id} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPaginas > 1 && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-center gap-2 flex-wrap">
            {pagina > 1 && (
              <Link
                href={`?pagina=${pagina - 1}${busca ? `&busca=${busca}` : ''}`}
                className="px-3 py-1 rounded-md bg-page text-text-primary hover:bg-page/80 transition-colors text-sm"
              >
                ← Anterior
              </Link>
            )}

            {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`?pagina=${p}${busca ? `&busca=${busca}` : ''}`}
                className={`px-3 py-1 rounded-md text-sm transition-colors ${
                  p === pagina
                    ? 'bg-primary-500 text-white font-medium'
                    : 'bg-page text-text-primary hover:bg-page/80'
                }`}
              >
                {p}
              </Link>
            ))}

            {pagina < totalPaginas && (
              <Link
                href={`?pagina=${pagina + 1}${busca ? `&busca=${busca}` : ''}`}
                className="px-3 py-1 rounded-md bg-page text-text-primary hover:bg-page/80 transition-colors text-sm"
              >
                Próxima →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
