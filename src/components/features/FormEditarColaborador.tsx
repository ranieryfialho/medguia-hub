'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { editarColaborador } from '@/actions/equipe'
import {
  AlertCircle,
  Briefcase,
  ChevronLeft,
  FileText,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  User,
} from 'lucide-react'

type ColaboradorFormData = {
  id: string
  nome: string
  cpf: string
  email: string
  telefone: string
  cargo: string
  nivelAcesso: string
  conselho: string
  especialidade: string
}

export function FormEditarColaborador({ colaborador }: { colaborador: ColaboradorFormData }) {
  const [state, formAction, isPending] = useActionState(editarColaborador, null)

  return (
    <div className="space-y-6 w-full">
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
              Atualizando os dados de {colaborador.nome}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#bcc9c4]/30 rounded-3xl p-6 sm:p-8 shadow-sm">
        <form action={formAction} className="space-y-8">
          <input type="hidden" name="id" value={colaborador.id} />

          {state?.error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-[#ba1a1a]/10 border border-[#ba1a1a]/20 text-[#ba1a1a]">
              <AlertCircle size={18} className="shrink-0" />
              <p className="text-sm font-bold">{state.error}</p>
            </div>
          )}

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
                    defaultValue={colaborador.nome}
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
                    defaultValue={colaborador.cpf}
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
                    defaultValue={colaborador.email}
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
                    defaultValue={colaborador.telefone}
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
                    { id: 'medico', label: 'Médico', desc: 'Médicos parceiros' },
                    { id: 'gestor', label: 'Gestor', desc: 'Acesso total e métricas' },
                  ].map((perfil) => (
                    <label key={perfil.id} className="relative cursor-pointer group">
                      <input
                        type="radio"
                        name="cargo"
                        value={perfil.id}
                        defaultChecked={colaborador.cargo === perfil.id}
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

              <div className="space-y-2 lg:col-span-2">
                <label className="text-sm font-bold text-[#3d4945] block">Nível de Acesso *</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { id: 'basico', label: 'Básico', desc: 'Usa apenas os módulos liberados' },
                    { id: 'gestor', label: 'Gestor', desc: 'Pode ajustar acessos de outros usuários' },
                    { id: 'master', label: 'Master', desc: 'Recebe todos os módulos automaticamente' },
                  ].map((nivel) => (
                    <label key={nivel.id} className="relative cursor-pointer group">
                      <input
                        type="radio"
                        name="nivel_acesso"
                        value={nivel.id}
                        defaultChecked={colaborador.nivelAcesso === nivel.id}
                        className="peer sr-only"
                        required
                      />
                      <div className="h-full border-2 border-[#bcc9c4]/50 rounded-xl p-5 hover:bg-[#f0f5f4] transition-all peer-checked:border-[#006b5a] peer-checked:bg-[#cce2da]/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-[#171d1c] group-hover:text-[#006b5a] peer-checked:text-[#006b5a]">{nivel.label}</span>
                          <ShieldCheck size={20} className="text-transparent peer-checked:text-[#006b5a]" />
                        </div>
                        <p className="text-xs font-medium text-[#3d4945]/60 leading-tight">{nivel.desc}</p>
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
                  defaultValue={colaborador.conselho}
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
                  defaultValue={colaborador.especialidade}
                  className="w-full bg-[#f0f5f4] border border-[#bcc9c4]/50 rounded-xl px-4 py-3 text-[#171d1c] focus:outline-none focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] transition-all font-medium"
                />
              </div>
            </div>
          </div>

          <div className="pt-8 mt-8 border-t border-[#bcc9c4]/30 flex flex-col sm:flex-row items-center justify-end gap-4">
            <Link href="/equipe" className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-[#3d4945] hover:bg-[#f0f5f4] transition-colors text-center">
              Cancelar
            </Link>
            <button type="submit" disabled={isPending} className="w-full sm:w-auto bg-gradient-to-r from-[#006b5a] to-[#33a68f] text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-md shadow-[#006b5a]/20 disabled:opacity-70">
              <Save size={20} />
              {isPending ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
