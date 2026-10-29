'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, Check, X, ToggleLeft, ToggleRight } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  criarOrigemVenda,
  atualizarOrigemVenda,
  toggleAtivoOrigemVenda,
  excluirOrigemVenda,
} from '@/actions/origens-venda'
import type { OrigemVenda } from '@/lib/origens-venda'

export function GerenciadorOrigensVenda({ origens: inicial }: { origens: OrigemVenda[] }) {
  const [origens, setOrigens] = useState(inicial)
  const [novoNome, setNovoNome] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editandoNome, setEditandoNome] = useState('')
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAdicionarSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!novoNome.trim()) return

    startTransition(async () => {
      const result = await criarOrigemVenda(novoNome)
      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('Origem criada')
      setNovoNome('')
      window.location.reload()
    })
  }

  function iniciarEdicao(origem: OrigemVenda) {
    setEditandoId(origem.id)
    setEditandoNome(origem.nome)
    setExcluindoId(null)
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setEditandoNome('')
  }

  function handleSalvarEdicao(id: string) {
    if (!editandoNome.trim()) return

    startTransition(async () => {
      const result = await atualizarOrigemVenda(id, editandoNome)
      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('Origem atualizada')
      setOrigens((prev) => prev.map((origem) => (
        origem.id === id ? { ...origem, nome: editandoNome.trim() } : origem
      )))
      setEditandoId(null)
    })
  }

  function handleToggleAtivo(origem: OrigemVenda) {
    startTransition(async () => {
      const result = await toggleAtivoOrigemVenda(origem.id, !origem.ativo)
      if (result.error) {
        toast.error(result.error)
        return
      }

      setOrigens((prev) => prev.map((item) => (
        item.id === origem.id ? { ...item, ativo: !item.ativo } : item
      )))
    })
  }

  function handleExcluir(id: string) {
    startTransition(async () => {
      const result = await excluirOrigemVenda(id)
      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('Origem excluída')
      setOrigens((prev) => prev.filter((origem) => origem.id !== id))
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
          placeholder="Nome da nova origem (ex: Instagram)"
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
        {origens.length === 0 && (
          <p className="px-5 py-6 text-sm text-text-secondary text-center">
            Nenhuma origem cadastrada ainda.
          </p>
        )}
        <ul className="divide-y divide-border">
          {origens.map((origem) => (
            <li key={origem.id} className={`flex items-center gap-3 px-4 py-3 ${!origem.ativo ? 'opacity-50' : ''}`}>
              {editandoId === origem.id ? (
                <>
                  <input
                    autoFocus
                    type="text"
                    value={editandoNome}
                    onChange={(e) => setEditandoNome(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSalvarEdicao(origem.id)
                      if (e.key === 'Escape') cancelarEdicao()
                    }}
                    className="flex-1 bg-input border border-primary-500 rounded-sm px-2 py-1 text-sm focus:outline-none"
                    disabled={isPending}
                  />
                  <button
                    onClick={() => handleSalvarEdicao(origem.id)}
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
              ) : excluindoId === origem.id ? (
                <>
                  <span className="flex-1 text-sm text-text-primary">
                    Excluir <strong>{origem.nome}</strong>?
                  </span>
                  <button
                    onClick={() => handleExcluir(origem.id)}
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
                  <span className="flex-1 text-sm text-text-primary">{origem.nome}</span>
                  {origem.sistema && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                      padrão
                    </span>
                  )}
                  {!origem.ativo && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                      inativa
                    </span>
                  )}
                  {!origem.sistema && (
                    <button
                    onClick={() => handleToggleAtivo(origem)}
                    disabled={isPending}
                    className="p-1.5 text-text-secondary hover:text-primary-500 hover:bg-page rounded transition-colors"
                    title={origem.ativo ? 'Desativar' : 'Ativar'}
                  >
                    {origem.ativo
                      ? <ToggleRight size={17} className="text-primary-500" />
                      : <ToggleLeft size={17} />
                    }
                  </button>
                  )}
                  <button
                    onClick={() => iniciarEdicao(origem)}
                    disabled={isPending}
                    className="p-1.5 text-text-secondary hover:text-primary-500 hover:bg-page rounded transition-colors"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  {!origem.sistema && (
                    <button
                    onClick={() => { setExcluindoId(origem.id); setEditandoId(null) }}
                    disabled={isPending}
                    className="p-1.5 text-text-secondary hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-text-secondary">
        Origens inativas deixam de aparecer ao criar ou editar vendas, mas as vendas antigas continuam preservadas. Renomear uma origem atualiza o nome também nas vendas e relatórios já existentes. A origem padrão &ldquo;Médico&rdquo; não pode ser desativada nem excluída.
      </p>
    </div>
  )
}
