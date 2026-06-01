'use client'

import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { X, Send, MessageSquare, Loader2 } from 'lucide-react'
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
  email?: string | null
  data_agendamento: string
  tipo: string
  atendimento_id: string
  profissional_nome?: string
  numero_sessao?: number
  total_sessoes?: number
}

type Canal = 'sms' | 'email'

const substituirShortcodes = (text: string, paciente: Paciente) => {
  const dataConsulta = new Date(paciente.data_agendamento)
  const sessaoInfo = paciente.total_sessoes && paciente.total_sessoes > 1
    ? `${paciente.numero_sessao}/${paciente.total_sessoes}`
    : ''

  return text
    .replace(/{{nome}}/g, paciente.nome)
    .replace(/{{data}}/g, format(dataConsulta, 'dd/MM/yyyy'))
    .replace(/{{hora}}/g, format(dataConsulta, 'HH:mm'))
    .replace(/{{tipo}}/g, paciente.tipo)
    .replace(/{{profissional}}/g, paciente.profissional_nome || 'Profissional')
    .replace(/{{sessao}}/g, sessaoInfo)
}

export function SeletorTemplateCanal({
  canal,
  isOpen,
  onClose,
  paciente,
  templates,
}: {
  canal: Canal
  isOpen: boolean
  onClose: () => void
  paciente: Paciente
  templates: Template[]
}) {
  const [selectedId, setSelectedId] = useState<string | null>(templates[0]?.id ?? null)
  const [isSending, setIsSending] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (isOpen && templates.length > 0 && !selectedId) {
      setSelectedId(templates[0].id)
    }
  }, [isOpen, templates, selectedId])

  const selectedTemplate = templates.find(t => t.id === selectedId)
  const mensagemFinal = selectedTemplate ? substituirShortcodes(selectedTemplate.conteudo, paciente) : ''
  const assuntoEmail = selectedTemplate ? substituirShortcodes(selectedTemplate.nome, paciente) : ''

  // Busca o preview HTML sempre que mudar o template selecionado (só para email)
  useEffect(() => {
    if (canal !== 'email' || !selectedTemplate || !isOpen) return

    const dataConsulta = new Date(paciente.data_agendamento)

    setIsLoadingPreview(true)
    setPreviewHtml(null)

    fetch('/api/confirmacoes/email-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mensagem: mensagemFinal,
        assunto: assuntoEmail,
        paciente: {
          nome: paciente.nome,
          tipo: paciente.tipo,
          data: format(dataConsulta, 'dd/MM/yyyy'),
          hora: format(dataConsulta, 'HH:mm'),
          profissional: paciente.profissional_nome || 'Profissional',
        },
      }),
    })
      .then(r => r.json())
      .then(data => { if (data.html) setPreviewHtml(data.html) })
      .catch(() => {})
      .finally(() => setIsLoadingPreview(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, isOpen])

  // Ajusta altura do iframe dinamicamente ao conteúdo
  useEffect(() => {
    if (!iframeRef.current || !previewHtml) return
    const iframe = iframeRef.current
    const onLoad = () => {
      const height = iframe.contentDocument?.body?.scrollHeight
      if (height) iframe.style.height = `${height + 16}px`
    }
    iframe.addEventListener('load', onLoad)
    return () => iframe.removeEventListener('load', onLoad)
  }, [previewHtml])

  const handleEnviar = async () => {
    if (!selectedTemplate) return

    setIsSending(true)
    try {
      const endpoint = canal === 'sms' ? '/api/confirmacoes/sms' : '/api/confirmacoes/email'
      const dataConsulta = new Date(paciente.data_agendamento)
      const body = canal === 'sms'
        ? { telefone: paciente.telefone, mensagem: mensagemFinal, atendimento_id: paciente.atendimento_id }
        : {
            email: paciente.email,
            mensagem: mensagemFinal,
            assunto: assuntoEmail,
            atendimento_id: paciente.atendimento_id,
            paciente: {
              nome: paciente.nome,
              tipo: paciente.tipo,
              data: format(dataConsulta, 'dd/MM/yyyy'),
              hora: format(dataConsulta, 'HH:mm'),
              profissional: paciente.profissional_nome || 'Profissional',
            },
          }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || `Erro ao enviar ${canal === 'sms' ? 'SMS' : 'email'}`)
        return
      }

      if (canal === 'sms') {
        toast.success(data.message || `SMS aceito pela Twilio para ${paciente.nome}.`)
      } else {
        toast.success(`Email enviado para ${paciente.nome}!`)
      }
      onClose()
    } catch {
      toast.error(`Erro ao enviar ${canal === 'sms' ? 'SMS' : 'email'}`)
    } finally {
      setIsSending(false)
    }
  }

  if (!isOpen) return null

  const titulo = canal === 'sms' ? 'Enviar SMS' : 'Enviar Email'

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-all duration-300 animate-in fade-in"
        onClick={onClose}
      />

      <div className="fixed right-0 top-0 h-dvh w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300 ease-out">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#171d1c]">{titulo}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Paciente */}
          <div className="bg-[#006b5a]/5 border border-[#006b5a]/10 rounded-lg p-4">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-2">Paciente</p>
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold text-slate-900">{paciente.nome}</p>
              {paciente.total_sessoes && paciente.total_sessoes > 1 && (
                <span className="text-xs font-medium px-2 py-0.5 bg-[#006b5a]/20 text-[#006b5a] rounded-full">
                  {paciente.numero_sessao}/{paciente.total_sessoes}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-600">
              {paciente.tipo} • {format(new Date(paciente.data_agendamento), 'dd/MM/yyyy HH:mm')}
            </p>
            {canal === 'email' && paciente.email && (
              <p className="text-xs text-slate-500 mt-1">{paciente.email}</p>
            )}
            {canal === 'sms' && (
              <p className="text-xs text-slate-500 mt-1">{paciente.telefone}</p>
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
                  Nenhum template de {canal === 'sms' ? 'SMS' : 'email'} cadastrado.
                </p>
                <a href="/confirmacoes/mensagens" className="text-xs font-semibold text-[#006b5a] hover:underline">
                  Criar template →
                </a>
              </div>
            ) : (
              <div className="space-y-2">
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
                Preview
              </label>

              {canal === 'email' ? (
                <>
                  <p className="text-xs text-slate-500 mb-2">
                    <span className="font-medium text-slate-700">Assunto:</span> {assuntoEmail}
                  </p>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    {isLoadingPreview ? (
                      <div className="flex items-center justify-center h-48 bg-slate-50">
                        <Loader2 size={20} className="animate-spin text-slate-400" />
                      </div>
                    ) : previewHtml ? (
                      <iframe
                        ref={iframeRef}
                        srcDoc={previewHtml}
                        className="w-full border-0"
                        style={{ minHeight: '300px' }}
                        title="Preview do email"
                      />
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm whitespace-pre-wrap wrap-break-word max-h-40 overflow-y-auto text-slate-700">
                  {mensagemFinal.replace(/{{link_confirmacao}}/g, '[link de confirmação]')}
                </div>
              )}
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
            className="flex-1 px-4 py-2 bg-[#006b5a] text-white rounded-lg hover:bg-[#005249] disabled:opacity-50 transition-colors font-medium text-sm flex items-center justify-center gap-2"
          >
            <Send size={16} />
            {isSending ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>
    </>
  )
}
