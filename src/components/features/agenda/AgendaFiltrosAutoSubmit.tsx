'use client'

import { useEffect, useRef } from 'react'

export function AgendaFiltrosAutoSubmit() {
  const markerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const parentForm = markerRef.current?.closest('form') as HTMLFormElement | null
    if (!parentForm) return
    const form: HTMLFormElement = parentForm

    function handleChange(event: Event) {
      const target = event.target
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return
      if (!['profissional', 'horario', 'status'].includes(target.name)) return
      form.requestSubmit()
    }

    form.addEventListener('change', handleChange)
    return () => form.removeEventListener('change', handleChange)
  }, [])

  return <span ref={markerRef} className="hidden" aria-hidden="true" />
}
