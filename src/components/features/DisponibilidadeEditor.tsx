'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { salvarDisponibilidade, type DiaDisponibilidade } from '@/actions/disponibilidade'
import toast from 'react-hot-toast'
import { Clock, CheckCircle } from 'lucide-react'

const DIAS = [
  { dia_semana: 1, label: 'Segunda-feira' },
  { dia_semana: 2, label: 'Terça-feira' },
  { dia_semana: 3, label: 'Quarta-feira' },
  { dia_semana: 4, label: 'Quinta-feira' },
  { dia_semana: 5, label: 'Sexta-feira' },
  { dia_semana: 6, label: 'Sábado' },
  { dia_semana: 0, label: 'Domingo' },
]

type Props = {
  targetProfissionalId: string
  disponibilidade: DiaDisponibilidade[]
  isGestor: boolean
  profissionais: { id: string; nome: string }[]
  profissionalAtualId: string
}

function buildEstado(disponibilidade: DiaDisponibilidade[]) {
  const map = new Map(disponibilidade.map(d => [d.dia_semana, d]))
  return DIAS.map(d => {
    const existente = map.get(d.dia_semana)
    return {
      dia_semana: d.dia_semana,
      ativo: existente?.ativo ?? false,
      hora_inicio: existente?.hora_inicio?.slice(0, 5) ?? '08:00',
      hora_fim: existente?.hora_fim?.slice(0, 5) ?? '18:00',
    }
  })
}

export function DisponibilidadeEditor({
  targetProfissionalId,
  disponibilidade,
  isGestor,
  profissionais,
  profissionalAtualId,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dias, setDias] = useState(() => buildEstado(disponibilidade))

  function toggleDia(idx: number) {
    setDias(prev => prev.map((d, i) => i === idx ? { ...d, ativo: !d.ativo } : d))
  }

  function setHora(idx: number, campo: 'hora_inicio' | 'hora_fim', valor: string) {
    setDias(prev => prev.map((d, i) => i === idx ? { ...d, [campo]: valor } : d))
  }

  function handleSalvar() {
    startTransition(async () => {
      const res = await salvarDisponibilidade(targetProfissionalId, dias)
      if (res.error) {
        toast.error('Erro ao salvar: ' + res.error)
      } else {
        toast.success('Disponibilidade salva com sucesso!')
      }
    })
  }

  function handleProfissionalChange(profId: string) {
    router.push(`/configuracoes/disponibilidade?profissional=${profId}`)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 bg-gradient-to-b from-slate-50/60 to-transparent">
        <div className="flex items-center gap-2 mb-1">
          <Clock size={18} className="text-[#006b5a]" />
          <h3 className="font-bold text-slate-900">Horários de Atendimento</h3>
        </div>
        <p className="text-xs text-slate-500">
          Defina os dias e horários em que o profissional realiza atendimentos.
        </p>

        {isGestor && profissionais.length > 0 && (
          <div className="mt-4">
            <label className="text-xs font-semibold text-slate-500 block mb-1.5">Profissional</label>
            <select
              value={profissionalAtualId}
              onChange={e => handleProfissionalChange(e.target.value)}
              className="w-full bg-white border border-[#bcc9c4] rounded-lg px-3 py-2 text-sm text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] transition-all font-medium appearance-none shadow-sm"
            >
              {profissionais.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Grid de dias */}
      <div className="divide-y divide-slate-50">
        {DIAS.map((diaConfig, idx) => {
          const d = dias[idx]
          return (
            <div
              key={diaConfig.dia_semana}
              className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${d.ativo ? 'bg-white' : 'bg-slate-50/60'}`}
            >
              {/* Toggle */}
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={d.ativo}
                  onChange={() => toggleDia(idx)}
                />
                <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#006b5a]" />
              </label>

              {/* Nome do dia */}
              <span className={`text-sm font-semibold w-36 shrink-0 ${d.ativo ? 'text-slate-800' : 'text-slate-400'}`}>
                {diaConfig.label}
              </span>

              {/* Inputs de hora */}
              {d.ativo ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="time"
                    value={d.hora_inicio}
                    onChange={e => setHora(idx, 'hora_inicio', e.target.value)}
                    className="border border-[#bcc9c4] rounded-lg px-3 py-1.5 text-sm font-medium text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] outline-none transition-all"
                  />
                  <span className="text-slate-400 text-sm font-medium">→</span>
                  <input
                    type="time"
                    value={d.hora_fim}
                    onChange={e => setHora(idx, 'hora_fim', e.target.value)}
                    className="border border-[#bcc9c4] rounded-lg px-3 py-1.5 text-sm font-medium text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] outline-none transition-all"
                  />
                </div>
              ) : (
                <span className="text-xs text-slate-400 italic">Não atende</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="p-5 border-t border-slate-100 bg-slate-50/40">
        <button
          onClick={handleSalvar}
          disabled={isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#006b5a] text-white text-sm font-bold rounded-xl hover:bg-[#005548] transition-colors disabled:opacity-60 shadow-sm"
        >
          <CheckCircle size={16} />
          {isPending ? 'Salvando...' : 'Salvar disponibilidade'}
        </button>
      </div>
    </div>
  )
}
