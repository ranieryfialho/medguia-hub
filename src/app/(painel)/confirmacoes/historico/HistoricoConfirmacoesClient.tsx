'use client'

import { useState, useTransition } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CheckCircle, XCircle, Phone, RefreshCw, MessageCircle, MessageSquare, Mail, User, Filter, Loader2 } from 'lucide-react'
import { buscarAuditoriaGeral } from '@/actions/confirmacoes-auditoria'
import type { EventoAuditoriaGeral, TipoAuditoria } from '@/actions/confirmacoes-auditoria'

const TIPOS: { valor: TipoAuditoria | ''; label: string }[] = [
  { valor: '', label: 'Todos' },
  { valor: 'status_alterado', label: 'Status' },
  { valor: 'whatsapp_enviado', label: 'WhatsApp' },
  { valor: 'sms_enviado', label: 'SMS' },
  { valor: 'email_enviado', label: 'Email' },
]

function iconeEvento(tipo: TipoAuditoria, descricao: string) {
  if (tipo === 'status_alterado') {
    if (descricao.includes('Vai faltar')) return { Icon: XCircle, cor: 'text-red-600 bg-red-50' }
    if (descricao.includes('Não atendeu')) return { Icon: Phone, cor: 'text-orange-600 bg-orange-50' }
    if (descricao.includes('Reagendou')) return { Icon: RefreshCw, cor: 'text-slate-600 bg-slate-100' }
    return { Icon: CheckCircle, cor: 'text-emerald-600 bg-emerald-50' }
  }
  if (tipo === 'whatsapp_enviado') return { Icon: MessageCircle, cor: 'text-green-600 bg-green-50' }
  if (tipo === 'sms_enviado') return { Icon: MessageSquare, cor: 'text-blue-600 bg-blue-50' }
  return { Icon: Mail, cor: 'text-purple-600 bg-purple-50' }
}

export function HistoricoConfirmacoesClient({ eventosIniciais }: { eventosIniciais: EventoAuditoriaGeral[] }) {
  const [eventos, setEventos] = useState(eventosIniciais)
  const [tipoFiltro, setTipoFiltro] = useState<TipoAuditoria | ''>('')
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    return d.toISOString().split('T')[0]
  })
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().split('T')[0])
  const [pending, startTransition] = useTransition()

  const aplicarFiltros = () => {
    startTransition(async () => {
      const data = await buscarAuditoriaGeral({
        tipo: tipoFiltro || undefined,
        data_inicio: dataInicio ? `${dataInicio}T00:00:00` : undefined,
        data_fim: dataFim ? `${dataFim}T23:59:59` : undefined,
      })
      setEventos(data)
    })
  }

  const eventosFiltrados = tipoFiltro
    ? eventos.filter(e => e.tipo === tipoFiltro)
    : eventos

  // Agrupa por dia
  const porDia = eventosFiltrados.reduce<Record<string, EventoAuditoriaGeral[]>>((acc, e) => {
    const dia = e.criado_em.split('T')[0]
    if (!acc[dia]) acc[dia] = []
    acc[dia].push(e)
    return acc
  }, {})

  const dias = Object.keys(porDia).sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">De</label>
          <input
            type="date"
            value={dataInicio}
            onChange={e => setDataInicio(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#006b5a]/30"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Até</label>
          <input
            type="date"
            value={dataFim}
            onChange={e => setDataFim(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#006b5a]/30"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Tipo</label>
          <select
            value={tipoFiltro}
            onChange={e => setTipoFiltro(e.target.value as TipoAuditoria | '')}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#006b5a]/30"
          >
            {TIPOS.map(t => <option key={t.valor} value={t.valor}>{t.label}</option>)}
          </select>
        </div>
        <button
          onClick={aplicarFiltros}
          disabled={pending}
          className="flex items-center gap-2 px-4 py-2 bg-[#006b5a] hover:bg-[#005548] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Filter size={14} />}
          Filtrar
        </button>
        <span className="text-xs text-slate-400 self-end pb-1">
          {eventosFiltrados.length} {eventosFiltrados.length === 1 ? 'evento' : 'eventos'}
        </span>
      </div>

      {/* Lista agrupada por dia */}
      {dias.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-100 shadow-sm">
          <p className="text-slate-400 font-medium">Nenhum evento encontrado</p>
          <p className="text-sm text-slate-300 mt-1">Ajuste os filtros ou aguarde as primeiras ações serem registradas</p>
        </div>
      ) : (
        dias.map(dia => {
          const eventosNoDia = porDia[dia]
          const dataFormatada = format(new Date(`${dia}T12:00:00`), "EEEE, dd 'de' MMMM", { locale: ptBR })

          return (
            <div key={dia} className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1 capitalize">
                {dataFormatada}
              </p>
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-50">
                {eventosNoDia.map(evento => {
                  const { Icon, cor } = iconeEvento(evento.tipo, evento.descricao)
                  const pacienteNome = evento.atendimento?.paciente?.nome ?? '—'

                  return (
                    <div key={evento.id} className="flex items-start gap-3 px-4 py-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${cor}`}>
                        <Icon size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{pacienteNome}</p>
                            <p className="text-xs text-slate-500">{evento.descricao}</p>
                          </div>
                          <span className="text-xs text-slate-400 shrink-0 mt-0.5">
                            {format(new Date(evento.criado_em), 'HH:mm')}
                          </span>
                        </div>
                        {evento.usuario_nome && (
                          <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <User size={10} />
                            {evento.usuario_nome}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
