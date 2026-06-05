import { redirect } from 'next/navigation'
import { ShieldCheck, Users } from 'lucide-react'
import { ModalEditarAcesso } from '@/components/features/shared'
import { requireModulo } from '@/lib/guard'
import { createClient } from '@/lib/supabase/server'
import {
  normalizarCargoOperacional,
  inferirTemplatePerfilPorModulos,
  TODOS_MODULOS,
  type NivelAcesso,
} from '@/lib/modulos'
import { isGestorSistema } from '@/lib/permissoes'

type PerfilRow = {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
  nivel_acesso: string | null
  modulos_liberados: string[] | null
  ativo: boolean | null
}

const CARGO_LABEL: Record<string, string> = {
  fisioterapeuta: 'Fisioterapeuta',
  recepcionista: 'Recepcionista',
  medico: 'Médico',
  gestor: 'Gestor',
}

const NIVEL_STYLE: Record<string, string> = {
  master: 'bg-[#fdf3e3] text-[#b45309]',
  gestor: 'bg-[#eaf7f3] text-[#006b5a]',
  basico: 'bg-[#f0f5f4] text-[#3d4945]',
}

const TEMPLATE_LABEL: Record<string, string> = {
  fisioterapeuta: 'Fisioterapeuta',
  recepcionista: 'Recepção',
  medico: 'Médico',
  gestor: 'Gestor',
  comercial: 'Comercial',
  completo: 'Completo',
  customizado: 'Personalizado',
}

export default async function GestaoAcessosPage() {
  const { profile } = await requireModulo('equipe:acessos')

  if (!isGestorSistema(profile?.nivel_acesso)) {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, nivel_acesso, modulos_liberados, ativo')
    .order('full_name')

  const totalModulos = TODOS_MODULOS.length

  const usuarios = ((data ?? []) as PerfilRow[]).map((item) => {
    const modulosLiberados = item.modulos_liberados ?? []
    const isLegado = modulosLiberados.length === 0
    const template = isLegado ? 'completo' : inferirTemplatePerfilPorModulos(modulosLiberados)
    const qtdModulos = isLegado ? totalModulos : modulosLiberados.length

    return {
      id: item.id,
      nome: item.full_name || 'Usuário sem nome',
      email: item.email || 'Sem e-mail',
      cargo: normalizarCargoOperacional(item.role),
      cargoLabel: CARGO_LABEL[item.role ?? ''] || item.role || 'Colaborador',
      nivelAcesso: (item.nivel_acesso || 'basico') as NivelAcesso,
      modulosLiberados,
      ativo: item.ativo !== false,
      template,
      qtdModulos,
      isLegado,
    }
  })

  const ativos = usuarios.filter(u => u.ativo)
  const inativos = usuarios.filter(u => !u.ativo)

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
            Fonte da verdade para cargos, níveis e módulos de cada colaborador.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#3d4945] shadow-sm border border-[#bcc9c4]/30">
          <Users size={16} className="text-[#006b5a]" />
          {ativos.length} ativos · {inativos.length} inativos
        </div>
      </div>

      <UsuariosTabela usuarios={ativos} totalModulos={totalModulos} titulo="Colaboradores Ativos" />

      {inativos.length > 0 && (
        <UsuariosTabela usuarios={inativos} totalModulos={totalModulos} titulo="Inativos" dimmed />
      )}
    </div>
  )
}

type UsuarioItem = {
  id: string
  nome: string
  email: string
  cargo: ReturnType<typeof normalizarCargoOperacional>
  cargoLabel: string
  nivelAcesso: NivelAcesso
  modulosLiberados: string[]
  ativo: boolean
  template: string
  qtdModulos: number
  isLegado: boolean
}

function UsuariosTabela({
  usuarios,
  totalModulos,
  titulo,
  dimmed = false,
}: {
  usuarios: UsuarioItem[]
  totalModulos: number
  titulo: string
  dimmed?: boolean
}) {
  if (usuarios.length === 0) return null

  return (
    <div className={`overflow-hidden rounded-3xl border border-[#bcc9c4]/30 bg-white shadow-sm ${dimmed ? 'opacity-70' : ''}`}>
      <div className="border-b border-[#bcc9c4]/20 px-5 py-3">
        <h2 className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#6d7a75]">{titulo}</h2>
      </div>

      {/* Cabeçalho da tabela — desktop */}
      <div className="hidden md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 border-b border-[#bcc9c4]/20 px-5 py-3 text-xs font-extrabold uppercase tracking-[0.16em] text-[#6d7a75]">
        <span>Colaborador</span>
        <span>Perfil de Acesso</span>
        <span>Nível</span>
        <span className="text-right">Ações</span>
      </div>

      <div className="divide-y divide-[#bcc9c4]/20">
        {usuarios.map(usuario => (
          <div
            key={usuario.id}
            className="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center"
          >
            {/* Nome / email / cargo */}
            <div>
              <p className="text-base font-bold text-[#171d1c]">{usuario.nome}</p>
              <p className="mt-0.5 text-sm text-[#3d4945]/70">{usuario.email}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#6d7a75]">
                {usuario.cargoLabel}
              </p>
            </div>

            {/* Template e contagem de módulos */}
            <div className="flex flex-col gap-1.5">
              <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${
                usuario.template === 'customizado'
                  ? 'bg-[#f0f0ff] text-[#5b5bd6]'
                  : usuario.template === 'completo'
                    ? 'bg-[#fff3e0] text-[#b45309]'
                    : 'bg-[#eaf7f3] text-[#006b5a]'
              }`}>
                {TEMPLATE_LABEL[usuario.template] ?? usuario.template}
              </span>
              <span className="text-xs text-[#3d4945]/55">
                {usuario.qtdModulos}/{totalModulos} módulos
                {usuario.isLegado && <span className="ml-1 text-amber-600">· legado</span>}
              </span>
            </div>

            {/* Nível */}
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${NIVEL_STYLE[usuario.nivelAcesso] ?? NIVEL_STYLE.basico}`}>
                {usuario.nivelAcesso}
              </span>
            </div>

            {/* Ação */}
            <div className="md:justify-self-end">
              <ModalEditarAcesso usuario={usuario} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
