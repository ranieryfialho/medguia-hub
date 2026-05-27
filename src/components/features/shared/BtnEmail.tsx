'use client'

import { useState } from 'react'
import { Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import { SeletorTemplateCanal } from './SeletorTemplateCanal'

interface Template {
  id: string
  nome: string
  conteudo: string
}

interface PacienteConfirmacao {
  id: string
  nome: string
  telefone: string
  email?: string | null
  data_agendamento: string
  tipo: string
  atendimento_id: string
  profissional_nome?: string
  numero_sessao?: number
  total_sessoes?: number
}

export function BtnEmail({ paciente }: { paciente: PacienteConfirmacao }) {
  const [isOpen, setIsOpen] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async () => {
    if (!paciente.email) return

    if (templates.length === 0 && !isLoading) {
      setIsLoading(true)
      try {
        const response = await fetch('/api/templates?categoria=confirmacao_email')
        const data = await response.json()
        if (data.templates) setTemplates(data.templates)
      } catch {
        toast.error('Erro ao carregar templates de email')
      } finally {
        setIsLoading(false)
      }
    }

    setIsOpen(true)
  }

  const semEmail = !paciente.email

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isLoading || semEmail}
        className={`transition-colors ${
          semEmail
            ? 'text-slate-300 cursor-not-allowed opacity-50'
            : 'hover:text-orange-500 cursor-pointer text-slate-600'
        }`}
        title={semEmail ? 'Paciente sem email cadastrado' : 'Enviar Email'}
      >
        <Mail size={18} />
      </button>

      {!semEmail && (
        <SeletorTemplateCanal
          canal="email"
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          paciente={paciente}
          templates={templates}
        />
      )}
    </>
  )
}
