import Image from 'next/image'
import { Search, Bell } from 'lucide-react'

type HeaderProps = {
  nomeUsuario: string
  cargoUsuario: string
  avatarUrl: string
}

export function Header({ nomeUsuario, cargoUsuario, avatarUrl }: HeaderProps) {
  return (
    <header className="hidden lg:flex sticky top-0 z-40 bg-[#f5faf9]/90 backdrop-blur-md justify-between items-center w-full px-8 py-4 border-b border-[#dee3e3]/50">
      <div className="flex-1 flex items-center">
        <div className="relative group w-full max-w-md hidden sm:block">
          <span className="absolute inset-y-0 left-3 flex items-center text-[#3d4945]">
            <Search size={18} />
          </span>
          <input
            className="bg-[#f0f5f4] border-none rounded-full pl-10 pr-6 py-2.5 text-sm w-full focus:ring-2 focus:ring-[#006b5a]/20 transition-all outline-none text-[#171d1c]"
            placeholder="Buscar paciente ou consulta..."
            type="text"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 rounded-full hover:bg-[#dee3e3] transition-colors text-[#3d4945]">
          <Bell size={20} />
        </button>
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
