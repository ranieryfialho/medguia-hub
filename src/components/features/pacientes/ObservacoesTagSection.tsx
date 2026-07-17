'use client'

import { useEffect, useState } from 'react'
import { StickyNote, ExternalLink, FileText, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { listarObservacoesPaciente, type ObservacaoPaciente } from '@/actions/pacientes'

const TAG_BADGE: Record<string, string> = {
  agendamentos: 'bg-teal-50 text-teal-700',
  comercial:    'bg-blue-50 text-blue-700',
  contatos:     'bg-purple-50 text-purple-700',
  followups:    'bg-amber-50 text-amber-700',
  geral:        'bg-slate-100 text-slate-600',
}

function AnexoInline({ obs }: { obs: ObservacaoPaciente }) {
  if (!obs.google_drive_file_id) return null
  const isImage = obs.google_drive_file_mime?.startsWith('image/')
  const isPdf = obs.google_drive_file_mime === 'application/pdf'
  return (
    <a
      href={obs.google_drive_file_url ?? `/api/drive/file/${obs.google_drive_file_id}`}
      target="_blank" rel="noopener noreferrer"
      className="mt-1.5 flex items-center gap-1.5 w-fit"
    >
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/drive/file/${obs.google_drive_file_id}`} alt={obs.google_drive_file_nome ?? 'Anexo'}
          className="h-14 rounded-lg object-cover border border-slate-200 hover:opacity-80 transition-opacity" />
      ) : (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 text-xs text-slate-600">
          <FileText size={12} className={isPdf ? 'text-red-400' : 'text-slate-400'} />
          <span className="max-w-[180px] truncate">{obs.google_drive_file_nome}</span>
          <ExternalLink size={10} className="shrink-0 text-slate-400" />
        </div>
      )}
    </a>
  )
}

type Props = { pacienteId: string; tag: string }

export function ObservacoesTagSection({ pacienteId, tag }: Props) {
  const [obs, setObs] = useState<ObservacaoPaciente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    listarObservacoesPaciente(pacienteId).then((data) => {
      setObs(data.filter(o => o.tag === tag))
      setCarregando(false)
    })
  }, [pacienteId, tag])

  if (carregando || obs.length === 0) return null

  const badge = TAG_BADGE[tag] ?? TAG_BADGE.geral

  return (
    <div className="mt-6 rounded-xl border border-[#dee3e3] overflow-hidden">
      <button
        onClick={() => setAberto(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-[#f5faf9] text-left hover:bg-[#edf7f4] transition-colors"
      >
        <StickyNote size={13} className="text-[#006b5a] shrink-0" />
        <span className="flex-1 text-xs font-semibold text-[#3d4945]">
          Observações vinculadas
          <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badge}`}>
            {obs.length}
          </span>
        </span>
        <ChevronDown size={13} className={`text-[#6d7a75] transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <div className="divide-y divide-[#f0f5f4]">
          {obs.map(o => (
            <div key={o.id} className="px-4 py-3 space-y-1">
              <p className="text-[10px] text-[#9BB0AD]">
                {format(new Date(o.criado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                {o.autor_nome && <> · {o.autor_nome}</>}
              </p>
              {o.texto && <p className="text-xs text-[#083142] leading-relaxed">{o.texto}</p>}
              <AnexoInline obs={o} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}