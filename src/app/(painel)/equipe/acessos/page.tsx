import { redirect } from 'next/navigation'
import { ShieldCheck, Users } from 'lucide-react'
import { ModalEditarAcesso } from '@/components/features/ModalEditarAcesso'
import { requireModulo } from '@/lib/guard'
import { createClient } from '@/lib/supabase/server'
import { normalizarCargoOperacional, type NivelAcesso } from '@/lib/modulos'

type PerfilRow = {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
  nivel_acesso: string | null
  modulos_liberados: string[] | null
  ativo: boolean | null
}

function labelCargo(cargo: string | null) {
  switch (cargo) {
    case 'fisioterapeuta':
      return 'Fisioterapeuta'
    case 'recepcionista':
      return 'Recepcionista'
    case 'medico':
      return 'Médico'
    case 'gestor':
      return 'Gestor'
    default:
      return cargo || 'Colaborador'
  }
}

export default async function GestaoAcessosPage() {
  const { profile } = await requireModulo('equipe:acessos')

  if (!['gestor', 'master'].includes(profile.nivel_acesso)) {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, nivel_acesso, modulos_liberados, ativo')
    .order('full_name')

  const usuarios = ((data ?? []) as PerfilRow[])
    .map((item) => ({
      id: item.id,
      nome: item.full_name || 'Usuário sem nome',
      email: item.email || 'Sem e-mail',
      cargo: normalizarCargoOperacional(item.role),
      cargoLabel: labelCargo(item.role),
      nivelAcesso: (item.nivel_acesso || 'basico') as NivelAcesso,
      modulosLiberados: item.modulos_liberados ?? [],
      ativo: item.ativo !== false,
    }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#eaf7f3] px-3 py-1 text-xs font-extrabold uppercase tracking-[0.2em] text-[#006b5a]">
            <ShieldCheck size={14} />
            Equipe
          </div>
          <h1 className="text-2xl font-bold text-[#171d1c]">Gestão de Acessos</h1>
          <p className="mt-1 text-sm text-[#3d4945]/70">
            Separe perfil operacional, nível do sistema e módulos liberados para cada colaborador.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#3d4945] shadow-sm border border-[#bcc9c4]/30">
          <Users size={16} className="text-[#006b5a]" />
          {usuarios.length} colaboradores listados
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-[#bcc9c4]/30 bg-white shadow-sm">
        <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] gap-4 border-b border-[#bcc9c4]/20 px-5 py-4 text-xs font-extrabold uppercase tracking-[0.18em] text-[#6d7a75]">
          <span>Colaborador</span>
          <span>Nível e Status</span>
          <span className="text-right">Ações</span>
        </div>

        <div className="divide-y divide-[#bcc9c4]/20">
          {usuarios.map((usuario) => (
            <div key={usuario.id} className={`grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] md:items-center ${usuario.ativo ? 'bg-white' : 'bg-[#f7f9f8] opacity-70'}`}>
              <div>
                <p className="text-base font-bold text-[#171d1c]">{usuario.nome}</p>
                <p className="mt-1 text-sm text-[#3d4945]/70">{usuario.email}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#6d7a75]">{usuario.cargoLabel}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#f0f5f4] px-3 py-1 text-xs font-bold text-[#3d4945]">
                  nível {usuario.nivelAcesso}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${usuario.ativo ? 'bg-[#eaf7f3] text-[#006b5a]' : 'bg-[#ba1a1a]/10 text-[#ba1a1a]'}`}>
                  {usuario.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>

              <div className="md:justify-self-end">
                <ModalEditarAcesso usuario={usuario} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
