import Link from 'next/link'
import { requireModulo } from '@/lib/guard'
import { listarOrigensVenda } from '@/actions/origens-venda'
import { GerenciadorOrigensVenda } from '@/components/features/vendas/GerenciadorOrigensVenda'

export default async function OrigensVendaPage() {
  await requireModulo('comercial:vendas')

  const origens = await listarOrigensVenda()

  return (
    <div className="relative min-h-full">
      <div className="mb-6">
        <div className="text-xs text-text-secondary mb-2 flex items-center gap-2">
          <Link href="/dashboard" className="hover:text-primary-500 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/vendas" className="hover:text-primary-500 transition-colors">Vendas</Link>
          <span>/</span>
          <span className="text-text-primary font-medium">Origens</span>
        </div>

        <h1 className="text-xl font-semibold text-text-primary">Origens de Venda</h1>
        <p className="text-sm text-text-secondary mt-1">
          Gerencie as origens exibidas ao criar e editar uma venda, nos filtros e nos relatórios.
        </p>
      </div>

      <GerenciadorOrigensVenda origens={origens} />
    </div>
  )
}
