'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface Option {
  id: string
  nome: string
}

interface FiltroProdutosMultiSelectProps {
  name: string
  options: Option[]
  defaultSelected?: string[]
  label: string
}

export function FiltroProdutosMultiSelect({
  name,
  options,
  defaultSelected = [],
  label,
}: FiltroProdutosMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>(defaultSelected)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSelected(defaultSelected)
  }, [defaultSelected])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const resumo = useMemo(() => {
    if (selected.length === 0) return 'Todos os produtos'
    if (selected.length === 1) {
      return options.find((option) => option.id === selected[0])?.nome || '1 produto'
    }
    return `${selected.length} produtos selecionados`
  }, [options, selected])

  function toggleValue(value: string) {
    setSelected((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs text-text-secondary uppercase mb-1">{label}</label>

      {selected.map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500 flex items-center justify-between gap-3 text-left"
      >
        <span className="truncate text-text-primary">{resumo}</span>
        <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-md border border-border bg-surface shadow-lg overflow-hidden">
          <div className="max-h-64 overflow-y-auto py-1">
            {options.map((option) => {
              const checked = selected.includes(option.id)
              return (
                <label
                  key={option.id}
                  className="flex items-center gap-3 px-3 py-2 text-sm text-text-primary hover:bg-page cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleValue(option.id)}
                    className="w-4 h-4 text-primary-500 rounded"
                  />
                  <span className="truncate">{option.nome}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
