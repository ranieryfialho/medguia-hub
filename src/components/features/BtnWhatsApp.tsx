'use client'

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { SeletorTemplateWhatsApp } from './SeletorTemplateWhatsApp'

interface Template {
  id: string
  nome: string
  conteudo: string
}

interface PacienteConfirmacao {
  id: string
  nome: string
  telefone: string
  data_agendamento: string
  tipo: string
  atendimento_id: string
}

export function BtnWhatsApp({
  numero,
  paciente,
  onDrawerToggle
}: {
  numero: string
  paciente?: PacienteConfirmacao
  onDrawerToggle?: (isOpen: boolean) => void
}) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const handleDrawerToggle = (isOpen: boolean) => {
    setIsDrawerOpen(isOpen)
    onDrawerToggle?.(isOpen)
  }
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()

    // Se não tiver número, mostra erro
    if (!numero) {
      toast.error('Paciente sem número cadastrado')
      return
    }

    // Se não tem contexto de agendamento (ex: página de pacientes), abre WhatsApp diretamente
    if (!paciente) {
      window.open(`https://wa.me/55${numero}`, '_blank')
      return
    }

    // Carregar templates se ainda não estão carregados
    if (templates.length === 0 && !isLoadingTemplates) {
      setIsLoadingTemplates(true)
      try {
        const response = await fetch('/api/templates')
        const data = await response.json()
        if (data.templates) {
          setTemplates(data.templates)
        }
      } catch (error) {
        console.error('Erro ao carregar templates:', error)
        toast.error('Erro ao carregar templates')
      } finally {
        setIsLoadingTemplates(false)
      }
    }

    handleDrawerToggle(true)
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isLoadingTemplates}
        className={`transition-colors ${
          numero
            ? 'hover:text-[#25D366] cursor-pointer text-slate-600'
            : 'text-text-tertiary hover:text-text-secondary cursor-not-allowed opacity-50'
        }`}
        title="WhatsApp"
      >
        <MessageCircle size={18} />
      </button>

      {paciente && (
        <SeletorTemplateWhatsApp
          isOpen={isDrawerOpen}
          onClose={() => handleDrawerToggle(false)}
          paciente={paciente}
          templates={templates}
        />
      )}
    </>
  )
}