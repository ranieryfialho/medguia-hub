'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, Check, X, ToggleLeft, ToggleRight, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  criarPlanoSaude,
  atualizarPlanoSaude,
  toggleAtivoPlanoSaude,
  excluirPlanoSaude,
  type PlanoSaude,
} from '@/actions/planos-saude'

export function PlanosSaudeManager({ planos: inicial }: { planos: PlanoSaude[] }) {
  const [planos, setPlanos] = useState(inicial)
  const [novoNome, setNovoNome] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editandoNome, setEditandoNome] = useState('')
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAdicionarSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!novoNome.trim()) return

    startTransition(async () => {
      const result = await criarPlanoSaude(novoNome)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Plano criado')
      setNovoNome('')
      window.location.reload()
    })
  }

  function iniciarEdicao(plano: PlanoSaude) {
    setEditandoId(plano.id)
    setEditandoNome(plano.nome)
    setExcluindoId(null)
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setEditandoNome('')
  }

  function handleSalvarEdicao(id: string) {
    if (!editandoNome.trim()) return
    startTransition(async () => {
      const result = await atualizarPlanoSaude(id, editandoNome)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Plano atualizado')
      setPlanos(prev => prev.map(p => p.id === id ? { ...p, nome: editandoNome.trim() } : p))
      setEditandoId(null)
    })
  }

  function handleToggleAtivo(plano: PlanoSaude) {
    startTransition(async () => {
      const result = await toggleAtivoPlanoSaude(plano.id, !plano.ativo)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setPlanos(prev => prev.map(p => p.id === plano.id ? { ...p, ativo: !p.ativo } : p))
    })
  }

  function handleExcluir(id: string) {
    startTransition(async () => {
      const result = await excluirPlanoSaude(id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Plano excluído')
      setPlanos(prev => prev.filter(p => p.id !== id))
      setExcluindoId(null)
    })
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdicionarSubmit} className="flex gap-2">
        <input
          type="text"
          value={novoNome}
          onChange={e => setNovoNome(e.target.value)}
          placeholder="Nome do novo plano (ex: Bradesco Saúde, Hapvida...)"
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
        {planos.length === 0 && (
          <p className="px-5 py-6 text-sm text-text-secondary text-center">
            Nenhum plano de saúde cadastrado ainda.
          </p>
        )}
        <ul className="divide-y divide-border">
          {planos.map(plano => (
            <li key={plano.id} className={`flex items-center gap-3 px-4 py-3 ${!plano.ativo ? 'opacity-50' : ''}`}>
              <GripVertical size={15} className="text-text-tertiary shrink-0 cursor-grab" />

              {editandoId === plano.id ? (
                <>
                  <input
                    autoFocus
                    type="text"
                    value={editandoNome}
                    onChange={e => setEditandoNome(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSalvarEdicao(plano.id)
                      if (e.key === 'Escape') cancelarEdicao()
                    }}
                    className="flex-1 bg-input border border-primary-500 rounded-sm px-2 py-1 text-sm focus:outline-none"
                    disabled={isPending}
                  />
                  <button
                    onClick={() => handleSalvarEdicao(plano.id)}
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
              ) : excluindoId === plano.id ? (
                <>
                  <span className="flex-1 text-sm text-text-primary">
                    Excluir <strong>{plano.nome}</strong>?
                  </span>
                  <button
                    onClick={() => handleExcluir(plano.id)}
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
                  <span className="flex-1 text-sm text-text-primary">{plano.nome}</span>
                  {!plano.ativo && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                      inativo
                    </span>
                  )}
                  <button
                    onClick={() => handleToggleAtivo(plano)}
                    disabled={isPending}
                    className="p-1.5 text-text-secondary hover:text-primary-500 hover:bg-page rounded transition-colors"
                    title={plano.ativo ? 'Desativar' : 'Ativar'}
                  >
                    {plano.ativo
                      ? <ToggleRight size={17} className="text-primary-500" />
                      : <ToggleLeft size={17} />
                    }
                  </button>
                  <button
                    onClick={() => iniciarEdicao(plano)}
                    disabled={isPending}
                    className="p-1.5 text-text-secondary hover:text-primary-500 hover:bg-page rounded transition-colors"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => { setExcluindoId(plano.id); setEditandoId(null) }}
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
        Planos inativos não aparecem no cadastro de novos pacientes, mas são preservados nos registros existentes.
      </p>
    </div>
  )
}
