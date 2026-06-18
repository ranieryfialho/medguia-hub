'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CheckCircle, XCircle, Phone, RefreshCw, MessageCircle, MessageSquare, Mail, User, Loader2 } from 'lucide-react'
import type { EventoAuditoria, TipoAuditoria } from '@/actions/confirmacoes-auditoria'

const ICONES: Record<TipoAuditoria, React.ElementType> = {
  status_alterado: CheckCircle,
  whatsapp_enviado: MessageCircle,
  sms_enviado: MessageSquare,
  email_enviado: Mail,
}

const CORES: Record<TipoAuditoria, string> = {
  status_alterado: 'text-emerald-600 bg-emerald-50',
  whatsapp_enviado: 'text-green-600 bg-green-50',
  sms_enviado: 'text-blue-600 bg-blue-50',
  email_enviado: 'text-purple-600 bg-purple-50',
}

const LINHA: Record<TipoAuditoria, string> = {
  status_alterado: 'bg-emerald-200',
  whatsapp_enviado: 'bg-green-200',
  sms_enviado: 'bg-blue-200',
  email_enviado: 'bg-purple-200',
}

function iconeStatus(descricao: string): React.ElementType {
  if (descricao.includes('Vai faltar')) return XCircle
  if (descricao.includes('Não atendeu')) return Phone
  if (descricao.includes('Reagendou')) return RefreshCw
  return CheckCircle
}

type Props = {
  eventos: EventoAuditoria[]
  compact?: boolean
}

export function AuditoriaTimeline({ eventos, compact = false }: Props) {
  if (eventos.length === 0) {
    return (
      <p className="text-sm text-text-secondary italic py-2">
        Nenhuma ação registrada para este atendimento.
      </p>
    )
  }

  return (
    <div className="space-y-0">
      {eventos.map((evento, idx) => {
        const Icone = evento.tipo === 'status_alterado'
          ? iconeStatus(evento.descricao)
          : ICONES[evento.tipo]
        const cor = CORES[evento.tipo]
        const isLast = idx === eventos.length - 1

        return (
          <div key={evento.id} className="flex gap-3">
            {/* Linha vertical + ícone */}
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${cor}`}>
                <Icone size={14} />
              </div>
              {!isLast && (
                <div className={`w-px flex-1 mt-1 mb-1 min-h-[16px] ${LINHA[evento.tipo]}`} />
              )}
            </div>

            {/* Conteúdo */}
            <div className={`flex-1 min-w-0 ${isLast ? '' : 'pb-3'}`}>
              <p className={`font-medium text-text-primary ${compact ? 'text-xs' : 'text-sm'}`}>
                {evento.descricao}
              </p>
              <div className={`flex items-center gap-2 mt-0.5 text-text-secondary ${compact ? 'text-[10px]' : 'text-xs'}`}>
                <span>
                  {format(new Date(evento.criado_em), "dd/MM 'às' HH:mm", { locale: ptBR })}
                </span>
                {evento.usuario_nome && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <User size={10} />
                      {evento.usuario_nome}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

type AsyncProps = {
  atendimentoId: string
  buscar: (id: string) => Promise<EventoAuditoria[]>
  compact?: boolean
}

export function AuditoriaTimelineAsync({ atendimentoId, buscar, compact }: AsyncProps) {
  const [eventos, setEventos] = useState<EventoAuditoria[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    buscar(atendimentoId).then(data => {
      setEventos(data)
      setCarregando(false)
    })
  }, [atendimentoId, buscar])

  if (carregando) {
    return (
      <div className="flex items-center gap-2 py-3 text-text-secondary text-sm">
        <Loader2 size={14} className="animate-spin" />
        Carregando...
      </div>
    )
  }

  return <AuditoriaTimeline eventos={eventos} compact={compact} />
}