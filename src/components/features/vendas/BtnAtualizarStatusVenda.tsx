'use client'

import { useState, useTransition } from 'react'
import { CheckCircle, XCircle, Clock, LoaderCircle } from 'lucide-react'
import { atualizarStatusVenda } from '@/actions/vendas'
import { UploadComprovantesVenda } from './UploadComprovantesVenda'
import type { ComprovanteVenda } from '@/lib/comprovantes-venda'

interface Props {
  vendaId: string
  statusAtual: string
  pacienteId: string
  pacienteNome: string
  /** Comprovantes já anexados à venda — os novos são acrescentados a estes. */
  comprovantesAtuais: ComprovanteVenda[]
}

export function BtnAtualizarStatusVenda({ vendaId, statusAtual, pacienteId, pacienteNome, comprovantesAtuais }: Props) {
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [motivo, setMotivo] = useState('')

  const [modalComprovanteAberto, setModalComprovanteAberto] = useState(false)
  const [comprovantesNovos, setComprovantesNovos] = useState<ComprovanteVenda[]>([])

  const atualizar = (novoStatus: string, motivoRecusa?: string, novos?: ComprovanteVenda[]) => {
    setErro('')
    startTransition(async () => {
      const result = await atualizarStatusVenda(vendaId, novoStatus, motivoRecusa, novos)
      if (result.error) setErro(result.error)
    })
  }

  const handleConfirmarVenda = () => {
    if (comprovantesAtuais.length > 0) {
      atualizar('venda_confirmada')
      return
    }
    setComprovantesNovos([])
    setModalComprovanteAberto(true)
  }

  const confirmarComComprovante = () => {
    if (comprovantesNovos.length === 0) return
    setModalComprovanteAberto(false)
    atualizar('venda_confirmada', undefined, comprovantesNovos)
  }

  const handleRecusar = () => {
    setMotivo('')
    setModalAberto(true)
  }

  const confirmarRecusa = () => {
    setModalAberto(false)
    atualizar('orcamento_recusado', motivo)
  }

  return (
    <>
      <div className="space-y-2">
        <p className="text-xs text-text-secondary uppercase font-semibold mb-2">Alterar status</p>
        <div className="flex flex-wrap gap-2">
          {statusAtual !== 'venda_confirmada' && (
            <button
              onClick={handleConfirmarVenda}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              {isPending ? <LoaderCircle size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Confirmar venda
            </button>
          )}

          {statusAtual !== 'orcamento_pendente' && (
            <button
              onClick={() => atualizar('orcamento_pendente')}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              {isPending ? <LoaderCircle size={14} className="animate-spin" /> : <Clock size={14} />}
              Marcar como pendente
            </button>
          )}

          {statusAtual !== 'orcamento_recusado' && (
            <button
              onClick={handleRecusar}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              {isPending ? <LoaderCircle size={14} className="animate-spin" /> : <XCircle size={14} />}
              Marcar como recusado
            </button>
          )}
        </div>
        {erro && <p className="text-xs text-red-600 mt-1">{erro}</p>}
      </div>

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-surface rounded-xl border border-border shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <XCircle size={20} className="text-red-500 shrink-0" />
              <h2 className="text-base font-semibold text-text-primary">Recusar orçamento</h2>
            </div>
            <p className="text-sm text-text-secondary">
              Informe o motivo da recusa, se houver. Essa informação ficará registrada no orçamento.
            </p>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ex: Paciente achou o valor alto, optou por outro tratamento..."
              rows={3}
              className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500 resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setModalAberto(false)}
                className="px-4 py-2 rounded-md text-sm font-medium text-text-secondary hover:bg-page transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarRecusa}
                className="px-4 py-2 rounded-md bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
              >
                Confirmar recusa
              </button>
            </div>
          </div>
        </div>
      )}

      {modalComprovanteAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-surface rounded-xl border border-border shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle size={20} className="text-emerald-500 shrink-0" />
              <h2 className="text-base font-semibold text-text-primary">Confirmar venda</h2>
            </div>
            <p className="text-sm text-text-secondary">
              Anexe o comprovante de pagamento para confirmar esta venda. Você pode anexar mais de um.
            </p>

            <UploadComprovantesVenda
              pacienteId={pacienteId}
              pacienteNome={pacienteNome}
              comprovantes={comprovantesNovos}
              onChange={setComprovantesNovos}
            />

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setModalComprovanteAberto(false)}
                className="px-4 py-2 rounded-md text-sm font-medium text-text-secondary hover:bg-page transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarComComprovante}
                disabled={comprovantesNovos.length === 0 || isPending}
                className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                Confirmar venda
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
