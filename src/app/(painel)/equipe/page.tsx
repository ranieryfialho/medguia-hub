import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Plus, User, Mail } from 'lucide-react'
import { MenuAcoesColaborador } from '@/components/features/MenuAcoesColaborador'
import { FiltrosEquipe } from '@/components/features/FiltrosEquipe'

// Mapeamento de estilos para cada cargo
const getCargoConfig = (cargo: string) => {
  const configs: Record<string, any> = {
    'fisioterapeuta': { bg: 'bg-[#cce2da]', text: 'text-[#006b5a]', label: 'Fisioterapeuta' },
    'recepcionista': { bg: 'bg-[#c3e8fd]', text: 'text-[#406375]', label: 'Recepcionista' },
    'medico': { bg: 'bg-[#dee3e3]', text: 'text-[#6d7a75]', label: 'Médico' },
    'gestor': { bg: 'bg-[#3d4945]', text: 'text-white', label: 'Gestor' },
    'default': { bg: 'bg-[#f0f5f4]', text: 'text-[#3d4945]', label: 'Colaborador' }
  }
  return configs[cargo?.toLowerCase()] || configs['default']
}

export default async function EquipePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const resolvedParams = await searchParams
  const busca = ((resolvedParams.busca as string) || '').trim().toLowerCase()

  // Busca os usuários na tabela profiles
  const { data: perfis, error } = await supabase
    .from('profiles')
    .select('*')

  if (error) {
    console.error('Erro ao buscar equipe na tabela profiles:', error.message)
  }

  // Filtra e ordena os membros
  const listaEquipe = (perfis || [])
    .filter(m => {
      const nome = (m.full_name || m.nome || '')
      if ((m.role || m.cargo || '').toLowerCase() === 'master') return false
      if (!busca) return true
      const email = (m.email || '').toLowerCase()
      const cargo = (m.role || m.cargo || '').toLowerCase()
      return nome.toLowerCase().includes(busca) || email.includes(busca) || cargo.includes(busca)
    })
    .sort((a, b) => {
      const nomeA = a.nome || a.full_name || ''
      const nomeB = b.nome || b.full_name || ''
      return nomeA.localeCompare(nomeB)
    })

  const totalEquipe = listaEquipe.length

  return (
    <div className="space-y-6">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-2xl text-[#171d1c]">Equipe</h2>
          <p className="text-sm font-medium text-[#3d4945]/70 mt-1">
            Gerencie os profissionais e acessos do sistema ({totalEquipe} registrados)
          </p>
        </div>
        
        <Link 
          href="/equipe/novo" 
          className="bg-gradient-to-r from-[#006b5a] to-[#33a68f] text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-md shadow-[#006b5a]/20"
        >
          <Plus size={20} />
          Novo Colaborador
        </Link>
      </div>

      {/* BARRA DE PESQUISA E FILTROS */}
      <div className="bg-white p-4 rounded-2xl border border-[#bcc9c4]/30 shadow-sm flex flex-col sm:flex-row gap-4">
        <FiltrosEquipe />
      </div>

      {/* LISTA DE COLABORADORES */}
      <div className="bg-white border border-[#bcc9c4]/30 rounded-3xl shadow-sm">
        
        {listaEquipe.length > 0 ? (
          <div className="divide-y divide-[#bcc9c4]/30">
            {listaEquipe.map((membro) => {
              const cargoMembro = membro.cargo || membro.role || 'default'
              const nomeMembro = membro.nome || membro.full_name || 'Usuário Sem Nome'
              const emailMembro = membro.email || 'Email não informado'
              const isAtivo = membro.ativo !== false // Assume como ativo se for null/undefined
              
              const config = getCargoConfig(cargoMembro)
              const iniciais = nomeMembro.substring(0, 2).toUpperCase()

              return (
                <div 
                  key={membro.id} 
                  className={`p-4 sm:p-6 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 first:rounded-t-3xl last:rounded-b-3xl ${
                    isAtivo ? 'hover:bg-[#f9fbfb]' : 'bg-[#f0f5f4]/50 opacity-70 grayscale-[30%]'
                  }`}
                >
                  
                  <div className="flex items-center gap-4">
                    {/* Avatar Dinâmico */}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-sm shrink-0 ${
                      isAtivo ? 'bg-[#dee3e3] text-[#3d4945]' : 'bg-[#bcc9c4]/50 text-[#3d4945]/50'
                    }`}>
                      {iniciais}
                    </div>
                    
                    {/* Informações Principais */}
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className={`font-bold text-lg leading-none ${
                          isAtivo ? 'text-[#171d1c]' : 'text-[#3d4945] line-through decoration-[#ba1a1a]/40'
                        }`}>
                          {nomeMembro}
                        </h4>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${config.bg} ${config.text}`}>
                          {config.label}
                        </span>
                        
                        {/* Tag vermelha se o usuário estiver inativo */}
                        {!isAtivo && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#ba1a1a]/10 text-[#ba1a1a] border border-[#ba1a1a]/20">
                            Inativo
                          </span>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm font-medium text-[#3d4945]/70">
                        <span className="flex items-center gap-1.5 break-all">
                          <Mail size={14} className="shrink-0" />
                          {emailMembro}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ações (3 Pontinhos Client Component) */}
                  {/* Removidas as classes de opacidade que causavam o bug */}
                  <div className="mt-2 sm:mt-0 flex justify-end">
                    <MenuAcoesColaborador id={membro.id} isAtivo={isAtivo} />
                  </div>
                  
                </div>
              )
            })}
          </div>
        ) : (
          <div className="py-16 flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 bg-[#f0f5f4] rounded-full flex items-center justify-center text-[#bcc9c4] mb-4">
              <User size={32} />
            </div>
            <h3 className="text-lg font-bold text-[#171d1c] mb-1">Nenhum colaborador encontrado</h3>
            <p className="text-sm font-medium text-[#3d4945]/70 max-w-md mx-auto mb-6">
              {busca ? `Nenhum resultado para "${busca}".` : 'Você ainda não cadastrou nenhum membro na equipe ou os perfis não possuem dados públicos.'}
            </p>
            <Link 
              href="/equipe/novo" 
              className="bg-[#006b5a] text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#005a4c] transition-colors shadow-sm"
            >
              <Plus size={18} />
              Cadastrar Primeiro Membro
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}