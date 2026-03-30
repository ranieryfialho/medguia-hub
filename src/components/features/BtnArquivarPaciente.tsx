'use client'

import { Archive } from 'lucide-react'
import { arquivarPaciente } from '@/actions/pacientes'
import toast from 'react-hot-toast'

export function BtnArquivarPaciente({ id, nome }: { id: string; nome: string }) {
  const handleArchive = async () => {
    const confirmacao = window.confirm(`Deseja arquivar o paciente ${nome}? Ele ficará oculto da listagem principal.`)
    
    if (confirmacao) {
      const loadingToast = toast.loading('Arquivando...')
      const res = await arquivarPaciente(id)
      
      if (res?.error) {
        toast.error(res.error, { id: loadingToast })
      } else {
        toast.success('Paciente arquivado com sucesso!', { id: loadingToast })
      }
    }
  }

  return (
    <button 
      onClick={handleArchive} 
      className="hover:text-warning transition-colors" 
      title="Arquivar Paciente"
    >
      <Archive size={18} />
    </button>
  )
}