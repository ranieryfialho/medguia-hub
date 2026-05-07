'use client'

import { useState, useRef } from 'react'
import { salvarTemplate, atualizarTemplate, deletarTemplate } from '@/actions/templates'
import { Plus, Trash2, Check, X, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'

interface Template {
  id: string
  nome: string
  conteudo: string
  criado_em?: string
  criado_por: string | null
  categoria: 'confirmacao' | 'reativacao'
}

type Categoria = 'confirmacao' | 'reativacao'

const CATEGORIAS = [
  { id: 'confirmacao' as const, label: 'Confirmação de Consulta', descricao: 'Mensagens para confirmar agendamentos' },
  { id: 'reativacao' as const, label: 'Reativação de Paciente', descricao: 'Mensagens para reengajar pacientes inativos' },
]

const SHORTCODES = [
  // Agendamento
  { label: '{{nome}}', value: '{{nome}}' },
  { label: '{{data}}', value: '{{data}}' },
  { label: '{{hora}}', value: '{{hora}}' },
  { label: '{{profissional}}', value: '{{profissional}}' },
  { label: '{{tipo}}', value: '{{tipo}}' },
  { label: '{{sessao}}', value: '{{sessao}}' },
  // Reativação de contatos
  { label: '{{dias}}', value: '{{dias}}' },
  { label: '{{data_ultimo}}', value: '{{data_ultimo}}' },
  { label: '{{ultimo_tipo}}', value: '{{ultimo_tipo}}' },
]

export function GerenciadorMensagens({ templates: initialTemplates }: { templates: Template[] }) {
  const [templates, setTemplates] = useState(initialTemplates)
  const [activeTab, setActiveTab] = useState<Categoria>('confirmacao')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isEditingNew, setIsEditingNew] = useState(false)
  const [nome, setNome] = useState('')
  const [conteudo, setConteudo] = useState('')
  const [categoria, setCategoria] = useState<Categoria>('confirmacao')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const templatesDoTab = templates.filter(t => t.categoria === activeTab)
  const selectedTemplate = templates.find(t => t.id === selectedId)
  const isGlobal = selectedTemplate?.criado_por === null && !isEditingNew

  const handleSelectTemplate = (id: string) => {
    if (isEditingNew) {
      setIsEditingNew(false)
    }
    setSelectedId(id)
    const template = templates.find(t => t.id === id)
    if (template) {
      setNome(template.nome)
      setConteudo(template.conteudo)
      setCategoria(template.categoria)
      setDeletingId(null)
    }
  }

  const handleNovaMsg = () => {
    setIsEditingNew(true)
    setSelectedId(null)
    setNome('')
    setConteudo('')
    setCategoria(activeTab)
    setDeletingId(null)
  }

  const handleCancel = () => {
    setIsEditingNew(false)
    if (selectedTemplate) {
      setNome(selectedTemplate.nome)
      setConteudo(selectedTemplate.conteudo)
      setCategoria(selectedTemplate.categoria)
    }
  }

  const handleSave = async () => {
    if (!nome.trim() || !conteudo.trim()) {
      toast.error('Preencha nome e conteúdo da mensagem')
      return
    }

    setIsSaving(true)
    try {
      if (isEditingNew) {
        const result = await salvarTemplate(nome, conteudo, categoria)
        if (result.error) {
          toast.error('Erro ao salvar template')
          return
        }
        const newTemplate: Template = {
          id: result.id || Math.random().toString(),
          nome,
          conteudo,
          categoria,
          criado_em: new Date().toISOString(),
          criado_por: 'me',
        }
        setTemplates([...templates, newTemplate])
        toast.success('Template criado com sucesso!')
        setIsEditingNew(false)
        setSelectedId(newTemplate.id)
      } else if (selectedTemplate) {
        const result = await atualizarTemplate(selectedTemplate.id, nome, conteudo)
        if (result.error) {
          toast.error('Erro ao atualizar template')
          return
        }
        toast.success('Template atualizado com sucesso!')
        setTemplates(
          templates.map(t => (t.id === selectedTemplate.id ? { ...t, nome, conteudo, categoria } : t))
        )
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedTemplate || deletingId !== selectedTemplate.id) return

    setIsSaving(true)
    try {
      const result = await deletarTemplate(selectedTemplate.id)
      if (result.error) {
        toast.error('Erro ao deletar template')
        return
      }
      toast.success('Template deletado')
      setTemplates(templates.filter(t => t.id !== selectedTemplate.id))
      setSelectedId(templatesDoTab[0]?.id ?? null)
      setDeletingId(null)
    } finally {
      setIsSaving(false)
    }
  }

  const insertShortcode = (shortcode: string) => {
    if (!textareaRef.current) return
    const start = textareaRef.current.selectionStart
    const end = textareaRef.current.selectionEnd
    const newConteudo =
      conteudo.substring(0, start) + shortcode + conteudo.substring(end)
    setConteudo(newConteudo)
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = start + shortcode.length
        textareaRef.current.selectionEnd = start + shortcode.length
        textareaRef.current.focus()
      }
    }, 0)
  }

  const substituirShortcodes = (text: string) => {
    const example = {
      nome: 'João Silva',
      data: '15/04/2026',
      hora: '14:30',
      profissional: 'Carlos Fisioterapeuta',
      tipo: 'Fisioterapia',
      sessao: '2/10',
      dias: '45',
      data_ultimo: '21/02/2026',
      ultimo_tipo: 'FOT Fisioterapia',
    }

    return text
      .replace(/{{nome}}/g, `<span class="bg-[#006b5a]/20 px-1 rounded">${example.nome}</span>`)
      .replace(/{{data}}/g, `<span class="bg-[#006b5a]/20 px-1 rounded">${example.data}</span>`)
      .replace(/{{hora}}/g, `<span class="bg-[#006b5a]/20 px-1 rounded">${example.hora}</span>`)
      .replace(/{{profissional}}/g, `<span class="bg-[#006b5a]/20 px-1 rounded">${example.profissional}</span>`)
      .replace(/{{tipo}}/g, `<span class="bg-[#006b5a]/20 px-1 rounded">${example.tipo}</span>`)
      .replace(/{{sessao}}/g, `<span class="bg-[#006b5a]/20 px-1 rounded">${example.sessao}</span>`)
      .replace(/{{dias}}/g, `<span class="bg-[#b45309]/20 px-1 rounded">${example.dias}</span>`)
      .replace(/{{data_ultimo}}/g, `<span class="bg-[#b45309]/20 px-1 rounded">${example.data_ultimo}</span>`)
      .replace(/{{ultimo_tipo}}/g, `<span class="bg-[#b45309]/20 px-1 rounded">${example.ultimo_tipo}</span>`)
  }

  return (
    <div className="space-y-6">
      {/* Abas de categoria */}
      <div className="flex gap-1 border-b border-slate-200">
        {CATEGORIAS.map(cat => (
          <button
            key={cat.id}
            onClick={() => {
              setActiveTab(cat.id)
              setSelectedId(templatesDoTab[0]?.id ?? null)
              setIsEditingNew(false)
            }}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-all ${
              activeTab === cat.id
                ? 'border-[#006b5a] text-[#006b5a]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {cat.label}
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 bg-slate-100 rounded-full">
              {templates.filter(t => t.categoria === cat.id && (t.criado_por !== null || t.criado_por === null)).length}
            </span>
          </button>
        ))}
      </div>

      {/* Descrição do tab ativo */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
        <p className="text-sm text-slate-600">
          {CATEGORIAS.find(c => c.id === activeTab)?.descricao}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de templates (esquerda) */}
        <div className="lg:col-span-1 space-y-3">
          <button
            onClick={handleNovaMsg}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#006b5a] text-white rounded-xl hover:bg-[#005249] transition-colors font-medium"
          >
            <Plus size={18} />
            Nova Mensagem
          </button>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {templatesDoTab.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 py-8 text-slate-500">
                <MessageSquare size={32} className="mb-2 opacity-30" />
                <p className="text-sm text-center">Nenhum template nesta categoria.</p>
              </div>
            ) : (
              templatesDoTab.map(template => (
                <div
                  key={template.id}
                  onClick={() => handleSelectTemplate(template.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-all border ${
                    selectedId === template.id
                      ? 'bg-[#006b5a]/10 border-[#006b5a] shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-[#171d1c] flex-1">{template.nome}</p>
                    {template.criado_por === null && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">padrão</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {template.conteudo}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Form de edição (direita) */}
        <div className="lg:col-span-2">
          {isEditingNew || selectedTemplate ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
              {/* Banner somente leitura */}
              {isGlobal && (
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500">
                  <span className="font-semibold text-slate-600">Template padrão</span>
                  — visível para todos os usuários. Não pode ser editado.
                </div>
              )}

              {/* Categoria (apenas para novo) */}
              {isEditingNew && (
                <div>
                  <label className="block text-sm font-medium text-[#171d1c] mb-2">
                    Categoria
                  </label>
                  <div className="flex gap-2">
                    {CATEGORIAS.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setCategoria(cat.id)}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                          categoria === cat.id
                            ? 'border-[#006b5a] bg-[#006b5a]/10 text-[#006b5a]'
                            : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-[#171d1c] mb-2">
                  Nome da mensagem
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Ex: Lembrete padrão"
                  disabled={isGlobal}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#006b5a] text-sm disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
              </div>

              {/* Shortcodes */}
              {!isGlobal && (
                <div>
                  <label className="block text-sm font-medium text-[#171d1c] mb-2">
                    Shortcodes
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {SHORTCODES.map(sc => (
                      <button
                        key={sc.value}
                        onClick={() => insertShortcode(sc.value)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono rounded-lg transition-colors"
                      >
                        {sc.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Conteúdo */}
              <div>
                <label className="block text-sm font-medium text-[#171d1c] mb-2">
                  Conteúdo
                </label>
                <textarea
                  ref={textareaRef}
                  value={conteudo}
                  onChange={e => setConteudo(e.target.value)}
                  placeholder="Digite sua mensagem com shortcodes..."
                  rows={6}
                  disabled={isGlobal}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#006b5a] text-sm font-mono disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
              </div>

              {/* Preview */}
              <div>
                <label className="block text-sm font-medium text-[#171d1c] mb-2">
                  Preview
                </label>
                <div
                  className="w-full p-3 border border-slate-300 rounded-lg bg-slate-50 text-sm whitespace-pre-wrap break-words max-h-48 overflow-y-auto"
                  dangerouslySetInnerHTML={{
                    __html: substituirShortcodes(conteudo) || '(preview aqui)',
                  }}
                />
              </div>

              {/* Botões */}
              {!isGlobal && (
                <div className="flex gap-3 pt-4">
                  {deletingId === selectedTemplate?.id ? (
                    <>
                      <button
                        onClick={handleDelete}
                        disabled={isSaving}
                        className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors font-medium text-sm flex items-center justify-center gap-2"
                      >
                        <Trash2 size={16} />
                        Confirmar exclusão
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium text-sm"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 px-4 py-2 bg-[#006b5a] text-white rounded-lg hover:bg-[#005249] disabled:opacity-50 transition-colors font-medium text-sm flex items-center justify-center gap-2"
                      >
                        <Check size={16} />
                        Salvar
                      </button>
                      <button
                        onClick={handleCancel}
                        className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium text-sm flex items-center justify-center gap-2"
                      >
                        <X size={16} />
                        Cancelar
                      </button>
                      {!isEditingNew && selectedTemplate && (
                        <button
                          onClick={() => setDeletingId(selectedTemplate.id)}
                          className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors font-medium text-sm flex items-center gap-2"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <MessageSquare size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 font-medium">Selecione um template ou crie um novo</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}