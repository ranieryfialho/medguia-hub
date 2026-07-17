'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { adicionarObservacaoPaciente } from '@/actions/pacientes'
import { criarPastaPaciente } from '@/actions/google-drive'
import { X, Plus, Paperclip, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

type Tag = { id: string; label: string; active: string; inactive: string }

const TAGS: Tag[] = [
  { id: 'geral',         label: 'Geral',        active: 'bg-slate-600 text-white border-slate-600',   inactive: 'bg-white text-slate-600 border-slate-300 hover:border-slate-500' },
  { id: 'agendamentos',  label: 'Agendamentos', active: 'bg-teal-600 text-white border-teal-600',     inactive: 'bg-white text-teal-700 border-teal-200 hover:border-teal-500' },
  { id: 'comercial',     label: 'Comercial',    active: 'bg-blue-600 text-white border-blue-600',     inactive: 'bg-white text-blue-700 border-blue-200 hover:border-blue-500' },
  { id: 'contatos',      label: 'Contatos',     active: 'bg-purple-600 text-white border-purple-600', inactive: 'bg-white text-purple-700 border-purple-200 hover:border-purple-500' },
  { id: 'followups',     label: 'Follow-ups',   active: 'bg-amber-500 text-white border-amber-500',   inactive: 'bg-white text-amber-700 border-amber-200 hover:border-amber-400' },
]

type Props = { pacienteId: string; nomePaciente: string }

export function FormNovaObservacao({ pacienteId, nomePaciente }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [texto, setTexto] = useState('')
  const [tag, setTag] = useState('geral')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    if (isOpen) {
      window.addEventListener('keydown', handleEsc)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { window.removeEventListener('keydown', handleEsc); document.body.style.overflow = '' }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  function handleClose() {
    setIsOpen(false)
    setTexto('')
    setTag('geral')
    setArquivo(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!texto.trim() && !arquivo) {
      toast.error('Adicione uma observação ou selecione um arquivo.')
      return
    }

    setIsPending(true)

    try {
      let arquivoInfo: { id: string; url: string; nome: string; mime: string } | null = null

      if (arquivo) {
        const pastaResult = await criarPastaPaciente(pacienteId, nomePaciente)
        if (!pastaResult.success) {
          toast.error('Não foi possível acessar a pasta no Drive. Verifique as configurações.')
          return
        }
        const fd = new FormData()
        fd.append('file', arquivo)
        fd.append('pacienteId', pacienteId)
        const res = await fetch('/api/drive/upload', { method: 'POST', body: fd })
        const json = await res.json()
        if (!res.ok) { toast.error(json.error ?? 'Erro no upload do arquivo'); return }
        arquivoInfo = { id: json.id, url: json.fileUrl, nome: json.nome, mime: json.mimeType }
      }

      const result = await adicionarObservacaoPaciente(pacienteId, texto || null, tag, arquivoInfo)
      if (result.error) { toast.error(result.error); return }

      toast.success('Observação salva!')
      handleClose()
    } catch {
      toast.error('Erro inesperado. Tente novamente.')
    } finally {
      setIsPending(false)
    }
  }

  const BotaoAbrir = (
    <button
      onClick={() => setIsOpen(true)}
      className="p-1.5 bg-[#006b5a]/10 text-[#006b5a] hover:bg-[#006b5a] hover:text-white rounded-md transition-colors"
      title="Nova Observação"
    >
      <Plus size={16} />
    </button>
  )

  if (typeof document === 'undefined') return BotaoAbrir

  return (
    <>
      {BotaoAbrir}

      {isOpen && createPortal(
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-5 duration-300">

            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-bold text-[#006b5a]">Observações Gerais</h3>
              <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Tag selector */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tema</label>
                <div className="flex gap-2">
                  {TAGS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTag(t.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        tag === t.id ? t.active : t.inactive
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Texto */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Observação</label>
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  rows={4}
                  placeholder="Descreva a observação..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#33A68F]/50 focus:border-[#33A68F] transition-all resize-none text-slate-700"
                />
              </div>

              {/* Arquivo */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Anexar arquivo <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                {arquivo ? (
                  <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <Paperclip size={14} className="text-[#006b5a] shrink-0" />
                    <span className="text-sm text-slate-700 flex-1 truncate">{arquivo.name}</span>
                    <button
                      type="button"
                      onClick={() => { setArquivo(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-2 px-3 py-2.5 border border-dashed border-slate-200 rounded-lg text-sm text-slate-500 hover:border-[#33A68F] hover:text-[#006b5a] transition-colors"
                  >
                    <Paperclip size={14} />
                    Selecionar arquivo
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                  onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                />
                <p className="text-[10px] text-slate-400 mt-1">Máximo 50MB. Salvo no Google Drive do paciente.</p>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button type="button" onClick={handleClose}
                  className="px-5 py-2.5 text-slate-600 text-sm font-medium hover:bg-slate-100 rounded-lg transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={isPending}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#006b5a] hover:bg-[#005143] text-white text-sm font-bold rounded-lg transition-all disabled:opacity-70 shadow-md shadow-[#006b5a]/20">
                  {isPending && <Loader2 size={14} className="animate-spin" />}
                  {isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}