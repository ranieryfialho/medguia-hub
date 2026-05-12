'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, Check, X, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Minus } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  criarProtocolo,
  atualizarProtocolo,
  toggleAtivoProtocolo,
  excluirProtocolo,
  adicionarItemProtocolo,
  removerItemProtocolo,
  type Protocolo,
} from '@/actions/protocolos'

interface Produto {
  id: string
  nome: string
  preco_padrao: number
}

interface ProtocolosManagerProps {
  protocolos: Protocolo[]
  produtos: Produto[]
}

export function ProtocolosManager({ protocolos: inicial, produtos }: ProtocolosManagerProps) {
  const [protocolos, setProtocolos] = useState(inicial)
  const [novoNome, setNovoNome] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editandoNome, setEditandoNome] = useState('')
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [expandidoId, setExpandidoId] = useState<string | null>(null)

  const [itemProtocoloId, setItemProtocoloId] = useState<string | null>(null)
  const [itemProdutoId, setItemProdutoId] = useState('')
  const [itemQuantidade, setItemQuantidade] = useState(1)

  const [isPending, startTransition] = useTransition()

  function handleAdicionarProtocolo(e: React.FormEvent) {
    e.preventDefault()
    if (!novoNome.trim()) return
    startTransition(async () => {
      const result = await criarProtocolo(novoNome)
      if (result.error) { toast.error(result.error); return }
      toast.success('Protocolo criado')
      setNovoNome('')
      window.location.reload()
    })
  }

  function iniciarEdicao(p: Protocolo) {
    setEditandoId(p.id)
    setEditandoNome(p.nome)
    setExcluindoId(null)
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setEditandoNome('')
  }

  function handleSalvarEdicao(id: string) {
    if (!editandoNome.trim()) return
    startTransition(async () => {
      const result = await atualizarProtocolo(id, editandoNome)
      if (result.error) { toast.error(result.error); return }
      toast.success('Protocolo atualizado')
      setProtocolos(prev => prev.map(p => p.id === id ? { ...p, nome: editandoNome.trim() } : p))
      setEditandoId(null)
    })
  }

  function handleToggleAtivo(p: Protocolo) {
    startTransition(async () => {
      const result = await toggleAtivoProtocolo(p.id, !p.ativo)
      if (result.error) { toast.error(result.error); return }
      setProtocolos(prev => prev.map(pp => pp.id === p.id ? { ...pp, ativo: !pp.ativo } : pp))
    })
  }

  function handleExcluir(id: string) {
    startTransition(async () => {
      const result = await excluirProtocolo(id)
      if (result.error) { toast.error(result.error); return }
      toast.success('Protocolo excluído')
      setProtocolos(prev => prev.filter(p => p.id !== id))
      setExcluindoId(null)
      if (expandidoId === id) setExpandidoId(null)
    })
  }

  function handleAdicionarItem(protocolo_id: string) {
    if (!itemProdutoId || itemQuantidade < 1) return
    startTransition(async () => {
      const result = await adicionarItemProtocolo(protocolo_id, itemProdutoId, itemQuantidade)
      if (result.error) { toast.error(result.error); return }
      toast.success('Item adicionado')
      setItemProdutoId('')
      setItemQuantidade(1)
      setItemProtocoloId(null)
      window.location.reload()
    })
  }

  function handleRemoverItem(protocolo_id: string, item_id: string) {
    startTransition(async () => {
      const result = await removerItemProtocolo(item_id)
      if (result.error) { toast.error(result.error); return }
      toast.success('Item removido')
      setProtocolos(prev =>
        prev.map(p =>
          p.id === protocolo_id
            ? { ...p, itens: p.itens.filter(it => it.id !== item_id) }
            : p
        )
      )
    })
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdicionarProtocolo} className="flex gap-2">
        <input
          type="text"
          value={novoNome}
          onChange={e => setNovoNome(e.target.value)}
          placeholder="Nome do protocolo (ex: Artrose+, Protocolo Joelho...)"
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
        {protocolos.length === 0 && (
          <p className="px-5 py-6 text-sm text-text-secondary text-center">
            Nenhum protocolo cadastrado ainda.
          </p>
        )}
        <ul className="divide-y divide-border">
          {protocolos.map(protocolo => (
            <li key={protocolo.id} className={!protocolo.ativo ? 'opacity-50' : ''}>
              {/* Linha principal */}
              <div className="flex items-center gap-3 px-4 py-3">
                {editandoId === protocolo.id ? (
                  <>
                    <input
                      autoFocus
                      type="text"
                      value={editandoNome}
                      onChange={e => setEditandoNome(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSalvarEdicao(protocolo.id)
                        if (e.key === 'Escape') cancelarEdicao()
                      }}
                      className="flex-1 bg-input border border-primary-500 rounded-sm px-2 py-1 text-sm focus:outline-none"
                      disabled={isPending}
                    />
                    <button onClick={() => handleSalvarEdicao(protocolo.id)} disabled={isPending} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Salvar">
                      <Check size={15} />
                    </button>
                    <button onClick={cancelarEdicao} className="p-1.5 text-text-secondary hover:bg-page rounded transition-colors" title="Cancelar">
                      <X size={15} />
                    </button>
                  </>
                ) : excluindoId === protocolo.id ? (
                  <>
                    <span className="flex-1 text-sm text-text-primary">
                      Excluir <strong>{protocolo.nome}</strong>?
                    </span>
                    <button onClick={() => handleExcluir(protocolo.id)} disabled={isPending} className="px-3 py-1 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded transition-colors disabled:opacity-50">
                      Confirmar
                    </button>
                    <button onClick={() => setExcluindoId(null)} className="px-3 py-1 text-xs font-medium border border-border text-text-secondary hover:bg-page rounded transition-colors">
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setExpandidoId(v => v === protocolo.id ? null : protocolo.id)}
                      className="flex items-center gap-2 flex-1 text-left min-w-0"
                    >
                      <span className="text-sm font-medium text-text-primary truncate">{protocolo.nome}</span>
                      <span className="shrink-0 text-[10px] font-semibold text-text-tertiary bg-page border border-border px-1.5 py-0.5 rounded">
                        {protocolo.itens.length} {protocolo.itens.length === 1 ? 'item' : 'itens'}
                      </span>
                      {!protocolo.ativo && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">inativo</span>
                      )}
                      {expandidoId === protocolo.id
                        ? <ChevronUp size={14} className="text-text-secondary ml-auto shrink-0" />
                        : <ChevronDown size={14} className="text-text-secondary ml-auto shrink-0" />
                      }
                    </button>

                    <button onClick={() => handleToggleAtivo(protocolo)} disabled={isPending} className="p-1.5 text-text-secondary hover:text-primary-500 hover:bg-page rounded transition-colors" title={protocolo.ativo ? 'Desativar' : 'Ativar'}>
                      {protocolo.ativo ? <ToggleRight size={17} className="text-primary-500" /> : <ToggleLeft size={17} />}
                    </button>
                    <button onClick={() => iniciarEdicao(protocolo)} disabled={isPending} className="p-1.5 text-text-secondary hover:text-primary-500 hover:bg-page rounded transition-colors" title="Editar nome">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => { setExcluindoId(protocolo.id); setEditandoId(null) }} disabled={isPending} className="p-1.5 text-text-secondary hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="Excluir">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>

              {/* Itens expandidos */}
              {expandidoId === protocolo.id && (
                <div className="px-4 pb-4 space-y-3 bg-page/50 border-t border-border">
                  {protocolo.itens.length === 0 ? (
                    <p className="text-sm text-text-secondary pt-3">Nenhum item neste protocolo.</p>
                  ) : (
                    <ul className="divide-y divide-border pt-2">
                      {protocolo.itens.map(item => (
                        <li key={item.id} className="flex items-center justify-between py-2 text-sm">
                          <span className="text-text-primary">{item.produto_nome}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-text-secondary text-xs">{item.quantidade}×</span>
                            <button
                              type="button"
                              onClick={() => handleRemoverItem(protocolo.id, item.id)}
                              disabled={isPending}
                              className="p-1 text-text-secondary hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                              title="Remover item"
                            >
                              <Minus size={13} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Adicionar item */}
                  {itemProtocoloId === protocolo.id ? (
                    <div className="flex items-center gap-2 pt-1">
                      <select
                        value={itemProdutoId}
                        onChange={e => setItemProdutoId(e.target.value)}
                        className="flex-1 bg-input border border-border-input rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:border-primary-500"
                        disabled={isPending}
                      >
                        <option value="">Selecione o produto...</option>
                        {produtos.map(p => (
                          <option key={p.id} value={p.id}>{p.nome}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={itemQuantidade}
                        onChange={e => setItemQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 bg-input border border-border-input rounded-sm px-2 py-1.5 text-sm text-center focus:outline-none focus:border-primary-500"
                        disabled={isPending}
                        title="Quantidade"
                      />
                      <button
                        type="button"
                        onClick={() => handleAdicionarItem(protocolo.id)}
                        disabled={isPending || !itemProdutoId}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors disabled:opacity-40"
                        title="Confirmar"
                      >
                        <Check size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setItemProtocoloId(null); setItemProdutoId(''); setItemQuantidade(1) }}
                        className="p-1.5 text-text-secondary hover:bg-page rounded transition-colors"
                        title="Cancelar"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setItemProtocoloId(protocolo.id); setItemProdutoId(''); setItemQuantidade(1) }}
                      disabled={isPending}
                      className="flex items-center gap-1.5 text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors"
                    >
                      <Plus size={13} />
                      Adicionar item
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-text-secondary">
        Protocolos inativos não aparecem na criação de vendas, mas são preservados nos registros existentes.
      </p>
    </div>
  )
}
