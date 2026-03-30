import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Eye, Edit } from 'lucide-react'
import { BtnWhatsApp } from '@/components/features/BtnWhatsApp'
import { BtnArquivarPaciente } from '@/components/features/BtnArquivarPaciente'
import { FiltrosPacientes } from '@/components/features/FiltrosPacientes'

export default async function PacientesListPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  
  // 1. Resolve os parâmetros da URL para saber se a checkbox está marcada
  const resolvedParams = await searchParams
  const mostrarInativos = resolvedParams.inativos === 'true'

  // 2. Monta a Query do Supabase dinamicamente
  let query = supabase
    .from('pacientes')
    .select('*')
    .order('created_at', { ascending: false })

  // Se NÃO for para mostrar inativos, filtramos para trazer apenas os ativos
  if (!mostrarInativos) {
    query = query.or('ativo.eq.true,ativo.is.null')
  }

  const { data: pacientes, error } = await query

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
          <h1 className="text-xl font-semibold text-text-primary">Listar Pacientes</h1>
          <Link 
            href="/pacientes/novo" 
            className="bg-[#0A4D68] hover:bg-[#083d53] text-white flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Adicionar
          </Link>
        </div>
      </div>

      <div className="bg-surface rounded-b-lg shadow-sm border border-border -mt-6">
        
        {/* Renderiza o novo Componente Cliente com a Checkbox */}
        <FiltrosPacientes />

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
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
                    Nenhum paciente encontrado.
                  </td>
                </tr>
              )}
              {pacientes?.map((paciente) => {
                const iniciais = paciente.nome.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()
                const numeroLimpo = paciente.telefone?.replace(/\D/g, '') || ''
                const isAtivo = paciente.ativo !== false // default é true

                return (
                  <tr key={paciente.id} className={`transition-colors group ${!isAtivo ? 'bg-page/40 opacity-75' : 'hover:bg-page/50'}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-border flex items-center justify-center text-xs font-medium text-text-secondary shrink-0">
                          {iniciais}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-text-primary">{paciente.nome}</span>
                          {/* BADGE DE STATUS */}
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
                      <span className="inline-block px-3 py-1 bg-[#E8F0FE] text-[#1A73E8] text-xs font-semibold rounded-full">
                        {paciente.convenio || 'Sem tags'}
                      </span>
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
      </div>
    </div>
  )
}