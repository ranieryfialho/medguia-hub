'use client'

import { useState } from 'react'
import { ShoppingCart, ChevronDown, ChevronUp, ExternalLink, Clock, XCircle } from 'lucide-react'
import Link from 'next/link'
import { formatAppDate } from '@/lib/datetime'

const ORIGEM_CONFIG: Record<string, { label: string; cor: string; bg: string }> = {
  medico:    { label: 'Médico',    cor: 'text-blue-700',   bg: 'bg-blue-50' },
  leads:     { label: 'Lead',      cor: 'text-amber-700',  bg: 'bg-amber-50' },
  indicacao: { label: 'Indicação', cor: 'text-purple-700', bg: 'bg-purple-50' },
  renovacao: { label: 'Renovação', cor: 'text-green-700',  bg: 'bg-green-50' },
  campanha:  { label: 'Campanha',  cor: 'text-rose-700',   bg: 'bg-rose-50' },
}

const STATUS_CONFIG: Record<string, { label: string; cor: string; bg: string; borderL: string }> = {
  venda_confirmada:   { label: 'Venda',             cor: 'text-emerald-700', bg: 'bg-emerald-50',  borderL: 'border-l-emerald-500' },
  orcamento_pendente: { label: 'Orçamento pendente', cor: 'text-amber-700',  bg: 'bg-amber-50',    borderL: 'border-l-amber-400' },
  orcamento_recusado: { label: 'Orçamento recusado', cor: 'text-red-700',    bg: 'bg-red-50',      borderL: 'border-l-red-400' },
}

type ItemVendaResumido = {
  id: string
  quantidade: number
  preco_unitario: number
  produtos: { nome: string } | null
}

export type VendaTimeline = {
  id: string
  origem: string
  status?: string | null
  medico_referenciador_nome?: string | null
  data_venda: string
  observacoes?: string | null
  profiles: { full_name: string } | null
  itens_venda: ItemVendaResumido[]
}

export function CartaoVenda({ venda }: { venda: VendaTimeline }) {
  const [expandido, setExpandido] = useState(false)

  const origemCfg = ORIGEM_CONFIG[venda.origem] ?? { label: venda.origem, cor: 'text-slate-600', bg: 'bg-slate-100' }
  const statusKey = venda.status ?? 'venda_confirmada'
  const statusCfg = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.venda_confirmada
  const isOrcamento = statusKey !== 'venda_confirmada'
  const total = venda.itens_venda.reduce((sum, item) => sum + item.quantidade * item.preco_unitario, 0)
  const formatarValor = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const iconeStatus = statusKey === 'orcamento_pendente'
    ? <Clock size={18} className="text-amber-500" />
    : statusKey === 'orcamento_recusado'
      ? <XCircle size={18} className="text-red-500" />
      : <ShoppingCart size={18} className="text-emerald-600" />

  const bgIcone = statusKey === 'orcamento_pendente'
    ? 'bg-amber-50'
    : statusKey === 'orcamento_recusado'
      ? 'bg-red-50'
      : 'bg-emerald-50'

  return (
    <div className="relative mb-8 last:mb-0 animate-in fade-in duration-300">
      <div className={`absolute -left-[10px] top-0 w-10 h-10 rounded-full ${bgIcone} flex items-center justify-center border-4 border-white z-10 shadow-md ring-2 ring-white/50`}>
        {iconeStatus}
      </div>

      <div className="relative ml-14 md:ml-16">
        <div className={`relative bg-white rounded-xl shadow-md border border-slate-100 border-l-4 ${statusCfg.borderL} transition-all duration-300`}>
          <div className="p-4 bg-gradient-to-b from-slate-50/40 to-transparent">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 ${origemCfg.bg} ${origemCfg.cor} text-[10px] font-extrabold rounded uppercase tracking-wider`}>
                  {origemCfg.label}
                </span>
                <span className={`px-2 py-0.5 ${statusCfg.bg} ${statusCfg.cor} text-[10px] font-extrabold rounded uppercase tracking-wider`}>
                  {statusCfg.label}
                </span>
              </div>
              <span className="text-xs font-medium text-slate-500">
                {formatAppDate(venda.data_venda, 'pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>

            <div className="flex items-end justify-between">
              <div>
                <h5 className="font-bold text-slate-900 text-[15px]">
                  {venda.itens_venda.length} produto{venda.itens_venda.length !== 1 ? 's' : ''}
                </h5>
                {venda.profiles?.full_name && (
                  <p className="text-xs text-slate-500 mt-0.5">Profissional: {venda.profiles.full_name}</p>
                )}
              </div>
              <span className="text-lg font-extrabold text-emerald-700">{formatarValor(total)}</span>
            </div>
          </div>

          <button
            onClick={() => setExpandido(!expandido)}
            className="w-full px-4 py-2 flex items-center justify-between border-t border-slate-50 text-xs font-semibold text-slate-400 hover:text-[#006b5a] hover:bg-slate-50 transition-colors rounded-b-xl"
          >
            <span>{expandido ? 'Ocultar detalhes' : 'Ver detalhes'}</span>
            {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {expandido && (
            <div className="px-4 pb-4 space-y-2 animate-in slide-in-from-top-2 duration-200">
              <div className="h-px bg-slate-100 mb-3" />
              {venda.itens_venda.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100">
                  <span className="text-xs font-semibold text-slate-700">{item.produtos?.nome ?? '—'}</span>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{item.quantidade}×</span>
                    <span className="font-bold text-slate-700">{formatarValor(item.preco_unitario)}</span>
                  </div>
                </div>
              ))}
              {venda.observacoes && (
                <p className="text-xs text-slate-500 italic mt-2 px-1">{venda.observacoes}</p>
              )}
              <Link
                href={`/vendas/${venda.id}`}
                className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 mt-3"
              >
                <ExternalLink size={12} />
                {isOrcamento ? 'Ver orçamento completo' : 'Ver venda completa'}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
