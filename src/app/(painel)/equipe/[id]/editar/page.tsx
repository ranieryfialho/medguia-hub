import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { editarColaborador } from '@/actions/equipe'
import { 
  ChevronLeft, 
  Save, 
  User, 
  Mail, 
  Phone, 
  Briefcase, 
  FileText,
  ShieldCheck
} from 'lucide-react'

export default async function EditarColaboradorPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()

  // 1. Resolução correta da Promise de parâmetros do Next.js 15
  const resolvedParams = await params
  const colaboradorId = resolvedParams.id

  // 2. Busca os dados atuais do colaborador pelo ID
  const { data: colaborador, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', colaboradorId)
    .single()

  // Se não encontrar o colaborador (ou se o ID for inválido), mostra a tela de 404
  if (error || !colaborador) {
    notFound()
  }

  // 3. BYPASS DE TIPAGEM: Evita erro de TypeScript pois as colunas foram criadas via SQL
  const dadosColab = colaborador as any

  // Normaliza os nomes das colunas
  const nomeAtual = dadosColab.nome || dadosColab.full_name || ''
  const cargoAtual = dadosColab.cargo || dadosColab.role || 'fisioterapeuta'

  return (
    <div className="space-y-6 w-full">
      
      {/* CABEÇALHO */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            href="/equipe" 
            className="w-10 h-10 rounded-full flex items-center justify-center bg-[#f0f5f4] hover:bg-[#dee3e3] transition-colors text-[#171d1c]"
          >
            <ChevronLeft size={24} />
          </Link>
          <div>
            <h2 className="font-bold text-2xl text-[#171d1c]">Editar Colaborador</h2>
            <p className="text-sm font-medium text-[#3d4945]/70 mt-1">
              Atualizando os dados de {nomeAtual}
            </p>
          </div>
        </div>
      </div>
    
      {/* ÁREA DO FORMULÁRIO (Conectada com editarColaborador) */}
      <div className="bg-white border border-[#bcc9c4]/30 rounded-3xl p-6 sm:p-8 shadow-sm">
        <form action={editarColaborador} className="space-y-8">
          
          {/* Input Oculto para enviar o ID do usuário para a Action */}
          <input type="hidden" name="id" value={dadosColab.id} />

          <div className="space-y-6">
            <h3 className="text-sm font-extrabold text-[#006b5a] uppercase tracking-widest border-b border-[#bcc9c4]/30 pb-2 flex items-center gap-2">
              <User size={18} />
              Dados Pessoais
            </h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 xl:gap-8">
              <div className="space-y-2">
                <label htmlFor="nome" className="text-sm font-bold text-[#3d4945] block">Nome Completo *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#3d4945]/50">
                    <User size={18} />
                  </div>
                  <input 
                    type="text" 
                    id="nome" 
                    name="nome" 
                    required 
                    defaultValue={nomeAtual}
                    className="w-full bg-[#f0f5f4] border border-[#bcc9c4]/50 rounded-xl pl-11 pr-4 py-3 text-[#171d1c] focus:outline-none focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] transition-all font-medium" 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="cpf" className="text-sm font-bold text-[#3d4945] block">CPF *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#3d4945]/50">
                    <FileText size={18} />
                  </div>
                  <input 
                    type="text" 
                    id="cpf" 
                    name="cpf" 
                    required 
                    defaultValue={dadosColab.cpf || ''}
                    className="w-full bg-[#f0f5f4] border border-[#bcc9c4]/50 rounded-xl pl-11 pr-4 py-3 text-[#171d1c] focus:outline-none focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] transition-all font-medium" 
                  />
                </div>
              </div>

              <div className="space-y-2 opacity-70">
                <label htmlFor="email" className="text-sm font-bold text-[#3d4945] flex items-center justify-between">
                  <span>E-mail (Login)</span>
                  <span className="text-[10px] font-bold text-[#ba1a1a] uppercase">Bloqueado</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#3d4945]/50">
                    <Mail size={18} />
                  </div>
                  <input 
                    type="email" 
                    defaultValue={dadosColab.email || ''}
                    disabled
                    readOnly
                    className="w-full bg-[#dee3e3]/50 border border-[#bcc9c4]/30 rounded-xl pl-11 pr-4 py-3 text-[#3d4945] cursor-not-allowed font-medium" 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="telefone" className="text-sm font-bold text-[#3d4945] block">Telefone / WhatsApp *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#3d4945]/50">
                    <Phone size={18} />
                  </div>
                  <input 
                    type="tel" 
                    id="telefone" 
                    name="telefone" 
                    required 
                    defaultValue={dadosColab.telefone || ''}
                    className="w-full bg-[#f0f5f4] border border-[#bcc9c4]/50 rounded-xl pl-11 pr-4 py-3 text-[#171d1c] focus:outline-none focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] transition-all font-medium" 
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6 pt-4">
            <h3 className="text-sm font-extrabold text-[#006b5a] uppercase tracking-widest border-b border-[#bcc9c4]/30 pb-2 flex items-center gap-2">
              <Briefcase size={18} />
              Atuação Profissional
            </h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 xl:gap-8">
              
              <div className="space-y-2 lg:col-span-2">
                <label className="text-sm font-bold text-[#3d4945] block">Perfil de Acesso (Cargo) *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-6">
                  {[
                    { id: 'fisioterapeuta', label: 'Fisioterapeuta', desc: 'Atendimentos e prontuários' },
                    { id: 'recepcionista', label: 'Recepcionista', desc: 'Agenda e pacientes' },
                    { id: 'medico', label: 'Médico Parceiro', desc: 'Acompanhamento' },
                    { id: 'gestor', label: 'Gestor', desc: 'Acesso total e métricas' },
                  ].map((perfil) => (
                    <label key={perfil.id} className="relative cursor-pointer group">
                      <input 
                        type="radio" 
                        name="cargo" 
                        value={perfil.id} 
                        defaultChecked={cargoAtual === perfil.id}
                        className="peer sr-only" 
                        required 
                      />
                      <div className="h-full border-2 border-[#bcc9c4]/50 rounded-xl p-5 hover:bg-[#f0f5f4] transition-all peer-checked:border-[#006b5a] peer-checked:bg-[#cce2da]/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-[#171d1c] group-hover:text-[#006b5a] peer-checked:text-[#006b5a]">{perfil.label}</span>
                          <ShieldCheck size={20} className="text-transparent peer-checked:text-[#006b5a]" />
                        </div>
                        <p className="text-xs font-medium text-[#3d4945]/60 leading-tight">{perfil.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="conselho" className="text-sm font-bold text-[#3d4945] flex items-center justify-between">
                  <span>Registro Profissional</span>
                  <span className="text-[10px] font-medium text-[#3d4945]/50 uppercase">Opcional</span>
                </label>
                <input 
                  type="text" 
                  id="conselho" 
                  name="conselho" 
                  defaultValue={dadosColab.conselho || ''}
                  className="w-full bg-[#f0f5f4] border border-[#bcc9c4]/50 rounded-xl px-4 py-3 text-[#171d1c] focus:outline-none focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] transition-all font-medium" 
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="especialidade" className="text-sm font-bold text-[#3d4945] flex items-center justify-between">
                  <span>Especialidade</span>
                  <span className="text-[10px] font-medium text-[#3d4945]/50 uppercase">Opcional</span>
                </label>
                <input 
                  type="text" 
                  id="especialidade" 
                  name="especialidade" 
                  defaultValue={dadosColab.especialidade || ''}
                  className="w-full bg-[#f0f5f4] border border-[#bcc9c4]/50 rounded-xl px-4 py-3 text-[#171d1c] focus:outline-none focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] transition-all font-medium" 
                />
              </div>

            </div>
          </div>

          <div className="pt-8 mt-8 border-t border-[#bcc9c4]/30 flex flex-col sm:flex-row items-center justify-end gap-4">
            <Link href="/equipe" className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-[#3d4945] hover:bg-[#f0f5f4] transition-colors text-center">
              Cancelar
            </Link>
            <button type="submit" className="w-full sm:w-auto bg-gradient-to-r from-[#006b5a] to-[#33a68f] text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-md shadow-[#006b5a]/20">
              <Save size={20} />
              Salvar Alterações
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}