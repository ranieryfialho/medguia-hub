'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ExternalLink, FileIcon, FileText, FolderOpen, FolderPlus,
  ImageIcon, Loader2, RefreshCw, Upload, VideoIcon,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'
import {
  buscarPastaPaciente, criarPastaPaciente,
  listarMidiasPaciente, listarMidiasPacienteConsultas,
} from '@/actions/google-drive'
import type { MidiaItem } from '@/components/features/agenda/agendamento-item-utils'
import { LightboxMidia, type LightboxMidiaItem, type TipoLightboxMidia } from '@/components/features/pacientes/LightboxMidia'

type MidiaConsulta = MidiaItem & {
  atendimento_data: string | null
  atendimento_tipo: string | null
}

type ViewerState = (MidiaItem | MidiaConsulta) | null

function MidiaGrid({
  midias,
  onAmplia,
}: {
  midias: MidiaItem[]
  onAmplia: (m: MidiaItem) => void
}) {
  if (midias.length === 0) return (
    <div className="rounded-xl border-2 border-dashed border-[#bcc9c4]/60 p-8 text-center space-y-2">
      <ImageIcon size={24} className="text-[#bcc9c4] mx-auto" />
      <p className="text-xs text-[#6d7a75]">Nenhum arquivo nesta seção.</p>
    </div>
  )

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
      {midias.map((midia) => {
        const isImage = midia.mime_type?.startsWith('image/')
        const isVideo = midia.mime_type?.startsWith('video/')
        const isPdf = midia.mime_type === 'application/pdf'
        return (
          <button
            key={midia.id}
            type="button"
            onClick={() => onAmplia(midia)}
            className="relative aspect-square rounded-xl overflow-hidden bg-[#f0f5f4] border border-[#bcc9c4]/40 hover:border-[#006b5a]/40 hover:shadow-md transition-all group"
          >
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/drive/file/${midia.google_drive_file_id}`}
                alt={midia.nome}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : isVideo ? (
              <>
                <video
                  src={`/api/drive/file/${midia.google_drive_file_id}`}
                  preload="metadata"
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow">
                    <VideoIcon size={16} className="text-[#006b5a] ml-0.5" />
                  </div>
                </div>
              </>
            ) : isPdf ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 p-2">
                <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center">
                  <FileText size={20} className="text-red-500" />
                </div>
                <span className="text-[9px] font-bold text-red-500 uppercase tracking-wide">PDF</span>
                <span className="text-[8px] text-[#6d7a75] text-center leading-tight line-clamp-2 w-full px-1">{midia.nome}</span>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
                <FileIcon size={22} className="text-[#6d7a75]" />
                <span className="text-[9px] text-[#6d7a75] text-center leading-tight line-clamp-2 w-full px-1">{midia.nome}</span>
              </div>
            )}
            {!isVideo && <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-xl" />}
          </button>
        )
      })}
    </div>
  )
}

export function TabMidiasPaciente({ pacienteId, nomePaciente }: { pacienteId: string; nomePaciente: string }) {
  const [pastaUrl, setPastaUrl] = useState<string | null>(null)
  const [driveConectado, setDriveConectado] = useState<boolean | null>(null)
  const [carregandoPasta, setCarregandoPasta] = useState(true)
  const [criandoPasta, setCriandoPasta] = useState(false)

  const [midiasPaciente, setMidiasPaciente] = useState<MidiaItem[]>([])
  const [midiasConsultas, setMidiasConsultas] = useState<MidiaConsulta[]>([])
  const [carregando, setCarregando] = useState(false)

  const [uploadando, setUploadando] = useState(false)
  const [midiaAmpliada, setMidiaAmpliada] = useState<ViewerState>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    buscarPastaPaciente(pacienteId).then((r) => {
      setPastaUrl(r.url)
      setDriveConectado(r.driveConectado)
      setCarregandoPasta(false)
      if (r.url) void carregarMidias()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId])

  async function carregarMidias() {
    setCarregando(true)
    const [resPaciente, resConsultas] = await Promise.all([
      listarMidiasPaciente(pacienteId),
      listarMidiasPacienteConsultas(pacienteId),
    ])
    setMidiasPaciente(resPaciente.midias)
    setMidiasConsultas(resConsultas.midias as MidiaConsulta[])
    setCarregando(false)
  }

  async function handleCriarPasta() {
    setCriandoPasta(true)
    const r = await criarPastaPaciente(pacienteId, nomePaciente)
    setCriandoPasta(false)
    if (r.success && r.folderUrl) {
      setPastaUrl(r.folderUrl)
      void carregarMidias()
    } else {
      toast.error(r.error ?? 'Erro ao criar pasta no Drive')
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 50 * 1024 * 1024) { toast.error('Arquivo muito grande. Máximo 50MB.'); return }
    setUploadando(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('pacienteId', pacienteId)
      const res = await fetch('/api/drive/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) toast.error(json.error ?? 'Erro no upload')
      else { toast.success('Arquivo enviado!'); await carregarMidias() }
    } catch { toast.error('Erro ao enviar arquivo') }
    finally { setUploadando(false); if (uploadInputRef.current) uploadInputRef.current.value = '' }
  }

  function midiaParaLightboxItem(midia: MidiaItem | MidiaConsulta): LightboxMidiaItem {
    const tipo: TipoLightboxMidia = midia.mime_type?.startsWith('image/')
      ? 'image'
      : midia.mime_type?.startsWith('video/')
        ? 'video'
        : midia.mime_type === 'application/pdf'
          ? 'pdf'
          : 'file'
    return {
      src: `/api/drive/file/${midia.google_drive_file_id}`,
      nome: midia.nome,
      tipo,
      urlExterna: midia.google_drive_file_url,
    }
  }

  if (carregandoPasta) return (
    <div className="flex items-center justify-center py-16 text-sm text-[#6d7a75]">
      <Loader2 size={20} className="animate-spin mr-2" />Verificando pasta no Drive...
    </div>
  )

  if (driveConectado === false) return (
    <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 space-y-2">
      <p className="text-sm font-semibold text-amber-800">Google Drive não conectado</p>
      <p className="text-xs text-amber-700">Conecte uma conta do Google Drive nas configurações para armazenar arquivos.</p>
      <a href="/configuracoes/google-drive" target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#006b5a] hover:underline">
        Ir para configurações <ExternalLink size={11} />
      </a>
    </div>
  )

  if (!pastaUrl) return (
    <div className="rounded-xl bg-[#f0f5f4] border border-[#bcc9c4]/40 p-8 text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-white border border-[#bcc9c4]/40 flex items-center justify-center mx-auto">
        <FolderPlus size={26} className="text-[#6d7a75]" />
      </div>
      <div>
        <p className="text-sm font-semibold text-[#3d4945]">Pasta do paciente não criada</p>
        <p className="text-xs text-[#6d7a75] mt-1">Crie a pasta no Drive para armazenar arquivos deste paciente.</p>
      </div>
      <button type="button" onClick={handleCriarPasta} disabled={criandoPasta}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#006b5a] text-white text-sm font-semibold hover:bg-[#005a4b] disabled:opacity-50">
        {criandoPasta ? <><RefreshCw size={15} className="animate-spin" />Criando...</> : <><FolderPlus size={15} />Criar pasta no Drive</>}
      </button>
    </div>
  )

  return (
    <>
      <div className="space-y-8">

        {/* Arquivos do paciente */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-[#083142]">Arquivos do paciente</h4>
              <p className="text-[11px] text-[#6d7a75]">Enviados via Observações Gerais ou diretamente aqui</p>
            </div>
            <div className="flex items-center gap-2">
              {pastaUrl && (
                <a href={pastaUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#bcc9c4]/60 text-xs font-semibold text-[#3d4945] hover:bg-[#f0f5f4]">
                  <FolderOpen size={13} />Ver no Drive
                </a>
              )}
              <button type="button" disabled={uploadando} onClick={() => uploadInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#006b5a] text-white text-xs font-semibold hover:bg-[#005a4b] disabled:opacity-60">
                {uploadando ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                {uploadando ? 'Enviando...' : 'Enviar'}
              </button>
              <input ref={uploadInputRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                className="hidden" onChange={handleUpload} />
            </div>
          </div>
          {carregando ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[#006b5a]" /></div>
          ) : (
            <MidiaGrid midias={midiasPaciente} onAmplia={(m) => setMidiaAmpliada(m)} />
          )}
        </section>

        {/* Arquivos de consultas */}
        <section className="space-y-3">
          <div>
            <h4 className="text-sm font-bold text-[#083142]">Arquivos de consultas</h4>
            <p className="text-[11px] text-[#6d7a75]">Enviados dentro de cada atendimento</p>
          </div>
          {carregando ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[#006b5a]" /></div>
          ) : midiasConsultas.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-[#bcc9c4]/60 p-8 text-center space-y-2">
              <ImageIcon size={24} className="text-[#bcc9c4] mx-auto" />
              <p className="text-xs text-[#6d7a75]">Nenhum arquivo enviado nas consultas.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Group by date for context */}
              {Object.entries(
                midiasConsultas.reduce<Record<string, MidiaConsulta[]>>((acc, m) => {
                  const key = m.atendimento_data
                    ? `${format(new Date(m.atendimento_data), "dd/MM/yyyy", { locale: ptBR })} — ${m.atendimento_tipo ?? 'Sessão'}`
                    : 'Sem data'
                  ;(acc[key] ??= []).push(m)
                  return acc
                }, {})
              ).map(([label, items]) => (
                <div key={label} className="space-y-2">
                  <p className="text-[11px] font-semibold text-[#6d7a75] uppercase tracking-wide">{label}</p>
                  <MidiaGrid midias={items} onAmplia={(m) => setMidiaAmpliada(m)} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {midiaAmpliada && (
        <LightboxMidia item={midiaParaLightboxItem(midiaAmpliada)} onClose={() => setMidiaAmpliada(null)} />
      )}
    </>
  )
}
