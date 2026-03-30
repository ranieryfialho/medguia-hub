'use client'

import { useActionState, useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { adicionarObservacao } from '@/actions/pacientes'
import { X, Plus } from 'lucide-react'
import toast from 'react-hot-toast'

export function FormNovaObservacao({ pacienteId }: { pacienteId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(adicionarObservacao, null)
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
      toast.success('Observação adicionada com sucesso!')
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

  const BotaoAbrir = (
    <button 
      onClick={() => setIsOpen(true)}
      className="p-1.5 bg-[#006b5a]/10 text-[#006b5a] hover:bg-[#006b5a] hover:text-white rounded-md transition-colors"
      title="Adicionar Nova Observação"
    >
      <Plus size={16} />
    </button>
  );

  if (!portalNode) return BotaoAbrir;

  return (
    <>
      {BotaoAbrir}

      {isOpen && createPortal(
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-5 duration-300">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-bold text-[#006b5a]">Nova Observação Clínica</h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                <X size={20} />
              </button>
            </div>

            <form ref={formRef} action={formAction} className="p-6">
              <input type="hidden" name="paciente_id" value={pacienteId} />
              
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Descreva a observação</label>
                  <textarea 
                    name="nova_observacao" 
                    required 
                    rows={5} 
                    placeholder="Ex: Paciente relatou melhora na dor ao acordar..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#33A68F]/50 focus:border-[#33A68F] transition-all resize-none text-slate-700"
                  ></textarea>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button 
                    type="button" 
                    onClick={() => setIsOpen(false)}
                    className="px-5 py-2.5 text-slate-600 text-sm font-medium hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={isPending}
                    className="px-5 py-2.5 bg-[#006b5a] hover:bg-[#005143] text-white text-sm font-bold rounded-lg transition-all disabled:opacity-70 shadow-md shadow-[#006b5a]/20"
                  >
                    {isPending ? 'Salvando...' : 'Adicionar'}
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