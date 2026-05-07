'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Activity, PauseCircle, FileText, Hourglass, CheckCircle2 } from 'lucide-react'
import { FormAdicionarNotaEvento } from './FormAdicionarNotaEvento'

const getStatusConfig = (status: string) => {
  switch(status) {
    case 'tratamento_ativo': return { color: 'text-[#33A68F]', bg: 'bg-[#33A68F]/10', border: 'border-[#33A68F]', icon: Activity, label: 'Tratamento Ativo' }
    case 'pausado': return { color: 'text-amber-500', bg: 'bg-amber-100', border: 'border-amber-500', icon: PauseCircle, label: 'Pausado' }
    case 'em_avaliacao': return { color: 'text-blue-500', bg: 'bg-blue-100', border: 'border-blue-500', icon: FileText, label: 'Em Avaliação' }
    case 'aguardando_avaliacao': return { color: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-400', icon: Hourglass, label: 'Aguardando' }
    case 'alta': return { color: 'text-[#25D366]', bg: 'bg-[#25D366]/10', border: 'border-[#25D366]', icon: CheckCircle2, label: 'Alta / Finalizado' }
    default: return { color: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-400', icon: Activity, label: status }
  }
}

export function CartaoEvento({ evento, pacienteId }: { evento: any, pacienteId: string }) {
  const [expanded, setExpanded] = useState(false)
  const config = getStatusConfig(evento.status)
  const Icone = config.icon

  const rawObs = evento.observacao || ''
  const parts = rawObs.split('\n\n• [')
  
  const observacaoPrincipal = parts[0]
  
  const notasAdicionais = parts.length > 1 
    ? parts.slice(1).map((notaStr: string) => {
        const fechamentoBracket = notaStr.indexOf(']')
        if (fechamentoBracket !== -1) {
          return {
            data: notaStr.substring(0, fechamentoBracket),
            texto: notaStr.substring(fechamentoBracket + 1).trim()
          }
        }
        return { data: 'Data desc.', texto: notaStr }
      })
    : []

  const qtdNotas = notasAdicionais.length

  return (
    <div className="relative mb-6 last:mb-0 animate-in fade-in duration-300">
      <div className={`absolute -left-[10px] md:-left-[10px] top-0 w-10 h-10 rounded-full ${config.bg} flex items-center justify-center border-4 border-white z-10 shadow-sm`}>
        <Icone size={18} className={config.color} />
      </div>

      <div className={`ml-10 md:ml-12 bg-white rounded-xl p-4 shadow-sm border border-slate-100 border-l-4 ${config.border} flex flex-col transition-all`}>
        
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <span className={`px-2 py-0.5 ${config.bg} ${config.color} text-[10px] font-extrabold rounded uppercase tracking-wider`}>
            {config.label}
          </span>
          
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500">
              {format(new Date(evento.created_at), "dd MMM, yyyy • HH:mm", { locale: ptBR })}
            </span>
            
            <div className="flex items-center gap-1.5">
              <div 
                className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-sm"
                title={`Registrado por ${evento.responsavel?.full_name || 'Usuário'}`}
              >
                {evento.responsavel?.full_name?.charAt(0) || 'U'}
              </div>
              
              {qtdNotas > 0 && (
                <button 
                  onClick={() => setExpanded(!expanded)}
                  className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold transition-colors shadow-sm ${
                    expanded 
                      ? 'bg-[#006b5a] text-white border-[#006b5a]' 
                      : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                  }`}
                  title={expanded ? "Esconder notas" : "Ver notas adicionais"}
                >
                  +{qtdNotas}
                </button>
              )}
            </div>
          </div>
        </div>

        <h5 className="font-bold text-slate-900 mb-0.5 text-[15px]">
          {evento.titulo || `Registro de ${evento.status.replace(/_/g, ' ')}`}
        </h5>
        
        <p className="text-sm text-slate-600 mb-2 whitespace-pre-wrap leading-relaxed">{observacaoPrincipal}</p>

        {expanded && qtdNotas > 0 && (
          <div className="mt-1 mb-3 p-3 bg-slate-50/80 rounded-lg border border-slate-100 space-y-3 animate-in slide-in-from-top-2 duration-200">
            <h6 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-4 h-[1px] bg-slate-200"></span> Notas e Atualizações
            </h6>
            
            {notasAdicionais.map((nota: any, i: number) => (
              <div key={i} className="flex gap-3 text-sm">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-slate-300 mt-1.5"></div>
                  {i !== notasAdicionais.length - 1 && <div className="w-px h-full bg-slate-200"></div>}
                </div>
                <div className="flex flex-col pb-2">
                  <span className="text-[10px] font-bold text-[#006b5a] mb-0.5">{nota.data}</span>
                  <span className="text-slate-700 leading-relaxed">{nota.texto}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end mt-1 pt-2 border-t border-slate-50">
          <FormAdicionarNotaEvento eventoId={evento.id} pacienteId={pacienteId} />
        </div>
      </div>
    </div>
  )
}