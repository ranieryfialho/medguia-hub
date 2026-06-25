'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ClipboardList, User, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react'
import { ModalFollowUp } from './ModalFollowUp'
import { BotaoConcluirFollowUp } from './BotaoConcluirFollowUp'
import type { FollowUp, FollowUpTipo } from '@/actions/follow-ups'

type Profissional = { id: string; full_name: string }

type Props = {
  pacienteId: string
  followUps: FollowUp[]
  tipos: FollowUpTipo[]
  profissionais: Profissional[]
}

const PREVIEW_COUNT = 3

export function SecaoFollowUpsPaciente({ pacienteId, followUps: inicial, tipos, profissionais }: Props) {
  const [followUps] = useState(inicial)
  const [expandido, setExpandido] = useState(false)

  const pendentes = followUps.filter(fu => fu.status === 'pendente')
  const visiveis = expandido ? followUps : followUps.slice(0, PREVIEW_COUNT)
  const temMais = followUps.length > PREVIEW_COUNT

  function handleConcluido() {
    window.location.reload()
  }

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <ClipboardList size={16} className="text-[#006b5a]" />
          Follow-ups
          {pendentes.length > 0 && (
            <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
              {pendentes.length} pendente{pendentes.length !== 1 ? 's' : ''}
            </span>
          )}
          {followUps.length > 0 && pendentes.length === 0 && (
            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full">
              {followUps.length} concluído{followUps.length !== 1 ? 's' : ''}
            </span>
          )}
        </h4>
        <ModalFollowUp
          pacienteId={pacienteId}
          tipos={tipos}
          profissionais={profissionais}
          onSuccess={() => window.location.reload()}
        />
      </div>

      {visiveis.length === 0 ? (
        <p className="text-xs text-slate-400 italic">Nenhum follow-up registrado.</p>
      ) : (
        <ul className="space-y-2">
          {visiveis.map(fu => {
            const tipo = fu.tipo as { id: string; nome: string; cor: string | null } | null
            const responsavel = fu.responsavel as { id: string; full_name: string } | null
            const isPendente = fu.status === 'pendente'

            return (
              <li key={fu.id} className={`rounded-lg p-3 border transition-colors ${isPendente ? 'bg-slate-50 border-slate-100' : 'bg-emerald-50/40 border-emerald-100/60'}`}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {tipo && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={tipo.cor
                            ? { backgroundColor: `${tipo.cor}20`, color: tipo.cor }
                            : { backgroundColor: 'rgb(0 107 90 / 0.1)', color: '#006b5a' }
                          }
                        >
                          {tipo.nome}
                        </span>
                      )}
                      {!isPendente && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-600">
                          <CheckCircle2 size={10} />
                          Concluído
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400">
                        {format(new Date(fu.created_at), "dd/MM/yy · HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    {fu.descricao && (
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">{fu.descricao}</p>
                    )}
                    {responsavel && (
                      <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                        <User size={9} />
                        {responsavel.full_name}
                      </p>
                    )}
                  </div>
                  {isPendente && (
                    <BotaoConcluirFollowUp id={fu.id} onSuccess={handleConcluido} />
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {temMais && (
        <button
          onClick={() => setExpandido(v => !v)}
          className="mt-2 w-full flex items-center justify-center gap-1 text-xs text-[#006b5a] hover:underline"
        >
          {expandido ? (
            <><ChevronUp size={12} /> Ver menos</>
          ) : (
            <><ChevronDown size={12} /> Ver mais {followUps.length - PREVIEW_COUNT} follow-up{followUps.length - PREVIEW_COUNT !== 1 ? 's' : ''}</>
          )}
        </button>
      )}
    </div>
  )
}