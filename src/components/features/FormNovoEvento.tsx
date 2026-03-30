'use client'

import { useActionState, useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { criarEvento } from '@/actions/eventos' 
import { X } from 'lucide-react'
import toast from 'react-hot-toast'

export function FormNovoEvento({ pacienteId }: { pacienteId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(criarEvento, null)
  const formRef = useRef<HTMLFormElement>(null)
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let element = document.getElementById('modal-portal');
    if (!element) {
      element = document.createElement('div');
      element.id = 'modal-portal';
      document.body.appendChild(element);
    }
    setPortalNode(element);
  }, []);

  useEffect(() => {
    if (state?.error) toast.error(state.error)
    if (state?.success) {
      toast.success('Evento adicionado à linha do tempo!')
      setIsOpen(false)
      formRef.current?.reset()
    }
  }, [state])

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => { if (event.key === 'Escape') setIsOpen(false); };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { window.removeEventListener('keydown', handleEsc); document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!portalNode) {
     return (
       <button onClick={() => setIsOpen(true)} className="px-5 py-2 bg-gradient-to-br from-[#006b5a] to-[#33A68F] text-white text-sm font-bold rounded-full shadow-md shadow-[#006b5a]/20 hover:scale-[0.98] transition-transform">
         + Novo Evento
       </button>
     );
  }

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="px-5 py-2 bg-gradient-to-br from-[#006b5a] to-[#33A68F] text-white text-sm font-bold rounded-full shadow-md shadow-[#006b5a]/20 hover:scale-[0.98] transition-transform">
        + Novo Evento
      </button>

      {isOpen && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-5 duration-300">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-bold text-[#006b5a]">Adicionar à Jornada</h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                <X size={20} />
              </button>
            </div>

            <form ref={formRef} action={formAction} className="p-6">
              <input type="hidden" name="paciente_id" value={pacienteId} />
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Fase / Status Atual</label>
                  <select name="status" required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#33A68F]/50 focus:border-[#33A68F] transition-all text-slate-700">
                    <option value="aguardando_avaliacao">⏳ Aguardando Avaliação</option>
                    <option value="em_avaliacao">📊 Em Avaliação</option>
                    <option value="proposta_enviada">📄 Proposta Enviada</option>
                    <option value="tratamento_ativo">✅ Tratamento Ativo</option>
                    <option value="pausado">⏸️ Pausado</option>
                    <option value="alta">🌟 Alta / Finalizado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Título do Evento</label>
                  <input 
                    type="text" 
                    name="titulo" 
                    required 
                    placeholder="Ex: Início do Ciclo de Fisioterapia"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#33A68F]/50 focus:border-[#33A68F] transition-all text-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Observação Detalhada</label>
                  <textarea 
                    name="observacao" 
                    required 
                    rows={3} 
                    placeholder="Descreva o que aconteceu neste evento..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#33A68F]/50 focus:border-[#33A68F] transition-all resize-none"
                  ></textarea>
                </div>

                <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-slate-100">
                  <button type="button" onClick={() => setIsOpen(false)} className="px-5 py-2.5 text-slate-600 text-sm font-medium hover:bg-slate-100 rounded-lg transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" disabled={isPending} className="px-5 py-2.5 bg-gradient-to-br from-[#006b5a] to-[#33A68F] hover:from-[#005143] hover:to-[#006b5a] text-white text-sm font-bold rounded-lg transition-all disabled:opacity-70 shadow-md shadow-[#006b5a]/20">
                    {isPending ? 'Salvando...' : 'Registrar Evento'}
                  </button>
                </div>
              </div>
            </form>

          </div>
        </div>,
        portalNode
      )}
    </>
  )
}