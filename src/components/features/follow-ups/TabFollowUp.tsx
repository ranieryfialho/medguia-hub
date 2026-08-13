'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { CheckCircle, ChevronLeft, FileText, Plus, User } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  buscarResponsavelPadrao,
  criarFollowUp,
  listarTemplatesPorTipo,
  listarTipos,
  type FollowUpTemplate,
  type FollowUpTipo,
} from '@/actions/follow-ups'

type Props = {
  pacienteId: string
  atendimentoId: string
  profissionais: { id: string; full_name: string }[]
  isActive: boolean
  onSuccess?: () => void
}

export function TabFollowUp({ pacienteId, atendimentoId, profissionais, isActive, onSuccess }: Props) {
  const [tipos, setTipos] = useState<FollowUpTipo[]>([])
  const [loadingTipos, setLoadingTipos] = useState(false)
  const [passo, setPasso] = useState<'tipo' | 'form'>('tipo')
  const [tipoSelecionado, setTipoSelecionado] = useState<FollowUpTipo | null>(null)
  const [templates, setTemplates] = useState<FollowUpTemplate[]>([])
  const [templateId, setTemplateId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [usuarioLogado, setUsuarioLogado] = useState<{ id: string; full_name: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [concluido, setConcluido] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const carregou = useRef(false)

  useEffect(() => {
    if (!isActive || carregou.current) return
    carregou.current = true
    setLoadingTipos(true)
    listarTipos().then(t => { setTipos(t); setLoadingTipos(false) })
    buscarResponsavelPadrao().then(u => {
      if (!u) return
      setUsuarioLogado(u)
      setResponsavelId(prev => prev || u.id)
    })
  }, [isActive])

  function resetar() {
    setPasso('tipo')
    setTipoSelecionado(null)
    setTemplates([])
    setTemplateId('')
    setDescricao('')
    setResponsavelId(usuarioLogado?.id ?? '')
    setConcluido(false)
  }

  // Garante que quem esta logado apareca na lista mesmo se nao vier em profissionais
  const opcoesResponsavel = usuarioLogado && !profissionais.some(p => p.id === usuarioLogado.id)
    ? [usuarioLogado, ...profissionais]
    : profissionais

  function selecionarTipo(tipo: FollowUpTipo) {
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
    if (!tipoSelecionado) return
    startTransition(async () => {
      const result = await criarFollowUp({
        paciente_id: pacienteId,
        atendimento_id: atendimentoId,
        tipo_id: tipoSelecionado.id,
        descricao: descricao || undefined,
        responsavel_id: responsavelId || null,
      })
      if (result.error) { toast.error(result.error); return }
      setConcluido(true)
      onSuccess?.()
    })
  }

  if (!isActive) return null

  if (concluido) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
        <CheckCircle size={44} className="text-[#006b5a]" />
        <p className="text-sm font-semibold text-[#3d4945]">Follow-up registrado com sucesso!</p>
        <button
          onClick={resetar}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#006b5a]/10 text-[#006b5a] hover:bg-[#006b5a] hover:text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={14} />
          Adicionar outro
        </button>
      </div>
    )
  }

  if (loadingTipos) {
    return (
      <div className="py-8 text-center text-sm text-slate-400">Carregando tipos de follow-up...</div>
    )
  }

  if (passo === 'tipo') {
    return (
      <div>
        <p className="text-xs font-bold text-[#6d7a75] mb-3 uppercase tracking-wide">Tipo de follow-up</p>
        {tipos.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">
            Nenhum tipo cadastrado. Configure em Follow-ups → Tipos.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-[#bcc9c4]/30 overflow-hidden">
            {tipos.map(tipo => (
              <li key={tipo.id}>
                <button
                  type="button"
                  onClick={() => selecionarTipo(tipo)}
                  className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-[#006b5a]/5 hover:text-[#006b5a] transition-colors"
                >
                  {tipo.nome}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <button
        type="button"
        onClick={() => setPasso('tipo')}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
      >
        <ChevronLeft size={14} />
        {tipoSelecionado?.nome}
      </button>

      {isPending ? (
        <div className="h-9 bg-slate-100 animate-pulse rounded-lg" />
      ) : templates.length > 0 ? (
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <FileText size={12} />
            Template
          </label>
          <select
            value={templateId}
            onChange={e => aplicarTemplate(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#33A68F]/50 focus:border-[#33A68F] transition-all"
          >
            <option value="">-- Selecione um template --</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.titulo}</option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-500">
          Descrição do follow-up
        </label>
        <textarea
          ref={textareaRef}
          value={descricao}
          onChange={e => setDescricao(e.target.value)}
          rows={4}
          placeholder="Descreva o follow-up realizado..."
          className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#33A68F]/50 focus:border-[#33A68F] transition-all"
        />
      </div>

      <div>
        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <User size={12} />
          Responsável pelo follow-up
        </label>
        <select
          value={responsavelId}
          onChange={e => setResponsavelId(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#33A68F]/50 focus:border-[#33A68F] transition-all"
        >
          {!responsavelId && <option value="">Carregando...</option>}
          {opcoesResponsavel.map(p => (
            <option key={p.id} value={p.id}>
              {p.full_name}{usuarioLogado?.id === p.id ? ' (você)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => setPasso('tipo')}
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
        >
          Voltar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-[#006b5a] px-5 py-2 text-sm font-bold text-white shadow-md shadow-[#006b5a]/20 hover:bg-[#005143] transition-all disabled:opacity-70"
        >
          {isPending ? 'Salvando...' : 'Registrar Follow-up'}
        </button>
      </div>
    </form>
  )
}
