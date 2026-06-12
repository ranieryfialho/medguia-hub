'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil, Check, X, Trash2, ToggleLeft, ToggleRight, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  criarTemplate, editarTemplate, toggleTemplate, deletarTemplate,
  type FollowUpTipo, type FollowUpTemplate,
} from '@/actions/follow-ups'

export function FollowUpTemplatesManager({
  tipos,
  templates: inicial,
}: {
  tipos: FollowUpTipo[]
  templates: FollowUpTemplate[]
}) {
  const [templates, setTemplates] = useState(inicial)
  const [tipoFiltro, setTipoFiltro] = useState<string>('todos')
  const [novoTipoId, setNovoTipoId] = useState('')
  const [novoTitulo, setNovoTitulo] = useState('')
  const [novoConteudo, setNovoConteudo] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editandoTitulo, setEditandoTitulo] = useState('')
  const [editandoConteudo, setEditandoConteudo] = useState('')
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [formAberto, setFormAberto] = useState(false)
  const [isPending, startTransition] = useTransition()

  const templatesFiltrados = tipoFiltro === 'todos'
    ? templates
    : templates.filter(t => t.tipo_id === tipoFiltro)

  function handleAdicionar(e: React.FormEvent) {
    e.preventDefault()
    if (!novoTipoId || !novoTitulo.trim() || !novoConteudo.trim()) return
    startTransition(async () => {
      const result = await criarTemplate({ tipo_id: novoTipoId, titulo: novoTitulo, conteudo: novoConteudo })
      if (result.error) { toast.error(result.error); return }
      toast.success('Template criado')
      setNovoTipoId(''); setNovoTitulo(''); setNovoConteudo(''); setFormAberto(false)
      window.location.reload()
    })
  }

  function iniciarEdicao(t: FollowUpTemplate) {
    setEditandoId(t.id); setEditandoTitulo(t.titulo); setEditandoConteudo(t.conteudo)
    setExcluindoId(null)
  }

  function handleSalvarEdicao(id: string) {
    if (!editandoTitulo.trim() || !editandoConteudo.trim()) return
    startTransition(async () => {
      const result = await editarTemplate(id, { titulo: editandoTitulo, conteudo: editandoConteudo })
      if (result.error) { toast.error(result.error); return }
      toast.success('Template atualizado')
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, titulo: editandoTitulo.trim(), conteudo: editandoConteudo.trim() } : t))
      setEditandoId(null)
    })
  }

  function handleToggle(t: FollowUpTemplate) {
    startTransition(async () => {
      const result = await toggleTemplate(t.id, !t.ativo)
      if (result.error) { toast.error(result.error); return }
      setTemplates(prev => prev.map(item => item.id === t.id ? { ...item, ativo: !item.ativo } : item))
    })
  }

  function handleExcluir(id: string) {
    startTransition(async () => {
      const result = await deletarTemplate(id)
      if (result.error) { toast.error(result.error); return }
      toast.success('Template excluído')
      setTemplates(prev => prev.filter(t => t.id !== id))
      setExcluindoId(null)
    })
  }

  function nomeTipo(tipoId: string) {
    return tipos.find(t => t.id === tipoId)?.nome ?? '—'
  }

  return (
    <div className="space-y-6">
      {/* Formulário novo template */}
      <div className="border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => setFormAberto(v => !v)}
          className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-text-primary hover:bg-page transition-colors"
        >
          <Plus size={15} className="text-primary-500" />
          <span className="flex-1 text-left">Adicionar template</span>
          <ChevronDown size={15} className={`transition-transform duration-200 ${formAberto ? 'rotate-180' : ''}`} />
        </button>
        {formAberto && (
          <form onSubmit={handleAdicionar} className="px-4 pb-4 space-y-3 border-t border-border">
            <div className="pt-3">
              <label className="block text-xs font-medium text-text-secondary mb-1">Tipo</label>
              <select
                value={novoTipoId}
                onChange={e => setNovoTipoId(e.target.value)}
                className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
                disabled={isPending}
              >
                <option value="">-- Selecione o tipo --</option>
                {tipos.filter(t => t.ativo).map(t => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Título do template</label>
              <input
                type="text"
                value={novoTitulo}
                onChange={e => setNovoTitulo(e.target.value)}
                placeholder="Ex: Avaliação inicial padrão"
                className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
                disabled={isPending}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Conteúdo</label>
              <textarea
                value={novoConteudo}
                onChange={e => setNovoConteudo(e.target.value)}
                placeholder="Texto que preencherá automaticamente o campo de descrição..."
                rows={4}
                className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500 resize-none"
                disabled={isPending}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setFormAberto(false)} className="px-4 py-2 text-sm border border-border rounded-sm hover:bg-page transition-colors">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending || !novoTipoId || !novoTitulo.trim() || !novoConteudo.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-sm text-sm font-medium transition-colors disabled:opacity-50"
              >
                Salvar template
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Filtro por tipo */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-secondary">Filtrar:</span>
        <select
          value={tipoFiltro}
          onChange={e => setTipoFiltro(e.target.value)}
          className="bg-input border border-border-input rounded-sm px-2 py-1 text-sm focus:outline-none focus:border-primary-500"
        >
          <option value="todos">Todos os tipos</option>
          {tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
      </div>

      {/* Lista */}
      <div className="bg-surface rounded-lg border border-border overflow-hidden">
        {templatesFiltrados.length === 0 && (
          <p className="px-5 py-6 text-sm text-text-secondary text-center">Nenhum template encontrado.</p>
        )}
        <ul className="divide-y divide-border">
          {templatesFiltrados.map(t => (
            <li key={t.id} className={`px-4 py-3 ${!t.ativo ? 'opacity-50' : ''}`}>
              {editandoId === t.id ? (
                <div className="space-y-2">
                  <input
                    autoFocus
                    type="text"
                    value={editandoTitulo}
                    onChange={e => setEditandoTitulo(e.target.value)}
                    className="w-full bg-input border border-primary-500 rounded-sm px-2 py-1 text-sm focus:outline-none"
                    disabled={isPending}
                  />
                  <textarea
                    value={editandoConteudo}
                    onChange={e => setEditandoConteudo(e.target.value)}
                    rows={3}
                    className="w-full bg-input border border-primary-500 rounded-sm px-2 py-1 text-sm focus:outline-none resize-none"
                    disabled={isPending}
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditandoId(null)} className="p-1.5 text-text-secondary hover:bg-page rounded transition-colors"><X size={15} /></button>
                    <button onClick={() => handleSalvarEdicao(t.id)} disabled={isPending} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"><Check size={15} /></button>
                  </div>
                </div>
              ) : excluindoId === t.id ? (
                <div className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-text-primary">Excluir <strong>{t.titulo}</strong>?</span>
                  <button onClick={() => handleExcluir(t.id)} disabled={isPending} className="px-3 py-1 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded transition-colors disabled:opacity-50">Confirmar</button>
                  <button onClick={() => setExcluindoId(null)} className="px-3 py-1 text-xs font-medium border border-border text-text-secondary hover:bg-page rounded transition-colors">Cancelar</button>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">{t.titulo}</span>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 bg-page rounded text-text-secondary border border-border">{nomeTipo(t.tipo_id)}</span>
                      {!t.ativo && <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">inativo</span>}
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{t.conteudo}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => handleToggle(t)} disabled={isPending} className="p-1.5 text-text-secondary hover:text-primary-500 hover:bg-page rounded transition-colors" title={t.ativo ? 'Desativar' : 'Ativar'}>
                      {t.ativo ? <ToggleRight size={17} className="text-primary-500" /> : <ToggleLeft size={17} />}
                    </button>
                    <button onClick={() => iniciarEdicao(t)} disabled={isPending} className="p-1.5 text-text-secondary hover:text-primary-500 hover:bg-page rounded transition-colors" title="Editar">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => { setExcluindoId(t.id); setEditandoId(null) }} disabled={isPending} className="p-1.5 text-text-secondary hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="Excluir">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}