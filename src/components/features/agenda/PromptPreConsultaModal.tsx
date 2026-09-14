'use client'

import { createPortal } from 'react-dom'
import { useState } from 'react'
import { X, Stethoscope } from 'lucide-react'

export interface PromptPreConsultaModalProps {
  aberto: boolean
  loading: boolean
  error: string
  ocultarAviso: boolean
  onConfirmar: (naoMostrarNovamente: boolean) => void
  onFechar: () => void
}

export function PromptPreConsultaModal({
  aberto,
  loading,
  error,
  ocultarAviso,
  onConfirmar,
  onFechar,
}: PromptPreConsultaModalProps) {
  const [etapa, setEtapa] = useState<'pergunta' | 'aviso'>('pergunta')
  const [naoMostrarNovamente, setNaoMostrarNovamente] = useState(false)

  if (!aberto) return null

  function handleFechar() {
    setEtapa('pergunta')
    setNaoMostrarNovamente(false)
    onFechar()
  }

  function handleSim() {
    if (ocultarAviso) {
      onConfirmar(false)
      return
    }
    setEtapa('aviso')
  }

  const conteudo = (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar"
        onClick={handleFechar}
        className="absolute inset-0 bg-[#171d1c]/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl p-6 space-y-4">
        <button type="button" onClick={handleFechar} className="absolute top-4 right-4 text-[#6d7a75] hover:text-[#171d1c]">
          <X size={16} />
        </button>

        <div className="flex items-center gap-2 text-[#006b5a]">
          <Stethoscope size={20} />
          <h3 className="font-bold text-[#083142]">Tem pré-consulta de fisioterapia?</h3>
        </div>

        {etapa === 'pergunta' ? (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleFechar}
              className="flex-1 px-4 py-2.5 rounded-lg font-bold text-[#3d4945] bg-white border border-[#bcc9c4] hover:bg-[#dee3e3] transition-colors"
            >
              Não
            </button>
            <button
              type="button"
              onClick={handleSim}
              className="flex-1 px-4 py-2.5 rounded-lg font-bold text-white bg-[#006b5a] hover:bg-[#004f43] transition-colors"
            >
              Sim
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-[#6d7a75]">
              A pré-consulta ficará pendente até um fisioterapeuta ser atribuído a ela na fila de pré-consultas.
            </p>
            <label className="flex items-center gap-2 text-xs font-medium text-[#3d4945]">
              <input
                type="checkbox"
                checked={naoMostrarNovamente}
                onChange={(e) => setNaoMostrarNovamente(e.target.checked)}
                className="rounded border-[#bcc9c4] text-[#006b5a] focus:ring-[#006b5a]/50"
              />
              Não mostrar esta mensagem novamente
            </label>
            {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleFechar}
                className="flex-1 px-4 py-2.5 rounded-lg font-bold text-[#3d4945] bg-white border border-[#bcc9c4] hover:bg-[#dee3e3] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => onConfirmar(naoMostrarNovamente)}
                className="flex-1 px-4 py-2.5 rounded-lg font-bold text-white bg-[#006b5a] hover:bg-[#004f43] transition-colors disabled:opacity-60"
              >
                {loading ? 'Criando...' : 'Criar pré-consulta'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(conteudo, document.body) : null
}
