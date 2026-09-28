'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, FileText, CheckCircle2, ExternalLink, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { AssinaturaCanvas } from './AssinaturaCanvas'
import { FORMA_PAGAMENTO_LABEL } from '@/lib/vendas'
import type { ItemTermoPdf } from '@/lib/relatorios/pdf-termo-venda'
import type { ConfigClinica } from '@/lib/clinica'

export type DadosTermoVenda = {
  vendaId: string
  paciente: {
    id: string
    nome: string
    cpf: string | null
    rg: string | null
    orgao_emissor_rg: string | null
    data_nascimento: string | null
    telefone: string | null
    email: string | null
    endereco: string | null
    complemento: string | null
  }
  profissional: string | null
  forma_pagamento: string
  data_venda: string
  itens: ItemTermoPdf[]
  total: number
  clinica?: ConfigClinica | null
  tipoVenda?: string | null
  protocoloNome?: string | null
  medicoReferenciador?: string | null
  observacoes?: string | null
}

type Props = {
  dados: DadosTermoVenda
  trigger?: React.ReactNode
  forceOpen?: boolean
  onClose?: () => void
}

type Etapa = 'assinatura' | 'gerando' | 'salvo'

const fmtMoeda = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtData = (iso: string) => {
  const d = new Date(iso.slice(0, 10) + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function ModalTermoVenda({ dados, trigger, forceOpen, onClose }: Props) {
  const isControlado = forceOpen !== undefined
  const [abertoLocal, setAbertoLocal] = useState(false)
  const aberto = isControlado ? forceOpen : abertoLocal

  const [etapa, setEtapa] = useState<Etapa>('assinatura')
  const [assinatura, setAssinatura] = useState<string | null>(null)
  const [driveUrl, setDriveUrl] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const fechar = () => {
    if (etapa === 'gerando') return
    setEtapa('assinatura')
    setAssinatura(null)
    setDriveUrl(null)
    setErro(null)
    if (isControlado) onClose?.()
    else setAbertoLocal(false)
  }

  const abrir = () => {
    setEtapa('assinatura')
    setAssinatura(null)
    setDriveUrl(null)
    setErro(null)
    if (!isControlado) setAbertoLocal(true)
  }

  const gerarESalvar = async () => {
    if (!assinatura) {
      toast.error('Por favor, colete a assinatura antes de gerar o termo.')
      return
    }

    setEtapa('gerando')
    setErro(null)

    try {
      const { gerarPdfTermoVenda } = await import('@/lib/relatorios/pdf-termo-venda')

      const blob = await gerarPdfTermoVenda({
        paciente: dados.paciente,
        profissional: dados.profissional,
        forma_pagamento: FORMA_PAGAMENTO_LABEL[dados.forma_pagamento] || dados.forma_pagamento,
        data_venda: dados.data_venda,
        itens: dados.itens,
        total: dados.total,
        assinaturaDataUrl: assinatura,
        clinica: dados.clinica,
      })

      const nomeTratamento = dados.itens[0]?.nome ?? 'Geral'

      const formData = new FormData()
      formData.append('file', new File([blob], 'contrato.pdf', { type: 'application/pdf' }))
      formData.append('vendaId', dados.vendaId)
      formData.append('pacienteId', dados.paciente.id)
      formData.append('nomePaciente', dados.paciente.nome)
      formData.append('nomeTratamento', nomeTratamento)
      formData.append('tipo', 'termo')

      const res = await fetch('/api/drive/upload-termo', { method: 'POST', body: formData })
      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || 'Erro ao salvar no Drive')
      }

      const url = URL.createObjectURL(blob)
      const w = window.open(url, '_blank')
      if (w) setTimeout(() => w.print(), 800)
      setTimeout(() => URL.revokeObjectURL(url), 10_000)

      setDriveUrl(json.folderUrl ?? json.fileUrl ?? null)
      setEtapa('salvo')
      toast.success('Contrato salvo no Google Drive.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar o contrato'
      setErro(msg)
      setEtapa('assinatura')
    }
  }

  const modal = aberto ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-xl shadow-2xl border border-border w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="font-semibold text-text-primary text-base">Gerar Contrato</h2>
              <p className="text-xs text-text-secondary">{dados.paciente.nome}</p>
            </div>
          </div>
          <button
            onClick={fechar}
            disabled={etapa === 'gerando'}
            className="p-1.5 rounded-lg hover:bg-page text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {etapa === 'salvo' ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <p className="font-semibold text-text-primary text-lg">Contrato salvo com sucesso</p>
                <p className="text-sm text-text-secondary mt-1">
                  O PDF foi gerado, aberto para impressão e salvo automaticamente na pasta do paciente no Google Drive.
                </p>
              </div>
              {driveUrl && (
                <a
                  href={driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  <ExternalLink size={14} />
                  Abrir pasta no Drive
                </a>
              )}
            </div>
          ) : (
            <>
              {/* Resumo da venda */}
              <div className="bg-page rounded-lg border border-border p-4 space-y-3">
                <p className="text-xs font-semibold text-text-secondary uppercase">Resumo da Venda</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-text-secondary">Data</p>
                    <p className="font-medium text-text-primary">{fmtData(dados.data_venda)}</p>
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

              {/* Assinatura */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-text-primary">
                  Assinatura do paciente
                </p>
                <p className="text-xs text-text-secondary">
                  Solicite ao paciente que assine no campo abaixo antes de gerar o contrato.
                </p>
                <AssinaturaCanvas onChange={setAssinatura} height={160} />
              </div>

              {erro && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{erro}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border flex justify-end gap-3">
          {etapa === 'salvo' ? (
            <button
              onClick={fechar}
              className="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-medium text-sm transition-colors"
            >
              Fechar
            </button>
          ) : (
            <>
              <button
                onClick={fechar}
                disabled={etapa === 'gerando'}
                className="px-4 py-2 rounded-lg border border-border text-text-primary hover:bg-page text-sm transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={gerarESalvar}
                disabled={!assinatura || etapa === 'gerando'}
                className="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {etapa === 'gerando' ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <FileText size={15} />
                    Gerar, Imprimir e Salvar
                  </>
                )}
              </button>
            </>
          )}
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
            <FileText size={15} />
            Gerar Contrato
          </button>
        )}
      </div>
      {typeof window !== 'undefined' && modal
        ? createPortal(modal, document.body)
        : null}
    </>
  )
}
