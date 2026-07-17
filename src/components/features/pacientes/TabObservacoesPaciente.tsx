'use client'

import { useEffect, useState } from 'react'
import { Loader2, StickyNote, FileText, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { listarObservacoesPaciente, type ObservacaoPaciente } from '@/actions/pacientes'
import { FormNovaObservacao } from '@/components/features/prontuarios/FormNovaObservacao'

type TagConfig = { label: string; active: string; badge: string }

const TAG_CONFIG: Record<string, TagConfig> = {
  geral:         { label: 'Geral',        active: 'bg-slate-600 text-white',   badge: 'bg-slate-100 text-slate-600' },
  agendamentos:  { label: 'Agendamentos', active: 'bg-teal-600 text-white',    badge: 'bg-teal-50 text-teal-700' },
  comercial:     { label: 'Comercial',    active: 'bg-blue-600 text-white',    badge: 'bg-blue-50 text-blue-700' },
  contatos:      { label: 'Contatos',     active: 'bg-purple-600 text-white',  badge: 'bg-purple-50 text-purple-700' },
  followups:     { label: 'Follow-ups',   active: 'bg-amber-500 text-white',   badge: 'bg-amber-50 text-amber-700' },
}

const FILTER_TABS = [{ id: 'todos', label: 'Todas' }, ...Object.entries(TAG_CONFIG).map(([id, c]) => ({ id, label: c.label }))]

function AnexoPreview({ obs }: { obs: ObservacaoPaciente }) {
  if (!obs.google_drive_file_id) return null
  const isImage = obs.google_drive_file_mime?.startsWith('image/')
  const isPdf = obs.google_drive_file_mime === 'application/pdf'

  return (
    <a
      href={obs.google_drive_file_url ?? `/api/drive/file/${obs.google_drive_file_id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex items-center gap-2 w-fit"
    >
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/drive/file/${obs.google_drive_file_id}`}
          alt={obs.google_drive_file_nome ?? 'Anexo'}
          className="h-20 rounded-lg object-cover border border-slate-200 hover:opacity-90 transition-opacity"
        />
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">
          <FileText size={14} className={isPdf ? 'text-red-500' : 'text-slate-500'} />
          <span className="text-xs text-slate-700 max-w-[200px] truncate">{obs.google_drive_file_nome}</span>
          <ExternalLink size={11} className="text-slate-400 shrink-0" />
        </div>
      )}
    </a>
  )
}

export function TabObservacoesPaciente({ pacienteId, nomePaciente }: { pacienteId: string; nomePaciente: string }) {
  const [observacoes, setObservacoes] = useState<ObservacaoPaciente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtroTag, setFiltroTag] = useState('todos')

  useEffect(() => {
    listarObservacoesPaciente(pacienteId).then((data) => {
      setObservacoes(data)
      setCarregando(false)
    })
  }, [pacienteId])

  const filtradas = filtroTag === 'todos' ? observacoes : observacoes.filter(o => o.tag === filtroTag)

  if (carregando) return (
    <div className="flex items-center justify-center py-16 text-sm text-[#6d7a75]">
      <Loader2 size={20} className="animate-spin mr-2" />Carregando...
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-[#6d7a75]">
          {observacoes.length} observação{observacoes.length !== 1 ? 'ões' : ''} registrada{observacoes.length !== 1 ? 's' : ''}
        </p>
        <FormNovaObservacao pacienteId={pacienteId} nomePaciente={nomePaciente} />
      </div>

      {/* Filter pills */}
      {observacoes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {FILTER_TABS.map(({ id, label }) => {
            const count = id === 'todos' ? observacoes.length : observacoes.filter(o => o.tag === id).length
            if (id !== 'todos' && count === 0) return null
            const cfg = id === 'todos' ? null : TAG_CONFIG[id]
            return (
              <button
                key={id}
                onClick={() => setFiltroTag(id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  filtroTag === id
                    ? (cfg ? cfg.active : 'bg-[#006b5a] text-white') + ' border-transparent'
                    : 'bg-white text-[#6d7a75] border-[#dee3e3] hover:border-[#006b5a] hover:text-[#006b5a]'
                }`}
              >
                {label}
                <span className={`text-[10px] px-1 rounded-full ${filtroTag === id ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Lista */}
      {filtradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <StickyNote size={32} className="text-slate-200" />
          <p className="text-sm font-semibold text-[#3d4945]">
            {filtroTag === 'todos' ? 'Nenhuma observação registrada.' : `Nenhuma observação em "${TAG_CONFIG[filtroTag]?.label}".`}
          </p>
        </div>
      ) : (
        <div className="relative pl-5">
          <div className="absolute left-[7px] top-1 bottom-1 w-px bg-[#dee3e3]" />
          {filtradas.map((obs) => {
            const cfg = TAG_CONFIG[obs.tag] ?? TAG_CONFIG.geral
            return (
              <div key={obs.id} className="relative mb-4 last:mb-0">
                <span className="absolute -left-5 top-1.5 w-2.5 h-2.5 rounded-full bg-[#006b5a] border-2 border-white" />
                <div className="bg-white border border-[#dee3e3] rounded-xl px-4 py-3 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                    <span className="text-[10px] text-[#6d7a75]">
                      {format(new Date(obs.criado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      {obs.autor_nome && <> · {obs.autor_nome}</>}
                    </span>
                  </div>
                  {obs.texto && (
                    <p className="text-sm text-[#083142] leading-relaxed">{obs.texto}</p>
                  )}
                  <AnexoPreview obs={obs} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}