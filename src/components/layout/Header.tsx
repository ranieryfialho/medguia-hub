import Image from 'next/image'
import Link from 'next/link'
import { HardDrive } from 'lucide-react'
import { buscarStatusConexaoGoogle } from '@/actions/google-drive'
import { temAcesso } from '@/lib/modulos'
import { BuscaGlobalTrigger } from './BuscaGlobalTrigger'
import { SinoNotificacoes } from './SinoNotificacoes'

type HeaderProps = {
  nomeUsuario: string
  cargoUsuario: string
  avatarUrl: string
  modulosLiberados?: string[]
  userId: string
}

export async function Header({ nomeUsuario, cargoUsuario, avatarUrl, modulosLiberados = [], userId }: HeaderProps) {
  const mostrarDrive = temAcesso(modulosLiberados, 'configuracoes:google_drive')
  const statusDrive = mostrarDrive ? await buscarStatusConexaoGoogle() : null

  return (
    <header className="hidden lg:flex sticky top-0 z-40 bg-[#f5faf9]/90 backdrop-blur-md justify-between items-center w-full px-8 py-4 border-b border-[#dee3e3]/50">
      <div className="flex-1 flex items-center">
        <BuscaGlobalTrigger className="w-full" />
      </div>

      <div className="flex items-center gap-4">
        {mostrarDrive && statusDrive && (
          <Link
            href="/configuracoes/google-drive"
            title={statusDrive.conectado ? `Google Drive: ${statusDrive.email ?? 'conectado'}` : 'Google Drive: desconectado'}
            className="relative p-2 rounded-full hover:bg-[#dee3e3] transition-colors text-[#3d4945]"
          >
            <HardDrive size={20} />
            <span
              className={`absolute top-1 right-1 w-2.5 h-2.5 rounded-full border-2 border-[#f5faf9] ${
                statusDrive.conectado ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
          </Link>
        )}

        <SinoNotificacoes userId={userId} />
        <div className="flex items-center gap-3 pl-4 border-l border-[#bcc9c4]/50">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-[#171d1c] leading-none capitalize">{nomeUsuario}</p>
            <p className="text-[11px] text-[#3d4945] font-medium mt-1 capitalize">{cargoUsuario}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-200 overflow-hidden shadow-sm border border-slate-200 flex items-center justify-center">
            <Image
              src={avatarUrl}
              alt={`Foto de perfil de ${nomeUsuario}`}
              width={40}
              height={40}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </header>
  )
}
