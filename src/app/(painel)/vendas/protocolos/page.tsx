import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ProtocolosManager } from '@/components/features/shared'
import { listarProtocolos } from '@/actions/protocolos'
import { requireModulo } from '@/lib/guard'

export default async function ProtocolosPage() {
  await requireModulo('comercial:produtos')

  const supabase = await createClient()

  const [protocolos, { data: produtos }] = await Promise.all([
    listarProtocolos(),
    supabase
      .from('produtos')
      .select('id, nome, preco_padrao')
      .eq('ativo', true)
      .order('nome'),
  ])

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-text-secondary mb-2 flex items-center gap-2">
          <Link href="/dashboard" className="hover:text-primary-500 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href="/vendas" className="hover:text-primary-500 transition-colors">Vendas</Link>
          <span>/</span>
          <span className="text-text-primary font-medium">Protocolos</span>
        </div>

        <div className="flex items-center gap-4 mb-2">
          <Link href="/vendas" className="inline-flex items-center gap-1 text-sm text-primary-500 hover:text-primary-600 transition-colors">
            <ArrowLeft size={16} />
            Voltar
          </Link>
        </div>

        <h1 className="text-xl font-semibold text-text-primary">Protocolos de Venda</h1>
        <p className="text-sm text-text-secondary mt-1">
          Crie templates com produtos pré-definidos para agilizar o registro de vendas.
        </p>
      </div>

      <div className="bg-surface rounded-lg border border-border shadow-sm p-6">
        <ProtocolosManager
          protocolos={protocolos}
          produtos={produtos ?? []}
        />
      </div>
    </div>
  )
}
