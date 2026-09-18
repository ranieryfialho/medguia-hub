import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Eye, Edit, X } from 'lucide-react'
import { BtnWhatsApp } from '@/components/features/shared'
import { BtnArquivarPaciente } from '@/components/features/pacientes'
import { FiltrosPacientes } from '@/components/features/pacientes'
import { PaginacaoPacientes } from '@/components/features/pacientes'
import { requireModulo } from '@/lib/guard'
import { extrairMetadataInativacao } from '@/lib/paciente-inativacao'
import AvatarPaciente from '@/components/features/pacientes/AvatarPaciente'
import { SeletorTagsPaciente } from '@/components/features/pacientes'
import { listarTagsPacienteAtivas, listarTagsPorPacientes } from '@/actions/paciente-tags'
import { isGestorSistema } from '@/lib/permissoes'
import { formatAppDate, getAppDayRangeUTC, parseAppDate } from '@/lib/datetime'

type PacienteListItem = {
  id: string
  nome: string
  cpf: string | null
  email: string | null
  telefone: string | null
  recuperacao_base: boolean | null
  convenio: string | null
  ativo: boolean | null
  observacoes_gerais: string | null
  foto_drive_file_id: string | null
  foto_atualizada_em: string | null
}

export default async function PacientesListPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { user, profile } = await requireModulo('pacientes')

  const supabase = await createClient()

  const resolvedParams = await searchParams
  const mostrarInativos = resolvedParams.inativos === 'true'
  const busca = ((resolvedParams.busca as string) || '').trim()
  const limite = Math.max(1, parseInt((resolvedParams.limite as string) || '50'))
  const pagina = Math.max(1, parseInt((resolvedParams.pagina as string) || '1'))
  const offset = (pagina - 1) * limite

  // Filtro "Pacientes Ativos" vindo do dashboard: quem teve atendimento no período de/até.
  const ativosDe = typeof resolvedParams.ativos_de === 'string' ? resolvedParams.ativos_de : undefined
  const ativosAte = typeof resolvedParams.ativos_ate === 'string' ? resolvedParams.ativos_ate : undefined
  const filtrarAtivosPeriodo = Boolean(ativosDe && ativosAte)

  let pacientes: PacienteListItem[] = []
  let total = 0

  if (filtrarAtivosPeriodo && ativosDe && ativosAte) {
    // Não dá pra filtrar `pacientes.id in (...)` com centenas de UUIDs: a URL fica grande
    // demais e o proxy na frente do Supabase self-hosted derruba a request com 502.
    // Em vez disso, buscamos os atendimentos do período (poucos profissionais no filtro,
    // URL curta) já com o paciente embutido via join, e filtramos/paginamos em memória.
    const isGestorOuMaster = isGestorSistema(profile?.nivel_acesso)
    let profIds: string[] = [user.id]
    if (isGestorOuMaster) {
      const { data: profsData } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['fisioterapeuta', 'gestor'])
        .eq('ativo', true)
      profIds = (profsData ?? []).map((p) => p.id)
    }

    const { start } = getAppDayRangeUTC(ativosDe)
    const { end } = getAppDayRangeUTC(ativosAte)

    const { data: atendData } = await supabase
      .from('atendimentos')
      .select(
        'paciente_id, pacientes(id, nome, cpf, email, telefone, recuperacao_base, convenio, ativo, observacoes_gerais, foto_drive_file_id, foto_atualizada_em)'
      )
      .in('profissional_id', profIds)
      .gte('data_agendamento', start)
      .lte('data_agendamento', end)

    const porId = new Map<string, PacienteListItem>()
    for (const row of atendData ?? []) {
      const p = row.pacientes as unknown as PacienteListItem | null
      if (p && !porId.has(p.id)) porId.set(p.id, p)
    }

    let todos = Array.from(porId.values())

    if (!mostrarInativos) {
      todos = todos.filter((p) => p.ativo !== false)
    }

    if (busca) {
      const buscaLower = busca.toLowerCase()
      todos = todos.filter(
        (p) =>
          p.nome?.toLowerCase().includes(buscaLower) ||
          p.cpf?.includes(busca) ||
          p.telefone?.includes(busca)
      )
    }

    todos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

    total = todos.length
    pacientes = todos.slice(offset, offset + limite)
  } else {
    let query = supabase
      .from('pacientes')
      .select(
        'id, nome, cpf, email, telefone, recuperacao_base, convenio, ativo, observacoes_gerais, foto_drive_file_id, foto_atualizada_em',
        { count: 'exact' }
      )
      .order('nome', { ascending: true })

    if (!mostrarInativos) {
      query = query.or('ativo.eq.true,ativo.is.null')
    }

    if (busca) {
      query = query.or(`nome.ilike.%${busca}%,cpf.ilike.%${busca}%,telefone.ilike.%${busca}%`)
    }

    query = query.range(offset, offset + limite - 1)

    const { data, count } = await query
    pacientes = data ?? []
    total = count ?? 0
  }

  const totalPaginas = Math.ceil(total / limite)

  const [tagsCatalogo, tagsPorPaciente] = await Promise.all([
    listarTagsPacienteAtivas(),
    listarTagsPorPacientes((pacientes ?? []).map((p) => p.id)),
  ])

  return (
    <div className="space-y-6">
      {/* Breadcrumb e Título */}
      <div>
        <div className="text-xs text-text-secondary mb-2 flex items-center gap-2">
          <Link href="/dashboard" className="hover:text-primary-500 transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-text-primary font-medium">Listar Pacientes</span>
        </div>

        <div className="flex items-center justify-between bg-surface p-4 rounded-t-lg border-b border-border">
          <h1 className="text-lg lg:text-xl font-semibold text-text-primary">Listar Pacientes</h1>
          <Link
            href="/pacientes/novo"
            className="bg-[#0A4D68] hover:bg-[#083d53] text-white flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Adicionar</span>
            <span className="sm:hidden">Novo</span>
          </Link>
        </div>
      </div>

      {filtrarAtivosPeriodo && ativosDe && ativosAte && (
        <div className="flex items-center justify-between gap-3 bg-[#f0fcf9] border border-[#006b5a]/20 text-[#006b5a] text-sm px-4 py-2.5 rounded-lg">
          <span>
            Filtrando <strong>pacientes ativos</strong> entre {formatAppDate(parseAppDate(ativosDe))} e {formatAppDate(parseAppDate(ativosAte))}
            {' '}({total} {total === 1 ? 'paciente' : 'pacientes'})
          </span>
          <Link href="/pacientes" className="flex items-center gap-1 font-semibold hover:underline shrink-0">
            <X size={14} />
            Limpar filtro
          </Link>
        </div>
      )}

      <div className="bg-surface rounded-b-lg shadow-sm border border-border -mt-6">
        <FiltrosPacientes />

        {/* Tabela — desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Nome</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">CPF</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Email / Telefone</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase">Tags</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pacientes?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-text-secondary">
                    {busca ? `Nenhum paciente encontrado para "${busca}".` : 'Nenhum paciente encontrado.'}
                  </td>
                </tr>
              )}
              {pacientes?.map((paciente) => {
                const numeroLimpo = paciente.telefone?.replace(/\D/g, '') || ''
                const isAtivo = paciente.ativo !== false
                const metaInativacao = extrairMetadataInativacao(paciente.observacoes_gerais)

                return (
                  <tr key={paciente.id} className={`transition-colors group ${!isAtivo ? 'bg-page/40 opacity-75' : 'hover:bg-page/50'}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <AvatarPaciente
                          nome={paciente.nome}
                          fotoDriveFileId={paciente.foto_drive_file_id}
                          fotoAtualizadaEm={paciente.foto_atualizada_em}
                          size="sm"
                          ampliavel
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-text-primary">{paciente.nome}</span>
                          {!isAtivo ? (
                            <span className="text-[10px] font-bold text-error uppercase tracking-wider">Inativo</span>
                          ) : (
                            <span className="text-[10px] font-bold text-[#25D366] uppercase tracking-wider">Ativo</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {paciente.cpf || 'Não informado'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-text-primary">{paciente.email || '-'}</span>
                        <span className="text-sm text-text-link hover:underline cursor-pointer">{paciente.telefone || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <SeletorTagsPaciente
                          pacienteId={paciente.id}
                          tagsAtuais={tagsPorPaciente[paciente.id] ?? []}
                          catalogo={tagsCatalogo}
                        />
                        {paciente.recuperacao_base && (
                          <span className="inline-block px-3 py-1 bg-[#f5f3ff] text-[#4f46e5] text-xs font-semibold rounded-full border border-[#ddd6fe]">
                            Recuperação de Base
                          </span>
                        )}
                        {!isAtivo && metaInativacao.obito && (
                          <span className="inline-block px-3 py-1 bg-[#ffdad6] text-[#ba1a1a] text-xs font-semibold rounded-full border border-[#ba1a1a]/20">
                            Óbito
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-3 text-text-tertiary">
                        <Link href={`/pacientes/${paciente.id}`} className="hover:text-primary-500 transition-colors" title="Visualizar">
                          <Eye size={18} />
                        </Link>
                        <Link href={`/pacientes/${paciente.id}/editar`} className="hover:text-primary-500 transition-colors" title="Editar">
                          <Edit size={18} />
                        </Link>
                        <BtnWhatsApp numero={numeroLimpo} />
                        {isAtivo && (
                          <BtnArquivarPaciente id={paciente.id} nome={paciente.nome} />
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Cards — mobile */}
        <div className="md:hidden divide-y divide-border">
          {pacientes?.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-text-secondary">
              {busca ? `Nenhum paciente encontrado para "${busca}".` : 'Nenhum paciente encontrado.'}
            </p>
          )}
          {pacientes?.map((paciente) => {
            const numeroLimpo = paciente.telefone?.replace(/\D/g, '') || ''
            const isAtivo = paciente.ativo !== false
            const metaInativacao = extrairMetadataInativacao(paciente.observacoes_gerais)

            return (
              <div key={paciente.id} className={`px-4 py-3 flex items-center gap-3 ${!isAtivo ? 'opacity-60' : ''}`}>
                <AvatarPaciente
                  nome={paciente.nome}
                  fotoDriveFileId={paciente.foto_drive_file_id}
                  fotoAtualizadaEm={paciente.foto_atualizada_em}
                  size="md"
                  ampliavel
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary truncate">{paciente.nome}</p>
                  <p className="text-xs text-text-secondary truncate">{paciente.telefone || paciente.email || 'Sem contato'}</p>
                  {paciente.recuperacao_base ? (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-[#f5f3ff] text-[#4f46e5] text-[10px] font-semibold rounded-full border border-[#ddd6fe]">
                      Recuperação de Base
                    </span>
                  ) : (
                    paciente.convenio && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-[#E8F0FE] text-[#1A73E8] text-[10px] font-semibold rounded-full">
                        {paciente.convenio}
                      </span>
                    )
                  )}
                  {!isAtivo && metaInativacao.obito && (
                    <span className="inline-block mt-1 ml-1 px-2 py-0.5 bg-[#ffdad6] text-[#ba1a1a] text-[10px] font-semibold rounded-full border border-[#ba1a1a]/20">
                      Óbito
                    </span>
                  )}
                  <div className="mt-1.5">
                    <SeletorTagsPaciente
                      pacienteId={paciente.id}
                      tagsAtuais={tagsPorPaciente[paciente.id] ?? []}
                      catalogo={tagsCatalogo}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-text-tertiary">
                  <Link href={`/pacientes/${paciente.id}`} title="Visualizar">
                    <Eye size={17} />
                  </Link>
                  <Link href={`/pacientes/${paciente.id}/editar`} title="Editar">
                    <Edit size={17} />
                  </Link>
                  <BtnWhatsApp numero={numeroLimpo} />
                </div>
              </div>
            )
          })}
        </div>

        <PaginacaoPacientes
          paginaAtual={pagina}
          totalPaginas={totalPaginas}
          total={total}
          limite={limite}
          offset={offset}
        />
      </div>
    </div>
  )
}
