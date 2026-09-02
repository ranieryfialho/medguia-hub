'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { buscarPacientesPorNome, criarPaciente, type PacienteDuplicado, type PacienteFormState } from '@/actions/pacientes'
import Link from 'next/link'
import { Loader2, UploadCloud } from 'lucide-react'
import toast from 'react-hot-toast'
import type { OrigemPaciente } from '@/actions/origens-paciente'
import type { PlanoSaude } from '@/actions/planos-saude'
import { ComboboxPaciente } from '@/components/features/pacientes'
import { formatarCPF, formatarRG, formatarTelefone, mascararCPFInput, mascararRGInput, mascararTelefoneInput } from '@/lib/input-masks'
import { gerarPreviewImagem, redimensionarImagem, revogarPreviewImagem, validarArquivoImagem } from '@/lib/imagem'

const MENSAGEM_FALHA_FOTO = 'Paciente cadastrado com sucesso, mas a foto não pôde ser salva agora. Você pode enviá-la depois pela edição do cadastro.'

export interface DepsEnvioFotoPosCadastro {
  uploadFoto: (pacienteId: string, file: File) => Promise<Response>
  toastSuccess: (mensagem: string) => void
  toastWarning: (mensagem: string) => void
}

// @spec:AC-088 @spec:AC-089 — chamada só depois que `criarPaciente` (T-003) devolve
// `pacienteId` (cadastro textual já concluído). Falha do Drive (resposta não-ok ou
// exceção de rede) nunca vira erro fatal: mostra warning e deixa o cadastro seguir,
// já que o paciente já existe e a foto pode ser reenviada depois pela edição.
export async function enviarFotoAposCadastro(
  pacienteId: string,
  file: File,
  deps: DepsEnvioFotoPosCadastro,
): Promise<void> {
  try {
    const response = await deps.uploadFoto(pacienteId, file)
    if (response.ok) {
      deps.toastSuccess('Paciente cadastrado com sucesso.')
    } else {
      deps.toastWarning(MENSAGEM_FALHA_FOTO)
    }
  } catch {
    deps.toastWarning(MENSAGEM_FALHA_FOTO)
  }
}

async function uploadFotoPaciente(pacienteId: string, file: File): Promise<Response> {
  const formData = new FormData()
  formData.append('file', file)
  return fetch(`/api/pacientes/${pacienteId}/foto`, { method: 'POST', body: formData })
}

type CadastroPacienteState = PacienteFormState
type NomeSuggestion = {
  id: string
  nome: string
  detalhe?: string
}

function parseOrigem(origem: string) {
  const [origemBase = '', segundoNivel = ''] = origem.split('::')
  const baseNormalizada = origemBase.trim().toLowerCase()

  if (baseNormalizada === 'meta' || baseNormalizada === 'facebook') {
    return {
      origemBase,
      metaCanal: '',
      metaAnuncio: segundoNivel,
    }
  }

  return {
    origemBase,
    metaCanal: '',
    metaAnuncio: '',
  }
}

function montarOrigem(origemBase: string, metaCanal: string, metaAnuncio: string) {
  const base = origemBase.trim().toLowerCase()
  if (base === 'facebook' || base === 'meta') {
    return [origemBase, metaAnuncio.trim()].filter(Boolean).join('::')
  }
  return origemBase
}

function tipoOrigem(nome: string) {
  const n = nome.toLowerCase()
  if (n.includes('facebook') || n.includes('meta')) return 'facebook'
  if (n.includes('médico') || n.includes('medico')) return 'medico'
  if (n.includes('indicaç') || n.includes('indicac')) return 'indicacao'
  return 'outro'
}

export function FormCadastroPaciente({ origens = [], planos = [] }: { origens?: OrigemPaciente[]; planos?: PlanoSaude[] }) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState<CadastroPacienteState, FormData>(criarPaciente, { error: '', fields: {} })
  const [isBuscandoNome, startBuscaNome] = useTransition()
  const origemInicial = parseOrigem(state?.fields?.origem as string || '')
  const [origemSelecionada, setOrigemSelecionada] = useState(origemInicial.origemBase)
  const [metaCanal] = useState(origemInicial.metaCanal)
  const [metaAnuncio, setMetaAnuncio] = useState(origemInicial.metaAnuncio)
  const [nome, setNome] = useState(state?.fields?.nome as string || '')
  const [sugestoesNome, setSugestoesNome] = useState<NomeSuggestion[]>([])
  const debounceNomeRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreviewUrl, setFotoPreviewUrl] = useState<string | null>(null)
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const pacienteIdProcessadoRef = useRef<string | null>(null)

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error)
    }
  }, [state?.error])

  // AC-107/AC-108/AC-109: `pacienteId` só existe quando o cadastro textual foi
  // concluído (nem CPF duplicado nem candidato a duplicado retornam ele) — a
  // navegação e o upload de foto (AC-088/AC-089) só disparam a partir daqui.
  useEffect(() => {
    const pacienteId = state?.pacienteId
    if (!pacienteId || pacienteIdProcessadoRef.current === pacienteId) return
    pacienteIdProcessadoRef.current = pacienteId

    async function concluirCadastro() {
      if (!fotoFile) {
        toast.success('Paciente cadastrado com sucesso.')
        router.push('/pacientes')
        return
      }

      setEnviandoFoto(true)
      const arquivoParaEnvio = await redimensionarImagem(fotoFile).catch(() => fotoFile)
      await enviarFotoAposCadastro(pacienteId, arquivoParaEnvio, {
        uploadFoto: uploadFotoPaciente,
        toastSuccess: toast.success,
        toastWarning: (mensagem) => toast(mensagem, { icon: '⚠️', duration: 6000 }),
      })
      setEnviandoFoto(false)
      router.push('/pacientes')
    }

    concluirCadastro()
  }, [state?.pacienteId, fotoFile, router])

  useEffect(() => {
    return () => {
      if (fotoPreviewUrl) revogarPreviewImagem(fotoPreviewUrl)
    }
  }, [fotoPreviewUrl])

  async function handleSelecionarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const validacao = await validarArquivoImagem(file)
    if (!validacao.valido) {
      toast.error(validacao.erro || 'Imagem inválida.')
      return
    }

    if (fotoPreviewUrl) revogarPreviewImagem(fotoPreviewUrl)
    setFotoFile(file)
    setFotoPreviewUrl(gerarPreviewImagem(file))
  }

  useEffect(() => {
    const termo = nome.trim()

    if (debounceNomeRef.current) clearTimeout(debounceNomeRef.current)

    if (termo.length < 3) return

    debounceNomeRef.current = setTimeout(() => {
      startBuscaNome(async () => {
        const pacientes = await buscarPacientesPorNome(termo)
        setSugestoesNome(pacientes)
      })
    }, 300)

    return () => {
      if (debounceNomeRef.current) clearTimeout(debounceNomeRef.current)
    }
  }, [nome])

  const tipo = tipoOrigem(origemSelecionada)
  const origemPersistida = montarOrigem(origemSelecionada, metaCanal, metaAnuncio)
  const duplicateCandidates: PacienteDuplicado[] = Array.isArray(state?.duplicateCandidates) ? state.duplicateCandidates : []
  const temSugestoesNome = sugestoesNome.length > 0
  const nomeExatoJaExiste = sugestoesNome.some((paciente) => paciente.nome.trim().toLowerCase() === nome.trim().toLowerCase())

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
              value={nome}
              onChange={e => {
                const value = e.target.value
                setNome(value)
                if (value.trim().length < 3) {
                  setSugestoesNome([])
                }
              }}
              className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500" 
              placeholder="Nome completo" 
            />
            {isBuscandoNome && nome.trim().length >= 3 && (
              <div className="mt-2 flex items-center gap-2 text-xs text-text-secondary">
                <Loader2 size={12} className="animate-spin" />
                Buscando pacientes parecidos...
              </div>
            )}
            {!isBuscandoNome && temSugestoesNome && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="text-xs font-semibold text-amber-900">
                  {nomeExatoJaExiste
                    ? 'Já existe paciente com este nome. Confira antes de criar outro cadastro.'
                    : 'Encontramos pacientes parecidos. Considere reutilizar um cadastro existente.'}
                </div>
                <div className="mt-2 space-y-2">
                  {sugestoesNome.slice(0, 4).map((paciente) => (
                    <div key={paciente.id} className="flex items-center justify-between gap-3 rounded-md border border-amber-100 bg-white px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-text-primary">{paciente.nome}</div>
                        {paciente.detalhe && (
                          <div className="truncate text-xs text-text-secondary">{paciente.detalhe}</div>
                        )}
                      </div>
                      <Link
                        href={`/pacientes/${paciente.id}`}
                        target="_blank"
                        className="shrink-0 text-xs font-semibold text-primary-600 hover:text-primary-700"
                      >
                        Abrir cadastro
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">CPF</label>
            <input 
              type="text" 
              name="cpf" 
              defaultValue={formatarCPF(state?.fields?.cpf as string || '')}
              onInput={(e) => {
                e.currentTarget.value = mascararCPFInput(e.currentTarget.value)
              }}
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
              defaultValue={formatarTelefone(state?.fields?.telefone as string || '')}
              onInput={(e) => {
                e.currentTarget.value = mascararTelefoneInput(e.currentTarget.value)
              }}
              className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500" 
              placeholder="(00) 00000-0000" 
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Telefone Secundário</label>
            <input 
              type="text" 
              name="telefone_secundario" 
              defaultValue={formatarTelefone(state?.fields?.telefone_secundario as string || '')}
              onInput={(e) => {
                e.currentTarget.value = mascararTelefoneInput(e.currentTarget.value)
              }}
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
              defaultValue={formatarRG(state?.fields?.rg as string || '')}
              onInput={(e) => {
                e.currentTarget.value = mascararRGInput(e.currentTarget.value)
              }}
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

      {/* Bloco: Imagem */}
      <div className="mb-8">
        <span className="block text-xs font-medium text-text-secondary mb-2">Imagem</span>
        <label className="w-full border-2 border-dashed border-border-input rounded-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer bg-page/50 hover:border-primary-300">
          {fotoPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fotoPreviewUrl} alt="Preview da foto do paciente" className="mb-2 h-24 w-24 rounded-full object-cover" />
          ) : (
            <UploadCloud className="text-text-tertiary mb-2" size={32} />
          )}
          <p className="text-sm text-text-primary">
            <span className="text-primary-500 font-medium">Clique para fazer upload</span> ou arraste e solte
          </p>
          <p className="text-xs text-text-secondary mt-1">
            {enviandoFoto ? 'Enviando foto...' : 'PNG, JPG ou JPEG (máx. 10MB)'}
          </p>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={isPending || enviandoFoto}
            onChange={handleSelecionarFoto}
          />
        </label>
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
                if (tipoOrigem(value) !== 'facebook') {
                  setMetaAnuncio('')
                }
              }}
              className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
            >
              <option value="">Selecione</option>
              {origens.map(o => (
                <option key={o.id} value={o.nome}>
                  {o.nome}
                </option>
              ))}
            </select>
            <input type="hidden" name="origem" value={origemPersistida} />
          </div>
          {tipo === 'facebook' && (
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
            defaultValue={state?.fields?.convenio as string || ''}
            className="w-full bg-input border border-border-input rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
          >
            <option value="">Selecione um plano...</option>
            {planos.map(p => (
              <option key={p.id} value={p.nome}>{p.nome}</option>
            ))}
          </select>
        </div>
      </div>

      {duplicateCandidates.length > 0 && (
        <div className="mb-8 rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="text-lg font-semibold text-amber-950 mb-2">Possível duplicidade encontrada</h2>
          <p className="text-sm text-amber-900 mb-4">
            {state.warning || 'Já existe paciente com dados parecidos. Revise os cadastros abaixo antes de continuar.'}
          </p>
          <div className="space-y-3">
            {duplicateCandidates.map((paciente) => (
              <div key={paciente.id} className="rounded-lg border border-amber-200 bg-white p-3 text-sm text-slate-800">
                <div className="font-semibold">{paciente.nome}</div>
                <div className="mt-1 text-slate-600">
                  {[
                    paciente.cpf ? `CPF: ${paciente.cpf}` : null,
                    paciente.telefone ? `Telefone: ${paciente.telefone}` : null,
                    paciente.email ? `Email: ${paciente.email}` : null,
                    paciente.data_nascimento ? `Nascimento: ${paciente.data_nascimento}` : null,
                  ].filter(Boolean).join(' • ') || 'Sem identificadores complementares'}
                </div>
                <div className="mt-1 text-xs font-medium text-amber-700">
                  {Array.isArray(paciente.motivos) ? paciente.motivos.join(' • ') : 'nome igual'}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-amber-800">
            Se ainda assim for um paciente novo, confirme o cadastro no botão abaixo.
          </p>
        </div>
      )}

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
        {duplicateCandidates.length > 0 && (
          <button
            type="submit"
            name="confirmar_duplicado"
            value="1"
            disabled={isPending}
            className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-sm font-semibold transition-colors disabled:opacity-70"
          >
            {isPending ? 'Confirmando...' : 'Salvar mesmo assim'}
          </button>
        )}
      </div>
    </form>
  )
}
