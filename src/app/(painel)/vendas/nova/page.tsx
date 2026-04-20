import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FormNovaVenda } from '@/components/features/FormNovaVenda'

export default async function NovaVendaPage() {
  const supabase = await createClient()

  const [{ data: pacientes }, { data: produtos }, { data: comJornada }, { data: fisioterapeutas }] = await Promise.all([
    supabase
      .from('pacientes')
      .select('id, nome, cpf, telefone')
      .eq('ativo', true)
      .order('nome'),
    supabase
      .from('produtos')
      .select('id, nome, numero_atendimentos, preco_padrao')
      .eq('ativo', true)
      .order('nome'),
    supabase
      .from('disponibilidade_profissional')
      .select('profissional_id'),
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('role', 'fisioterapeuta'),
  ])

  const idsComJornada = [...new Set((comJornada || []).map((d: any) => d.profissional_id))]

  // Gestores com jornada cadastrada (master é admin, não aparece como profissional)
  const { data: gestoresRaw } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('role', 'gestor')
    .in('id', idsComJornada.length > 0 ? idsComJornada : [''])

  const profissionais = [
    ...(fisioterapeutas || []),
    ...(gestoresRaw || []),
  ]
    .map((p: any) => ({ id: p.id, nome: p.full_name || 'Sem nome', role: p.role }))
    .sort((a: any, b: any) => a.nome.localeCompare(b.nome))

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div>
        <Link
          href="/vendas"
          className="inline-flex items-center gap-1 text-sm text-primary-500 hover:text-primary-600 transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          Voltar
        </Link>

        <h1 className="text-2xl font-semibold text-text-primary">Nova Venda</h1>
        <p className="text-sm text-text-secondary mt-1">Preencha os dados para registrar uma nova venda</p>
      </div>

      {/* Formulário ocupando toda a largura */}
      <div className="bg-surface rounded-lg border border-border shadow-sm p-6">
        <FormNovaVenda
          pacientes={pacientes || []}
          profissionais={profissionais}
          produtos={produtos || []}
        />
      </div>
    </div>
  )
}
