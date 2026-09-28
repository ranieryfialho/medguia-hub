'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'
import { LightboxMidia, type TipoLightboxMidia } from '@/components/features/pacientes/LightboxMidia'

function inferirTipo(extensao: string): TipoLightboxMidia {
  const ext = extensao.replace(/^\./, '').toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'bmp'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  return 'file'
}

export function ComprovanteVendaPreview({
  fileId,
  nome,
  fileUrl,
  extensao = '',
}: {
  fileId: string
  nome: string
  fileUrl?: string | null
  extensao?: string
}) {
  const [ampliado, setAmpliado] = useState(false)
  const tipo = inferirTipo(extensao)
  const src = `/api/drive/file/${fileId}`

  return (
    <>
      <button
        type="button"
        onClick={() => setAmpliado(true)}
        className="mt-1 flex items-center gap-2.5 group text-left"
      >
        <div className="w-14 h-14 rounded-lg overflow-hidden bg-page border border-border shrink-0 flex items-center justify-center group-hover:border-primary-500/50 transition-colors">
          {tipo === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={nome} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <FileText size={20} className="text-primary-500" />
          )}
        </div>
        <span className="text-sm text-primary-500 group-hover:text-primary-600 truncate max-w-[200px]">
          {nome}
        </span>
      </button>

      {ampliado && (
        <LightboxMidia
          item={{ src, nome, tipo, urlExterna: fileUrl }}
          onClose={() => setAmpliado(false)}
        />
      )}
    </>
  )
}
