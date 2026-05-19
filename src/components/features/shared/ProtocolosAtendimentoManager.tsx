'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, Check, X, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Minus } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  criarProtocoloAtendimento,
  atualizarProtocoloAtendimento,
  atualizarItemProtocoloAtendimento,
  toggleAtivoProtocoloAtendimento,
  excluirProtocoloAtendimento,
  adicionarItemProtocoloAtendimento,
  removerItemProtocoloAtendimento,
  type ProtocoloAtendimento,
} from '@/actions/protocolos-atendimento'

interface TipoConsultaOption {
  id: string
  nome: string
  ativo: boolean
}

interface ProtocolosAtendimentoManagerProps {
  protocolos: ProtocoloAtendimento[]
  tiposConsulta: TipoConsultaOption[]
}

export function ProtocolosAtendimentoManager({
  protocolos: inicial,
  tiposConsulta,
}: ProtocolosAtendimentoManagerProps) {
  function normalizarTotalSessoes(valor: string | number) {
    const numero = typeof valor === 'number' ? valor : parseInt(valor, 10)
    return Math.max(1, Math.min(365, Number.isNaN(numero) ? 1 : numero))
  }

  const [protocolos, setProtocolos] = useState(inicial)
  const [novoNome, setNovoNome] = useState('')
  const [novoTotalSessoes, setNovoTotalSessoes] = useState(1)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editandoNome, setEditandoNome] = useState('')
  const [editandoTotalSessoes, setEditandoTotalSessoes] = useState(1)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [expandidoId, setExpandidoId] = useState<string | null>(null)
  const [itemProtocoloId, setItemProtocoloId] = useState<string | null>(null)
  const [itemTipoConsultaId, setItemTipoConsultaId] = useState('')
  const [itemQuantidade, setItemQuantidade] = useState(1)
  const [editandoItemId, setEditandoItemId] = useState<string | null>(null)
  const [editandoItemTipoConsultaId, setEditandoItemTipoConsultaId] = useState('')
  const [editandoItemQuantidade, setEditandoItemQuantidade] = useState(1)
  const [isPending, startTransition] = useTransition()

  function handleAdicionarProtocolo(e: React.FormEvent) {
    e.preventDefault()
    if (!novoNome.trim()) return
    startTransition(async () => {
      const result = await criarProtocoloAtendimento(novoNome, novoTotalSessoes)
      if (result.error) { toast.error(result.error); return }
      toast.success('Protocolo criado')
      setNovoNome('')
      setNovoTotalSessoes(1)
      window.location.reload()
    })
  }

  function iniciarEdicao(protocolo: ProtocoloAtendimento) {
    setEditandoId(protocolo.id)
    setEditandoNome(protocolo.nome)
    setEditandoTotalSessoes(protocolo.total_sessoes)
    setExcluindoId(null)
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setEditandoNome('')
    setEditandoTotalSessoes(1)
  }

  function handleSalvarEdicao(id: string) {
    if (!editandoNome.trim()) return
    startTransition(async () => {
      const result = await atualizarProtocoloAtendimento(id, editandoNome, editandoTotalSessoes)
      if (result.error) { toast.error(result.error); return }
      toast.success('Protocolo atualizado')
      setProtocolos((prev) => prev.map((protocolo) => (
        protocolo.id === id ? { ...protocolo, nome: editandoNome.trim(), total_sessoes: editandoTotalSessoes } : protocolo
      )))
      setEditandoId(null)
    })
  }

  function handleToggleAtivo(protocolo: ProtocoloAtendimento) {
    startTransition(async () => {
      const result = await toggleAtivoProtocoloAtendimento(protocolo.id, !protocolo.ativo)
      if (result.error) { toast.error(result.error); return }
      setProtocolos((prev) => prev.map((item) => (
        item.id === protocolo.id ? { ...item, ativo: !item.ativo } : item
      )))
    })
  }

  function handleExcluir(id: string) {
    startTransition(async () => {
      const result = await excluirProtocoloAtendimento(id)
      if (result.error) { toast.error(result.error); return }
      toast.success('Protocolo excluido')
      setProtocolos((prev) => prev.filter((protocolo) => protocolo.id !== id))
      setExcluindoId(null)
      if (expandidoId === id) setExpandidoId(null)
    })
  }

  function handleAdicionarItem(protocoloId: string) {
    if (!itemTipoConsultaId || itemQuantidade < 1) return
    startTransition(async () => {
      const result = await adicionarItemProtocoloAtendimento(protocoloId, itemTipoConsultaId, itemQuantidade)
      if (result.error) { toast.error(result.error); return }
      toast.success('Item adicionado')
      setItemTipoConsultaId('')
      setItemQuantidade(1)
      setItemProtocoloId(null)
      window.location.reload()
    })
  }

  function handleRemoverItem(protocoloId: string, itemId: string) {
    startTransition(async () => {
      const result = await removerItemProtocoloAtendimento(itemId)
      if (result.error) { toast.error(result.error); return }
      toast.success('Item removido')
      setProtocolos((prev) =>
        prev.map((protocolo) =>
          protocolo.id === protocoloId
            ? { ...protocolo, itens: protocolo.itens.filter((item) => item.id !== itemId) }
            : protocolo
        )
      )
    })
  }

  function iniciarEdicaoItem(itemId: string, tipoConsultaId: string, quantidade: number) {
    setEditandoItemId(itemId)
    setEditandoItemTipoConsultaId(tipoConsultaId)
    setEditandoItemQuantidade(quantidade)
  }

  function cancelarEdicaoItem() {
    setEditandoItemId(null)
    setEditandoItemTipoConsultaId('')
    setEditandoItemQuantidade(1)
  }

  function handleSalvarEdicaoItem(protocoloId: string, itemId: string) {
    if (!editandoItemTipoConsultaId || editandoItemQuantidade < 1) return

    startTransition(async () => {
      const result = await atualizarItemProtocoloAtendimento(
        itemId,
        editandoItemTipoConsultaId,
        editandoItemQuantidade
      )
      if (result.error) { toast.error(result.error); return }

      const tipoSelecionado = tiposConsulta.find((tipo) => tipo.id === editandoItemTipoConsultaId)
      toast.success('Item atualizado')
      setProtocolos((prev) =>
        prev.map((protocolo) =>
          protocolo.id === protocoloId
            ? {
                ...protocolo,
                itens: protocolo.itens.map((item) =>
                  item.id === itemId
                    ? {
                        ...item,
                        tipo_consulta_id: editandoItemTipoConsultaId,
                        tipo_consulta_nome: tipoSelecionado?.nome ?? item.tipo_consulta_nome,
                        quantidade: editandoItemQuantidade,
                      }
                    : item
                ),
              }
            : protocolo
        )
      )
      cancelarEdicaoItem()
    })
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdicionarProtocolo} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_auto]">
        <input
          type="text"
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          placeholder="Nome do protocolo (ex: Pos-operatorio de joelho)"
          className="flex-1 bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
          disabled={isPending}
        />
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-text-secondary">Total de sessoes</p>
          <input
            type="number"
            min="1"
            max="365"
            value={novoTotalSessoes}
            onChange={(e) => setNovoTotalSessoes(normalizarTotalSessoes(e.target.value))}
            className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm text-center focus:outline-none focus:border-primary-500"
            disabled={isPending}
            title="Total de sessoes"
          />
        </div>
        <button
          type="submit"
          disabled={isPending || !novoNome.trim()}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-sm text-sm font-medium transition-colors disabled:opacity-50 self-end"
        >
          <Plus size={15} />
          Adicionar
        </button>
      </form>

      <p className="text-xs text-text-secondary -mt-3">
        O total de sessoes define quantos atendimentos o protocolo cria. A quantidade de cada item define em quantas dessas sessoes aquele atendimento aparece.
      </p>

      <div className="bg-surface rounded-lg border border-border overflow-hidden">
        {protocolos.length === 0 && (
          <p className="px-5 py-6 text-sm text-text-secondary text-center">
            Nenhum protocolo de atendimento cadastrado ainda.
          </p>
        )}
        <ul className="divide-y divide-border">
          {protocolos.map((protocolo) => (
            <li key={protocolo.id} className={!protocolo.ativo ? 'opacity-50' : ''}>
              <div className="flex items-center gap-3 px-4 py-3">
                {editandoId === protocolo.id ? (
                  <>
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        autoFocus
                        type="text"
                        value={editandoNome}
                        onChange={(e) => setEditandoNome(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSalvarEdicao(protocolo.id)
                          if (e.key === 'Escape') cancelarEdicao()
                        }}
                        className="flex-1 bg-input border border-primary-500 rounded-sm px-2 py-1 text-sm focus:outline-none"
                        disabled={isPending}
                      />
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={editandoTotalSessoes}
                        onChange={(e) => setEditandoTotalSessoes(normalizarTotalSessoes(e.target.value))}
                        className="w-24 bg-input border border-primary-500 rounded-sm px-2 py-1 text-sm text-center focus:outline-none"
                        disabled={isPending}
                        title="Total de sessoes"
                      />
                    </div>
                    <button type="button" onClick={() => handleSalvarEdicao(protocolo.id)} disabled={isPending} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Salvar">
                      <Check size={15} />
                    </button>
                    <button type="button" onClick={cancelarEdicao} className="p-1.5 text-text-secondary hover:bg-page rounded transition-colors" title="Cancelar">
                      <X size={15} />
                    </button>
                  </>
                ) : excluindoId === protocolo.id ? (
                  <>
                    <span className="flex-1 text-sm text-text-primary">
                      Excluir <strong>{protocolo.nome}</strong>?
                    </span>
                    <button type="button" onClick={() => handleExcluir(protocolo.id)} disabled={isPending} className="px-3 py-1 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded transition-colors disabled:opacity-50">
                      Confirmar
                    </button>
                    <button type="button" onClick={() => setExcluindoId(null)} className="px-3 py-1 text-xs font-medium border border-border text-text-secondary hover:bg-page rounded transition-colors">
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setExpandidoId((value) => value === protocolo.id ? null : protocolo.id)}
                      className="flex items-center gap-2 flex-1 text-left min-w-0"
                    >
                      <span className="text-sm font-medium text-text-primary truncate">{protocolo.nome}</span>
                      <span className="shrink-0 text-[10px] font-semibold text-primary-700 bg-primary-50 border border-primary-100 px-1.5 py-0.5 rounded">
                        {protocolo.total_sessoes} sessoes
                      </span>
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
                    <button type="button" onClick={() => handleToggleAtivo(protocolo)} disabled={isPending} className="p-1.5 text-text-secondary hover:text-primary-500 hover:bg-page rounded transition-colors" title={protocolo.ativo ? 'Desativar' : 'Ativar'}>
                      {protocolo.ativo ? <ToggleRight size={17} className="text-primary-500" /> : <ToggleLeft size={17} />}
                    </button>
                    <button type="button" onClick={() => iniciarEdicao(protocolo)} disabled={isPending} className="p-1.5 text-text-secondary hover:text-primary-500 hover:bg-page rounded transition-colors" title="Editar nome">
                      <Pencil size={14} />
                    </button>
                    <button type="button" onClick={() => { setExcluindoId(protocolo.id); setEditandoId(null) }} disabled={isPending} className="p-1.5 text-text-secondary hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="Excluir">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>

              {expandidoId === protocolo.id && (
                <div className="px-4 pb-4 space-y-3 bg-page/50 border-t border-border">
                  {protocolo.itens.length === 0 ? (
                    <p className="text-sm text-text-secondary pt-3">Nenhum item neste protocolo.</p>
                  ) : (
                    <ul className="divide-y divide-border pt-2">
                      {protocolo.itens.map((item) => (
                        <li key={item.id} className="flex items-center justify-between py-2 text-sm">
                          {editandoItemId === item.id ? (
                            <div className="flex items-center gap-2 w-full">
                              <select
                                value={editandoItemTipoConsultaId}
                                onChange={(e) => setEditandoItemTipoConsultaId(e.target.value)}
                                className="flex-1 bg-input border border-border-input rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:border-primary-500"
                                disabled={isPending}
                              >
                                {tiposConsulta.map((tipo) => (
                                  <option key={tipo.id} value={tipo.id}>{tipo.nome}</option>
                                ))}
                              </select>
                              <input
                                type="number"
                                min="1"
                                max={protocolo.total_sessoes}
                                value={editandoItemQuantidade}
                                onChange={(e) => setEditandoItemQuantidade(Math.min(protocolo.total_sessoes, Math.max(1, parseInt(e.target.value) || 1)))}
                                className="w-16 bg-input border border-border-input rounded-sm px-2 py-1.5 text-sm text-center focus:outline-none focus:border-primary-500"
                                disabled={isPending}
                              />
                              <button
                                type="button"
                                onClick={() => handleSalvarEdicaoItem(protocolo.id, item.id)}
                                disabled={isPending || !editandoItemTipoConsultaId}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                title="Salvar item"
                              >
                                <Check size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={cancelarEdicaoItem}
                                className="p-1 text-text-secondary hover:bg-page rounded transition-colors"
                                title="Cancelar edição"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="text-text-primary">{item.tipo_consulta_nome}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-text-secondary text-xs">{item.quantidade}x</span>
                                <button
                                  type="button"
                                  onClick={() => iniciarEdicaoItem(item.id, item.tipo_consulta_id, item.quantidade)}
                                  disabled={isPending}
                                  className="p-1 text-text-secondary hover:text-primary-500 hover:bg-page rounded transition-colors"
                                  title="Editar item"
                                >
                                  <Pencil size={13} />
                                </button>
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
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {itemProtocoloId === protocolo.id ? (
                    <div className="flex items-center gap-2 pt-1">
                      <select
                        value={itemTipoConsultaId}
                        onChange={(e) => setItemTipoConsultaId(e.target.value)}
                        className="flex-1 bg-input border border-border-input rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:border-primary-500"
                        disabled={isPending}
                      >
                        <option value="">Selecione o tipo de consulta...</option>
                        {tiposConsulta.map((tipo) => (
                          <option key={tipo.id} value={tipo.id}>{tipo.nome}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        max={protocolo.total_sessoes}
                        value={itemQuantidade}
                        onChange={(e) => setItemQuantidade(Math.min(protocolo.total_sessoes, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="w-16 bg-input border border-border-input rounded-sm px-2 py-1.5 text-sm text-center focus:outline-none focus:border-primary-500"
                        disabled={isPending}
                        title="Quantidade"
                      />
                      <button
                        type="button"
                        onClick={() => handleAdicionarItem(protocolo.id)}
                        disabled={isPending || !itemTipoConsultaId}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors disabled:opacity-40"
                        title="Confirmar"
                      >
                        <Check size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setItemProtocoloId(null); setItemTipoConsultaId(''); setItemQuantidade(1) }}
                        className="p-1.5 text-text-secondary hover:bg-page rounded transition-colors"
                        title="Cancelar"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setItemProtocoloId(protocolo.id); setItemTipoConsultaId(''); setItemQuantidade(1) }}
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
        Protocolos inativos deixam de aparecer em fluxos futuros de atendimento, mas os registros existentes continuam preservados.
      </p>
    </div>
  )
}
