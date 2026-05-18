'use client'

import { useEffect, useRef } from 'react'

const STORAGE_KEY = 'medguia_agenda_status_filter'

type AgendaFiltrosAutoSubmitProps = {
  initialStatuses: string[]
  allStatuses: string[]
  clearPersistedStatuses?: boolean
}

function normalizarStatuses(statuses: string[], allStatuses: string[]) {
  const validos = Array.from(new Set(statuses.filter((status) => allStatuses.includes(status))))
  return validos.length === 0 || validos.length === allStatuses.length ? [] : validos
}

function persistirStatuses(statuses: string[]) {
  if (statuses.length === 0) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses))
}

export function AgendaFiltrosAutoSubmit({
  initialStatuses,
  allStatuses,
  clearPersistedStatuses = false,
}: AgendaFiltrosAutoSubmitProps) {
  const markerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const parentForm = markerRef.current?.closest('form') as HTMLFormElement | null
    if (!parentForm) return
    const form: HTMLFormElement = parentForm

    if (clearPersistedStatuses) {
      localStorage.removeItem(STORAGE_KEY)
      form.requestSubmit()
      return
    }

    const statusesIniciaisNormalizados = normalizarStatuses(initialStatuses, allStatuses)
    if (statusesIniciaisNormalizados.length > 0) {
      persistirStatuses(statusesIniciaisNormalizados)
    } else {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        try {
          const statusesSalvos = normalizarStatuses(JSON.parse(raw), allStatuses)
          if (statusesSalvos.length > 0) {
            const statusSet = new Set(statusesSalvos)
            const checkboxes = form.querySelectorAll<HTMLInputElement>('input[name="status"][type="checkbox"]')
            let houveMudanca = false

            checkboxes.forEach((checkbox) => {
              const shouldCheck = statusSet.has(checkbox.value)
              if (checkbox.checked !== shouldCheck) {
                checkbox.checked = shouldCheck
                houveMudanca = true
              }
            })

            if (houveMudanca) {
              form.requestSubmit()
              return
            }
          } else {
            localStorage.removeItem(STORAGE_KEY)
          }
        } catch {
          localStorage.removeItem(STORAGE_KEY)
        }
      }
    }

    function handleChange(event: Event) {
      const target = event.target
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return
      if (!['profissional', 'horario', 'status'].includes(target.name)) return

      if (target.name === 'status') {
        const statusesMarcados = Array.from(
          form.querySelectorAll<HTMLInputElement>('input[name="status"][type="checkbox"]:checked'),
          (checkbox) => checkbox.value,
        )
        persistirStatuses(normalizarStatuses(statusesMarcados, allStatuses))
      }

      form.requestSubmit()
    }

    form.addEventListener('change', handleChange)
    return () => form.removeEventListener('change', handleChange)
  }, [allStatuses, clearPersistedStatuses, initialStatuses])

  return <span ref={markerRef} className="hidden" aria-hidden="true" />
}
