import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FormEditarVenda } from '@/components/features/FormEditarVenda'

export default async function EditarVendaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { id } = await params

  // Carregar dados da venda
  const { data: venda } = await supabase
    .from('vendas')
    .select('*')
    .eq('id', id)
    .single()

  // Carregar itens da venda
  const { data: itensVenda } = await supabase
    .from('itens_venda')
    .select(`
      id,
      produto_id,
      quantidade,
      preco_unitario
    `)
    .eq('venda_id', id)

  // Carregar dados de referência
  const [{ data: pacientes }, { data: profiles }, { data: produtos }] = await Promise.all([
    supabase
      .from('pacientes')
      .select('id, nome')
      .eq('ativo', true)
      .order('nome'),
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['fisioterapeuta', 'gestor'])
      .order('full_name'),
    supabase
      .from('produtos')
      .select('id, nome, numero_atendimentos, preco_padrao')
      .eq('ativo', true)
      .order('nome'),
  ])

  if (!venda) {
    return (
      <div className="space-y-4">
        <Link
          href="/vendas"
          className="inline-flex items-center gap-1 text-sm text-primary-500 hover:text-primary-600"
        >
          <ArrowLeft size={16} />
          Voltar para Vendas
        </Link>
        <div className="text-center py-12">
          <p className="text-text-secondary">Venda não encontrada</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <div>
        <Link
          href={`/vendas/${id}`}
          className="inline-flex items-center gap-1 text-sm text-primary-500 hover:text-primary-600 transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          Voltar
        </Link>

        <h1 className="text-2xl font-semibold text-text-primary">Editar Venda</h1>
        <p className="text-sm text-text-secondary mt-1">Modifique os dados da venda</p>
      </div>

      {/* Formulário */}
      <div className="bg-surface rounded-lg border border-border shadow-sm p-6">
        <FormEditarVenda
          vendaId={id}
          vendaInicial={venda}
          itensInicial={itensVenda || []}
          pacientes={pacientes || []}
          profissionais={(profiles || []).map((p: any) => ({ id: p.id, nome: p.full_name || 'Sem nome', role: p.role }))}
          produtos={produtos || []}
        />
      </div>
    </div>
  )
}
