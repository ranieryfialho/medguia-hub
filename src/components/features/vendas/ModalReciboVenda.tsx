'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Receipt, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { AssinaturaCanvas } from './AssinaturaCanvas'
import { FORMA_PAGAMENTO_LABEL } from '@/lib/vendas'
import type { ItemReciboPdf } from '@/lib/relatorios/pdf-recibo-venda'
import type { ConfigClinica } from '@/lib/clinica'

export type DadosReciboVenda = {
  vendaId: string
  paciente: {
    id: string
    nome: string
    cpf: string | null
    rg: string | null
    orgao_emissor_rg: string | null
    endereco: string | null
    complemento: string | null
  }
  profissional: string | null
  forma_pagamento: string
  data_venda: string
  itens: ItemReciboPdf[]
  total: number
  tipoVenda?: string | null
  protocoloNome?: string | null
  medicoReferenciador?: string | null
  observacoes?: string | null
  clinica?: ConfigClinica | null
}

type Props = {
  dados: DadosReciboVenda
  trigger?: React.ReactNode
  forceOpen?: boolean
  onClose?: () => void
}

const fmtMoeda = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function ModalReciboVenda({ dados, trigger, forceOpen, onClose }: Props) {
  const isControlado = forceOpen !== undefined
  const [abertoLocal, setAbertoLocal] = useState(false)
  const aberto = isControlado ? forceOpen : abertoLocal

  const [assinatura, setAssinatura] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const fechar = () => {
    if (gerando) return
    setAssinatura(null)
    setErro(null)
    if (isControlado) onClose?.()
    else setAbertoLocal(false)
  }

  const abrir = () => {
    setAssinatura(null)
    setErro(null)
    if (!isControlado) setAbertoLocal(true)
  }

  const gerarEImprimir = async () => {
    if (!assinatura) {
      toast.error('Por favor, colete a assinatura antes de gerar o recibo.')
      return
    }

    setGerando(true)
    setErro(null)

    try {
      const { gerarPdfReciboVenda } = await import('@/lib/relatorios/pdf-recibo-venda')

      const blob = await gerarPdfReciboVenda({
        vendaId: dados.vendaId,
        paciente: dados.paciente,
        profissional: dados.profissional,
        forma_pagamento: FORMA_PAGAMENTO_LABEL[dados.forma_pagamento] || dados.forma_pagamento,
        data_venda: dados.data_venda,
        itens: dados.itens,
        total: dados.total,
        tipoVenda: dados.tipoVenda,
        protocoloNome: dados.protocoloNome,
        medicoReferenciador: dados.medicoReferenciador,
        observacoes: dados.observacoes,
        assinaturaDataUrl: assinatura,
        clinica: dados.clinica,
      })

      const url = URL.createObjectURL(blob)
      const w = window.open(url, '_blank')
      if (w) setTimeout(() => w.print(), 800)
      setTimeout(() => URL.revokeObjectURL(url), 10_000)

      const nomeTratamento = dados.itens[0]?.nome ?? 'Geral'
      const formData = new FormData()
      formData.append('file', new File([blob], 'recibo.pdf', { type: 'application/pdf' }))
      formData.append('vendaId', dados.vendaId)
      formData.append('pacienteId', dados.paciente.id)
      formData.append('nomePaciente', dados.paciente.nome)
      formData.append('nomeTratamento', nomeTratamento)
      formData.append('tipo', 'recibo')

      const res = await fetch('/api/drive/upload-termo', { method: 'POST', body: formData })
      if (res.ok) {
        toast.success('Recibo gerado e salvo no Google Drive.')
      } else {
        toast('Recibo impresso, mas não foi possível salvá-lo no Drive.', { icon: '⚠️' })
      }

      fechar()
    } catch {
      setErro('Erro ao gerar o recibo.')
    } finally {
      setGerando(false)
    }
  }

  const modal = aberto ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-xl shadow-2xl border border-border w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center">
              <Receipt size={18} />
            </div>
            <div>
              <h2 className="font-semibold text-text-primary text-base">Recibo de Contratação</h2>
              <p className="text-xs text-text-secondary">{dados.paciente.nome}</p>
            </div>
          </div>
          <button
            onClick={fechar}
            disabled={gerando}
            className="p-1.5 rounded-lg hover:bg-page text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="bg-page rounded-lg border border-border p-4 space-y-3">
            <p className="text-xs font-semibold text-text-secondary uppercase">Resumo da Venda</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-text-secondary">Data</p>
                <p className="font-medium text-text-primary">
                  {new Date(dados.data_venda.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-secondary">Pagamento</p>
                <p className="font-medium text-text-primary">
                  {FORMA_PAGAMENTO_LABEL[dados.forma_pagamento] || dados.forma_pagamento}
                </p>
              </div>
              {dados.profissional && (
                <div>
                  <p className="text-xs text-text-secondary">Profissional</p>
                  <p className="font-medium text-text-primary">{dados.profissional}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-text-secondary">Total</p>
                <p className="font-semibold text-primary-600">{fmtMoeda(dados.total)}</p>
              </div>
            </div>
            <div className="pt-1 border-t border-border space-y-1">
              {dados.itens.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-text-primary">{item.nome} ×{item.quantidade}</span>
                  <span className="text-text-secondary">{fmtMoeda(item.subtotal)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-text-primary">
              Assinatura do contratante
            </p>
            <p className="text-xs text-text-secondary">
              Solicite ao paciente que assine no campo abaixo antes de gerar o recibo.
            </p>
            <AssinaturaCanvas onChange={setAssinatura} height={160} />
          </div>

          {erro && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-border flex justify-end gap-3">
          <button
            onClick={fechar}
            disabled={gerando}
            className="px-4 py-2 rounded-lg border border-border text-text-primary hover:bg-page text-sm transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={gerarEImprimir}
            disabled={!assinatura || gerando}
            className="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {gerando ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Receipt size={15} />
                Gerar e Imprimir
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      <div onClick={abrir} className="cursor-pointer">
        {trigger ?? (
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-border hover:bg-page text-text-primary rounded-md font-medium text-sm transition-colors"
          >
            <Receipt size={15} />
            Recibo
          </button>
        )}
      </div>
      {typeof window !== 'undefined' && modal
        ? createPortal(modal, document.body)
        : null}
    </>
  )
}
