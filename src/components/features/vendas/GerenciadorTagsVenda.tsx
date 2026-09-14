'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, Check, X, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  criarTagVenda,
  atualizarTagVenda,
  excluirTagVenda,
  type VendaTag,
} from '@/actions/venda-tags'
import { getTagCorConfig, TAG_CORES_SELECIONAVEIS } from '@/lib/tag-cores'

function ordenarTags(tags: VendaTag[]) {
  return [...tags].sort((a, b) =>
    a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }),
  )
}

function SeletorCor({ value, onChange }: { value: string; onChange: (cor: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TAG_CORES_SELECIONAVEIS.map(({ key, dot, label }) => (
        <button
          key={key}
          type="button"
          title={label}
          onClick={() => onChange(key)}
          className={`w-5 h-5 rounded-full ${dot} border-2 transition-all ${
            value === key ? 'border-text-primary scale-110' : 'border-transparent hover:scale-105'
          }`}
        />
      ))}
    </div>
  )
}

export function GerenciadorTagsVenda({ tags: inicial }: { tags: VendaTag[] }) {
  const [tags, setTags] = useState(() => ordenarTags(inicial.filter(t => t.ativo)))
  const [novoNome, setNovoNome] = useState('')
  const [novaCor, setNovaCor] = useState(TAG_CORES_SELECIONAVEIS[0].key)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editandoNome, setEditandoNome] = useState('')
  const [editandoCor, setEditandoCor] = useState('')
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAdicionarSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!novoNome.trim()) return

    startTransition(async () => {
      const result = await criarTagVenda(novoNome, novaCor)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Tag criada')
      if (result.tag) setTags(prev => ordenarTags([...prev, result.tag as VendaTag]))
      setNovoNome('')
      setNovaCor(TAG_CORES_SELECIONAVEIS[0].key)
    })
  }

  function iniciarEdicao(tag: VendaTag) {
    setEditandoId(tag.id)
    setEditandoNome(tag.nome)
    setEditandoCor(tag.cor)
    setExcluindoId(null)
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setEditandoNome('')
    setEditandoCor('')
  }

  function handleSalvarEdicao(id: string) {
    if (!editandoNome.trim()) return
    startTransition(async () => {
      const result = await atualizarTagVenda(id, editandoNome, editandoCor)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Tag atualizada')
      setTags(prev => ordenarTags(prev.map(t => t.id === id
        ? { ...t, nome: editandoNome.trim(), cor: editandoCor }
        : t
      )))
      cancelarEdicao()
    })
  }

  function handleExcluir(id: string) {
    startTransition(async () => {
      const result = await excluirTagVenda(id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Tag excluída')
      setTags(prev => prev.filter(t => t.id !== id))
      setExcluindoId(null)
    })
  }

  return (
    <div className="space-y-6">
      {/* Formulário de nova tag */}
      <form onSubmit={handleAdicionarSubmit} className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={novoNome}
          onChange={e => setNovoNome(e.target.value)}
          placeholder="Nome da nova tag (ex: VIP, Sinal pago, Inadimplente...)"
          className="flex-1 min-w-[200px] bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
          disabled={isPending}
        />
        <SeletorCor value={novaCor} onChange={setNovaCor} />
        <button
          type="submit"
          disabled={isPending || !novoNome.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-sm text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Plus size={15} />
          Adicionar
        </button>
      </form>

      {/* Lista */}
      <div className="bg-surface rounded-lg border border-border overflow-hidden">
        {tags.length === 0 && (
          <p className="px-5 py-6 text-sm text-text-secondary text-center">
            Nenhuma tag cadastrada ainda.
          </p>
        )}
        <ul className="divide-y divide-border">
          {tags.map(tag => {
            const cfg = getTagCorConfig(tag.cor)
            return (
              <li key={tag.id} className="flex items-center gap-3 px-4 py-3">
                <GripVertical size={15} className="text-text-tertiary shrink-0 cursor-grab" />

                {editandoId === tag.id ? (
                  <>
                    <input
                      autoFocus
                      type="text"
                      value={editandoNome}
                      onChange={e => setEditandoNome(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSalvarEdicao(tag.id)
                        if (e.key === 'Escape') cancelarEdicao()
                      }}
                      className="flex-1 bg-input border border-primary-500 rounded-sm px-2 py-1 text-sm focus:outline-none"
                      disabled={isPending}
                    />
                    <SeletorCor value={editandoCor} onChange={setEditandoCor} />
                    <button
                      onClick={() => handleSalvarEdicao(tag.id)}
                      disabled={isPending}
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                      title="Salvar"
                    >
                      <Check size={15} />
                    </button>
                    <button
                      onClick={cancelarEdicao}
                      className="p-1.5 text-text-secondary hover:bg-page rounded transition-colors"
                      title="Cancelar"
                    >
                      <X size={15} />
                    </button>
                  </>
                ) : excluindoId === tag.id ? (
                  <>
                    <span className="flex-1 text-sm text-text-primary">
                      Excluir <strong>{tag.nome}</strong>?
                    </span>
                    <button
                      onClick={() => handleExcluir(tag.id)}
                      disabled={isPending}
                      className="px-3 py-1 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded transition-colors disabled:opacity-50"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setExcluindoId(null)}
                      className="px-3 py-1 text-xs font-medium border border-border text-text-secondary hover:bg-page rounded transition-colors"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      {tag.nome}
                    </span>
                    <span className="flex-1" />
                    <button
                      onClick={() => iniciarEdicao(tag)}
                      disabled={isPending}
                      className="p-1.5 text-text-secondary hover:text-primary-500 hover:bg-page rounded transition-colors"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => { setExcluindoId(tag.id); setEditandoId(null) }}
                      disabled={isPending}
                      className="p-1.5 text-text-secondary hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <p className="text-xs text-text-secondary">
        Tags excluídas deixam de aparecer na lista de vendas e no detalhe da venda, mas os vínculos já feitos são preservados no histórico.
      </p>
    </div>
  )
}
