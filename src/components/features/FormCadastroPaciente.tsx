'use client'

import { useActionState, useEffect, useState } from 'react'
import { criarPaciente } from '@/actions/pacientes'
import Link from 'next/link'
import { UploadCloud } from 'lucide-react'
import toast from 'react-hot-toast'
import type { OrigemPaciente } from '@/actions/origens-paciente'
import { ComboboxPaciente } from '@/components/features/ComboboxPaciente'

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

export function FormCadastroPaciente({ origens = [] }: { origens?: OrigemPaciente[] }) {
  const [state, formAction, isPending] = useActionState<any, FormData>(criarPaciente, { error: '', fields: {} })
  const origemInicial = parseOrigem(state?.fields?.origem as string || '')
  const [origemSelecionada, setOrigemSelecionada] = useState(origemInicial.origemBase)
  const [metaCanal, setMetaCanal] = useState(origemInicial.metaCanal)
  const [metaAnuncio, setMetaAnuncio] = useState(origemInicial.metaAnuncio)

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error)
    }
  }, [state?.error])

  const tipo = tipoOrigem(origemSelecionada)
  const origemPersistida = montarOrigem(origemSelecionada, metaCanal, metaAnuncio)

  return (
    <form action={formAction} className="pb-24">
      {/* Bloco: Dados Pessoais */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Dados Pessoais</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-text-secondary mb-1">Nome *</label>
            <input 
              type="text" 
              name="nome" 
              required 
              defaultValue={state?.fields?.nome as string || ''}
              className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500" 
              placeholder="Nome completo" 
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">CPF</label>
            <input 
              type="text" 
              name="cpf" 
              defaultValue={state?.fields?.cpf as string || ''}
              className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500" 
              placeholder="000.000.000-00" 
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Data de Nascimento</label>
            <input 
              type="date" 
              name="data_nascimento" 
              defaultValue={state?.fields?.data_nascimento as string || ''}
              className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500" 
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Telefone Principal *</label>
            <input 
              type="text" 
              name="telefone" 
              required 
              defaultValue={state?.fields?.telefone as string || ''}
              className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500" 
              placeholder="(00) 00000-0000" 
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Telefone Secundário</label>
            <input 
              type="text" 
              name="telefone_secundario" 
              defaultValue={state?.fields?.telefone_secundario as string || ''}
              className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500" 
              placeholder="(00) 00000-0000" 
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Email</label>
            <input 
              type="email" 
              name="email" 
              defaultValue={state?.fields?.email as string || ''}
              className="w-full bg-primary-50 border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500" 
              placeholder="contato@exemplo.com" 
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Gênero</label>
            <select 
              name="genero" 
              defaultValue={state?.fields?.genero as string || ''}
              className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
            >
              <option value="">Selecione</option>
              <option value="Feminino">Feminino</option>
              <option value="Masculino">Masculino</option>
              <option value="Outro">Outro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Profissão</label>
            <input 
              type="text" 
              name="profissao" 
              defaultValue={state?.fields?.profissao as string || ''}
              className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500" 
              placeholder="Selecione uma profissão" 
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">RG</label>
            <input 
              type="text" 
              name="rg" 
              defaultValue={state?.fields?.rg as string || ''}
              className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500" 
              placeholder="RG" 
            />
          </div>
          
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-text-secondary mb-1">Órgão emissor do RG</label>
            <input 
              type="text" 
              name="orgao_emissor_rg" 
              defaultValue={state?.fields?.orgao_emissor_rg as string || ''}
              className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500" 
              placeholder="Órgão emissor do RG" 
            />
          </div>
        </div>
      </div>

      {/* Bloco: Imagem (Placeholder Visual) */}
      <div className="mb-8">
        <label className="block text-xs font-medium text-text-secondary mb-2">Imagem</label>
        <div className="w-full border-2 border-dashed border-border-input rounded-lg p-8 flex flex-col items-center justify-center text-center cursor-not-allowed bg-page/50">
          <UploadCloud className="text-text-tertiary mb-2" size={32} />
          <p className="text-sm text-text-primary">
            <span className="text-primary-500 font-medium">Clique para fazer upload</span> ou arraste e solte
          </p>
          <p className="text-xs text-text-secondary mt-1">PNG, JPG ou JPEG (máx. 10MB)</p>
        </div>
      </div>

      {/* Bloco: Como nos conheceu */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Como nos conheceu</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Como soube de nós? *</label>
            <select
              required
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
                defaultValue={state?.fields?.indicado_por as string || ''}
                tipo={tipo === 'medico' ? 'medico' : 'paciente'}
                placeholder={tipo === 'medico' ? 'Buscar médico parceiro...' : 'Buscar paciente que indicou...'}
              />
            </div>
          )}
        </div>
      </div>

      {/* Bloco: Endereço */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Endereço</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-text-secondary mb-1">Endereço com o número</label>
            <input 
              type="text" 
              name="endereco" 
              defaultValue={state?.fields?.endereco as string || ''}
              className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500" 
              placeholder="Digite o endereço" 
            />
          </div>
          <div className="pb-2">
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input 
                type="checkbox" 
                name="endereco_sem_numero" 
                defaultChecked={state?.fields?.endereco_sem_numero === 'on'}
                className="rounded border-border-input text-primary-500 focus:ring-primary-500" 
              />
              Endereço sem número
            </label>
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-text-secondary mb-1">Complemento</label>
            <input 
              type="text" 
              name="complemento" 
              defaultValue={state?.fields?.complemento as string || ''}
              className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500" 
              placeholder="Complemento" 
            />
          </div>
        </div>
      </div>

      {/* Bloco: Observações Gerais */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Observações Gerais</h2>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Histórico Clínico, Doenças e Alergias</label>
          <textarea 
            name="observacoes_gerais" 
            rows={4}
            defaultValue={state?.fields?.observacoes_gerais as string || ''}
            className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500" 
            placeholder="Digite aqui as doenças preexistentes, alergias ou observações importantes sobre o paciente..."
          />
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Planos de Saúde</h2>
        <div className="md:w-1/3">
          <label className="block text-xs font-medium text-text-secondary mb-1">Planos de Saúde</label>
          <select 
            name="convenio" 
            defaultValue={state?.fields?.convenio as string || 'particular'}
            className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
          >
            <option value="particular">Particular</option>
            <option value="unimed">Unimed</option>
            <option value="ipm">IPM</option>
            <option value="issec">ISSEC</option>
          </select>
        </div>
      </div>

      <div className="fixed bottom-0 right-0 left-[220px] bg-surface border-t border-border p-4 flex justify-end gap-3 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <Link 
          href="/pacientes"
          className="px-6 py-2 border border-border text-text-secondary rounded-md text-sm font-medium hover:bg-page transition-colors"
        >
          Descartar
        </Link>
        <button 
          type="submit" 
          disabled={isPending}
          className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-md text-sm font-semibold transition-colors disabled:opacity-70"
        >
          {isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}
