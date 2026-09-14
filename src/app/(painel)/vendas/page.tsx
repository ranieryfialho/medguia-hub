import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Eye, Edit, FileText, Info } from 'lucide-react'
import { FiltrosVendas } from '@/components/features/vendas'
import { BtnDeletarVenda } from '@/components/features/vendas'
import { SeletorTagsVenda } from '@/components/features/vendas'
import { listarTagsVendaAtivas, listarTagsPorVendas } from '@/actions/venda-tags'
import { requireModulo } from '@/lib/guard'
import { FORMA_PAGAMENTO_LABEL, TIPO_VENDA_LABEL } from '@/lib/vendas'
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
  tipo_venda,
  comprovante_pagamento_google_drive_file_id,
  comprovante_pagamento_nome,
  criado_em,
  itens_venda(quantidade, preco_unitario, produtos(nome))
`

const SELECT_VENDAS_COM_PROTOCOLO = `
  ${SELECT_VENDAS_BASE},
  protocolo_id,
  protocolo_nome
`

const SELECT_VENDAS_SEM_TIPO = `
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
  criado_em,
  itens_venda(quantidade, preco_unitario, produtos(nome))
`

function buildPaginaUrl(
  params: { [key: string]: string | string[] | undefined },
  pagina: number
) {
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (key === 'pagina') continue
    if (Array.isArray(value)) {
      for (const v of value) query.append(key, v)
    } else if (value) {
      query.set(key, value)
    }
  }

  if (pagina > 1) query.set('pagina', String(pagina))

  const queryString = query.toString()
  return queryString ? `?${queryString}` : '?'
}

function formatarValor(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function TagsItens({ itens }: { itens: { produtos: { nome: string } | null }[] }) {
  if (!itens?.length) return null
  const visiveis = itens.slice(0, 3)
  const extras = itens.length - 3
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {visiveis.map((item, idx) => (
        <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
          {item.produtos?.nome ?? '—'}
        </span>
      ))}
      {extras > 0 && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-400">
          +{extras}
        </span>
      )}
    </div>
  )
}

function PagamentoLabel({
  formaPagamento,
  pagamentos,
}: {
  formaPagamento: string
  pagamentos?: { forma_pagamento: string; valor: number }[]
}) {
  if (formaPagamento !== 'hibrido' || !pagamentos || pagamentos.length === 0) {
    return <>{FORMA_PAGAMENTO_LABEL[formaPagamento] || '—'}</>
  }

  return (
    <span className="inline-flex items-center gap-1 group relative">
      Híbrido
      <Info size={13} className="text-text-secondary cursor-help shrink-0" />
      <span className="hidden group-hover:block absolute z-20 bottom-full left-0 mb-1.5 w-56 p-2.5 rounded-md bg-slate-800 text-white text-xs shadow-lg whitespace-normal">
        <span className="block font-semibold mb-1">Formas de pagamento</span>
        {pagamentos.map((p, idx) => (
          <span key={idx} className="flex items-center justify-between gap-2">
            <span>{FORMA_PAGAMENTO_LABEL[p.forma_pagamento] || p.forma_pagamento}</span>
            <span className="font-medium">{formatarValor(p.valor)}</span>
          </span>
        ))}
      </span>
    </span>
  )
}

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
  const produtoIdsParam = (resolvedParams.produto_ids as string) || ''
  const produtoIdsFiltro = produtoIdsParam ? produtoIdsParam.split(',').filter(Boolean) : []
  const limite = Math.max(1, parseInt((resolvedParams.limite as string) || '50'))
  const pagina = Math.max(1, parseInt((resolvedParams.pagina as string) || '1'))
  const offset = (pagina - 1) * limite
  const buscaNormalizada = busca.toLowerCase()

  let pacienteIdsBusca: string[] = []
  let profissionalIdsBusca: string[] = []
  let vendaIdsProduto: string[] | null = null

  const [produtosResult, buscaResult, produtoFiltroResult] = await Promise.all([
    supabase.from('produtos').select('id, nome').eq('ativo', true).order('nome'),
    buscaNormalizada
      ? Promise.all([
          supabase.from('pacientes').select('id').ilike('nome', `%${buscaNormalizada}%`).limit(200),
          supabase.from('profiles').select('id').ilike('full_name', `%${buscaNormalizada}%`).limit(200),
        ])
      : null,
    produtoIdsFiltro.length > 0
      ? supabase.from('itens_venda').select('venda_id').in('produto_id', produtoIdsFiltro)
      : null,
  ])

  const produtos = (produtosResult.data ?? []) as { id: string; nome: string }[]

  if (buscaResult) {
    const [{ data: pacientesBusca }, { data: profissionaisBusca }] = buscaResult
    pacienteIdsBusca = (pacientesBusca ?? []).map((item) => item.id)
    profissionalIdsBusca = (profissionaisBusca ?? []).map((item) => item.id)
  }

  if (produtoFiltroResult) {
    vendaIdsProduto = [...new Set((produtoFiltroResult.data ?? []).map((i) => i.venda_id))]
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

    if (vendaIdsProduto !== null) {
      query = vendaIdsProduto.length > 0
        ? query.in('id', vendaIdsProduto)
        : query.in('id', ['00000000-0000-0000-0000-000000000000'])
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
    let { error } = tentativaComProtocolo

    if (error && (error.message.includes('protocolo_id') || error.message.includes('protocolo_nome'))) {
      usarCamposProtocolo = false
      query = aplicarBusca(buildQuery(SELECT_VENDAS_BASE))
      const fallback = await query.range(offset, offset + limite - 1)
      data = fallback.data
      count = fallback.count
      error = fallback.error
    }

    let usarTipoVenda = true
    if (error && error.message.includes('tipo_venda')) {
      usarTipoVenda = false
      query = aplicarBusca(buildQuery(SELECT_VENDAS_SEM_TIPO))
      const fallback = await query.range(offset, offset + limite - 1)
      data = fallback.data
      count = fallback.count
    }

    const vendasData = (data ?? []) as any[]
    vendas = vendasData.map((venda) => ({
      ...venda,
      protocolo_id: usarCamposProtocolo ? venda.protocolo_id : null,
      protocolo_nome: usarCamposProtocolo ? venda.protocolo_nome : null,
      tipo_venda: usarTipoVenda ? venda.tipo_venda : null,
    }))
    total = count ?? 0
  }

  // Só busca o detalhamento das vendas com resumo 'hibrido' — as demais
  // exibem a própria forma de pagamento direto de `venda.forma_pagamento`.
  const idsHibridos = vendas.filter((v) => v.forma_pagamento === 'hibrido').map((v) => v.id)
  if (idsHibridos.length > 0) {
    const { data: pagamentosRaw } = await supabase
      .from('pagamentos_venda')
      .select('venda_id, forma_pagamento, valor')
      .in('venda_id', idsHibridos)

    const pagamentosPorVenda: Record<string, { forma_pagamento: string; valor: number }[]> = {}
    for (const p of pagamentosRaw || []) {
      (pagamentosPorVenda[p.venda_id] ||= []).push({ forma_pagamento: p.forma_pagamento, valor: p.valor })
    }

    vendas = vendas.map((v) => ({ ...v, pagamentos: pagamentosPorVenda[v.id] }))
  }

  const totalPaginas = Math.ceil(total / limite)

  const [tagsCatalogo, tagsPorVenda] = await Promise.all([
    listarTagsVendaAtivas(),
    listarTagsPorVendas(vendas.map((v) => v.id)),
  ])

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
        <FiltrosVendas produtos={produtos} />

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Paciente</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Profissional</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Status</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Tipo da Venda</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Origem</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Pagamento</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase text-right">Valor</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Referenciador</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Data</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {vendas.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-sm text-text-secondary">
                    {busca ? `Nenhuma venda encontrada para "${busca}".` : 'Nenhuma venda encontrada.'}
                  </td>
                </tr>
              )}
              {vendas.map((venda: any) => {
                const dataFormatada = formatAppDate(venda.data_venda)
                const valorTotal = (venda.itens_venda ?? []).reduce(
                  (sum: number, item: any) => sum + item.quantidade * item.preco_unitario,
                  0
                )

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
                        <TagsItens itens={venda.itens_venda ?? []} />
                        <SeletorTagsVenda
                          vendaId={venda.id}
                          tagsAtuais={tagsPorVenda[venda.id] ?? []}
                          catalogo={tagsCatalogo}
                        />
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
                    <td className="px-6 py-4">
                      {venda.tipo_venda ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700">
                          {TIPO_VENDA_LABEL[venda.tipo_venda] ?? venda.tipo_venda}
                        </span>
                      ) : (
                        <span className="text-text-secondary text-sm">—</span>
                      )}
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
                      <PagamentoLabel formaPagamento={venda.forma_pagamento} pagamentos={venda.pagamentos} />
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-text-primary text-right">
                      {formatarValor(valorTotal)}
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
                        {venda.comprovante_pagamento_google_drive_file_id && (
                          <a
                            href={`/api/drive/file/${venda.comprovante_pagamento_google_drive_file_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-text-secondary hover:text-primary-500 hover:bg-page rounded transition-colors"
                            title="Ver comprovante de pagamento"
                          >
                            <FileText size={16} />
                          </a>
                        )}
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
              const valorTotal = (venda.itens_venda ?? []).reduce(
                (sum: number, item: any) => sum + item.quantidade * item.preco_unitario,
                0
              )

              return (
                <div key={venda.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-text-primary">{venda.pacientes?.nome}</p>
                      <p className="text-sm font-semibold text-emerald-700 mt-0.5">{formatarValor(valorTotal)}</p>
                      {venda.protocolo_nome && (
                        <p className="text-[11px] text-violet-700 font-medium mt-1">
                          Protocolo: {venda.protocolo_nome}
                        </p>
                      )}
                      <TagsItens itens={venda.itens_venda ?? []} />
                      <div className="mt-1">
                        <SeletorTagsVenda
                          vendaId={venda.id}
                          tagsAtuais={tagsPorVenda[venda.id] ?? []}
                          catalogo={tagsCatalogo}
                        />
                      </div>
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
                      {venda.tipo_venda && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-sky-50 text-sky-700">
                          {TIPO_VENDA_LABEL[venda.tipo_venda] ?? venda.tipo_venda}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-text-secondary">{dataFormatada}</p>
                  <p className="text-xs text-text-secondary">
                    <PagamentoLabel formaPagamento={venda.forma_pagamento} pagamentos={venda.pagamentos} />
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
                    {venda.comprovante_pagamento_google_drive_file_id && (
                      <a
                        href={`/api/drive/file/${venda.comprovante_pagamento_google_drive_file_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-3 py-1.5 text-xs rounded-md bg-page text-text-primary hover:bg-page/80 transition-colors flex items-center justify-center gap-1"
                      >
                        <FileText size={14} />
                        Comprovante
                      </a>
                    )}
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
                href={buildPaginaUrl(resolvedParams, pagina - 1)}
                className="px-3 py-1 rounded-md bg-page text-text-primary hover:bg-page/80 transition-colors text-sm"
              >
                ← Anterior
              </Link>
            )}

            {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={buildPaginaUrl(resolvedParams, p)}
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
                href={buildPaginaUrl(resolvedParams, pagina + 1)}
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
