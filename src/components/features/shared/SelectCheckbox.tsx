'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

type SelectCheckboxProps = {
  name: string
  label: string
  options: string[]
  selectedValues: string[]
}

export function SelectCheckbox({ name, label, options, selectedValues }: SelectCheckboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [localSelected, setLocalSelected] = useState<string[]>(selectedValues)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function toggle(option: string) {
    setLocalSelected(prev =>
      prev.includes(option) ? prev.filter(v => v !== option) : [...prev, option]
    )
  }

  const displayText = localSelected.length === 0
    ? 'Selecione'
    : localSelected.length === 1
    ? localSelected[0]
    : `${localSelected.length} selecionado${localSelected.length > 1 ? 's' : ''}`

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs text-text-secondary uppercase mb-1">{label}</label>

      {/* Hidden inputs always in DOM so form submission captures selected values */}
      {localSelected.map(v => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm text-left focus:outline-none focus:border-primary-500 flex items-center justify-between"
      >
        <span className={localSelected.length === 0 ? 'text-text-secondary' : 'text-text-primary'}>{displayText}</span>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-input border border-border-input rounded-md shadow-lg z-10">
          <div className="max-h-48 overflow-y-auto p-2 space-y-2">
            {options.map((option) => (
              <label key={option} className="flex items-center gap-2 cursor-pointer px-2 py-1.5 hover:bg-page rounded transition-colors">
                <input
                  type="checkbox"
                  checked={localSelected.includes(option)}
                  onChange={() => toggle(option)}
                  className="w-4 h-4 rounded border-border-input accent-primary-500"
                />
                <span className="text-sm text-text-primary flex-1">{option}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
