'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, Check, X, ToggleLeft, ToggleRight, GripVertical, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  criarTipoConsulta,
  atualizarTipoConsulta,
  toggleAtivoTipoConsulta,
  excluirTipoConsulta,
  type TipoConsulta,
} from '@/actions/tipos-consulta'

export function TiposConsultaManager({ tipos: inicial }: { tipos: TipoConsulta[] }) {
  const [tipos, setTipos] = useState(inicial)
  const [novoNome, setNovoNome] = useState('')
  const [novaDuracao, setNovaDuracao] = useState<number>(30)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editandoNome, setEditandoNome] = useState('')
  const [editandoDuracao, setEditandoDuracao] = useState<number>(30)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAdicionarSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!novoNome.trim()) return

    startTransition(async () => {
      const result = await criarTipoConsulta(novoNome, novaDuracao)
      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('Tipo de consulta criado')
      setNovoNome('')
      setNovaDuracao(30)
      window.location.reload()
    })
  }

  function iniciarEdicao(tipo: TipoConsulta) {
    setEditandoId(tipo.id)
    setEditandoNome(tipo.nome)
    setEditandoDuracao(tipo.duracao_padrao_minutos)
    setExcluindoId(null)
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setEditandoNome('')
    setEditandoDuracao(30)
  }

  function handleSalvarEdicao(id: string) {
    if (!editandoNome.trim()) return

    startTransition(async () => {
      const result = await atualizarTipoConsulta(id, editandoNome, editandoDuracao)
      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('Tipo de consulta atualizado')
      setTipos((prev) => prev.map((tipo) => (
        tipo.id === id
          ? { ...tipo, nome: editandoNome.trim(), duracao_padrao_minutos: editandoDuracao }
          : tipo
      )))
      setEditandoId(null)
    })
  }

  function handleToggleAtivo(tipo: TipoConsulta) {
    startTransition(async () => {
      const result = await toggleAtivoTipoConsulta(tipo.id, !tipo.ativo)
      if (result.error) {
        toast.error(result.error)
        return
      }

      setTipos((prev) => prev.map((item) => (
        item.id === tipo.id
          ? { ...item, ativo: !item.ativo }
          : item
      )))
    })
  }

  function handleExcluir(id: string) {
    startTransition(async () => {
      const result = await excluirTipoConsulta(id)
      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('Tipo de consulta excluído')
      setTipos((prev) => prev.filter((tipo) => tipo.id !== id))
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
          placeholder="Nome do novo tipo (ex: Avaliação postural)"
          className="flex-1 bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
          disabled={isPending}
        />
        <div className="flex items-center gap-1.5 shrink-0">
          <Clock size={13} className="text-text-secondary" />
          <input
            type="number"
            value={novaDuracao}
            onChange={(e) => setNovaDuracao(Math.max(5, parseInt(e.target.value) || 30))}
            min={5}
            step={5}
            className="w-20 bg-input border border-border-input rounded-sm px-2 py-2 text-sm focus:outline-none focus:border-primary-500 text-center"
            title="Duração padrão em minutos"
            disabled={isPending}
          />
          <span className="text-xs text-text-secondary">min</span>
        </div>
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
          <p className="px-5 py-6 text-sm text-text-secondary text-center">
            Nenhum tipo de consulta cadastrado ainda.
          </p>
        )}
        <ul className="divide-y divide-border">
          {tipos.map((tipo) => (
            <li key={tipo.id} className={`flex items-center gap-3 px-4 py-3 ${!tipo.ativo ? 'opacity-50' : ''}`}>
              <GripVertical size={15} className="text-text-tertiary shrink-0 cursor-grab" />

              {editandoId === tipo.id ? (
                <>
                  <input
                    autoFocus
                    type="text"
                    value={editandoNome}
                    onChange={(e) => setEditandoNome(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSalvarEdicao(tipo.id)
                      if (e.key === 'Escape') cancelarEdicao()
                    }}
                    className="flex-1 bg-input border border-primary-500 rounded-sm px-2 py-1 text-sm focus:outline-none"
                    disabled={isPending}
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <Clock size={12} className="text-text-secondary" />
                    <input
                      type="number"
                      value={editandoDuracao}
                      onChange={(e) => setEditandoDuracao(Math.max(5, parseInt(e.target.value) || 30))}
                      min={5}
                      step={5}
                      className="w-16 bg-input border border-primary-500 rounded-sm px-2 py-1 text-sm focus:outline-none text-center"
                      title="Duração padrão em minutos"
                      disabled={isPending}
                    />
                    <span className="text-xs text-text-secondary">min</span>
                  </div>
                  <button
                    onClick={() => handleSalvarEdicao(tipo.id)}
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
              ) : excluindoId === tipo.id ? (
                <>
                  <span className="flex-1 text-sm text-text-primary">
                    Excluir <strong>{tipo.nome}</strong>?
                  </span>
                  <button
                    onClick={() => handleExcluir(tipo.id)}
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
                  <span className="flex-1 text-sm text-text-primary">{tipo.nome}</span>
                  <span className="flex items-center gap-1 text-xs text-text-secondary shrink-0">
                    <Clock size={11} />
                    {tipo.duracao_padrao_minutos}min
                  </span>
                  {!tipo.ativo && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                      inativo
                    </span>
                  )}
                  <button
                    onClick={() => handleToggleAtivo(tipo)}
                    disabled={isPending}
                    className="p-1.5 text-text-secondary hover:text-primary-500 hover:bg-page rounded transition-colors"
                    title={tipo.ativo ? 'Desativar' : 'Ativar'}
                  >
                    {tipo.ativo
                      ? <ToggleRight size={17} className="text-primary-500" />
                      : <ToggleLeft size={17} />
                    }
                  </button>
                  <button
                    onClick={() => iniciarEdicao(tipo)}
                    disabled={isPending}
                    className="p-1.5 text-text-secondary hover:text-primary-500 hover:bg-page rounded transition-colors"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => { setExcluindoId(tipo.id); setEditandoId(null) }}
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
        Tipos inativos deixam de aparecer em novos agendamentos, mas os registros antigos continuam preservados.
      </p>
    </div>
  )
}
