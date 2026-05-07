'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'

interface ModalSessaoReposicaoProps {
  pacienteNome: string
  defaultData?: string  // 'yyyy-MM-dd'
  defaultHora?: string  // 'HH:mm'
  onClose: () => void
  onSaved: () => void
  /** Se fornecido, substitui a lógica padrão de salvar */
  onSalvarCustom?: (data: string, hora: string) => Promise<{ success?: boolean; error?: string }>
}

export function ModalSessaoReposicao({
  pacienteNome,
  defaultData,
  defaultHora,
  onClose,
  onSaved,
  onSalvarCustom,
}: ModalSessaoReposicaoProps) {
  const [data, setData] = useState(defaultData ?? '')
  const [hora, setHora] = useState(defaultHora ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSalvar() {
    if (!data || !hora) {
      toast.error('Preencha a data e o horário.')
      return
    }
    setSaving(true)
    if (!onSalvarCustom) return
    const res = await onSalvarCustom(data, hora)
    setSaving(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-[#171d1c]">Nova sessão de reposição</h3>
            <p className="text-xs text-slate-500 mt-0.5">{pacienteNome}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">Data</label>
            <input
              type="date"
              value={data}
              onChange={e => setData(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#006b5a]/30 focus:border-[#006b5a]/50"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">Horário</label>
            <input
              type="time"
              value={hora}
              onChange={e => setHora(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#006b5a]/30 focus:border-[#006b5a]/50"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#006b5a] text-white text-sm font-bold hover:bg-[#005a4c] disabled:opacity-60 transition-colors"
          >
            {saving ? 'Agendando...' : 'Agendar'}
          </button>
        </div>
      </div>
    </div>
  )
}
