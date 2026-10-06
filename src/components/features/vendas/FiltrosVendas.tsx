'use client'

import { Check, ChevronDown, Search, Tag, X } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { getTagCorConfig } from '@/lib/tag-cores'

const OPCOES_LIMITE = [10, 25, 50, 100]
const OPCOES_ORIGEM = [
  { value: 'medico', label: 'Médico' },
  { value: 'leads', label: 'Leads' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'renovacao', label: 'Renovação' },
  { value: 'campanha', label: 'Campanha' },
]
const OPCOES_STATUS = [
  { value: 'venda_confirmada',   label: 'Venda confirmada' },
  { value: 'orcamento_pendente', label: 'Orçamento pendente' },
  { value: 'orcamento_recusado', label: 'Orçamento recusado' },
]

type Produto = { id: string; nome: string }
type TagOpcao = { id: string; nome: string; cor: string }

export function FiltrosVendas({ produtos = [], tags = [] }: { produtos?: Produto[]; tags?: TagOpcao[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const buscaAtual = searchParams.get('busca') || ''
  const origemAtual = searchParams.get('origem') || ''
  const dataInicioAtual = searchParams.get('data_inicio') || ''
  const dataFimAtual = searchParams.get('data_fim') || ''
  const limiteAtual = searchParams.get('limite') || '50'
  const statusAtual = searchParams.get('status') || ''
  const tagAtual = searchParams.get('tag') || ''
  const produtoIdsAtual = searchParams.get('produto_ids')?.split(',').filter(Boolean) ?? []

  const [busca, setBusca] = useState(buscaAtual)
  const [produtosAberto, setProdutosAberto] = useState(false)
  const [buscaProduto, setBuscaProduto] = useState('')
  const [dataInicio, setDataInicio] = useState(dataInicioAtual)
  const [dataFim, setDataFim] = useState(dataFimAtual)
  const [tagsAberto, setTagsAberto] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const tagsRef = useRef<HTMLDivElement>(null)
  const montado = useRef(false)
  const montadoData = useRef(false)

  useEffect(() => {
    if (!montado.current) {
      montado.current = true
      return
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (busca) {
        params.set('busca', busca)
      } else {
        params.delete('busca')
      }
      params.delete('pagina')
      router.replace(`?${params.toString()}`)
    }, 400)

    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca])

  // Datas em estado local, com debounce antes de ir pra URL — do contrário,
  // cada dígito digitado (sobretudo no ano) dispara `router.replace` na hora
  // e a navegação resultante interrompe a digitação em andamento.
  useEffect(() => {
    if (!montadoData.current) {
      montadoData.current = true
      return
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (dataInicio) { params.set('data_inicio', dataInicio) } else { params.delete('data_inicio') }
      if (dataFim) { params.set('data_fim', dataFim) } else { params.delete('data_fim') }
      params.delete('pagina')
      router.replace(`?${params.toString()}`)
    }, 500)

    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataInicio, dataFim])

  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProdutosAberto(false)
      }
      if (tagsRef.current && !tagsRef.current.contains(e.target as Node)) {
        setTagsAberto(false)
      }
    }
    document.addEventListener('mousedown', handleClickFora)
    return () => document.removeEventListener('mousedown', handleClickFora)
  }, [])

  const mudarStatus = (valor: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (valor) { params.set('status', valor) } else { params.delete('status') }
    params.delete('pagina')
    router.replace(`?${params.toString()}`)
  }

  const mudarTag = (valor: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (valor) { params.set('tag', valor) } else { params.delete('tag') }
    params.delete('pagina')
    router.replace(`?${params.toString()}`)
    setTagsAberto(false)
  }

  const mudarOrigem = (valor: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (valor) { params.set('origem', valor) } else { params.delete('origem') }
    params.delete('pagina')
    router.replace(`?${params.toString()}`)
  }

  const mudarLimite = (valor: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('limite', valor)
    params.delete('pagina')
    router.replace(`?${params.toString()}`)
  }

  const toggleProduto = (id: string) => {
    const novos = produtoIdsAtual.includes(id)
      ? produtoIdsAtual.filter((p) => p !== id)
      : [...produtoIdsAtual, id]
    const params = new URLSearchParams(searchParams.toString())
    if (novos.length > 0) { params.set('produto_ids', novos.join(',')) } else { params.delete('produto_ids') }
    params.delete('pagina')
    router.replace(`?${params.toString()}`)
  }

  const limparFiltros = () => {
    setBusca('')
    setBuscaProduto('')
    setDataInicio('')
    setDataFim('')
    router.replace('?')
  }

  const produtosFiltrados = produtos.filter((p) =>
    p.nome.toLowerCase().includes(buscaProduto.toLowerCase())
  )

  const temFiltros = busca || origemAtual || dataInicioAtual || dataFimAtual || statusAtual || tagAtual || produtoIdsAtual.length > 0

  return (
    <div className="p-4 space-y-3 border-b border-border">
      {/* Row 1: Busca e Limite */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={18} />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por paciente ou profissional..."
            className="w-full pl-10 pr-4 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-text-secondary font-medium whitespace-nowrap">Mostrar:</span>
          <select
            value={limiteAtual}
            onChange={(e) => mudarLimite(e.target.value)}
            className="bg-input border border-border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
          >
            {OPCOES_LIMITE.map((n) => (
              <option key={n} value={String(n)}>
                {n} por página
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: Status, Origem, Produto e Período */}
      <div className="flex items-center gap-4 flex-wrap">
        <select
          value={statusAtual}
          onChange={(e) => mudarStatus(e.target.value)}
          className="bg-input border border-border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
        >
          <option value="">Todos os status</option>
          {OPCOES_STATUS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={origemAtual}
          onChange={(e) => mudarOrigem(e.target.value)}
          className="bg-input border border-border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
        >
          <option value="">Todas as origens</option>
          {OPCOES_ORIGEM.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {tags.length > 0 && (() => {
          const tagSel = tags.find((t) => t.id === tagAtual)
          const cfgSel = tagSel ? getTagCorConfig(tagSel.cor) : null
          return (
            <div className="relative" ref={tagsRef}>
              <button
                type="button"
                onClick={() => setTagsAberto((v) => !v)}
                className={`border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary-500 flex items-center gap-2 min-w-[160px] transition-colors ${
                  cfgSel ? `${cfgSel.bg} ${cfgSel.border} ${cfgSel.text} font-semibold` : 'bg-input border-border-input'
                }`}
              >
                {cfgSel ? (
                  <span className={`w-2 h-2 rounded-full shrink-0 ${cfgSel.dot}`} />
                ) : (
                  <Tag size={14} className="shrink-0 text-text-secondary" />
                )}
                <span className="flex-1 text-left">{tagSel ? tagSel.nome : 'Todas as tags'}</span>
                <ChevronDown size={14} className={`shrink-0 transition-transform ${tagsAberto ? 'rotate-180' : ''} ${cfgSel ? '' : 'text-text-secondary'}`} />
              </button>

              {tagsAberto && (
                <div className="absolute top-full left-0 z-50 mt-1 w-60 bg-white border border-border rounded-lg shadow-lg p-1">
                  <button
                    type="button"
                    onClick={() => mudarTag('')}
                    className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-page text-sm text-text-secondary"
                  >
                    <Tag size={14} className="shrink-0" />
                    <span className="flex-1 text-left">Todas as tags</span>
                    {!tagAtual && <Check size={14} className="text-primary-500" />}
                  </button>
                  <div className="max-h-60 overflow-y-auto">
                    {tags.map((tag) => {
                      const cfg = getTagCorConfig(tag.cor)
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => mudarTag(tag.id === tagAtual ? '' : tag.id)}
                          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-page"
                        >
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.text} ${cfg.border}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {tag.nome}
                          </span>
                          <span className="flex-1" />
                          {tag.id === tagAtual && <Check size={14} className="text-primary-500" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* Combobox de produtos */}
        {produtos.length > 0 && (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setProdutosAberto((v) => !v)}
              className="bg-input border border-border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary-500 flex items-center gap-2 min-w-[160px]"
            >
              <span className="flex-1 text-left">
                {produtoIdsAtual.length === 0
                  ? 'Todos os produtos'
                  : `${produtoIdsAtual.length} produto${produtoIdsAtual.length > 1 ? 's' : ''}`}
              </span>
              <ChevronDown size={14} className={`shrink-0 text-text-secondary transition-transform ${produtosAberto ? 'rotate-180' : ''}`} />
            </button>

            {produtosAberto && (
              <div className="absolute top-full left-0 z-50 mt-1 w-64 bg-white border border-border rounded-lg shadow-lg">
                <div className="p-2 border-b border-border">
                  <input
                    type="text"
                    value={buscaProduto}
                    onChange={(e) => setBuscaProduto(e.target.value)}
                    placeholder="Buscar produto..."
                    className="w-full px-2 py-1.5 text-sm bg-input border border-border-input rounded focus:outline-none focus:border-primary-500"
                    autoFocus
                  />
                </div>
                <div className="max-h-52 overflow-y-auto p-1">
                  {produtosFiltrados.length === 0 ? (
                    <p className="px-2 py-3 text-xs text-text-secondary text-center">Nenhum produto encontrado</p>
                  ) : (
                    produtosFiltrados.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-page cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={produtoIdsAtual.includes(p.id)}
                          onChange={() => toggleProduto(p.id)}
                          className="accent-primary-500 shrink-0"
                        />
                        <span className="text-sm text-text-primary">{p.nome}</span>
                      </label>
                    ))
                  )}
                </div>
                {produtoIdsAtual.length > 0 && (
                  <div className="p-2 border-t border-border">
                    <button
                      type="button"
                      onClick={() => {
                        const params = new URLSearchParams(searchParams.toString())
                        params.delete('produto_ids')
                        params.delete('pagina')
                        router.replace(`?${params.toString()}`)
                      }}
                      className="w-full text-xs text-text-secondary hover:text-text-primary text-center py-1"
                    >
                      Limpar seleção
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <input
          type="date"
          value={dataInicio}
          onChange={(e) => setDataInicio(e.target.value)}
          className="bg-input border border-border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
        />

        <span className="text-text-secondary text-sm">até</span>

        <input
          type="date"
          value={dataFim}
          onChange={(e) => setDataFim(e.target.value)}
          className="bg-input border border-border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
        />

        {temFiltros && (
          <button
            onClick={limparFiltros}
            className="flex items-center gap-1 px-3 py-2 text-sm rounded-md bg-page text-text-secondary hover:bg-page/80 transition-colors"
          >
            <X size={16} />
            Limpar
          </button>
        )}
      </div>
    </div>
  )
}
