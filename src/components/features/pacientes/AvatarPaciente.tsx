'use client'

import { useState } from 'react'
import { LightboxMidia } from '@/components/features/pacientes/LightboxMidia'

export type TamanhoAvatarPaciente = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

export interface AvatarPacienteProps {
  nome: string
  fotoDriveFileId?: string | null
  fotoAtualizadaEm?: string | null
  size?: TamanhoAvatarPaciente
  isAtivo?: boolean
  mostrarStatus?: boolean
  className?: string
  priority?: boolean
  ampliavel?: boolean
}

/** Duas primeiras iniciais do nome, em caixa alta — fallback quando não há foto (AC-097). */
export function calcularIniciais(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0] ?? '')
    .join('')
    .toUpperCase()
}

/** `?v=` invalida o cache privado do proxy quando a foto muda (AC-099). */
export function construirUrlFoto(fotoDriveFileId: string, fotoAtualizadaEm?: string | null): string {
  const versao = fotoAtualizadaEm ?? ''
  return `/api/drive/file/${fotoDriveFileId}?v=${encodeURIComponent(versao)}`
}

/** Só abre ampliação com foto presente e `ampliavel` ativada — iniciais nunca ampliam (AC-100, AC-101). */
export function podeAmpliar(fotoDriveFileId: string | null | undefined, ampliavel: boolean): boolean {
  return ampliavel && Boolean(fotoDriveFileId)
}

export type EstadoAvatarPaciente = 'fallback' | 'carregando' | 'foto'

/** Máquina de estados do avatar (seção 5.5 do TDD 006). */
export function calcularEstadoAvatar(
  fotoDriveFileId: string | null | undefined,
  imagemCarregou: boolean,
  imagemFalhou: boolean,
): EstadoAvatarPaciente {
  if (!fotoDriveFileId || imagemFalhou) return 'fallback'
  if (!imagemCarregou) return 'carregando'
  return 'foto'
}

const TAMANHO_CLASSES: Record<TamanhoAvatarPaciente, string> = {
  xs: 'w-6 h-6 text-[10px] rounded-full',
  sm: 'w-9 h-9 text-xs rounded-full',
  md: 'w-10 h-10 text-sm rounded-full',
  lg: 'w-14 h-14 text-base rounded-full',
  xl: 'w-20 h-20 text-xl rounded-full',
  '2xl': 'w-28 h-28 text-3xl rounded-3xl',
}

const STATUS_CLASSES: Record<TamanhoAvatarPaciente, string> = {
  xs: 'w-2 h-2 border',
  sm: 'w-2.5 h-2.5 border-2',
  md: 'w-3 h-3 border-2',
  lg: 'w-3.5 h-3.5 border-2',
  xl: 'w-4 h-4 border-[3px]',
  '2xl': 'w-5 h-5 border-4',
}

export default function AvatarPaciente({
  nome,
  fotoDriveFileId,
  fotoAtualizadaEm,
  size = 'md',
  isAtivo = true,
  mostrarStatus = false,
  className = '',
  priority = false,
  ampliavel = false,
}: AvatarPacienteProps) {
  const [imagemCarregou, setImagemCarregou] = useState(false)
  const [imagemFalhou, setImagemFalhou] = useState(false)
  const [lightboxAberto, setLightboxAberto] = useState(false)

  const estado = calcularEstadoAvatar(fotoDriveFileId, imagemCarregou, imagemFalhou)
  const iniciais = calcularIniciais(nome)
  const tamanhoClasses = TAMANHO_CLASSES[size]
  const ampliavelAtivo = podeAmpliar(fotoDriveFileId, ampliavel)

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <div
        className={`${tamanhoClasses} relative overflow-hidden flex items-center justify-center bg-[#006b5a] font-bold text-white shrink-0 ${ampliavelAtivo ? 'cursor-pointer' : ''}`}
        role={ampliavelAtivo ? 'button' : undefined}
        tabIndex={ampliavelAtivo ? 0 : undefined}
        onClick={ampliavelAtivo ? () => setLightboxAberto(true) : undefined}
      >
        {fotoDriveFileId && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={construirUrlFoto(fotoDriveFileId, fotoAtualizadaEm)}
            alt={nome}
            loading={priority ? undefined : 'lazy'}
            className={`w-full h-full object-cover ${estado === 'foto' ? '' : 'hidden'}`}
            onLoad={() => setImagemCarregou(true)}
            onError={() => setImagemFalhou(true)}
          />
        )}
        {estado === 'carregando' && (
          <span className="w-full h-full absolute inset-0 animate-pulse bg-[#006b5a]/60" aria-hidden="true" />
        )}
        {estado === 'fallback' && <span>{iniciais}</span>}
      </div>
      {mostrarStatus && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-white ${STATUS_CLASSES[size]} ${
            isAtivo ? 'bg-[#25D366]' : 'bg-red-500'
          }`}
          aria-hidden="true"
        />
      )}
      {lightboxAberto && ampliavelAtivo && fotoDriveFileId && (
        <LightboxMidia
          item={{ src: construirUrlFoto(fotoDriveFileId, fotoAtualizadaEm), nome, tipo: 'image' }}
          onClose={() => setLightboxAberto(false)}
        />
      )}
    </div>
  )
}
