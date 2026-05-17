import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Eye, Edit } from 'lucide-react'
import { FiltrosVendas } from '@/components/features/vendas'
import { BtnDeletarVenda } from '@/components/features/vendas'
import { requireModulo } from '@/lib/guard'
import { FORMA_PAGAMENTO_LABEL } from '@/lib/vendas'
import { formatAppDate, getAppDayRangeUTC } from '@/lib/datetime'

const STATUS_BADGE: Record<string, { label: string; classes: string }> = {
  venda_confirmada:   { label: 'Venda',      classes: 'bg-emerald-50 text-emerald-700' },
  orcamento_pendente: { label: 'Pendente',   classes: 'bg-amber-50 text-amber-700' },
  orcamento_recusado: { label: 'Recusado',   classes: 'bg-red-50 text-red-700' },
}

const SELECT_VENDAS_BASE = `
  id,
  paciente_id,
  pacientes(nome),
  profissional_id,
  profiles:profissional_id(full_name),
  origem,
  forma_pagamento,
  medico_referenciador_nome,
  data_venda,
  observacoes,
  status,
  criado_em
`

const SELECT_VENDAS_COM_PROTOCOLO = `
  ${SELECT_VENDAS_BASE},
  protocolo_id,
  protocolo_nome
`

export default async function VendasListPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  await requireModulo('comercial:vendas')

  const supabase = await createClient()

  const resolvedParams = await searchParams
  const busca = ((resolvedParams.busca as string) || '').trim()
  const origem = (resolvedParams.origem as string) || ''
  const data_inicio = (resolvedParams.data_inicio as string) || ''
  const data_fim = (resolvedParams.data_fim as string) || ''
  const status = (resolvedParams.status as string) || ''
  const limite = Math.max(1, parseInt((resolvedParams.limite as string) || '25'))
  const pagina = Math.max(1, parseInt((resolvedParams.pagina as string) || '1'))
  const offset = (pagina - 1) * limite
  const buscaNormalizada = busca.toLowerCase()

  let pacienteIdsBusca: string[] = []
  let profissionalIdsBusca: string[] = []

  if (buscaNormalizada) {
    const [{ data: pacientesBusca }, { data: profissionaisBusca }] = await Promise.all([
      supabase
        .from('pacientes')
        .select('id')
        .ilike('nome', `%${buscaNormalizada}%`)
        .limit(200),
      supabase
        .from('profiles')
        .select('id')
        .ilike('full_name', `%${buscaNormalizada}%`)
        .limit(200),
    ])

    pacienteIdsBusca = (pacientesBusca ?? []).map((item) => item.id)
    profissionalIdsBusca = (profissionaisBusca ?? []).map((item) => item.id)
  }

  const buildQuery = (selectClause: string) => {
    let query = supabase
      .from('vendas')
      .select(selectClause, { count: 'exact' })
      .order('data_venda', { ascending: false })

    if (origem) {
      query = query.eq('origem', origem)
    }

    if (data_inicio) {
      query = query.gte('data_venda', getAppDayRangeUTC(data_inicio).start)
    }

    if (data_fim) {
      query = query.lte('data_venda', getAppDayRangeUTC(data_fim).end)
    }

    if (status) {
      query = query.eq('status', status)
    }

    return query
  }

  let vendas: any[] = []
  let total = 0
  let usarCamposProtocolo = true

  if (!buscaNormalizada || pacienteIdsBusca.length > 0 || profissionalIdsBusca.length > 0) {
    const aplicarBusca = <TQuery extends { or: (filters: string) => TQuery }>(query: TQuery) => {
      if (!buscaNormalizada) return query

      const filtrosBusca: string[] = []
      if (pacienteIdsBusca.length > 0) {
        filtrosBusca.push(`paciente_id.in.(${pacienteIdsBusca.join(',')})`)
      }
      if (profissionalIdsBusca.length > 0) {
        filtrosBusca.push(`profissional_id.in.(${profissionalIdsBusca.join(',')})`)
      }

      return query.or(filtrosBusca.join(','))
    }

    let query = aplicarBusca(buildQuery(SELECT_VENDAS_COM_PROTOCOLO))
    const tentativaComProtocolo = await query.range(offset, offset + limite - 1)
    let { data, count } = tentativaComProtocolo
    const { error } = tentativaComProtocolo

    if (error && (error.message.includes('protocolo_id') || error.message.includes('protocolo_nome'))) {
      usarCamposProtocolo = false
      query = aplicarBusca(buildQuery(SELECT_VENDAS_BASE))
      const fallback = await query.range(offset, offset + limite - 1)
      data = fallback.data
      count = fallback.count
    }

    const vendasData = (data ?? []) as any[]
    vendas = usarCamposProtocolo
      ? vendasData
      : vendasData.map((venda) => ({ ...venda, protocolo_id: null, protocolo_nome: null }))
    total = count ?? 0
  }

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
          <span className="text-text-primary font-medium">Vendas</span>
        </div>

        <div className="flex items-center justify-between bg-surface p-4 rounded-t-lg border-b border-border">
          <h1 className="text-lg lg:text-xl font-semibold text-text-primary">Vendas</h1>
          <Link
            href="/vendas/nova"
            className="bg-[#0A4D68] hover:bg-[#083d53] text-white flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Nova Venda</span>
            <span className="sm:hidden">Nova</span>
          </Link>
        </div>
      </div>

      <div className="bg-surface rounded-b-lg shadow-sm border border-border -mt-6">
        <FiltrosVendas />

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Paciente</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Profissional</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Status</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Origem</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Pagamento</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Referenciador</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Data</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {vendas.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-sm text-text-secondary">
                    {busca ? `Nenhuma venda encontrada para "${busca}".` : 'Nenhuma venda encontrada.'}
                  </td>
                </tr>
              )}
              {vendas.map((venda: any) => {
                const dataFormatada = formatAppDate(venda.data_venda)

                return (
                  <tr key={venda.id} className="hover:bg-page/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-text-primary">
                      <div className="space-y-1">
                        <p>{venda.pacientes?.nome || '—'}</p>
                        {venda.protocolo_nome && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-800">
                            Protocolo: {venda.protocolo_nome}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-primary">{venda.profiles?.full_name || '—'}</td>
                    <td className="px-6 py-4">
                      {(() => {
                        const s = venda.status ?? 'venda_confirmada'
                        const cfg = STATUS_BADGE[s] ?? STATUS_BADGE.venda_confirmada
                        return (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.classes}`}>
                            {cfg.label}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary capitalize">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-page text-text-primary">
                        {venda.origem === 'medico'
                          ? 'Médico'
                          : venda.origem === 'leads'
                            ? 'Leads'
                            : venda.origem === 'indicacao'
                              ? 'Indicação'
                              : venda.origem === 'renovacao'
                                ? 'Renovação'
                              : 'Campanha'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {FORMA_PAGAMENTO_LABEL[venda.forma_pagamento] || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">{venda.medico_referenciador_nome || '—'}</td>
                    <td className="px-6 py-4 text-sm text-text-secondary">{dataFormatada}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/vendas/${venda.id}`}
                          className="p-2 text-text-secondary hover:text-primary-500 hover:bg-page rounded transition-colors"
                          title="Visualizar"
                        >
                          <Eye size={16} />
                        </Link>
                        <Link
                          href={`/vendas/${venda.id}/editar`}
                          className="p-2 text-text-secondary hover:text-primary-500 hover:bg-page rounded transition-colors"
                          title="Editar"
                        >
                          <Edit size={16} />
                        </Link>
                        <BtnDeletarVenda id={venda.id} status={venda.status} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Lista — Mobile */}
        <div className="md:hidden divide-y divide-border">
          {vendas.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-text-secondary">
              {busca ? `Nenhuma venda encontrada para "${busca}".` : 'Nenhuma venda encontrada.'}
            </div>
          ) : (
            vendas.map((venda: any) => {
              const dataFormatada = formatAppDate(venda.data_venda)

              return (
                <div key={venda.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-text-primary">{venda.pacientes?.nome}</p>
                      {venda.protocolo_nome && (
                        <p className="text-[11px] text-violet-700 font-medium mt-1">
                          Protocolo: {venda.protocolo_nome}
                        </p>
                      )}
                      <p className="text-xs text-text-secondary">{venda.profiles?.full_name}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {(() => {
                        const s = venda.status ?? 'venda_confirmada'
                        const cfg = STATUS_BADGE[s] ?? STATUS_BADGE.venda_confirmada
                        return (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.classes}`}>
                            {cfg.label}
                          </span>
                        )
                      })()}
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-page text-text-primary capitalize">
                        {venda.origem === 'medico'
                          ? 'Médico'
                          : venda.origem === 'leads'
                            ? 'Leads'
                            : venda.origem === 'indicacao'
                              ? 'Indicação'
                              : venda.origem === 'renovacao'
                                ? 'Renovação'
                                : 'Campanha'}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-text-secondary">{dataFormatada}</p>
                  <p className="text-xs text-text-secondary">
                    {FORMA_PAGAMENTO_LABEL[venda.forma_pagamento] || 'Forma não informada'}
                  </p>
                  {venda.medico_referenciador_nome && (
                    <p className="text-xs text-text-secondary">Dr. {venda.medico_referenciador_nome}</p>
                  )}
                  <div className="flex items-center gap-2 pt-2">
                    <Link
                      href={`/vendas/${venda.id}`}
                      className="flex-1 px-3 py-1.5 text-xs rounded-md bg-page text-text-primary hover:bg-page/80 transition-colors flex items-center justify-center gap-1"
                    >
                      <Eye size={14} />
                      Ver
                    </Link>
                    <Link
                      href={`/vendas/${venda.id}/editar`}
                      className="flex-1 px-3 py-1.5 text-xs rounded-md bg-page text-text-primary hover:bg-page/80 transition-colors flex items-center justify-center gap-1"
                    >
                      <Edit size={14} />
                      Editar
                    </Link>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Paginação */}
        {totalPaginas > 1 && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-center gap-2 flex-wrap">
            {pagina > 1 && (
              <Link
                href={`?pagina=${pagina - 1}${origem ? `&origem=${origem}` : ''}${busca ? `&busca=${busca}` : ''}${data_inicio ? `&data_inicio=${data_inicio}` : ''}${data_fim ? `&data_fim=${data_fim}` : ''}`}
                className="px-3 py-1 rounded-md bg-page text-text-primary hover:bg-page/80 transition-colors text-sm"
              >
                ← Anterior
              </Link>
            )}

            {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`?pagina=${p}${origem ? `&origem=${origem}` : ''}${busca ? `&busca=${busca}` : ''}${data_inicio ? `&data_inicio=${data_inicio}` : ''}${data_fim ? `&data_fim=${data_fim}` : ''}`}
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
                href={`?pagina=${pagina + 1}${origem ? `&origem=${origem}` : ''}${busca ? `&busca=${busca}` : ''}${data_inicio ? `&data_inicio=${data_inicio}` : ''}${data_fim ? `&data_fim=${data_fim}` : ''}`}
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
