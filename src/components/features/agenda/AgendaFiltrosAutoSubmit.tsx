'use client'

import { useEffect, useRef } from 'react'
import { salvarPreferenciaTela } from '@/actions/preferencias'

const TELA = 'agenda'

type AgendaFiltrosAutoSubmitProps = {
  allStatuses: string[]
}

export function AgendaFiltrosAutoSubmit({ allStatuses }: AgendaFiltrosAutoSubmitProps) {
  const markerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const parentForm = markerRef.current?.closest('form') as HTMLFormElement | null
    if (!parentForm) return
    const form: HTMLFormElement = parentForm

    function handleChange(event: Event) {
      const target = event.target
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return
      if (!['profissional', 'horario', 'status'].includes(target.name)) return

      if (target.name === 'profissional' || target.name === 'status') {
        const statusesMarcados = Array.from(
          form.querySelectorAll<HTMLInputElement>('input[name="status"][type="checkbox"]:checked'),
          (checkbox) => checkbox.value,
        )
        const statusesValidos = Array.from(new Set(statusesMarcados.filter((status) => allStatuses.includes(status))))
        const statusesParaSalvar = statusesValidos.length === allStatuses.length ? [] : statusesValidos

        const profissionalSelect = form.querySelector<HTMLSelectElement>('select[name="profissional"]')

        void salvarPreferenciaTela(TELA, {
          status: statusesParaSalvar,
          profissional: profissionalSelect?.value ?? '',
        }).catch(() => {})
      }

      form.requestSubmit()
    }

    form.addEventListener('change', handleChange)
    return () => form.removeEventListener('change', handleChange)
  }, [allStatuses])

  return <span ref={markerRef} className="hidden" aria-hidden="true" />
}
