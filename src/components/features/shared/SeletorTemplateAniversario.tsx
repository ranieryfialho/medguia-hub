'use client'

import { useState, useEffect } from 'react'
import { X, Send, MessageCircle, Mail, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'

interface Template {
  id: string
  nome: string
  conteudo: string
}

interface PacienteAniversario {
  id: string
  nome: string
  telefone: string
  email: string
  idade: number
  diaMes: string
  diaSemana: string
}

type Canal = 'whatsapp' | 'email'

function substituirShortcodes(text: string, paciente: PacienteAniversario): string {
  return text
    .replace(/{{nome}}/g, paciente.nome)
    .replace(/{{idade}}/g, String(paciente.idade))
    .replace(/{{dia_semana}}/g, paciente.diaSemana.toLowerCase())
}

export function SeletorTemplateAniversario({
  isOpen,
  onClose,
  canal,
  paciente,
  templates,
}: {
  isOpen: boolean
  onClose: () => void
  canal: Canal
  paciente: PacienteAniversario
  templates: Template[]
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    if (isOpen && templates.length > 0 && !selectedId) {
      setSelectedId(templates[0].id)
    }
  }, [isOpen, templates, selectedId])

  const selectedTemplate = templates.find(t => t.id === selectedId)
  const mensagemFinal = selectedTemplate ? substituirShortcodes(selectedTemplate.conteudo, paciente) : ''

  const handleEnviar = async () => {
    if (!selectedTemplate) return
    setIsSending(true)
    try {
      if (canal === 'whatsapp') {
        const telefoneLimpo = paciente.telefone.replace(/\D/g, '')
        const linkWhatsApp = `https://wa.me/55${telefoneLimpo}?text=${encodeURIComponent(mensagemFinal)}`
        window.open(linkWhatsApp, '_blank')
        toast.success('Abrindo WhatsApp...')
      } else {
        const assunto = encodeURIComponent(`Feliz Aniversário, ${paciente.nome}!`)
        const corpo = encodeURIComponent(mensagemFinal)
        const mailtoLink = `mailto:${paciente.email}?subject=${assunto}&body=${corpo}`
        window.open(mailtoLink, '_blank')
        toast.success('Abrindo cliente de email...')
      }
      onClose()
    } catch {
      toast.error('Erro ao abrir o canal de envio')
    } finally {
      setIsSending(false)
    }
  }

  if (!isOpen) return null

  const isWhatsApp = canal === 'whatsapp'
  const titulo = isWhatsApp ? 'Enviar via WhatsApp' : 'Enviar Email'

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-all duration-300 animate-in fade-in"
        onClick={onClose}
      />

      <div className="fixed right-0 top-0 h-dvh w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300 ease-out">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#171d1c] flex items-center gap-2">
            {isWhatsApp ? (
              <MessageCircle size={20} className="text-[#25D366]" />
            ) : (
              <Mail size={20} className="text-orange-500" />
            )}
            {titulo}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 transition-colors"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Dados do paciente */}
          <div className="bg-[#006b5a]/5 border border-[#006b5a]/10 rounded-lg p-4">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-2">Paciente</p>
            <p className="font-semibold text-slate-900">{paciente.nome}</p>
            <p className="text-sm text-slate-600 mt-1">
              🎂 {paciente.diaMes} · completa <strong>{paciente.idade} anos</strong> · {paciente.diaSemana}
            </p>
            {isWhatsApp && paciente.telefone && (
              <p className="text-xs text-slate-500 mt-1">{paciente.telefone}</p>
            )}
            {!isWhatsApp && paciente.email && (
              <p className="text-xs text-slate-500 mt-1">{paciente.email}</p>
            )}
          </div>

          {/* Templates */}
          <div>
            <label className="block text-sm font-medium text-[#171d1c] mb-2">
              Selecione um template
            </label>

            {templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 border border-dashed border-slate-300 rounded-lg gap-3">
                <MessageSquare size={32} className="text-slate-300" />
                <p className="text-sm text-slate-500 text-center">
                  Nenhum template de aniversário cadastrado.
                </p>
                <a
                  href="/configuracoes/mensagens"
                  className="text-xs font-semibold text-[#006b5a] hover:underline"
                >
                  Criar template →
                </a>
              </div>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto">
                {templates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedId(template.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedId === template.id
                        ? 'bg-[#006b5a]/10 border-[#006b5a] shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <p className="font-medium text-sm text-[#171d1c]">{template.nome}</p>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{template.conteudo}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Preview */}
          {selectedTemplate && (
            <div>
              <label className="block text-sm font-medium text-[#171d1c] mb-2">
                Preview da mensagem
              </label>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm whitespace-pre-wrap break-words max-h-40 overflow-y-auto text-slate-700">
                {mensagemFinal}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleEnviar}
            disabled={isSending || !selectedTemplate || templates.length === 0}
            className={`flex-1 px-4 py-2 text-white rounded-lg disabled:opacity-50 transition-colors font-medium text-sm flex items-center justify-center gap-2 ${
              isWhatsApp
                ? 'bg-[#25D366] hover:bg-[#20ba5a]'
                : 'bg-orange-500 hover:bg-orange-600'
            }`}
          >
            <Send size={16} />
            {isSending ? 'Abrindo...' : isWhatsApp ? 'Enviar WhatsApp' : 'Enviar Email'}
          </button>
        </div>
      </div>
    </>
  )
}