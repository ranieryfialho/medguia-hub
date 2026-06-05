'use client'

import { useState, useEffect, useRef } from 'react'
import { Save, Loader2, Activity, MessageSquare, Layers, StickyNote } from 'lucide-react'
import {
  buscarProntuarioPorAtendimento,
  salvarProntuario,
} from '@/actions/prontuarios'
import toast from 'react-hot-toast'

interface Props {
  atendimentoId: string
  pacienteId: string
  onSuccess?: () => void
}

const PAIN_ACTIVE: Record<number, string> = {
  0:  'bg-emerald-500 text-white border-emerald-500 shadow-emerald-200',
  1:  'bg-emerald-400 text-white border-emerald-400 shadow-emerald-200',
  2:  'bg-lime-400   text-white border-lime-400   shadow-lime-200',
  3:  'bg-lime-500   text-white border-lime-500   shadow-lime-200',
  4:  'bg-yellow-400 text-white border-yellow-400 shadow-yellow-200',
  5:  'bg-amber-400  text-white border-amber-400  shadow-amber-200',
  6:  'bg-orange-400 text-white border-orange-400 shadow-orange-200',
  7:  'bg-orange-500 text-white border-orange-500 shadow-orange-200',
  8:  'bg-red-400    text-white border-red-400    shadow-red-200',
  9:  'bg-red-500    text-white border-red-500    shadow-red-200',
  10: 'bg-red-700    text-white border-red-700    shadow-red-300',
}

const PAIN_INACTIVE = 'bg-white text-slate-500 border-slate-200 hover:border-[#006b5a] hover:text-[#006b5a] transition-colors'

function dorLabel(n: number) {
  if (n === 0) return 'Sem dor'
  if (n <= 3)  return 'Leve'
  if (n <= 6)  return 'Moderada'
  if (n <= 8)  return 'Intensa'
  return 'Muito intensa'
}

function dorBarColor(n: number): string {
  if (n === 0)  return 'bg-emerald-500'
  if (n <= 3)   return 'bg-lime-500'
  if (n <= 6)   return 'bg-amber-400'
  if (n <= 8)   return 'bg-orange-500'
  return 'bg-red-600'
}

const FIELD_CLASS =
  'w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-800 placeholder:text-slate-300 resize-none focus:outline-none focus:border-[#006b5a] focus:ring-2 focus:ring-[#006b5a]/10 transition-all touch-manipulation'

function AutoResizeTextarea({ value, onChange, placeholder, rows, className }: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  placeholder?: string
  rows?: number
  className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className={className}
      style={{ overflow: 'hidden' }}
    />
  )
}

function SectionLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <Icon size={14} className="text-[#006b5a] shrink-0" />
      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
    </div>
  )
}

function temCampoAbertoPreenchido(campos: string[]) {
  return campos.some((campo) => campo.trim().length > 0)
}

export function ProntuarioEvolucao({ atendimentoId, pacienteId, onSuccess }: Props) {
  const [loading, setLoading]                 = useState(true)
  const [saving, setSaving]                   = useState(false)
  const [escalaDor, setEscalaDor]             = useState<number | null>(null)
  const [queixaPrincipal, setQueixaPrincipal] = useState('')
  const [evolucao, setEvolucao]               = useState('')
  const [procedimentos, setProcedimentos]     = useState('')
  const [observacoes, setObservacoes]         = useState('')

  useEffect(() => {
    buscarProntuarioPorAtendimento(atendimentoId).then(data => {
      if (data) {
        setEscalaDor(data.escala_dor ?? null)
        setQueixaPrincipal(data.queixa_principal ?? '')
        setEvolucao(data.evolucao ?? '')
        setProcedimentos(data.procedimentos ?? '')
        setObservacoes(data.observacoes ?? '')
      }
      setLoading(false)
    })
  }, [atendimentoId])

  async function handleSalvar() {
    const temCampoAberto = temCampoAbertoPreenchido([
      queixaPrincipal,
      evolucao,
      procedimentos,
      observacoes,
    ])

    if (escalaDor === null || !temCampoAberto) {
      toast.error('Preencha a escala de dor e ao menos um campo antes de salvar.')
      return
    }

    setSaving(true)
    const result = await salvarProntuario(atendimentoId, pacienteId, {
      queixa_principal: queixaPrincipal,
      evolucao,
      procedimentos,
      escala_dor: escalaDor,
      observacoes,
    })
    setSaving(false)

    if (result.error) {
      toast.error(`Erro ao salvar: ${result.error}`)
    } else {
      toast.success('Evolução salva com sucesso')
      if (result.warning) {
        toast(result.warning, { icon: '⚠️' })
      }
      onSuccess?.()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-[#006b5a]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Escala de dor EVA */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-[#006b5a]" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Escala de Dor — EVA
            </span>
          </div>
          {escalaDor !== null && (
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${PAIN_ACTIVE[escalaDor]} shadow-sm`}>
              {escalaDor}/10 · {dorLabel(escalaDor)}
            </span>
          )}
        </div>

        {/* Botões em grid de 11 colunas — cabe em qualquer tela */}
        <div className="grid grid-cols-11 gap-1.5">
          {Array.from({ length: 11 }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setEscalaDor(prev => prev === i ? null : i)}
              className={`aspect-square w-full rounded-lg border text-xs font-bold active:scale-90 transition-all ${
                escalaDor === i
                  ? `${PAIN_ACTIVE[i]} shadow-md`
                  : PAIN_INACTIVE
              }`}
            >
              {i}
            </button>
          ))}
        </div>

        {/* Barra visual de intensidade */}
        {escalaDor !== null && (
          <div className="mt-2.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${dorBarColor(escalaDor)}`}
              style={{ width: `${(escalaDor / 10) * 100}%` }}
            />
          </div>
        )}
      </div>

      <div className="h-px bg-slate-100" />

      {/* Queixa principal */}
      <div>
        <SectionLabel icon={MessageSquare} label="Queixa Principal" />
        <AutoResizeTextarea
          value={queixaPrincipal}
          onChange={e => setQueixaPrincipal(e.target.value)}
          placeholder="Descreva a queixa do paciente nesta sessão..."
          rows={3}
          className={FIELD_CLASS}
        />
      </div>

      {/* Evolução da sessão */}
      <div>
        <SectionLabel icon={Activity} label="Evolução da Sessão" />
        <AutoResizeTextarea
          value={evolucao}
          onChange={e => setEvolucao(e.target.value)}
          placeholder="Como foi a sessão? Resposta do paciente ao tratamento..."
          rows={5}
          className={FIELD_CLASS}
        />
      </div>

      {/* Procedimentos realizados */}
      <div>
        <SectionLabel icon={Layers} label="Procedimentos Realizados" />
        <AutoResizeTextarea
          value={procedimentos}
          onChange={e => setProcedimentos(e.target.value)}
          placeholder="Técnicas e procedimentos aplicados..."
          rows={3}
          className={FIELD_CLASS}
        />
      </div>

      {/* Observações */}
      <div>
        <SectionLabel icon={StickyNote} label="Observações" />
        <AutoResizeTextarea
          value={observacoes}
          onChange={e => setObservacoes(e.target.value)}
          placeholder="Outras observações relevantes..."
          rows={3}
          className={FIELD_CLASS}
        />
      </div>

      {/* Botão salvar */}
      <button
        onClick={handleSalvar}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2.5 px-4 py-4 rounded-xl bg-[#006b5a] text-white font-bold text-sm hover:bg-[#005548] active:scale-[0.98] transition-all disabled:opacity-60 shadow-lg shadow-[#006b5a]/20 mt-2"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        {saving ? 'Salvando...' : 'Salvar Evolução'}
      </button>
    </div>
  )
}
