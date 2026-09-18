'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, ChevronLeft, User, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  buscarResponsavelPadrao,
  criarFollowUp,
  listarTemplatesPorTipo,
  type FollowUpTipo,
  type FollowUpTemplate,
} from '@/actions/follow-ups'
import { ComboboxPaciente } from '@/components/features/pacientes/ComboboxPaciente'

type Profissional = { id: string; full_name: string }
type PacienteSelecionado = { id: string; nome: string }
type TipoSelecionavel = Pick<FollowUpTipo, 'id' | 'nome'>

type Props = {
  pacienteId?: string
  atendimentoId?: string | null
  tipos: TipoSelecionavel[]
  profissionais: Profissional[]
  trigger?: React.ReactNode
  isOpen?: boolean
  onClose?: () => void
  onSuccess?: () => void
}

export function ModalFollowUp({
  pacienteId,
  atendimentoId,
  tipos,
  profissionais,
  trigger,
  isOpen: isOpenProp,
  onClose: onCloseProp,
  onSuccess,
}: Props) {
  const [isOpenLocal, setIsOpenLocal] = useState(false)
  const isControlled = isOpenProp !== undefined
  const isOpen = isControlled ? isOpenProp : isOpenLocal

  // Sem pacienteId fixo (uso fora do contexto de um paciente, ex.: /follow-ups),
  // o primeiro passo é escolher o paciente antes de seguir para tipo/formulário.
  const precisaEscolherPaciente = !pacienteId
  const [pacienteEscolhido, setPacienteEscolhido] = useState<PacienteSelecionado | null>(null)
  const pacienteIdEfetivo = pacienteId || pacienteEscolhido?.id || null

  const [passo, setPasso] = useState<'paciente' | 'tipo' | 'form'>(precisaEscolherPaciente ? 'paciente' : 'tipo')
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoSelecionavel | null>(null)
  const [templates, setTemplates] = useState<FollowUpTemplate[]>([])
  const [templateId, setTemplateId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [usuarioLogado, setUsuarioLogado] = useState<{ id: string; full_name: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const buscouUsuario = useRef(false)

  // Ao abrir, ja sugere quem esta logado como responsavel
  useEffect(() => {
    if (!isOpen || buscouUsuario.current) return
    buscouUsuario.current = true
    buscarResponsavelPadrao().then(u => {
      if (!u) return
      setUsuarioLogado(u)
      setResponsavelId(prev => prev || u.id)
    })
  }, [isOpen])

  function abrir() {
    if (!isControlled) setIsOpenLocal(true)
  }

  function fechar() {
    if (isControlled) onCloseProp?.()
    else setIsOpenLocal(false)
    resetar()
  }

  function resetar() {
    setPasso(precisaEscolherPaciente ? 'paciente' : 'tipo')
    setPacienteEscolhido(null)
    setTipoSelecionado(null)
    setTemplates([])
    setTemplateId('')
    setDescricao('')
    setResponsavelId(usuarioLogado?.id ?? '')
  }

  function selecionarPaciente(item: PacienteSelecionado) {
    setPacienteEscolhido(item)
    setPasso('tipo')
  }

  // Garante que quem esta logado apareca na lista mesmo se nao vier em profissionais
  const opcoesResponsavel = usuarioLogado && !profissionais.some(p => p.id === usuarioLogado.id)
    ? [usuarioLogado, ...profissionais]
    : profissionais

  function selecionarTipo(tipo: TipoSelecionavel) {
    setTipoSelecionado(tipo)
    setTemplates([])
    setTemplateId('')
    setPasso('form')
    startTransition(async () => {
      const ts = await listarTemplatesPorTipo(tipo.id)
      setTemplates(ts)
    })
  }

  function aplicarTemplate(id: string) {
    setTemplateId(id)
    const t = templates.find(t => t.id === id)
    if (t) {
      setDescricao(t.conteudo)
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tipoSelecionado || !pacienteIdEfetivo) return

    startTransition(async () => {
      const result = await criarFollowUp({
        paciente_id: pacienteIdEfetivo,
        atendimento_id: atendimentoId ?? null,
        tipo_id: tipoSelecionado.id,
        descricao: descricao || undefined,
        responsavel_id: responsavelId || null,
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('Follow-up registrado!')
      fechar()
      onSuccess?.()
    })
  }

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') fechar()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleEsc)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      window.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const botaoTrigger = trigger ?? (
    <button
      onClick={abrir}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#006b5a]/10 text-[#006b5a] hover:bg-[#006b5a] hover:text-white rounded-lg text-sm font-medium transition-colors"
    >
      <Plus size={14} />
      {precisaEscolherPaciente ? 'Novo Follow-up' : 'Follow-up'}
    </button>
  )

  if (typeof document === 'undefined') return <>{botaoTrigger}</>

  return (
    <>
      {!isControlled && (
        <span onClick={abrir} className="contents">{botaoTrigger}</span>
      )}

      {isOpen && createPortal(
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) fechar() }}
        >
          <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col animate-in fade-in slide-in-from-bottom-5 duration-300 ${passo === 'paciente' ? 'overflow-visible' : 'overflow-hidden'}`}>

            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
              {passo === 'form' && (
                <button onClick={() => setPasso('tipo')} className="text-slate-400 hover:text-slate-600 transition-colors p-1 -ml-1">
                  <ChevronLeft size={18} />
                </button>
              )}
              {passo === 'tipo' && precisaEscolherPaciente && (
                <button onClick={() => setPasso('paciente')} className="text-slate-400 hover:text-slate-600 transition-colors p-1 -ml-1">
                  <ChevronLeft size={18} />
                </button>
              )}
              <div className="flex-1">
                <h3 className="text-lg font-bold text-[#006b5a]">
                  {passo === 'paciente' ? 'Selecionar paciente' : passo === 'tipo' ? 'Adicionar Follow-up' : tipoSelecionado?.nome}
                </h3>
                {passo !== 'paciente' && pacienteEscolhido && (
                  <p className="text-xs text-slate-400 mt-0.5">Paciente: {pacienteEscolhido.nome}</p>
                )}
                {passo === 'form' && tipoSelecionado && !pacienteEscolhido && (
                  <p className="text-xs text-slate-400 mt-0.5">Preencha os detalhes do follow-up</p>
                )}
              </div>
              <button onClick={fechar} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                <X size={20} />
              </button>
            </div>

            {/* Passo 0 — Seleção de paciente (só quando não há paciente fixo) */}
            {passo === 'paciente' && (
              <div className="p-6 pb-24 rounded-b-2xl">
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Paciente</label>
                <ComboboxPaciente
                  name="paciente_busca"
                  placeholder="Buscar paciente pelo nome..."
                  onSelect={(item) => selecionarPaciente({ id: item.id, nome: item.nome })}
                />
              </div>
            )}

            {/* Passo 1 — Seleção de tipo */}
            {passo === 'tipo' && (
              <div className="overflow-y-auto max-h-[60vh]">
                {tipos.length === 0 ? (
                  <p className="px-6 py-8 text-sm text-slate-400 text-center">
                    Nenhum tipo cadastrado. Configure em Follow-ups → Tipos.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {tipos.map(tipo => (
                      <li key={tipo.id}>
                        <button
                          onClick={() => selecionarTipo(tipo)}
                          className="w-full text-left px-6 py-3.5 text-sm font-semibold tracking-wide uppercase text-slate-600 hover:bg-[#006b5a]/5 hover:text-[#006b5a] transition-colors"
                        >
                          {tipo.nome}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Passo 2 — Formulário */}
            {passo === 'form' && (
              <form onSubmit={handleSubmit} className="flex flex-col">
                <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">

                  {/* Template */}
                  {isPending ? (
                    <div className="h-9 bg-slate-100 animate-pulse rounded-lg" />
                  ) : templates.length > 0 ? (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1.5">
                        <FileText size={12} />
                        Template
                      </label>
                      <select
                        value={templateId}
                        onChange={e => aplicarTemplate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#33A68F]/50 focus:border-[#33A68F] transition-all"
                      >
                        <option value="">-- Selecione um template --</option>
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>{t.titulo}</option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  {/* Descrição */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">
                      Descrição do follow-up realizado
                    </label>
                    <textarea
                      ref={textareaRef}
                      value={descricao}
                      onChange={e => setDescricao(e.target.value)}
                      rows={5}
                      placeholder="Descreva o follow-up realizado..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#33A68F]/50 focus:border-[#33A68F] transition-all resize-none text-slate-700"
                    />
                  </div>

                  {/* Responsável */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1.5">
                      <User size={12} />
                      Responsável pelo follow-up
                    </label>
                    <select
                      value={responsavelId}
                      onChange={e => setResponsavelId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#33A68F]/50 focus:border-[#33A68F] transition-all"
                    >
                      {!responsavelId && <option value="">Carregando...</option>}
                      {opcoesResponsavel.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.full_name}{usuarioLogado?.id === p.id ? ' (você)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                  <button
                    type="button"
                    onClick={fechar}
                    className="px-5 py-2.5 text-slate-600 text-sm font-medium hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-5 py-2.5 bg-[#006b5a] hover:bg-[#005143] text-white text-sm font-bold rounded-lg transition-all disabled:opacity-70 shadow-md shadow-[#006b5a]/20"
                  >
                    {isPending ? 'Salvando...' : 'Registrar Follow-up'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}