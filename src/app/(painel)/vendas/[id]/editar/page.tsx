import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FormEditarVenda } from '@/components/features/vendas'
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
  forma_pagamento: string
  protocolo_id?: string | null
  protocolo_nome?: string | null
  medico_referenciador_nome?: string | null
  data_venda: string
  observacoes?: string | null
  status?: string | null
  pacientes?: {
    nome: string
  } | null
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function formatProfile(profile: ProfileRow) {
  return {
    id: profile.id,
    nome: profile.full_name || 'Sem nome',
    role: profile.role,
  }
}

const SELECT_VENDA_EDITAR_BASE = `
  id,
  paciente_id,
  profissional_id,
  origem,
  forma_pagamento,
  medico_referenciador_nome,
  data_venda,
  observacoes,
  status,
  pacientes(nome)
`

const SELECT_VENDA_EDITAR_COM_PROTOCOLO = `
  ${SELECT_VENDA_EDITAR_BASE},
  protocolo_id,
  protocolo_nome
`

export default async function EditarVendaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireModulo('comercial:vendas')

  const supabase = await createClient()
  const { id } = await params

  // Carregar dados da venda
  const { data: vendaComProtocolo, error: vendaError } = await supabase
    .from('vendas')
    .select(SELECT_VENDA_EDITAR_COM_PROTOCOLO)
    .eq('id', id)
    .single()

  let venda = vendaComProtocolo

  if (vendaError && (vendaError.message.includes('protocolo_id') || vendaError.message.includes('protocolo_nome'))) {
    const fallback = await supabase
      .from('vendas')
      .select(SELECT_VENDA_EDITAR_BASE)
      .eq('id', id)
      .single()

    venda = fallback.data ? { ...fallback.data, protocolo_id: null, protocolo_nome: null } : fallback.data
  }

  // Carregar itens da venda
  const { data: itensVenda } = await supabase
    .from('itens_venda')
    .select(`
      id,
      produto_id,
      quantidade,
      preco_unitario,
      numero_atendimentos
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

  const vendaNormalizada: VendaRow = {
    id: venda.id,
    paciente_id: venda.paciente_id,
    profissional_id: venda.profissional_id,
    origem: venda.origem,
    forma_pagamento: venda.forma_pagamento,
    protocolo_id: (venda as { protocolo_id?: string | null }).protocolo_id ?? null,
    protocolo_nome: (venda as { protocolo_nome?: string | null }).protocolo_nome ?? null,
    medico_referenciador_nome: venda.medico_referenciador_nome,
    data_venda: venda.data_venda,
    observacoes: venda.observacoes,
    status: (venda as any).status ?? 'venda_confirmada',
    pacientes: firstRelation(venda.pacientes as VendaRow['pacientes'] | VendaRow['pacientes'][]),
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
          vendaInicial={vendaNormalizada}
          itensInicial={itensVenda || []}
          profissionais={((profiles || []) as ProfileRow[]).map(formatProfile)}
          produtos={produtos || []}
          medicos={medicosFormatados}
        />
      </div>
    </div>
  )
}
