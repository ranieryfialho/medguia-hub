'use client'

import { useActionState, useEffect, useState } from 'react'
import { editarPaciente } from '@/actions/pacientes'
import Link from 'next/link'
import toast from 'react-hot-toast'
import type { OrigemPaciente } from '@/actions/origens-paciente'
import type { PlanoSaude } from '@/actions/planos-saude'
import { ComboboxPaciente } from '@/components/features/pacientes'
import { extrairMetadataInativacao } from '@/lib/paciente-inativacao'

function parseOrigem(origem: string) {
  const [origemBase = '', metaCanal = '', ...resto] = origem.split('::')
  return {
    origemBase,
    metaCanal,
    metaAnuncio: resto.join('::'),
  }
}

function montarOrigem(origemBase: string, metaCanal: string, metaAnuncio: string) {
  if (origemBase !== 'Meta') return origemBase
  return ['Meta', metaCanal.trim(), metaAnuncio.trim()].filter(Boolean).join('::')
}

function tipoOrigem(nome: string) {
  const n = nome.toLowerCase()
  if (n.includes('meta') || n.includes('instagram')) return 'meta'
  if (n.includes('médico') || n.includes('medico')) return 'medico'
  if (n.includes('indicaç') || n.includes('indicac')) return 'indicacao'
  return 'outro'
}

export function FormEditarPaciente({ paciente, origens = [], planos = [] }: { paciente: any; origens?: OrigemPaciente[]; planos?: PlanoSaude[] }) {
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

  const origemInicial = parseOrigem(getValue('origem'))
  const [origemSelecionada, setOrigemSelecionada] = useState<string>(origemInicial.origemBase)
  const [metaCanal, setMetaCanal] = useState<string>(origemInicial.metaCanal)
  const [metaAnuncio, setMetaAnuncio] = useState<string>(origemInicial.metaAnuncio)
  const metadataInativacao = extrairMetadataInativacao(paciente.observacoes_gerais)
  const tipo = tipoOrigem(origemSelecionada)
  const origemPersistida = montarOrigem(origemSelecionada, metaCanal, metaAnuncio)

  // Define se o paciente está ativo para marcar o select corretamente
  const isAtivo = state?.fields?.ativo !== undefined 
    ? state.fields.ativo === 'true' 
    : paciente.ativo !== false
  const [statusAtivoSelecionado, setStatusAtivoSelecionado] = useState<boolean>(isAtivo)
  const [motivoInatividade, setMotivoInatividade] = useState<string>(
    (state?.fields?.motivo_inatividade as string) || metadataInativacao.motivo,
  )
  const [obitoInatividade, setObitoInatividade] = useState<boolean>(
    state?.fields?.obito_inatividade === 'on' || metadataInativacao.obito,
  )

  return (
    <form action={formAction} className="pb-24">
      <input type="hidden" name="id" value={paciente.id} />

      {/* BLOCO: STATUS DO PACIENTE */}
      <div className="mb-8 rounded-2xl border border-[#bcc9c4]/40 bg-white p-5 shadow-sm">
        <label className="block text-sm font-semibold text-[#171d1c] mb-3">Status do Paciente no Sistema</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="group cursor-pointer">
            <input
              type="radio"
              name="ativo"
              value="true"
              defaultChecked={isAtivo}
              onChange={() => setStatusAtivoSelecionado(true)}
              className="peer sr-only"
            />
            <div className="h-full rounded-xl border-2 border-[#bcc9c4]/50 p-4 transition-all hover:bg-[#f0f5f4] peer-checked:border-[#006b5a] peer-checked:bg-[#cce2da]/30">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="block font-bold text-[#171d1c] peer-checked:text-[#006b5a]">Ativo</span>
                  <span className="mt-1 block text-sm text-[#6d7a75]">Paciente disponível na operação diária e nas listagens.</span>
                </div>
                <span className="h-3 w-3 rounded-full bg-transparent ring-2 ring-[#bcc9c4] peer-checked:bg-[#006b5a] peer-checked:ring-[#006b5a]" />
              </div>
            </div>
          </label>
          <label className="group cursor-pointer">
            <input
              type="radio"
              name="ativo"
              value="false"
              defaultChecked={!isAtivo}
              onChange={() => setStatusAtivoSelecionado(false)}
              className="peer sr-only"
            />
            <div className="h-full rounded-xl border-2 border-[#bcc9c4]/50 p-4 transition-all hover:bg-[#f0f5f4] peer-checked:border-[#ba1a1a] peer-checked:bg-[#ffdad6]/40">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="block font-bold text-[#171d1c] peer-checked:text-[#ba1a1a]">Inativo / Arquivado</span>
                  <span className="mt-1 block text-sm text-[#6d7a75]">Paciente oculto da listagem principal, preservando todo o histórico.</span>
                </div>
                <span className="h-3 w-3 rounded-full bg-transparent ring-2 ring-[#bcc9c4] peer-checked:bg-[#ba1a1a] peer-checked:ring-[#ba1a1a]" />
              </div>
            </div>
          </label>
        </div>
        <p className="text-xs text-[#6d7a75] mt-3">
          Pacientes inativos são ocultados da listagem principal, mas mantêm todo o histórico salvo.
        </p>
        {!statusAtivoSelecionado && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Motivo da inatividade</label>
              <input
                type="text"
                name="motivo_inatividade"
                value={motivoInatividade}
                onChange={(e) => setMotivoInatividade(e.target.value)}
                required={!statusAtivoSelecionado}
                className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
                placeholder="Ex: mudança de cidade, alta, óbito..."
              />
            </div>
            <label className="flex items-center gap-2 self-end text-sm text-text-secondary cursor-pointer pb-2">
              <input
                type="checkbox"
                name="obito_inatividade"
                checked={obitoInatividade}
                onChange={(e) => setObitoInatividade(e.target.checked)}
                className="rounded border-border-input text-primary-500 focus:ring-primary-500"
              />
              Óbito
            </label>
          </div>
        )}
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
            <select
              value={origemSelecionada}
              onChange={e => {
                const value = e.target.value
                setOrigemSelecionada(value)
                if (tipoOrigem(value) !== 'meta') {
                  setMetaCanal('')
                  setMetaAnuncio('')
                }
              }}
              className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
            >
              <option value="">Selecione</option>
              {origens.map(o => (
                <option key={o.id} value={o.nome.toLowerCase() === 'instagram' ? 'Meta' : o.nome}>
                  {o.nome.toLowerCase() === 'instagram' ? 'Meta' : o.nome}
                </option>
              ))}
              {!origens.some(o => o.nome.toLowerCase() === 'site') && (
                <option value="Site">Site</option>
              )}
            </select>
            <input type="hidden" name="origem" value={origemPersistida} />
          </div>
          {tipo === 'meta' && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Canal da Meta</label>
              <select
                required
                value={metaCanal}
                onChange={e => setMetaCanal(e.target.value)}
                className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
              >
                <option value="">Selecione</option>
                <option value="Instagram">Instagram</option>
                <option value="Facebook">Facebook</option>
              </select>
            </div>
          )}
          {tipo === 'meta' && (
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-text-secondary mb-1">Nome do anúncio</label>
              <input
                type="text"
                required
                value={metaAnuncio}
                onChange={e => setMetaAnuncio(e.target.value)}
                className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
                placeholder="Ex: Campanha dor lombar maio"
              />
            </div>
          )}
          {(tipo === 'medico' || tipo === 'indicacao') && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                {tipo === 'medico' ? 'Médico que indicou' : 'Indicado por'}
              </label>
              <ComboboxPaciente
                name="indicado_por"
                defaultValue={getValue('indicado_por')}
                tipo={tipo === 'medico' ? 'medico' : 'paciente'}
                placeholder={tipo === 'medico' ? 'Buscar médico parceiro...' : 'Buscar paciente que indicou...'}
              />
            </div>
          )}
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
          <textarea name="observacoes_gerais" rows={4} defaultValue={extrairMetadataInativacao(getValue('observacoes_gerais')).observacoesLimpa} className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500" />
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Planos de Saúde</h2>
        <div className="md:w-1/3">
          <select name="convenio" defaultValue={getValue('convenio') || ''} className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500">
            <option value="">Selecione um plano...</option>
            {planos.map(p => (
              <option key={p.id} value={p.nome}>{p.nome}</option>
            ))}
            {getValue('convenio') && !planos.some(p => p.nome === getValue('convenio')) && (
              <option value={getValue('convenio')}>{getValue('convenio')} (inativo)</option>
            )}
          </select>
        </div>
      </div>

      <div className="fixed bottom-0 right-0 left-55 bg-surface border-t border-border p-4 flex justify-end gap-3 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
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
