'use client'

import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
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

export function BtnSMS({ paciente }: { paciente: PacienteConfirmacao }) {
  const [isOpen, setIsOpen] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async () => {
    if (!paciente.telefone) {
      toast.error('Paciente sem telefone cadastrado')
      return
    }

    if (templates.length === 0 && !isLoading) {
      setIsLoading(true)
      try {
        const response = await fetch('/api/templates?categoria=confirmacao_sms')
        const data = await response.json()
        if (data.templates) setTemplates(data.templates)
      } catch {
        toast.error('Erro ao carregar templates de SMS')
      } finally {
        setIsLoading(false)
      }
    }

    setIsOpen(true)
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={`transition-colors ${
          paciente.telefone
            ? 'hover:text-blue-500 cursor-pointer text-slate-600'
            : 'text-slate-300 cursor-not-allowed opacity-50'
        }`}
        title="Enviar SMS"
      >
        <MessageSquare size={18} />
      </button>

      <SeletorTemplateCanal
        canal="sms"
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        paciente={paciente}
        templates={templates}
      />
    </>
  )
}
