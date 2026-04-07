'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { X, Send } from 'lucide-react'
import { registrarEnvioWhatsApp } from '@/actions/confirmacoes'
import toast from 'react-hot-toast'

interface Template {
  id: string
  nome: string
  conteudo: string
}

interface Paciente {
  id: string
  nome: string
  telefone: string
  data_agendamento: string
  tipo: string
  atendimento_id: string
  profissional_nome?: string
  numero_sessao?: number
  total_sessoes?: number
}

const substituirShortcodes = (text: string, paciente: Paciente) => {
  const dataFormatada = format(new Date(paciente.data_agendamento), 'dd/MM/yyyy')
  const horaFormatada = format(new Date(paciente.data_agendamento), 'HH:mm')
  const profissionalNome = paciente.profissional_nome || 'Profissional'
  const sessaoInfo = paciente.total_sessoes && paciente.total_sessoes > 1
    ? `${paciente.numero_sessao}/${paciente.total_sessoes}`
    : ''

  return text
    .replace(/{{nome}}/g, paciente.nome)
    .replace(/{{data}}/g, dataFormatada)
    .replace(/{{hora}}/g, horaFormatada)
    .replace(/{{tipo}}/g, paciente.tipo)
    .replace(/{{profissional}}/g, profissionalNome)
    .replace(/{{sessao}}/g, sessaoInfo)
}

export function SeletorTemplateWhatsApp({
  isOpen,
  onClose,
  paciente,
  templates,
}: {
  isOpen: boolean
  onClose: () => void
  paciente: Paciente
  templates: Template[]
}) {
  const [selectedId, setSelectedId] = useState<string | null>(templates[0]?.id ?? null)
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    if (isOpen && templates.length > 0 && !selectedId) {
      setSelectedId(templates[0].id)
    }
  }, [isOpen, templates, selectedId])

  const selectedTemplate = templates.find(t => t.id === selectedId)
  const mensagemFinal = selectedTemplate
    ? substituirShortcodes(selectedTemplate.conteudo, paciente)
    : ''

  const handleEnviar = async () => {
    if (!selectedTemplate) return

    setIsSending(true)
    try {
      // Registrar envio
      await registrarEnvioWhatsApp(paciente.atendimento_id, selectedTemplate.id)

      // Abrir WhatsApp com a mensagem
      const mensagemEncoded = encodeURIComponent(mensagemFinal)
      const linkWhatsApp = `https://wa.me/55${paciente.telefone}?text=${mensagemEncoded}`
      window.open(linkWhatsApp, '_blank')

      toast.success('Mensagem enviada!')
      onClose()
    } catch (error) {
      console.error('Erro ao enviar:', error)
      toast.error('Erro ao enviar mensagem')
    } finally {
      setIsSending(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay com blur */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-all duration-300 animate-in fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-screen w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300 ease-out">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#171d1c]">
            Enviar via WhatsApp
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
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-2">
              Paciente
            </p>
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold text-slate-900">{paciente.nome}</p>
              {paciente.total_sessoes && paciente.total_sessoes > 1 && (
                <span className="text-xs font-medium px-2 py-0.5 bg-[#006b5a]/20 text-[#006b5a] rounded-full">
                  {paciente.numero_sessao}/{paciente.total_sessoes}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-600 mt-1">
              {paciente.tipo} • {format(new Date(paciente.data_agendamento), 'dd/MM/yyyy HH:mm')}
            </p>
          </div>

          {/* Seleção de template */}
          <div>
            <label className="block text-sm font-medium text-[#171d1c] mb-2">
              Selecione um template
            </label>
            <div className="space-y-2 max-h-72 overflow-y-auto">
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
                  <p className="font-medium text-sm text-[#171d1c]">
                    {template.nome}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {template.conteudo}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Preview da mensagem */}
          {selectedTemplate && (
            <div>
              <label className="block text-sm font-medium text-[#171d1c] mb-2">
                Preview da mensagem
              </label>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm whitespace-pre-wrap break-words max-h-24 overflow-y-auto text-slate-700">
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
            disabled={isSending || !selectedTemplate}
            className="flex-1 px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#20ba5a] disabled:opacity-50 transition-colors font-medium text-sm flex items-center justify-center gap-2"
          >
            <Send size={16} />
            Enviar
          </button>
        </div>
      </div>
    </>
  )
}
