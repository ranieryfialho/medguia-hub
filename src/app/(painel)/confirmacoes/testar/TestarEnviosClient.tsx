'use client'

import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { FlaskConical, Mail, MessageSquare, Send, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface Template {
  id: string
  nome: string
  conteudo: string
}

const substituirShortcodes = (text: string, p: typeof PACIENTE_PADRAO) => {
  return text
    .replace(/{{nome}}/g, p.nome)
    .replace(/{{data}}/g, p.data)
    .replace(/{{hora}}/g, p.hora)
    .replace(/{{tipo}}/g, p.tipo)
    .replace(/{{profissional}}/g, p.profissional)
    .replace(/{{sessao}}/g, '')
}

const PACIENTE_PADRAO = {
  nome: 'Maria Silva',
  tipo: 'Fisioterapia',
  data: format(new Date(), 'dd/MM/yyyy'),
  hora: '14:00',
  profissional: 'Dr. João Souza',
}

type Canal = 'email' | 'sms'

export function TestarEnviosClient() {
  const [canal, setCanal] = useState<Canal>('email')
  const [destino, setDestino] = useState('')
  const [paciente, setPaciente] = useState(PACIENTE_PADRAO)
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Carrega templates ao mudar canal
  useEffect(() => {
    setSelectedId(null)
    setPreviewHtml(null)
    setIsLoadingTemplates(true)

    const categoria = canal === 'email' ? 'confirmacao_email' : 'confirmacao_sms'
    fetch(`/api/templates?categoria=${categoria}`)
      .then(r => r.json())
      .then(data => {
        const lista: Template[] = data.templates ?? []
        setTemplates(lista)
        if (lista.length > 0) setSelectedId(lista[0].id)
      })
      .catch(() => toast.error('Erro ao carregar templates'))
      .finally(() => setIsLoadingTemplates(false))
  }, [canal])

  const selectedTemplate = templates.find(t => t.id === selectedId)
  const mensagemFinal = selectedTemplate ? substituirShortcodes(selectedTemplate.conteudo, paciente) : ''
  const assuntoFinal = selectedTemplate ? substituirShortcodes(selectedTemplate.nome, paciente) : ''

  // Atualiza preview de email
  useEffect(() => {
    if (canal !== 'email' || !selectedTemplate) {
      setPreviewHtml(null)
      return
    }

    setIsLoadingPreview(true)
    setPreviewHtml(null)

    fetch('/api/confirmacoes/email-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mensagem: mensagemFinal,
        assunto: assuntoFinal,
        paciente,
      }),
    })
      .then(r => r.json())
      .then(data => { if (data.html) setPreviewHtml(data.html) })
      .catch(() => {})
      .finally(() => setIsLoadingPreview(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, canal, paciente.nome, paciente.tipo, paciente.data, paciente.hora, paciente.profissional])

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

  async function handleEnviar() {
    if (!destino || !selectedTemplate) return

    setIsSending(true)
    try {
      const endpoint = canal === 'email' ? '/api/confirmacoes/email' : '/api/confirmacoes/sms'
      const body = canal === 'email'
        ? { email: destino, mensagem: mensagemFinal, assunto: assuntoFinal, paciente }
        : { telefone: destino, mensagem: mensagemFinal }
      // atendimento_id omitido intencionalmente no teste — link de confirmação não é gerado

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Erro ao enviar')
        return
      }

      toast.success(`${canal === 'email' ? 'Email' : 'SMS'} de teste enviado para ${destino}!`)
    } catch {
      toast.error('Erro ao enviar')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-100">
        <FlaskConical size={24} className="text-[#006b5a]" />
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#006b5a]">Testar Envios</h2>
          <p className="text-xs text-slate-500 mt-0.5">Dispare um email ou SMS de teste sem precisar de um paciente real</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna esquerda: configurações */}
        <div className="space-y-4">

          {/* Canal */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">Canal</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setCanal('email')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                  canal === 'email'
                    ? 'bg-[#006b5a] text-white border-[#006b5a]'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                <Mail size={16} /> Email
              </button>
              <button
                onClick={() => setCanal('sms')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                  canal === 'sms'
                    ? 'bg-[#006b5a] text-white border-[#006b5a]'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                <MessageSquare size={16} /> SMS
              </button>
            </div>
          </div>

          {/* Destino */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
            <label className="text-sm font-semibold text-slate-700">
              {canal === 'email' ? 'Email de destino' : 'Telefone de destino'}
            </label>
            <input
              type={canal === 'email' ? 'email' : 'tel'}
              value={destino}
              onChange={e => setDestino(e.target.value)}
              placeholder={canal === 'email' ? 'voce@email.com' : '(11) 99999-9999'}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#006b5a]/30 focus:border-[#006b5a]"
            />
          </div>

          {/* Dados fictícios do paciente */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">Dados do paciente (teste)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-slate-500 mb-1 block">Nome</label>
                <input
                  value={paciente.nome}
                  onChange={e => setPaciente(p => ({ ...p, nome: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#006b5a]/30 focus:border-[#006b5a]"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Tipo</label>
                <input
                  value={paciente.tipo}
                  onChange={e => setPaciente(p => ({ ...p, tipo: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#006b5a]/30 focus:border-[#006b5a]"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Profissional</label>
                <input
                  value={paciente.profissional}
                  onChange={e => setPaciente(p => ({ ...p, profissional: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#006b5a]/30 focus:border-[#006b5a]"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Data</label>
                <input
                  value={paciente.data}
                  onChange={e => setPaciente(p => ({ ...p, data: e.target.value }))}
                  placeholder="dd/mm/aaaa"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#006b5a]/30 focus:border-[#006b5a]"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Hora</label>
                <input
                  value={paciente.hora}
                  onChange={e => setPaciente(p => ({ ...p, hora: e.target.value }))}
                  placeholder="HH:mm"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#006b5a]/30 focus:border-[#006b5a]"
                />
              </div>
            </div>
          </div>

          {/* Seletor de template */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">Template</p>
            {isLoadingTemplates ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={20} className="animate-spin text-slate-400" />
              </div>
            ) : templates.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">
                Nenhum template de {canal === 'email' ? 'email' : 'SMS'} cadastrado.{' '}
                <a href="/confirmacoes/mensagens" className="text-[#006b5a] font-semibold hover:underline">Criar →</a>
              </p>
            ) : (
              <div className="space-y-2">
                {templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedId === t.id
                        ? 'bg-[#006b5a]/10 border-[#006b5a] shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <p className="font-medium text-sm text-[#171d1c]">{t.nome}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{t.conteudo}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Botão enviar */}
          <button
            onClick={handleEnviar}
            disabled={isSending || !destino || !selectedTemplate}
            className="w-full py-3 bg-[#006b5a] text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#005249] disabled:opacity-50 transition-colors shadow-sm"
          >
            {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {isSending ? 'Enviando...' : `Enviar ${canal === 'email' ? 'Email' : 'SMS'} de teste`}
          </button>
        </div>

        {/* Coluna direita: preview */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">Preview</p>

          {!selectedTemplate ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <FlaskConical size={36} className="mb-3 opacity-40" />
              <p className="text-sm">Selecione um template para visualizar</p>
            </div>
          ) : canal === 'email' ? (
            <>
              <p className="text-xs text-slate-500 mb-3">
                <span className="font-medium text-slate-700">Assunto:</span> {assuntoFinal}
              </p>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                {isLoadingPreview ? (
                  <div className="flex items-center justify-center h-64 bg-slate-50">
                    <Loader2 size={20} className="animate-spin text-slate-400" />
                  </div>
                ) : previewHtml ? (
                  <iframe
                    ref={iframeRef}
                    srcDoc={previewHtml}
                    className="w-full border-0"
                    style={{ minHeight: '400px' }}
                    title="Preview do email"
                  />
                ) : null}
              </div>
            </>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm whitespace-pre-wrap wrap-break-word text-slate-700 min-h-32">
              {mensagemFinal.replace(/{{link_confirmacao}}/g, '[link de confirmação]') || <span className="text-slate-400">Mensagem aparecerá aqui</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
