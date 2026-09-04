'use client'

import { useRef, useState, useTransition } from 'react'
import { CheckCircle, XCircle, Clock, LoaderCircle, Upload, FileText, ExternalLink } from 'lucide-react'
import { atualizarStatusVenda } from '@/actions/vendas'
import { criarPastaPaciente } from '@/actions/google-drive'

interface ComprovanteVenda {
  fileId: string
  fileUrl: string | null
  nome: string | null
}

interface Props {
  vendaId: string
  statusAtual: string
  pacienteId: string
  pacienteNome: string
  comprovanteAtual: ComprovanteVenda | null
}

export function BtnAtualizarStatusVenda({ vendaId, statusAtual, pacienteId, pacienteNome, comprovanteAtual }: Props) {
  const [isPending, startTransition] = useTransition()
  const [erro, setErro] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [motivo, setMotivo] = useState('')

  const [modalComprovanteAberto, setModalComprovanteAberto] = useState(false)
  const [comprovanteNovo, setComprovanteNovo] = useState<ComprovanteVenda | null>(null)
  const [uploadandoComprovante, setUploadandoComprovante] = useState(false)
  const [erroComprovante, setErroComprovante] = useState('')
  const comprovanteInputRef = useRef<HTMLInputElement>(null)

  const atualizar = (novoStatus: string, motivoRecusa?: string, comprovante?: ComprovanteVenda) => {
    setErro('')
    startTransition(async () => {
      const result = await atualizarStatusVenda(
        vendaId,
        novoStatus,
        motivoRecusa,
        comprovante ? { fileId: comprovante.fileId, fileUrl: comprovante.fileUrl, nome: comprovante.nome } : undefined,
      )
      if (result.error) setErro(result.error)
    })
  }

  const handleConfirmarVenda = () => {
    if (comprovanteAtual) {
      atualizar('venda_confirmada')
      return
    }
    setErroComprovante('')
    setComprovanteNovo(null)
    setModalComprovanteAberto(true)
  }

  const handleUploadComprovante = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 50 * 1024 * 1024) {
      setErroComprovante('Arquivo muito grande. Máximo 50MB.')
      return
    }
    setErroComprovante('')
    setUploadandoComprovante(true)
    try {
      const pasta = await criarPastaPaciente(pacienteId, pacienteNome)
      if (!pasta.success) {
        setErroComprovante(pasta.error ?? 'Erro ao preparar pasta no Drive.')
        return
      }
      const fd = new FormData()
      fd.append('file', file)
      fd.append('pacienteId', pacienteId)
      const res = await fetch('/api/drive/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) {
        setErroComprovante(json.error ?? 'Erro no upload do comprovante.')
      } else {
        setComprovanteNovo({ fileId: json.id, fileUrl: json.fileUrl ?? null, nome: json.nome ?? file.name })
      }
    } catch {
      setErroComprovante('Erro ao enviar comprovante.')
    } finally {
      setUploadandoComprovante(false)
      if (comprovanteInputRef.current) comprovanteInputRef.current.value = ''
    }
  }

  const confirmarComComprovante = () => {
    if (!comprovanteNovo) return
    setModalComprovanteAberto(false)
    atualizar('venda_confirmada', undefined, comprovanteNovo)
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
              Anexe o comprovante de pagamento para confirmar esta venda.
            </p>

            {comprovanteNovo ? (
              <div className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border bg-page">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={16} className="text-primary-500 shrink-0" />
                  <span className="text-sm text-text-primary truncate">{comprovanteNovo.nome}</span>
                </div>
                <a
                  href={`/api/drive/file/${comprovanteNovo.fileId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-text-secondary hover:text-primary-500 hover:bg-white rounded transition-colors shrink-0"
                  title="Ver comprovante"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            ) : (
              <button
                type="button"
                disabled={uploadandoComprovante}
                onClick={() => comprovanteInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-dashed border-border-input text-sm font-medium text-text-secondary hover:bg-page transition-colors disabled:opacity-50"
              >
                {uploadandoComprovante ? <LoaderCircle size={16} className="animate-spin" /> : <Upload size={16} />}
                {uploadandoComprovante ? 'Enviando...' : 'Anexar comprovante'}
              </button>
            )}
            <input
              ref={comprovanteInputRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={handleUploadComprovante}
            />
            {erroComprovante && <p className="text-xs text-red-600">{erroComprovante}</p>}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setModalComprovanteAberto(false)}
                className="px-4 py-2 rounded-md text-sm font-medium text-text-secondary hover:bg-page transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarComComprovante}
                disabled={!comprovanteNovo || isPending}
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
