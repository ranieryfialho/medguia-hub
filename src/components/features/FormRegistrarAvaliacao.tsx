'use client'

import { useActionState, useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom' // <-- Importante
import { registrarAvaliacao } from '@/actions/atendimentos'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'

export function FormRegistrarAvaliacao({ pacienteId }: { pacienteId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [fechou, setFechou] = useState<string>('')
  
  const [state, formAction, isPending] = useActionState(registrarAvaliacao, null)
  const formRef = useRef<HTMLFormElement>(null)

  // Gerencia o Portal para o Modal
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Cria um container na raiz do body para o modal se não existir
    let element = document.getElementById('modal-portal');
    if (!element) {
      element = document.createElement('div');
      element.id = 'modal-portal';
      document.body.appendChild(element);
    }
    setPortalNode(element);
    
    // Limpa o portal se o modal fechar (preventivo)
    return () => {
      if (!isOpen && element && element.childNodes.length === 0) {
        // element.remove(); // Opcional: remover o div vazio
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (state?.error) toast.error(state.error)
    if (state?.success) {
      toast.success('Avaliação registrada com sucesso!')
      setIsOpen(false)
      setFechou('')
      formRef.current?.reset()
    }
  }, [state])

  // Lógica para fechar com a tecla ESC
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  // Se o Portal não estiver pronto, mostra apenas o botão
  if (!portalNode) {
     return (
       <button 
         onClick={() => setIsOpen(true)}
         className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-full hover:bg-slate-200 transition-colors"
       >
         ✓ Registrar Avaliação
       </button>
     );
  }

  return (
    <>
      {/* Botão que fica no cabeçalho */}
      <button 
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-full hover:bg-slate-200 transition-colors"
      >
        ✓ Registrar Avaliação
      </button>

      {/* O Modal (Só renderiza se isOpen for true E usando o Portal) */}
      {isOpen && createPortal(
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[99999] flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }} // Fecha ao clicar no fundo
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-5 duration-300">
            
            {/* Cabeçalho do Modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-bold text-[#006b5a]">Resultado da Avaliação</h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                <X size={20} />
              </button>
            </div>

            {/* Corpo do Formulário */}
            <form ref={formRef} action={formAction} className="p-6">
              <input type="hidden" name="paciente_id" value={pacienteId} />
              
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">O paciente fechou o tratamento? *</label>
                  <select 
                    name="fechou" 
                    required 
                    value={fechou}
                    onChange={(e) => setFechou(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#33A68F]/50 focus:border-[#33A68F] transition-all"
                  >
                    <option value="">Selecione...</option>
                    <option value="true">✅ Sim, fechou tratamento</option>
                    <option value="false">❌ Não fechou</option>
                  </select>
                </div>

                {/* Motivo de Perda */}
                {fechou === 'false' && (
                  <div className="p-4 bg-red-50/50 rounded-xl border border-red-100">
                    <label className="block text-sm font-bold text-red-900 mb-1.5">Motivo principal da perda *</label>
                    <select 
                      name="motivo_nao_fechamento" 
                      required 
                      className="w-full bg-white border border-red-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 text-slate-700"
                    >
                      <option value="">Selecione o motivo real...</option>
                      <option value="Preço/Valor">Preço / Achou Caro</option>
                      <option value="Distância/Logística">Distância / Logística Difícil</option>
                      <option value="Incompatibilidade de Horário">Incompatibilidade de Horário</option>
                      <option value="Vai pensar/Falar com familiar">Vai pensar / Falar com familiar</option>
                      <option value="Não tem perfil clínico">Não tem perfil clínico para a clínica</option>
                      <option value="Outro">Outro motivo</option>
                    </select>
                  </div>
                )}

                {/* Rodapé do Modal (Botões) */}
                <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-slate-100">
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
                    {isPending ? 'Salvando...' : 'Salvar Resultado'}
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