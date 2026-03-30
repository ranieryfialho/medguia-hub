'use client'

import { MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export function BtnWhatsApp({ numero }: { numero: string }) {
  const handleClick = (e: React.MouseEvent) => {
    // Se não tiver número, impede de abrir a aba e mostra o erro
    if (!numero) {
      e.preventDefault()
      toast.error('Paciente sem número cadastrado')
    }
  }

  const link = numero ? `https://wa.me/55${numero}` : '#'

  return (
    <a 
      href={link} 
      target="_blank" 
      rel="noopener noreferrer"
      className={`transition-colors ${numero ? 'hover:text-[#25D366]' : 'text-text-tertiary hover:text-text-secondary cursor-not-allowed'}`}
      title="WhatsApp"
      onClick={handleClick}
    >
      <MessageCircle size={18} />
    </a>
  )
}