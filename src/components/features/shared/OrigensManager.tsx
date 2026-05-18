'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, Check, X, ToggleLeft, ToggleRight, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  criarOrigemPaciente,
  atualizarOrigemPaciente,
  toggleAtivoOrigemPaciente,
  excluirOrigemPaciente,
  type OrigemPaciente,
} from '@/actions/origens-paciente'

function ordenarOrigens(origens: OrigemPaciente[]) {
  return [...origens].sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }),
  )
}

export function OrigensManager({ origens: inicial }: { origens: OrigemPaciente[] }) {
  const [origens, setOrigens] = useState(() => ordenarOrigens(inicial))
  const [novoNome, setNovoNome] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editandoNome, setEditandoNome] = useState('')
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAdicionarSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!novoNome.trim()) return

    startTransition(async () => {
      const result = await criarOrigemPaciente(novoNome)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Origem criada')
      setNovoNome('')
      // Otimista — recarrega via router refresh no servidor
      window.location.reload()
    })
  }

  function iniciarEdicao(origem: OrigemPaciente) {
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
      const result = await atualizarOrigemPaciente(id, editandoNome)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Origem atualizada')
      setOrigens(prev => ordenarOrigens(prev.map(o => o.id === id ? { ...o, nome: editandoNome.trim() } : o)))
      setEditandoId(null)
    })
  }

  function handleToggleAtivo(origem: OrigemPaciente) {
    startTransition(async () => {
      const result = await toggleAtivoOrigemPaciente(origem.id, !origem.ativo)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setOrigens(prev => prev.map(o => o.id === origem.id ? { ...o, ativo: !o.ativo } : o))
    })
  }

  function handleExcluir(id: string) {
    startTransition(async () => {
      const result = await excluirOrigemPaciente(id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Origem excluída')
      setOrigens(prev => prev.filter(o => o.id !== id))
      setExcluindoId(null)
    })
  }

  return (
    <div className="space-y-6">
      {/* Formulário de nova origem */}
      <form onSubmit={handleAdicionarSubmit} className="flex gap-2">
        <input
          type="text"
          value={novoNome}
          onChange={e => setNovoNome(e.target.value)}
          placeholder="Nome da nova origem (ex: TikTok, Rádio...)"
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

      {/* Lista */}
      <div className="bg-surface rounded-lg border border-border overflow-hidden">
        {origens.length === 0 && (
          <p className="px-5 py-6 text-sm text-text-secondary text-center">
            Nenhuma origem cadastrada ainda.
          </p>
        )}
        <ul className="divide-y divide-border">
          {origens.map(origem => (
            <li key={origem.id} className={`flex items-center gap-3 px-4 py-3 ${!origem.ativo ? 'opacity-50' : ''}`}>
              <GripVertical size={15} className="text-text-tertiary shrink-0 cursor-grab" />

              {editandoId === origem.id ? (
                <>
                  <input
                    autoFocus
                    type="text"
                    value={editandoNome}
                    onChange={e => setEditandoNome(e.target.value)}
                    onKeyDown={e => {
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
                  {!origem.ativo && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                      inativa
                    </span>
                  )}
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
                  <button
                    onClick={() => iniciarEdicao(origem)}
                    disabled={isPending}
                    className="p-1.5 text-text-secondary hover:text-primary-500 hover:bg-page rounded transition-colors"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => { setExcluindoId(origem.id); setEditandoId(null) }}
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
        Origens inativas não aparecem no cadastro de novos pacientes, mas são preservadas nos registros existentes.
      </p>
    </div>
  )
}
