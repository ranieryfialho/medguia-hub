import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FormNovaVenda } from '@/components/features/vendas'
import { requireModulo } from '@/lib/guard'
import { listarProtocolosAtivos } from '@/actions/protocolos'

interface JornadaRow {
  profissional_id: string | null
}

interface ProfileRow {
  id: string
  full_name: string | null
  role: string
}

function formatProfile(profile: ProfileRow) {
  return {
    id: profile.id,
    nome: profile.full_name || 'Sem nome',
    role: profile.role,
  }
}

export default async function NovaVendaPage() {
  await requireModulo('comercial:vendas')

  const supabase = await createClient()

  const [{ data: produtos }, { data: comJornada }, { data: fisioterapeutas }, { data: medicos }, protocolos] = await Promise.all([
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
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('role', 'medico'),
    listarProtocolosAtivos(),
  ])

  const idsComJornada = [
    ...new Set(((comJornada || []) as JornadaRow[]).map((d) => d.profissional_id).filter(Boolean)),
  ] as string[]

  // Gestores com jornada cadastrada (master é admin, não aparece como profissional)
  const { data: gestoresRaw } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('role', 'gestor')
    .in('id', idsComJornada.length > 0 ? idsComJornada : [''])

  const profissionais = [
    ...((fisioterapeutas || []) as ProfileRow[]),
    ...((gestoresRaw || []) as ProfileRow[]),
  ]
    .map(formatProfile)
    .sort((a, b) => a.nome.localeCompare(b.nome))

  const medicosFormatados = ((medicos || []) as ProfileRow[])
    .map(formatProfile)
    .sort((a, b) => a.nome.localeCompare(b.nome))

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
          profissionais={profissionais}
          produtos={produtos || []}
          medicos={medicosFormatados}
          protocolos={protocolos}
        />
      </div>
    </div>
  )
}
