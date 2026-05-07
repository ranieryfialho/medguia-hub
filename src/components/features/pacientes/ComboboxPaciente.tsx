'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { Search, Loader2, X } from 'lucide-react'
import { buscarPacientesPorNome, buscarMedicosPorNome } from '@/actions/pacientes'

type Resultado = { id: string; nome: string; detalhe?: string }

interface Props {
  name: string
  defaultValue?: string
  defaultId?: string
  placeholder?: string
  tipo?: 'paciente' | 'medico'
  valueMode?: 'label' | 'id'
  onSelect?: (item: Resultado) => void
  onClear?: () => void
}

export function ComboboxPaciente({
  name,
  defaultValue = '',
  defaultId = '',
  placeholder = 'Buscar...',
  tipo = 'paciente',
  valueMode = 'label',
  onSelect,
  onClear,
}: Props) {
  const [query, setQuery] = useState(defaultValue)
  const [resultados, setResultados] = useState<Resultado[]>([])
  const [aberto, setAberto] = useState(false)
  const [selecionado, setSelecionado] = useState<Resultado | null>(
    defaultValue
      ? { id: defaultId || defaultValue, nome: defaultValue }
      : null
  )
  const [isPending, startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleChange(valor: string) {
    setQuery(valor)
    setSelecionado(null)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!valor.trim()) {
      setResultados([])
      setAberto(false)
      onClear?.()
      return
    }

    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const data = tipo === 'medico'
          ? await buscarMedicosPorNome(valor)
          : await buscarPacientesPorNome(valor)
        setResultados(data)
        setAberto(true)
      })
    }, 300)
  }

  function handleSelecionar(item: Resultado) {
    setQuery(item.nome)
    setSelecionado(item)
    setResultados([])
    setAberto(false)
    onSelect?.(item)
  }

  function handleLimpar() {
    setQuery('')
    setSelecionado(null)
    setResultados([])
    setAberto(false)
    onClear?.()
  }

  const valorHidden = valueMode === 'id'
    ? (selecionado?.id || '')
    : (selecionado?.nome || query)

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={valorHidden} />

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => { if (resultados.length > 0) setAberto(true) }}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full bg-input border border-border-input rounded-sm pl-8 pr-8 py-2 text-sm focus:outline-none focus:border-primary-500"
        />
        {isPending && (
          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-text-tertiary" />
        )}
        {!isPending && query && (
          <button
            type="button"
            onClick={handleLimpar}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {aberto && resultados.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-surface border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {resultados.map(item => (
            <li key={item.id}>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); handleSelecionar(item) }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-page transition-colors"
              >
                <span className="font-medium text-text-primary">{item.nome}</span>
                {item.detalhe && (
                  <span className="ml-2 text-xs text-text-secondary">{item.detalhe}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {aberto && !isPending && resultados.length === 0 && query.trim().length >= 2 && (
        <div className="absolute z-50 mt-1 w-full bg-surface border border-border rounded-md shadow-lg px-3 py-2 text-sm text-text-secondary">
          {tipo === 'medico' ? 'Nenhum médico encontrado.' : 'Nenhum paciente encontrado.'}
        </div>
      )}
    </div>
  )
}
