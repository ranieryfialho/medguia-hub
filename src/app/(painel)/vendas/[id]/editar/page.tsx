import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FormEditarVenda } from '@/components/features/FormEditarVenda'
import { requireModulo } from '@/lib/guard'

interface ProfileRow {
  id: string
  full_name: string | null
  role: string
}

interface VendaRow {
  id: string
  paciente_id: string
  profissional_id: string
  origem: string
  medico_referenciador_nome?: string | null
  data_venda: string
  observacoes?: string | null
  pacientes?: {
    nome: string
  } | null
}

function formatProfile(profile: ProfileRow) {
  return {
    id: profile.id,
    nome: profile.full_name || 'Sem nome',
    role: profile.role,
  }
}

export default async function EditarVendaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireModulo('comercial:vendas')

  const supabase = await createClient()
  const { id } = await params

  // Carregar dados da venda
  const { data: venda } = await supabase
    .from('vendas')
    .select(`
      id,
      paciente_id,
      profissional_id,
      origem,
      medico_referenciador_nome,
      data_venda,
      observacoes,
      pacientes(nome)
    `)
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
  const [{ data: profiles }, { data: produtos }, { data: medicos }] = await Promise.all([
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
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('role', 'medico'),
  ])

  const medicosFormatados = ((medicos || []) as ProfileRow[]).map(formatProfile)

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
    <div className="space-y-6">
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
          vendaInicial={venda as VendaRow}
          itensInicial={itensVenda || []}
          profissionais={((profiles || []) as ProfileRow[]).map(formatProfile)}
          produtos={produtos || []}
          medicos={medicosFormatados}
        />
      </div>
    </div>
  )
}
