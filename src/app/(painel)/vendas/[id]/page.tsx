import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft, Edit } from 'lucide-react'
import { BtnDeletarVenda, BtnAtualizarStatusVenda } from '@/components/features/vendas'
import { requireModulo } from '@/lib/guard'
import { FORMA_PAGAMENTO_LABEL, STATUS_VENDA_LABEL } from '@/lib/vendas'
import { formatAppDate } from '@/lib/datetime'

const STATUS_BADGE: Record<string, { classes: string }> = {
  venda_confirmada:   { classes: 'bg-emerald-100 text-emerald-800' },
  orcamento_pendente: { classes: 'bg-amber-100 text-amber-800' },
  orcamento_recusado: { classes: 'bg-red-100 text-red-800' },
}

const SELECT_VENDA_BASE = `
  id,
  paciente_id,
  pacientes(id, nome, cpf, telefone, email),
  profissional_id,
  profiles:profissional_id(id, full_name, role),
  origem,
  forma_pagamento,
  medico_referenciador_nome,
  data_venda,
  observacoes,
  status,
  motivo_recusa,
  criado_em,
  atualizado_em
`

const SELECT_VENDA_COM_PROTOCOLO = `
  ${SELECT_VENDA_BASE},
  protocolo_id,
  protocolo_nome
`

export default async function VendaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireModulo('comercial:vendas')

  const supabase = await createClient()
  const { id } = await params

  const { data: vendaComProtocolo, error: vendaError } = await supabase
    .from('vendas')
    .select(SELECT_VENDA_COM_PROTOCOLO)
    .eq('id', id)
    .single()

  let venda = vendaComProtocolo

  if (vendaError && (vendaError.message.includes('protocolo_id') || vendaError.message.includes('protocolo_nome'))) {
    const fallback = await supabase
      .from('vendas')
      .select(SELECT_VENDA_BASE)
      .eq('id', id)
      .single()

    venda = fallback.data ? { ...fallback.data, protocolo_id: null, protocolo_nome: null } : fallback.data
  }

  const { data: itens } = await supabase
    .from('itens_venda')
    .select(`
      id,
      produto_id,
      produtos(id, nome, numero_atendimentos, preco_padrao),
      quantidade,
      preco_unitario,
      numero_atendimentos,
      subtotal
    `)
    .eq('venda_id', id)
    .order('criado_em')

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

  const v = venda as any
  const total = (itens || []).reduce((sum, item: any) => sum + item.quantidade * item.preco_unitario, 0)
  const dataFormatada = formatAppDate(venda.data_venda, 'pt-BR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const origemLabel =
    venda.origem === 'medico'
      ? 'Médico'
      : venda.origem === 'leads'
        ? 'Leads'
        : venda.origem === 'indicacao'
          ? 'Indicação'
          : venda.origem === 'renovacao'
            ? 'Renovação'
            : 'Campanha'

  const statusAtual = (v.status ?? 'venda_confirmada') as string
  const statusCfg = STATUS_BADGE[statusAtual] ?? STATUS_BADGE.venda_confirmada
  const isOrcamento = statusAtual !== 'venda_confirmada'
  const tituloPage = isOrcamento ? 'Detalhes do Orçamento' : 'Detalhes da Venda'
  const protocoloNome = (venda as { protocolo_nome?: string | null }).protocolo_nome ?? null

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

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-text-primary">{tituloPage}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusCfg.classes}`}>
              {STATUS_VENDA_LABEL[statusAtual] ?? statusAtual}
            </span>
            {protocoloNome && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-800">
                Protocolo
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/vendas/${id}/editar`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-md font-medium transition-colors"
            >
              <Edit size={16} />
              Editar
            </Link>
            <BtnDeletarVenda id={id} status={statusAtual} />
          </div>
        </div>
      </div>

      {/* Informações principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Paciente */}
        <div className="bg-surface rounded-lg border border-border p-6">
          <h2 className="text-sm font-semibold text-text-secondary uppercase mb-4">Paciente</h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-text-secondary uppercase">Nome</p>
              <p className="text-lg font-medium text-text-primary">{v.pacientes?.nome}</p>
            </div>
            {v.pacientes?.cpf && (
              <div>
                <p className="text-xs text-text-secondary uppercase">CPF</p>
                <p className="text-text-primary">{v.pacientes.cpf}</p>
              </div>
            )}
            {v.pacientes?.telefone && (
              <div>
                <p className="text-xs text-text-secondary uppercase">Telefone</p>
                <p className="text-text-primary">{v.pacientes.telefone}</p>
              </div>
            )}
          </div>
        </div>

        {/* Profissional e Origem */}
        <div className="bg-surface rounded-lg border border-border p-6">
          <h2 className="text-sm font-semibold text-text-secondary uppercase mb-4">{isOrcamento ? 'Informações do Orçamento' : 'Informações da Venda'}</h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-text-secondary uppercase">Profissional</p>
              <p className="text-text-primary">{v.profiles?.full_name}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary uppercase">Origem</p>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-page text-text-primary mt-1">
                {origemLabel}
              </span>
            </div>
            <div>
              <p className="text-xs text-text-secondary uppercase">Forma de Pagamento</p>
              <p className="text-text-primary">{FORMA_PAGAMENTO_LABEL[venda.forma_pagamento] || 'Não informada'}</p>
            </div>
            {protocoloNome && (
              <div>
                <p className="text-xs text-text-secondary uppercase">Protocolo</p>
                <p className="text-text-primary">{protocoloNome}</p>
              </div>
            )}
            {venda.medico_referenciador_nome && (
              <div>
                <p className="text-xs text-text-secondary uppercase">Médico Referenciador</p>
                <p className="text-text-primary">Dr. {venda.medico_referenciador_nome}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-text-secondary uppercase">{isOrcamento ? 'Data do Orçamento' : 'Data da Venda'}</p>
              <p className="text-text-primary">{dataFormatada}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Motivo de recusa */}
      {statusAtual === 'orcamento_recusado' && (
        <div className="bg-red-50 rounded-lg border border-red-200 p-4">
          <p className="text-xs text-red-700 uppercase font-semibold mb-1">Motivo da recusa</p>
          <p className="text-sm text-red-900">
            {(v.motivo_recusa as string | null) || <span className="italic text-red-400">Não informado</span>}
          </p>
        </div>
      )}

      {/* Ações de status */}
      <div className="bg-surface rounded-lg border border-border p-4">
        <BtnAtualizarStatusVenda vendaId={id} statusAtual={statusAtual} />
      </div>

      {/* Produtos */}
      <div className="bg-surface rounded-lg border border-border p-6">
        <h2 className="text-sm font-semibold text-text-secondary uppercase mb-4">Produtos</h2>

        {itens && itens.length > 0 ? (
          <div className="space-y-3">
            {itens.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between p-4 rounded-md bg-page border border-border">
                <div className="flex-1">
                  <p className="font-medium text-text-primary">{item.produtos.nome}</p>
                  <p className="text-xs text-text-secondary">
                    {item.quantidade}x R$ {item.preco_unitario.toFixed(2)}
                  </p>
                  {item.numero_atendimentos && (
                    <p className="text-xs text-text-secondary mt-1">
                      {item.numero_atendimentos} {item.numero_atendimentos === 1 ? 'atendimento' : 'atendimentos'} nesta venda
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-semibold text-text-primary">
                    R$ {(item.quantidade * item.preco_unitario).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}

            {/* Total */}
            <div className="mt-4 p-4 rounded-md bg-primary-50 border border-primary-200 flex items-center justify-between">
              <p className="font-semibold text-primary-900">Total</p>
              <p className="text-lg font-bold text-primary-900">R$ {total.toFixed(2)}</p>
            </div>
          </div>
        ) : (
          <p className="text-text-secondary text-sm">Nenhum produto nesta venda.</p>
        )}
      </div>

      {/* Observações */}
      {venda.observacoes && (
        <div className="bg-surface rounded-lg border border-border p-6">
          <h2 className="text-sm font-semibold text-text-secondary uppercase mb-4">Observações</h2>
          <p className="text-text-primary whitespace-pre-wrap">{venda.observacoes}</p>
        </div>
      )}

      {/* Datas */}
      <div className="bg-surface rounded-lg border border-border p-4 text-xs text-text-secondary space-y-1">
        <p>Criado em: {new Date(venda.criado_em).toLocaleString('pt-BR')}</p>
        <p>Atualizado em: {new Date(venda.atualizado_em).toLocaleString('pt-BR')}</p>
      </div>
    </div>
  )
}
