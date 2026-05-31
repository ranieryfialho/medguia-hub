'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ExternalLink, FileIcon, FolderOpen, FolderPlus, ImageIcon,
  Loader2, RefreshCw, Upload, VideoIcon, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { buscarPastaAtendimento, criarPastaAtendimento, listarMidiasAtendimento } from '@/actions/google-drive'
import type { MidiaItem } from './agendamento-item-utils'

type TabMidiaProps = {
  agendamentoId: string
  pacienteId: string
  nomePaciente: string
  dataAgendamento: string
  tipo: string
  googleDrivePastaUrl?: string | null
  isActive: boolean
}

export function TabMidia({
  agendamentoId, pacienteId, nomePaciente, dataAgendamento, tipo,
  googleDrivePastaUrl, isActive,
}: TabMidiaProps) {
  const [midiaUrl, setMidiaUrl] = useState<string | null>(googleDrivePastaUrl ?? null)
  const [midiaConectado, setMidiaConectado] = useState<boolean | null>(null)
  const [midiaCarregando, setMidiaCarregando] = useState(false)
  const [criandoPasta, setCriandoPasta] = useState(false)
  const [midias, setMidias] = useState<MidiaItem[]>([])
  const [midiasCarregando, setMidiasCarregando] = useState(false)
  const [uploadando, setUploadando] = useState(false)
  const [midiaAmpliada, setMidiaAmpliada] = useState<MidiaItem | null>(null)
  const [videoErro, setVideoErro] = useState(false)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isActive || midiaConectado !== null) return
    setMidiaCarregando(true)
    buscarPastaAtendimento(agendamentoId).then((resultado) => {
      setMidiaUrl(resultado.url)
      setMidiaConectado(resultado.driveConectado)
      setMidiaCarregando(false)
      if (resultado.url) void carregarMidias()
    })
  }, [isActive, agendamentoId, midiaConectado])

  async function carregarMidias() {
    setMidiasCarregando(true)
    const resultado = await listarMidiasAtendimento(agendamentoId)
    setMidias(resultado.midias)
    setMidiasCarregando(false)
  }

  async function handleCriarPasta() {
    setCriandoPasta(true)
    const resultado = await criarPastaAtendimento(agendamentoId, pacienteId, nomePaciente, dataAgendamento, tipo)
    setCriandoPasta(false)
    if (resultado.success && resultado.folderUrl) {
      setMidiaUrl(resultado.folderUrl)
    } else {
      toast.error(resultado.error ?? 'Erro ao criar pasta no Drive')
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 50MB por arquivo.')
      return
    }
    setUploadando(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('atendimentoId', agendamentoId)
      const res = await fetch('/api/drive/upload', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Erro no upload')
      } else {
        toast.success('Arquivo enviado com sucesso!')
        await carregarMidias()
      }
    } catch {
      toast.error('Erro ao enviar arquivo')
    } finally {
      setUploadando(false)
      if (uploadInputRef.current) uploadInputRef.current.value = ''
    }
  }

  return (
    <>
      <div className={isActive ? 'space-y-4' : 'hidden'}>
        {midiaCarregando ? (
          <div className="flex items-center justify-center py-10 text-sm font-medium text-[#6d7a75]">
            Verificando pasta no Drive...
          </div>
        ) : midiaConectado === false ? (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <FolderOpen size={16} className="text-amber-600 shrink-0" />
              <p className="text-sm font-semibold text-amber-800">Google Drive não conectado</p>
            </div>
            <p className="text-xs text-amber-700">
              Para armazenar mídias deste atendimento, conecte uma conta do Google Drive nas configurações.
            </p>
            <a
              href="/configuracoes/google-drive"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#006b5a] hover:underline"
            >
              Ir para configurações
              <ExternalLink size={11} />
            </a>
          </div>
        ) : midiaUrl ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#3d4945]">
                {midiasCarregando ? 'Carregando...' : `${midias.length} arquivo${midias.length !== 1 ? 's' : ''}`}
              </p>
              <div className="flex items-center gap-2">
                <a
                  href={midiaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#bcc9c4]/60 text-xs font-semibold text-[#3d4945] hover:bg-[#f0f5f4] transition-colors"
                >
                  <FolderOpen size={13} />
                  Ver no Drive
                </a>
                <button
                  type="button"
                  disabled={uploadando}
                  onClick={() => uploadInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#006b5a] text-white text-xs font-semibold hover:bg-[#005a4b] transition-colors disabled:opacity-60"
                >
                  {uploadando ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  {uploadando ? 'Enviando...' : 'Enviar'}
                </button>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*,video/*,.pdf"
                  className="hidden"
                  onChange={handleUpload}
                />
              </div>
            </div>

            {midiasCarregando ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-[#006b5a]" />
              </div>
            ) : midias.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-[#bcc9c4]/60 p-6 text-center space-y-2">
                <ImageIcon size={24} className="text-[#bcc9c4] mx-auto" />
                <p className="text-xs text-[#6d7a75]">Nenhum arquivo ainda. Clique em <strong>Enviar</strong> para adicionar fotos ou vídeos.</p>
                <p className="text-[10px] text-[#bcc9c4]">Máximo 50MB por arquivo. Para vídeos grandes, use o Google Drive diretamente.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {midias.map((midia) => {
                  const isImage = midia.mime_type.startsWith('image/')
                  const isVideo = midia.mime_type.startsWith('video/')
                  return (
                    <button
                      key={midia.id}
                      type="button"
                      onClick={() => { setVideoErro(false); setMidiaAmpliada(midia) }}
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
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl bg-[#f0f5f4] border border-[#bcc9c4]/40 p-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-white border border-[#bcc9c4]/40 flex items-center justify-center mx-auto">
                <FolderPlus size={22} className="text-[#6d7a75]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#3d4945]">Pasta não criada</p>
                <p className="text-xs text-[#6d7a75] mt-0.5">
                  Crie a pasta para começar a salvar fotos e vídeos deste atendimento.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCriarPasta}
                disabled={criandoPasta}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#006b5a] text-white text-sm font-semibold hover:bg-[#005a4b] transition-colors disabled:opacity-50"
              >
                {criandoPasta ? (
                  <><RefreshCw size={15} className="animate-spin" />Criando pasta...</>
                ) : (
                  <><FolderPlus size={15} />Criar pasta no Drive</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {midiaAmpliada && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setMidiaAmpliada(null)}
        >
          <button
            type="button"
            onClick={() => setMidiaAmpliada(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X size={20} />
          </button>
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {midiaAmpliada.mime_type.startsWith('image/') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/drive/file/${midiaAmpliada.google_drive_file_id}`}
                alt={midiaAmpliada.nome}
                className="max-h-[80vh] max-w-full rounded-xl object-contain"
              />
            ) : midiaAmpliada.mime_type.startsWith('video/') ? (
              videoErro ? (
                <div className="bg-white rounded-xl p-8 flex flex-col items-center gap-3 max-w-sm text-center">
                  <VideoIcon size={40} className="text-slate-300" />
                  <p className="text-sm font-semibold text-[#3d4945]">Não foi possível reproduzir</p>
                  <p className="text-xs text-[#6d7a75]">O codec pode não ser suportado pelo navegador.</p>
                  {midiaAmpliada.google_drive_file_url && (
                    <a
                      href={midiaAmpliada.google_drive_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#006b5a] text-white text-xs font-semibold hover:bg-[#005a4b] transition-colors"
                    >
                      <ExternalLink size={13} />
                      Abrir no Google Drive
                    </a>
                  )}
                </div>
              ) : (
                <video
                  src={`/api/drive/file/${midiaAmpliada.google_drive_file_id}`}
                  controls
                  autoPlay
                  playsInline
                  onError={() => setVideoErro(true)}
                  className="max-h-[80vh] max-w-full rounded-xl"
                />
              )
            ) : (
              <div className="bg-white rounded-xl p-8 flex flex-col items-center gap-3">
                <FileIcon size={48} className="text-[#6d7a75]" />
                <p className="text-sm font-semibold text-[#083142]">{midiaAmpliada.nome}</p>
              </div>
            )}
            <div className="flex items-center gap-3">
              <p className="text-white/70 text-xs">{midiaAmpliada.nome}</p>
              {midiaAmpliada.google_drive_file_url && (
                <a
                  href={midiaAmpliada.google_drive_file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs font-semibold hover:bg-white/20 transition-colors"
                >
                  <ExternalLink size={12} />
                  Abrir no Drive
                </a>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
