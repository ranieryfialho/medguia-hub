'use client'

import { createPortal } from 'react-dom'
import { useState } from 'react'
import { X, Stethoscope } from 'lucide-react'
import type { TipoConsulta } from '@/actions/tipos-consulta'

export interface PromptPreConsultaModalProps {
  aberto: boolean
  tiposAtivos: TipoConsulta[]
  loading: boolean
  error: string
  onConfirmar: (tipoPreConsultaNome: string) => void
  onFechar: () => void
}

export function PromptPreConsultaModal({
  aberto,
  tiposAtivos,
  loading,
  error,
  onConfirmar,
  onFechar,
}: PromptPreConsultaModalProps) {
  const [etapa, setEtapa] = useState<'pergunta' | 'tipo'>('pergunta')
  const [tipoSelecionado, setTipoSelecionado] = useState('')

  if (!aberto) return null

  function handleFechar() {
    setEtapa('pergunta')
    setTipoSelecionado('')
    onFechar()
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
          <h3 className="font-bold text-[#083142]">
            {etapa === 'pergunta' ? 'Tem pré-consulta de fisioterapia?' : 'Selecione o tipo de pré-consulta'}
          </h3>
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
              onClick={() => setEtapa('tipo')}
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
            <select
              value={tipoSelecionado}
              onChange={(e) => setTipoSelecionado(e.target.value)}
              className="w-full bg-white border border-[#bcc9c4] rounded-lg px-4 py-2.5 text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] transition-all font-medium appearance-none shadow-sm"
            >
              <option value="">Selecione o tipo de pré-consulta</option>
              {tiposAtivos.map((t) => (
                <option key={t.id} value={t.nome}>{t.nome}</option>
              ))}
            </select>
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
                disabled={!tipoSelecionado || loading}
                onClick={() => onConfirmar(tipoSelecionado)}
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
