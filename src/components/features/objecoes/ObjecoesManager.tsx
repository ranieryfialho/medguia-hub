'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, Check, X, ToggleLeft, ToggleRight, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  criarObjecao,
  atualizarObjecao,
  toggleAtivoObjecao,
  excluirObjecao,
  type Objecao,
} from '@/actions/objecoes'

export function ObjecoesManager({ objecoes: inicial }: { objecoes: Objecao[] }) {
  const [objecoes, setObjecoes] = useState(inicial)
  const [novoNome, setNovoNome] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editandoNome, setEditandoNome] = useState('')
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAdicionarSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!novoNome.trim()) return

    startTransition(async () => {
      const result = await criarObjecao(novoNome)
      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('Objeção criada')
      setNovoNome('')
      window.location.reload()
    })
  }

  function iniciarEdicao(objecao: Objecao) {
    setEditandoId(objecao.id)
    setEditandoNome(objecao.nome)
    setExcluindoId(null)
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setEditandoNome('')
  }

  function handleSalvarEdicao(id: string) {
    if (!editandoNome.trim()) return

    startTransition(async () => {
      const result = await atualizarObjecao(id, editandoNome)
      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('Objeção atualizada')
      setObjecoes((prev) => prev.map((objecao) => (
        objecao.id === id ? { ...objecao, nome: editandoNome.trim() } : objecao
      )))
      setEditandoId(null)
    })
  }

  function handleToggleAtivo(objecao: Objecao) {
    startTransition(async () => {
      const result = await toggleAtivoObjecao(objecao.id, !objecao.ativo)
      if (result.error) {
        toast.error(result.error)
        return
      }

      setObjecoes((prev) => prev.map((item) => (
        item.id === objecao.id ? { ...item, ativo: !item.ativo } : item
      )))
    })
  }

  function handleExcluir(id: string) {
    startTransition(async () => {
      const result = await excluirObjecao(id)
      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('Objeção excluída')
      setObjecoes((prev) => prev.filter((objecao) => objecao.id !== id))
      setExcluindoId(null)
    })
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdicionarSubmit} className="flex gap-2">
        <input
          type="text"
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          placeholder="Nome da nova objeção (ex: Preço alto)"
          className="flex-1 bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
          disabled={isPending}
        />
        <button
          type="submit"
          disabled={isPending || !novoNome.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-sm text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Plus size={15} />
          Adicionar
        </button>
      </form>

      <div className="bg-surface rounded-lg border border-border overflow-hidden">
        {objecoes.length === 0 && (
          <p className="px-5 py-6 text-sm text-text-secondary text-center">
            Nenhuma objeção cadastrada ainda.
          </p>
        )}
        <ul className="divide-y divide-border">
          {objecoes.map((objecao) => (
            <li key={objecao.id} className={`flex items-center gap-3 px-4 py-3 ${!objecao.ativo ? 'opacity-50' : ''}`}>
              <GripVertical size={15} className="text-text-tertiary shrink-0 cursor-grab" />

              {editandoId === objecao.id ? (
                <>
                  <input
                    autoFocus
                    type="text"
                    value={editandoNome}
                    onChange={(e) => setEditandoNome(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSalvarEdicao(objecao.id)
                      if (e.key === 'Escape') cancelarEdicao()
                    }}
                    className="flex-1 bg-input border border-primary-500 rounded-sm px-2 py-1 text-sm focus:outline-none"
                    disabled={isPending}
                  />
                  <button
                    onClick={() => handleSalvarEdicao(objecao.id)}
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
              ) : excluindoId === objecao.id ? (
                <>
                  <span className="flex-1 text-sm text-text-primary">
                    Excluir <strong>{objecao.nome}</strong>?
                  </span>
                  <button
                    onClick={() => handleExcluir(objecao.id)}
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
                  <span className="flex-1 text-sm text-text-primary">{objecao.nome}</span>
                  {!objecao.ativo && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                      inativa
                    </span>
                  )}
                  <button
                    onClick={() => handleToggleAtivo(objecao)}
                    disabled={isPending}
                    className="p-1.5 text-text-secondary hover:text-primary-500 hover:bg-page rounded transition-colors"
                    title={objecao.ativo ? 'Desativar' : 'Ativar'}
                  >
                    {objecao.ativo
                      ? <ToggleRight size={17} className="text-primary-500" />
                      : <ToggleLeft size={17} />
                    }
                  </button>
                  <button
                    onClick={() => iniciarEdicao(objecao)}
                    disabled={isPending}
                    className="p-1.5 text-text-secondary hover:text-primary-500 hover:bg-page rounded transition-colors"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => { setExcluindoId(objecao.id); setEditandoId(null) }}
                    disabled={isPending}
                    className="p-1.5 text-text-secondary hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-text-secondary">
        Objeções inativas deixam de aparecer no modal de criação de orçamento, mas as vendas antigas continuam preservadas.
      </p>
    </div>
  )
}
