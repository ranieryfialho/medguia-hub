'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, FileIcon, Loader2, VideoIcon, X } from 'lucide-react'

export type TipoLightboxMidia = 'image' | 'video' | 'pdf' | 'file'

export interface LightboxMidiaItem {
  src: string
  nome: string
  tipo: TipoLightboxMidia
  urlExterna?: string | null
}

/** Visualização ampliada de uma mídia (imagem/vídeo/PDF/arquivo), extraída de `TabMidiasPaciente` para reuso no `AvatarPaciente` (AC-100). */
export function LightboxMidia({ item, onClose }: { item: LightboxMidiaItem; onClose: () => void }) {
  const [videoErro, setVideoErro] = useState(false)
  const [pdfCarregando, setPdfCarregando] = useState(item.tipo === 'pdf')

  useEffect(() => {
    setVideoErro(false)
    setPdfCarregando(item.tipo === 'pdf')
  }, [item])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <button type="button" onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20">
        <X size={20} />
      </button>
      <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        {item.tipo === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.src} alt={item.nome} className="max-h-[80vh] max-w-full rounded-xl object-contain" />
        ) : item.tipo === 'video' ? (
          videoErro ? (
            <div className="bg-white rounded-xl p-8 flex flex-col items-center gap-3 max-w-sm text-center">
              <VideoIcon size={40} className="text-slate-300" />
              <p className="text-sm font-semibold text-[#3d4945]">Não foi possível reproduzir</p>
              {item.urlExterna && (
                <a href={item.urlExterna} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#006b5a] text-white text-xs font-semibold">
                  <ExternalLink size={13} />Abrir no Google Drive
                </a>
              )}
            </div>
          ) : (
            <video src={item.src} controls autoPlay playsInline onError={() => setVideoErro(true)}
              className="max-h-[80vh] max-w-full rounded-xl" />
          )
        ) : item.tipo === 'pdf' ? (
          <div style={{ position: 'relative', width: 'min(90vw, 860px)', height: '80vh' }}>
            {pdfCarregando && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', borderRadius: '12px', zIndex: 1 }}>
                <Loader2 size={32} className="animate-spin text-[#006b5a]" />
              </div>
            )}
            <iframe src={item.src} title={item.nome} onLoad={() => setPdfCarregando(false)}
              style={{ width: '100%', height: '100%', border: 'none', borderRadius: '12px', background: 'white', display: 'block' }} />
          </div>
        ) : (
          <div className="bg-white rounded-xl p-8 flex flex-col items-center gap-3">
            <FileIcon size={48} className="text-[#6d7a75]" />
            <p className="text-sm font-semibold text-[#083142]">{item.nome}</p>
          </div>
        )}
        <div className="flex items-center gap-3">
          <p className="text-white/70 text-xs">{item.nome}</p>
          {item.urlExterna && (
            <a href={item.urlExterna} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs font-semibold hover:bg-white/20">
              <ExternalLink size={12} />Abrir no Drive
            </a>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
