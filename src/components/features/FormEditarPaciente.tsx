'use client'

import { useActionState, useEffect } from 'react'
import { editarPaciente } from '@/actions/pacientes'
import Link from 'next/link'
import toast from 'react-hot-toast'

export function FormEditarPaciente({ paciente }: { paciente: any }) {
  const [state, formAction, isPending] = useActionState<any, FormData>(editarPaciente, { error: '', fields: {} })

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error)
    }
  }, [state?.error])

  const getValue = (field: string) => {
    if (state?.fields && state.fields[field] !== undefined) {
      return state.fields[field] as string
    }
    return paciente[field] || ''
  }

  // Define se o paciente está ativo para marcar o select corretamente
  const isAtivo = state?.fields?.ativo !== undefined 
    ? state.fields.ativo === 'true' 
    : paciente.ativo !== false

  return (
    <form action={formAction} className="pb-24">
      <input type="hidden" name="id" value={paciente.id} />

      {/* BLOCO: STATUS DO PACIENTE */}
      <div className="mb-8 p-4 bg-page rounded-md border border-border">
        <label className="block text-sm font-semibold text-text-primary mb-2">Status do Paciente no Sistema</label>
        <select 
          name="ativo" 
          defaultValue={isAtivo ? 'true' : 'false'}
          className="w-full md:w-1/3 bg-surface border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
        >
          <option value="true">✅ Ativo</option>
          <option value="false">🔒 Inativo / Arquivado</option>
        </select>
        <p className="text-xs text-text-tertiary mt-2">
          Pacientes inativos são ocultados da listagem principal, mas mantêm todo o histórico salvo.
        </p>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Dados Pessoais</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-text-secondary mb-1">Nome *</label>
            <input type="text" name="nome" required defaultValue={getValue('nome')} className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">CPF</label>
            <input type="text" name="cpf" defaultValue={getValue('cpf')} className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Data de Nascimento</label>
            <input type="date" name="data_nascimento" defaultValue={getValue('data_nascimento')} className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Telefone Principal *</label>
            <input type="text" name="telefone" required defaultValue={getValue('telefone')} className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Telefone Secundário</label>
            <input type="text" name="telefone_secundario" defaultValue={getValue('telefone_secundario')} className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Email</label>
            <input type="email" name="email" defaultValue={getValue('email')} className="w-full bg-primary-50 border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Gênero</label>
            <select name="genero" defaultValue={getValue('genero')} className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500">
              <option value="">Selecione</option>
              <option value="Feminino">Feminino</option>
              <option value="Masculino">Masculino</option>
              <option value="Outro">Outro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Profissão</label>
            <input type="text" name="profissao" defaultValue={getValue('profissao')} className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">RG</label>
            <input type="text" name="rg" defaultValue={getValue('rg')} className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500" />
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-text-secondary mb-1">Órgão emissor do RG</label>
            <input type="text" name="orgao_emissor_rg" defaultValue={getValue('orgao_emissor_rg')} className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500" />
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Como nos conheceu</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Como soube de nós? *</label>
            <select name="origem" defaultValue={getValue('origem')} className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500">
              <option value="indicacao">Indicação</option>
              <option value="instagram">Instagram</option>
              <option value="google">Google</option>
              <option value="medico">Médico Parceiro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Indicado por</label>
            <input type="text" name="indicado_por" defaultValue={getValue('indicado_por')} className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500" />
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Endereço</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-text-secondary mb-1">Endereço com o número</label>
            <input type="text" name="endereco" defaultValue={getValue('endereco')} className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500" />
          </div>
          <div className="pb-2">
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input type="checkbox" name="endereco_sem_numero" defaultChecked={paciente.endereco_sem_numero} className="rounded border-border-input text-primary-500 focus:ring-primary-500" />
              Endereço sem número
            </label>
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-text-secondary mb-1">Complemento</label>
            <input type="text" name="complemento" defaultValue={getValue('complemento')} className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500" />
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Observações Gerais</h2>
        <div>
          <textarea name="observacoes_gerais" rows={4} defaultValue={getValue('observacoes_gerais')} className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500" />
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Planos de Saúde</h2>
        <div className="md:w-1/3">
          <select name="convenio" defaultValue={getValue('convenio') || 'particular'} className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500">
            <option value="particular">Particular</option>
            <option value="unimed">Unimed</option>
            <option value="ipm">IPM</option>
            <option value="issec">ISSEC</option>
          </select>
        </div>
      </div>

      <div className="fixed bottom-0 right-0 left-[220px] bg-surface border-t border-border p-4 flex justify-end gap-3 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <Link href="/pacientes" className="px-6 py-2 border border-border text-text-secondary rounded-md text-sm font-medium hover:bg-page transition-colors">
          Cancelar
        </Link>
        <button type="submit" disabled={isPending} className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-md text-sm font-semibold transition-colors disabled:opacity-70">
          {isPending ? 'Atualizando...' : 'Atualizar Paciente'}
        </button>
      </div>
    </form>
  )
}