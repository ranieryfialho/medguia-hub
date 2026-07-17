'use client'

import { useEffect, useState } from 'react'
import { Loader2, User, Clock, Tag } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { buscarContatoPaciente } from '@/actions/contatos'
import { ObservacoesTagSection } from './ObservacoesTagSection'

const STATUS_CONFIG: Record<string, { label: string; cor: string }> = {
  a_contactar:      { label: 'A Contatar',           cor: 'bg-slate-100 text-slate-600' },
  recuperacao_base: { label: 'Recuperação de Base',   cor: 'bg-indigo-100 text-indigo-700' },
  tentativa:        { label: 'Tentativa',             cor: 'bg-amber-100 text-amber-700' },
  em_conversa:      { label: 'Em Conversa',           cor: 'bg-teal-100 text-teal-700' },
  sem_interesse:    { label: 'Sem Interesse',         cor: 'bg-red-100 text-red-700' },
  agendou:          { label: 'Agendou',               cor: 'bg-emerald-100 text-emerald-700' },
}

const isAutoNote = (texto: string) => {
  const t = texto.toLowerCase()
  return t.startsWith('status alterado para:') || t.startsWith('etapa alterada para:')
}

export function TabContatosPaciente({ pacienteId }: { pacienteId: string }) {
  const [dados, setDados] = useState<Awaited<ReturnType<typeof buscarContatoPaciente>> | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    buscarContatoPaciente(pacienteId).then((r) => {
      setDados(r)
      setCarregando(false)
    })
  }, [pacienteId])

  if (carregando) return (
    <div className="flex items-center justify-center py-16 text-sm text-[#6d7a75]">
      <Loader2 size={20} className="animate-spin mr-2" />Carregando...
    </div>
  )

  if (!dados?.contato) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <Tag size={32} className="text-slate-200" />
      <p className="text-sm font-semibold text-[#3d4945]">Paciente não está na base de contatos</p>
      <p className="text-xs text-[#6d7a75]">Adicione-o em <a href="/contatos" className="text-[#006b5a] hover:underline">/contatos</a> para iniciar o acompanhamento.</p>
    </div>
  )

  const { contato, notas } = dados
  const statusCfg = STATUS_CONFIG[contato.status] ?? { label: contato.status, cor: 'bg-slate-100 text-slate-600' }
  const manuais = notas.filter(n => !isAutoNote(n.texto))
  const automaticas = notas.filter(n => isAutoNote(n.texto))

  return (
    <div className="space-y-6">
      {/* Status card */}
      <div className="flex flex-wrap gap-4 p-4 bg-[#f0faf8] rounded-xl border border-[#c3ede6]">
        <div className="flex items-center gap-2">
          <Tag size={14} className="text-[#006b5a]" />
          <span className="text-xs text-[#6d7a75] font-medium">Status</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusCfg.cor}`}>
            {statusCfg.label}
          </span>
        </div>
        {contato.responsavel_nome && (
          <div className="flex items-center gap-2">
            <User size={14} className="text-[#006b5a]" />
            <span className="text-xs text-[#6d7a75] font-medium">Responsável</span>
            <span className="text-xs font-semibold text-[#083142]">{contato.responsavel_nome}</span>
          </div>
        )}
        {contato.ultima_atividade && (
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-[#006b5a]" />
            <span className="text-xs text-[#6d7a75] font-medium">Última atividade</span>
            <span className="text-xs font-semibold text-[#083142]">
              {formatDistanceToNow(new Date(contato.ultima_atividade), { addSuffix: true, locale: ptBR })}
            </span>
          </div>
        )}
      </div>

      {/* Notas manuais */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-[#083142]">
          Anotações do card
          <span className="ml-2 text-xs font-normal text-[#6d7a75]">{manuais.length} registro{manuais.length !== 1 ? 's' : ''}</span>
        </h4>
        {manuais.length === 0 ? (
          <p className="text-xs text-[#6d7a75] italic">Nenhuma anotação manual registrada.</p>
        ) : (
          <div className="relative pl-5">
            <div className="absolute left-[7px] top-1 bottom-1 w-px bg-[#dee3e3]" />
            {[...manuais].reverse().map((nota) => (
              <div key={nota.id} className="relative mb-4 last:mb-0">
                <span className="absolute -left-5 top-1.5 w-2.5 h-2.5 rounded-full bg-[#006b5a] border-2 border-white" />
                <div className="bg-white border border-[#dee3e3] rounded-xl px-4 py-3">
                  <p className="text-xs text-[#083142] leading-relaxed whitespace-pre-wrap">{nota.texto}</p>
                  <p className="text-[10px] text-[#6d7a75] mt-1.5">
                    {format(new Date(nota.criado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    {nota.autor_nome && <> · {nota.autor_nome}</>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mudanças de status */}
      {automaticas.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-[#083142]">
            Histórico de movimentações
            <span className="ml-2 text-xs font-normal text-[#6d7a75]">{automaticas.length} evento{automaticas.length !== 1 ? 's' : ''}</span>
          </h4>
          <div className="divide-y divide-[#f0f5f4]">
            {[...automaticas].reverse().map((nota) => (
              <div key={nota.id} className="flex items-start gap-3 py-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#bcc9c4] mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#6d7a75]">{nota.texto}</p>
                  <p className="text-[10px] text-[#9BB0AD]">
                    {format(new Date(nota.criado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    {nota.autor_nome && <> · {nota.autor_nome}</>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ObservacoesTagSection pacienteId={pacienteId} tag="contatos" />
    </div>
  )
}
