'use client'

import { useState, useRef } from 'react'
import { salvarTemplate, atualizarTemplate, deletarTemplate, type CategoriaTemplate } from '@/actions/templates'
import { Plus, Trash2, Check, X, MessageSquare, Mail, Link, Cake, StickyNote } from 'lucide-react'
import toast from 'react-hot-toast'

interface Template {
  id: string
  nome: string
  conteudo: string
  criado_em?: string
  criado_por: string | null
  categoria: CategoriaTemplate
}

const CATEGORIAS: { id: CategoriaTemplate; label: string; descricao: string; icone: React.ReactNode }[] = [
  {
    id: 'confirmacao',
    label: 'WhatsApp / Geral',
    descricao: 'Mensagens para confirmação de agendamentos via WhatsApp ou canal geral',
    icone: <MessageSquare size={14} />,
  },
  {
    id: 'reativacao',
    label: 'Reativação',
    descricao: 'Mensagens para reengajar pacientes inativos',
    icone: <MessageSquare size={14} />,
  },
  {
    id: 'confirmacao_sms',
    label: 'SMS',
    descricao: 'Mensagens curtas para confirmação via SMS — inclua {{link_confirmacao}} para o paciente confirmar com um clique',
    icone: <MessageSquare size={14} />,
  },
  {
    id: 'confirmacao_email',
    label: 'Email',
    descricao: 'Emails de confirmação — o campo "Nome" é usado como assunto do email. Use {{link_confirmacao}} para gerar o botão de confirmação',
    icone: <Mail size={14} />,
  },
  {
    id: 'aniversario',
    label: 'Aniversário',
    descricao: 'Mensagens de felicitação enviadas a pacientes no dia do aniversário',
    icone: <Cake size={14} />,
  },
  {
    id: 'anotacao',
    label: 'Modelos de Anotação',
    descricao: 'Textos rápidos para preencher anotações nos cards de contato — clique no modelo dentro do card para inserir',
    icone: <StickyNote size={14} />,
  },
]

// Shortcodes por categoria
const SHORTCODES_AGENDAMENTO = [
  { label: '{{nome}}', value: '{{nome}}', descricao: 'Nome do paciente' },
  { label: '{{data}}', value: '{{data}}', descricao: 'Data do atendimento' },
  { label: '{{hora}}', value: '{{hora}}', descricao: 'Horário' },
  { label: '{{profissional}}', value: '{{profissional}}', descricao: 'Nome do profissional' },
  { label: '{{tipo}}', value: '{{tipo}}', descricao: 'Tipo do serviço' },
  { label: '{{sessao}}', value: '{{sessao}}', descricao: 'Nº da sessão (ex: 2/10)' },
]

const SHORTCODES_REATIVACAO = [
  { label: '{{dias}}', value: '{{dias}}', descricao: 'Dias sem visita' },
  { label: '{{data_ultimo}}', value: '{{data_ultimo}}', descricao: 'Data do último atendimento' },
  { label: '{{ultimo_tipo}}', value: '{{ultimo_tipo}}', descricao: 'Tipo do último atendimento' },
]

const SHORTCODES_ANIVERSARIO = [
  { label: '{{nome}}', value: '{{nome}}', descricao: 'Nome do paciente' },
  { label: '{{idade}}', value: '{{idade}}', descricao: 'Idade que o paciente completa neste aniversário' },
  { label: '{{dia_semana}}', value: '{{dia_semana}}', descricao: 'Dia da semana do aniversário (ex: segunda-feira)' },
]

const SHORTCODE_LINK = {
  label: '{{link_confirmacao}}',
  value: '{{link_confirmacao}}',
  descricao: 'Link único para o paciente confirmar a consulta',
}

function getShortcodes(categoria: CategoriaTemplate) {
  if (categoria === 'anotacao') return []
  if (categoria === 'reativacao') return SHORTCODES_REATIVACAO
  if (categoria === 'confirmacao_sms' || categoria === 'confirmacao_email') {
    return [...SHORTCODES_AGENDAMENTO, SHORTCODE_LINK]
  }
  if (categoria === 'aniversario') return SHORTCODES_ANIVERSARIO
  return SHORTCODES_AGENDAMENTO
}

export function GerenciadorMensagens({
  templates: initialTemplates,
  abaInicial = 'confirmacao',
}: {
  templates: Template[]
  abaInicial?: CategoriaTemplate
}) {
  const [templates, setTemplates] = useState(initialTemplates)
  const [activeTab, setActiveTab] = useState<CategoriaTemplate>(abaInicial)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isEditingNew, setIsEditingNew] = useState(false)
  const [nome, setNome] = useState('')
  const [conteudo, setConteudo] = useState('')
  const [categoria, setCategoria] = useState<CategoriaTemplate>('confirmacao')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const templatesDoTab = templates.filter(t => t.categoria === activeTab)
  const selectedTemplate = templates.find(t => t.id === selectedId)
  const isGlobal = selectedTemplate?.criado_por === null && !isEditingNew

  const shortcodes = getShortcodes(isEditingNew ? categoria : (selectedTemplate?.categoria ?? activeTab))

  const handleSelectTemplate = (id: string) => {
    if (isEditingNew) setIsEditingNew(false)
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
      setSelectedId(null)
      setDeletingId(null)
    } finally {
      setIsSaving(false)
    }
  }

  const insertShortcode = (shortcode: string) => {
    if (!textareaRef.current) return
    const start = textareaRef.current.selectionStart
    const end = textareaRef.current.selectionEnd
    const newConteudo = conteudo.substring(0, start) + shortcode + conteudo.substring(end)
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
      idade: '35',
      dia_semana: 'segunda-feira',
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
      .replace(/{{idade}}/g, `<span class="bg-pink-100 text-pink-700 px-1 rounded">${example.idade}</span>`)
      .replace(/{{dia_semana}}/g, `<span class="bg-pink-100 text-pink-700 px-1 rounded">${example.dia_semana}</span>`)
      .replace(
        /{{link_confirmacao}}/g,
        `<span class="inline-flex items-center gap-1 bg-[#006b5a] text-white text-xs font-semibold px-2 py-0.5 rounded">🔗 link de confirmação</span>`
      )
  }

  const catAtiva = CATEGORIAS.find(c => c.id === activeTab)

  return (
    <div className="space-y-6">
      {/* Abas de categoria */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {CATEGORIAS.map(cat => (
          <button
            key={cat.id}
            onClick={() => {
              setActiveTab(cat.id)
              setSelectedId(null)
              setIsEditingNew(false)
              setNome('')
              setConteudo('')
            }}
            className={`flex items-center gap-1.5 px-4 py-3 font-medium text-sm border-b-2 transition-all whitespace-nowrap ${
              activeTab === cat.id
                ? 'border-[#006b5a] text-[#006b5a]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {cat.icone}
            {cat.label}
            <span className="ml-1 text-xs font-semibold px-1.5 py-0.5 bg-slate-100 rounded-full">
              {templates.filter(t => t.categoria === cat.id).length}
            </span>
          </button>
        ))}
      </div>

      {/* Descrição + hint especial para email */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 space-y-1">
        <p className="text-sm text-slate-600">{catAtiva?.descricao}</p>
        {activeTab === 'confirmacao_email' && (
          <p className="text-xs text-[#006b5a] font-medium flex items-center gap-1">
            <Mail size={12} />
            O campo &quot;Nome&quot; será usado como <strong>assunto</strong> do email enviado ao paciente.
          </p>
        )}
        {(activeTab === 'confirmacao_sms' || activeTab === 'confirmacao_email') && (
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <Link size={12} />
            Use <code className="bg-slate-200 px-1 rounded text-[11px]">{'{{link_confirmacao}}'}</code> para inserir o link de confirmação com um clique.
          </p>
        )}
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

              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-[#171d1c] mb-1">
                  {activeTab === 'confirmacao_email' || selectedTemplate?.categoria === 'confirmacao_email'
                    ? 'Nome / Assunto do email'
                    : 'Nome da mensagem'}
                </label>
                {(activeTab === 'confirmacao_email' || selectedTemplate?.categoria === 'confirmacao_email') && (
                  <p className="text-xs text-slate-400 mb-2">Este campo será usado como assunto no email enviado</p>
                )}
                <input
                  type="text"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder={
                    activeTab === 'confirmacao_email' || selectedTemplate?.categoria === 'confirmacao_email'
                      ? 'Ex: Confirmação de consulta — {{data}}'
                      : 'Ex: Lembrete padrão'
                  }
                  disabled={isGlobal}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#006b5a] text-sm disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
              </div>

              {/* Shortcodes */}
              {!isGlobal && (
                <div>
                  <label className="block text-sm font-medium text-[#171d1c] mb-2">
                    Shortcodes disponíveis
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {shortcodes.map(sc => (
                      <button
                        key={sc.value}
                        title={sc.descricao}
                        onClick={() => insertShortcode(sc.value)}
                        className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors ${
                          sc.value === '{{link_confirmacao}}'
                            ? 'bg-[#006b5a]/10 text-[#006b5a] border border-[#006b5a]/30 hover:bg-[#006b5a]/20'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {sc.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">Clique para inserir no cursor</p>
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
                  placeholder={activeTab === 'anotacao' || selectedTemplate?.categoria === 'anotacao' ? 'Digite o texto da anotação...' : 'Digite sua mensagem com shortcodes...'}
                  rows={6}
                  disabled={isGlobal}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#006b5a] text-sm font-mono disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
              </div>

              {/* Preview */}
              <div>
                <label className="block text-sm font-medium text-[#171d1c] mb-2">
                  Preview
                  {(activeTab === 'confirmacao_email' || selectedTemplate?.categoria === 'confirmacao_email') && (
                    <span className="ml-2 text-xs font-normal text-slate-400">(o botão de confirmação é gerado automaticamente no email real)</span>
                  )}
                </label>
                <div
                  className="w-full p-3 border border-slate-300 rounded-lg bg-slate-50 text-sm whitespace-pre-wrap break-words max-h-48 overflow-y-auto leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: substituirShortcodes(conteudo) || '<span class="text-slate-400">(preview aqui)</span>',
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
