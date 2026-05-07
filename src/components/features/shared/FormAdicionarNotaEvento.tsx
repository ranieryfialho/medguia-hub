'use client'

import { useActionState, useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { adicionarNotaEvento } from '@/actions/eventos'
import { X, MessageSquarePlus } from 'lucide-react'
import toast from 'react-hot-toast'

export function FormAdicionarNotaEvento({ eventoId, pacienteId }: { eventoId: string, pacienteId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(adicionarNotaEvento, null)
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
      toast.success('Nota adicionada ao evento!')
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
      className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-[#006b5a] transition-colors bg-slate-50 hover:bg-emerald-50 px-2.5 py-1 rounded-md border border-slate-100"
      title="Adicionar nota a este evento"
    >
      <MessageSquarePlus size={14} />
      <span>Adicionar nota</span>
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
              <h3 className="text-lg font-bold text-[#006b5a]">Adicionar Nota ao Evento</h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                <X size={20} />
              </button>
            </div>

            <form ref={formRef} action={formAction} className="p-6">
              <input type="hidden" name="evento_id" value={eventoId} />
              <input type="hidden" name="paciente_id" value={pacienteId} />
              
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Nova Nota / Acompanhamento</label>
                  <textarea 
                    name="nova_nota" 
                    required 
                    rows={4} 
                    placeholder="Ex: Tentei contato hoje, mas não atendeu..."
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
                    {isPending ? 'Salvando...' : 'Salvar Nota'}
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