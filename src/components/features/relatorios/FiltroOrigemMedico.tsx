'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

const ORIGENS = [
  { value: 'medico', label: 'Médico' },
  { value: 'leads', label: 'Leads' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'renovacao', label: 'Renovação' },
  { value: 'campanha', label: 'Campanha' },
]

interface Medico {
  id: string
  full_name: string
}

interface Props {
  defaultOrigem: string
  defaultMedicoNomes: string[]
  medicos: Medico[]
  defaultModalidade?: string
}

export function FiltroOrigemMedico({ defaultOrigem, defaultMedicoNomes, medicos, defaultModalidade = '' }: Props) {
  const [origem, setOrigem] = useState(defaultOrigem)
  const [medicosSelecionados, setMedicosSelecionados] = useState<string[]>(defaultMedicoNomes)
  const [modalidade, setModalidade] = useState(defaultModalidade)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setOrigem(defaultOrigem)
    setMedicosSelecionados(defaultMedicoNomes)
    setModalidade(defaultModalidade)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultOrigem, defaultModalidade])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function toggleMedico(nome: string) {
    setMedicosSelecionados((prev) =>
      prev.includes(nome) ? prev.filter((n) => n !== nome) : [...prev, nome]
    )
  }

  const resumo =
    medicosSelecionados.length === 0
      ? 'Todos os médicos'
      : medicosSelecionados.length === 1
        ? medicosSelecionados[0]
        : `${medicosSelecionados.length} médicos`

  return (
    <>
      <div>
        <label className="block text-xs text-text-secondary uppercase mb-1">Origem</label>
        <select
          name="origem"
          value={origem}
          onChange={(e) => {
            setOrigem(e.target.value)
            if (e.target.value !== 'medico') {
              setMedicosSelecionados([])
              setModalidade('')
            }
          }}
          className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
        >
          <option value="">Todas as origens</option>
          {ORIGENS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {origem === 'medico' && (
        <div>
          <label className="block text-xs text-text-secondary uppercase mb-1">Modalidade</label>
          <select
            name="modalidade"
            value={modalidade}
            onChange={(e) => setModalidade(e.target.value)}
            className="px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500"
          >
            <option value="">Todos os encaminhamentos</option>
            <option value="consultorio">Fechados em Consultório</option>
            <option value="fisio">Convertidos pelo Fisioterapeuta</option>
          </select>
        </div>
      )}

      {origem === 'medico' && medicos.length > 0 && (
        <div ref={containerRef} className="relative min-w-[220px]">
          <label className="block text-xs text-text-secondary uppercase mb-1">Médicos</label>

          {medicosSelecionados.map((nome) => (
            <input key={nome} type="hidden" name="medico_nome" value={nome} />
          ))}

          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="w-full px-3 py-2 bg-input border border-border-input rounded-md text-sm focus:outline-none focus:border-primary-500 flex items-center justify-between gap-3 text-left"
          >
            <span className="truncate text-text-primary">{resumo}</span>
            <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-md border border-border bg-surface shadow-lg overflow-hidden">
              <div className="max-h-64 overflow-y-auto py-1">
                {medicos.map((m) => {
                  const checked = medicosSelecionados.includes(m.full_name)
                  return (
                    <label
                      key={m.id}
                      className="flex items-center gap-3 px-3 py-2 text-sm text-text-primary hover:bg-page cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMedico(m.full_name)}
                        className="w-4 h-4 text-primary-500 rounded"
                      />
                      <span className="truncate">{m.full_name}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
