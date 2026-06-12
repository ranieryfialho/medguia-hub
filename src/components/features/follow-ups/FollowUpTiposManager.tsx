'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil, Check, X, ToggleLeft, ToggleRight, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'
import { criarTipo, editarTipo, toggleTipo, type FollowUpTipo } from '@/actions/follow-ups'

export function FollowUpTiposManager({ tipos: inicial }: { tipos: FollowUpTipo[] }) {
  const [tipos, setTipos] = useState(inicial)
  const [novoNome, setNovoNome] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editandoNome, setEditandoNome] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleAdicionar(e: React.FormEvent) {
    e.preventDefault()
    if (!novoNome.trim()) return
    startTransition(async () => {
      const result = await criarTipo({ nome: novoNome })
      if (result.error) { toast.error(result.error); return }
      toast.success('Tipo criado')
      setNovoNome('')
      window.location.reload()
    })
  }

  function handleSalvarEdicao(id: string) {
    if (!editandoNome.trim()) return
    startTransition(async () => {
      const result = await editarTipo(id, { nome: editandoNome })
      if (result.error) { toast.error(result.error); return }
      toast.success('Tipo atualizado')
      setTipos(prev => prev.map(t => t.id === id ? { ...t, nome: editandoNome.trim() } : t))
      setEditandoId(null)
    })
  }

  function handleToggle(tipo: FollowUpTipo) {
    startTransition(async () => {
      const result = await toggleTipo(tipo.id, !tipo.ativo)
      if (result.error) { toast.error(result.error); return }
      setTipos(prev => prev.map(t => t.id === tipo.id ? { ...t, ativo: !t.ativo } : t))
    })
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdicionar} className="flex gap-2">
        <input
          type="text"
          value={novoNome}
          onChange={e => setNovoNome(e.target.value)}
          placeholder="Nome do novo tipo (ex: Triagem)"
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
        {tipos.length === 0 && (
          <p className="px-5 py-6 text-sm text-text-secondary text-center">Nenhum tipo cadastrado.</p>
        )}
        <ul className="divide-y divide-border">
          {tipos.map(tipo => (
            <li key={tipo.id} className={`flex items-center gap-3 px-4 py-3 ${!tipo.ativo ? 'opacity-50' : ''}`}>
              <GripVertical size={15} className="text-text-tertiary shrink-0" />

              {editandoId === tipo.id ? (
                <>
                  <input
                    autoFocus
                    type="text"
                    value={editandoNome}
                    onChange={e => setEditandoNome(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSalvarEdicao(tipo.id)
                      if (e.key === 'Escape') setEditandoId(null)
                    }}
                    className="flex-1 bg-input border border-primary-500 rounded-sm px-2 py-1 text-sm focus:outline-none"
                    disabled={isPending}
                  />
                  <button onClick={() => handleSalvarEdicao(tipo.id)} disabled={isPending} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Salvar">
                    <Check size={15} />
                  </button>
                  <button onClick={() => setEditandoId(null)} className="p-1.5 text-text-secondary hover:bg-page rounded transition-colors" title="Cancelar">
                    <X size={15} />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-text-primary">{tipo.nome}</span>
                  {!tipo.ativo && <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">inativo</span>}
                  <button onClick={() => handleToggle(tipo)} disabled={isPending} className="p-1.5 text-text-secondary hover:text-primary-500 hover:bg-page rounded transition-colors" title={tipo.ativo ? 'Desativar' : 'Ativar'}>
                    {tipo.ativo ? <ToggleRight size={17} className="text-primary-500" /> : <ToggleLeft size={17} />}
                  </button>
                  <button onClick={() => { setEditandoId(tipo.id); setEditandoNome(tipo.nome) }} disabled={isPending} className="p-1.5 text-text-secondary hover:text-primary-500 hover:bg-page rounded transition-colors" title="Editar">
                    <Pencil size={14} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-text-secondary">
        Tipos inativos não aparecem ao criar novos follow-ups, mas os registros existentes são preservados.
      </p>
    </div>
  )
}