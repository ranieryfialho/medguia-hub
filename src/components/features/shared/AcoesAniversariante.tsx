'use client'

import { useState } from 'react'
import { MessageCircle, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import { SeletorTemplateAniversario } from './SeletorTemplateAniversario'

interface Template {
  id: string
  nome: string
  conteudo: string
}

export interface PacienteAnivProps {
  id: string
  nome: string
  telefone: string
  email: string
  idade: number
  diaMes: string
  diaSemana: string
}

export function AcoesAniversariante({ paciente }: { paciente: PacienteAnivProps }) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [openCanal, setOpenCanal] = useState<'whatsapp' | 'email' | null>(null)

  const loadTemplates = async () => {
    if (templates.length > 0) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/templates?categoria=aniversario')
      const data = await res.json()
      if (data.templates) setTemplates(data.templates)
    } catch {
      toast.error('Erro ao carregar templates')
    } finally {
      setIsLoading(false)
    }
  }

  const semTelefone = !paciente.telefone
  const semEmail = !paciente.email

  const handleWhatsApp = async () => {
    if (semTelefone) return
    await loadTemplates()
    setOpenCanal('whatsapp')
  }

  const handleEmail = async () => {
    if (semEmail) return
    await loadTemplates()
    setOpenCanal('email')
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={handleWhatsApp}
          disabled={isLoading || semTelefone}
          title={semTelefone ? 'Sem telefone cadastrado' : 'Enviar via WhatsApp'}
          className={`transition-colors ${
            semTelefone
              ? 'text-slate-300 cursor-not-allowed opacity-50'
              : 'text-slate-500 hover:text-[#25D366] cursor-pointer'
          }`}
        >
          <MessageCircle size={16} />
        </button>
        <button
          onClick={handleEmail}
          disabled={isLoading || semEmail}
          title={semEmail ? 'Sem email cadastrado' : 'Enviar Email'}
          className={`transition-colors ${
            semEmail
              ? 'text-slate-300 cursor-not-allowed opacity-50'
              : 'text-slate-500 hover:text-orange-500 cursor-pointer'
          }`}
        >
          <Mail size={16} />
        </button>
      </div>

      {openCanal && (
        <SeletorTemplateAniversario
          isOpen
          onClose={() => setOpenCanal(null)}
          canal={openCanal}
          paciente={paciente}
          templates={templates}
        />
      )}
    </>
  )
}