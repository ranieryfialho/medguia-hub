'use client'

import { useState, useTransition } from 'react'
import { Lock, Plus, Pencil, Trash2, Check, X, ChevronUp, ChevronDown, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  criarStatusOpcao,
  editarStatusOpcao,
  removerStatusOpcao,
  reordenarStatusOpcoes,
} from '@/actions/status-disponibilidade-config'
import { getCorConfig, CORES_SELECIONAVEIS, type OpcaoStatus } from '@/lib/status-disponibilidade-cores'
import {
  FORMULARIO_OPCAO_VAZIO as FORM_VAZIO,
  formularioDaOpcao,
  type FormularioOpcao,
} from '@/lib/status-disponibilidade-regras'

function SeletorCor({ value, onChange }: { value: string; onChange: (cor: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {CORES_SELECIONAVEIS.map(({ key, dot, label }) => (
        <button
          key={key}
          type="button"
          title={label}
          onClick={() => onChange(key)}
          className={`w-7 h-7 rounded-full ${dot} border-2 transition-all ${
            value === key ? 'border-slate-700 scale-110' : 'border-transparent hover:scale-105'
          }`}
        />
      ))}
    </div>
  )
}

function FormStatus({
  form,
  onChange,
  onSubmit,
  onCancel,
  isPending,
  submitLabel,
}: {
  form: FormularioOpcao
  onChange: (f: FormularioOpcao) => void
  onSubmit: () => void
  onCancel: () => void
  isPending: boolean
  submitLabel: string
}) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Label</label>
          <input
            autoFocus
            type="text"
            value={form.label}
            onChange={e => onChange({ ...form, label: e.target.value })}
            placeholder="Ex: Em visita"
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#006b5a] focus:ring-1 focus:ring-[#006b5a]/30"
            disabled={isPending}
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Label curto</label>
          <input
            type="text"
            value={form.label_curto}
            onChange={e => onChange({ ...form, label_curto: e.target.value })}
            placeholder="Ex: visita"
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#006b5a] focus:ring-1 focus:ring-[#006b5a]/30"
            disabled={isPending}
          />
        </div>
      </div>
      <div>
        <label className="text-[11px] font-semibold text-slate-500 block mb-2">Cor</label>
        <SeletorCor value={form.cor} onChange={cor => onChange({ ...form, cor })} />
      </div>
      {form.cor && (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${getCorConfig(form.cor).bg} ${getCorConfig(form.cor).text}`}>
          <span className={`w-2 h-2 rounded-full ${getCorConfig(form.cor).dot}`} />
          {form.label || 'Pré-visualização'}
        </div>
      )}
      <label className="flex items-start gap-2.5 cursor-pointer pt-1">
        <input
          type="checkbox"
          checked={form.observacao_obrigatoria}
          onChange={e => onChange({ ...form, observacao_obrigatoria: e.target.checked })}
          disabled={isPending}
          className="mt-0.5 w-4 h-4 shrink-0 rounded border-slate-300 text-[#006b5a] focus:ring-2 focus:ring-[#006b5a]/30 cursor-pointer"
        />
        <span>
          <span className="text-xs font-semibold text-slate-700 block">Exigir justificativa</span>
          <span className="text-[11px] text-slate-500 block mt-0.5">
            O profissional precisa escrever o motivo ao assumir este status. O texto
            fica gravado no bloco do histórico.
          </span>
        </span>
      </label>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X size={14} /> Cancelar
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isPending || !form.label.trim() || !form.label_curto.trim()}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-[#006b5a] text-white text-sm font-semibold rounded-lg hover:bg-[#005548] transition-colors disabled:opacity-50"
        >
          <Check size={14} /> {submitLabel}
        </button>
      </div>
    </div>
  )
}

export function GerenciadorStatusDisponibilidade({ opcoes: inicial }: { opcoes: OpcaoStatus[] }) {
  const [opcoes, setOpcoes] = useState(inicial)
  const [adicionando, setAdicionando] = useState(false)
  const [novoForm, setNovoForm] = useState(FORM_VAZIO)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editandoForm, setEditandoForm] = useState(FORM_VAZIO)
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const sistema = opcoes.filter(o => o.sistema).sort((a, b) => a.ordem - b.ordem)
  const customizaveis = opcoes.filter(o => !o.sistema).sort((a, b) => a.ordem - b.ordem)

  function handleAdicionar() {
    if (!novoForm.label.trim() || !novoForm.label_curto.trim()) return
    startTransition(async () => {
      const res = await criarStatusOpcao(novoForm)
      if (res.error) { toast.error(res.error); return }
      toast.success('Status criado')
      setAdicionando(false)
      setNovoForm(FORM_VAZIO)
      window.location.reload()
    })
  }

  function iniciarEdicao(op: OpcaoStatus) {
    setEditandoId(op.id)
    setEditandoForm(formularioDaOpcao(op))
  }

  function handleSalvarEdicao(id: string) {
    if (!editandoForm.label.trim() || !editandoForm.label_curto.trim()) return
    startTransition(async () => {
      const res = await editarStatusOpcao(id, editandoForm)
      if (res.error) { toast.error(res.error); return }
      toast.success('Status atualizado')
      setOpcoes(prev => prev.map(o => o.id === id
        ? {
            ...o,
            label: editandoForm.label.trim(),
            label_curto: editandoForm.label_curto.trim(),
            cor: editandoForm.cor,
            observacao_obrigatoria: editandoForm.observacao_obrigatoria,
          }
        : o
      ))
      setEditandoId(null)
    })
  }

  function handleRemover(id: string) {
    startTransition(async () => {
      const res = await removerStatusOpcao(id)
      if (res.error) { toast.error(res.error); return }
      toast.success('Status removido')
      setOpcoes(prev => prev.filter(o => o.id !== id))
      setConfirmandoId(null)
    })
  }

  function handleMover(id: string, direcao: 'up' | 'down') {
    const lista = [...customizaveis]
    const idx = lista.findIndex(o => o.id === id)
    if (direcao === 'up' && idx === 0) return
    if (direcao === 'down' && idx === lista.length - 1) return

    const troca = direcao === 'up' ? idx - 1 : idx + 1;
    [lista[idx], lista[troca]] = [lista[troca], lista[idx]]

    const novaOrdem = lista.map((o, i) => ({ ...o, ordem: i + 1 }))
    setOpcoes(prev => [...prev.filter(o => o.sistema), ...novaOrdem])

    startTransition(async () => {
      const res = await reordenarStatusOpcoes(novaOrdem.map(o => o.id))
      if (res.error) toast.error(res.error)
    })
  }

  return (
    <div className="space-y-8">
      {/* Status de sistema */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Lock size={13} className="text-slate-400" />
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status de sistema</h3>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
          {sistema.map(op => {
            const cfg = getCorConfig(op.cor)
            return (
              <div key={op.id} className="flex items-center gap-3 px-4 py-3 opacity-70">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-slate-800">{op.label}</span>
                  <span className="text-xs text-slate-400 ml-2">&quot;{op.label_curto}&quot;</span>
                </div>
                <Lock size={12} className="text-slate-300 shrink-0" />
              </div>
            )
          })}
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          Estes status são computados automaticamente pelo sistema e não podem ser editados.
        </p>
      </div>

      {/* Status customizáveis */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status personalizáveis</h3>
          {!adicionando && (
            <button
              onClick={() => { setAdicionando(true); setNovoForm(FORM_VAZIO) }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#006b5a] border border-[#006b5a]/30 rounded-lg hover:bg-[#006b5a]/5 transition-colors"
            >
              <Plus size={13} /> Novo status
            </button>
          )}
        </div>

        {adicionando && (
          <div className="mb-3">
            <FormStatus
              form={novoForm}
              onChange={setNovoForm}
              onSubmit={handleAdicionar}
              onCancel={() => { setAdicionando(false); setNovoForm(FORM_VAZIO) }}
              isPending={isPending}
              submitLabel="Adicionar"
            />
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
          {customizaveis.length === 0 && !adicionando && (
            <p className="px-4 py-6 text-sm text-slate-400 text-center">Nenhum status personalizado ainda.</p>
          )}
          {customizaveis.map((op, idx) => {
            const cfg = getCorConfig(op.cor)
            const isEditando = editandoId === op.id
            const isConfirmando = confirmandoId === op.id

            if (isEditando) {
              return (
                <div key={op.id} className="px-4 py-3">
                  <FormStatus
                    form={editandoForm}
                    onChange={setEditandoForm}
                    onSubmit={() => handleSalvarEdicao(op.id)}
                    onCancel={() => setEditandoId(null)}
                    isPending={isPending}
                    submitLabel="Salvar"
                  />
                </div>
              )
            }

            return (
              <div key={op.id} className="flex items-center gap-3 px-4 py-3">
                {/* Reorder */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    onClick={() => handleMover(op.id, 'up')}
                    disabled={isPending || idx === 0}
                    className="p-0.5 text-slate-300 hover:text-slate-500 disabled:opacity-20 transition-colors"
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    onClick={() => handleMover(op.id, 'down')}
                    disabled={isPending || idx === customizaveis.length - 1}
                    className="p-0.5 text-slate-300 hover:text-slate-500 disabled:opacity-20 transition-colors"
                  >
                    <ChevronDown size={13} />
                  </button>
                </div>

                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />

                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-slate-800">{op.label}</span>
                  <span className="text-xs text-slate-400 ml-2">&quot;{op.label_curto}&quot;</span>
                  {op.observacao_obrigatoria && (
                    <span className="inline-flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 align-middle">
                      <MessageSquare size={9} /> justificativa
                    </span>
                  )}
                </div>

                {isConfirmando ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-rose-600 font-medium">Remover?</span>
                    <button
                      onClick={() => handleRemover(op.id)}
                      disabled={isPending}
                      className="px-2 py-1 text-xs font-semibold bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors disabled:opacity-50"
                    >
                      Sim
                    </button>
                    <button
                      onClick={() => setConfirmandoId(null)}
                      className="px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Não
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => iniciarEdicao(op)}
                      disabled={isPending}
                      className="p-1.5 text-slate-400 hover:text-[#006b5a] hover:bg-[#006b5a]/5 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setConfirmandoId(op.id)}
                      disabled={isPending}
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Remover"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}