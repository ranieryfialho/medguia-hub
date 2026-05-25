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
  mostrarSeletorProfissional?: boolean
}

type DiaDisponibilidadeForm = Omit<DiaDisponibilidade, 'intervalo_inicio' | 'intervalo_fim'> & {
  intervalo_inicio: string
  intervalo_fim: string
  intervalo_ativo: boolean
}

function buildEstado(disponibilidade: DiaDisponibilidade[]): DiaDisponibilidadeForm[] {
  const map = new Map(disponibilidade.map(d => [d.dia_semana, d]))
  return DIAS.map(d => {
    const existente = map.get(d.dia_semana)
    return {
      dia_semana: d.dia_semana,
      ativo: existente?.ativo ?? false,
      jornada_inicio: existente?.jornada_inicio?.slice(0, 5) ?? '08:00',
      jornada_fim: existente?.jornada_fim?.slice(0, 5) ?? '18:00',
      intervalo_ativo: Boolean(existente?.intervalo_inicio && existente?.intervalo_fim),
      intervalo_inicio: existente?.intervalo_inicio?.slice(0, 5) ?? '12:00',
      intervalo_fim: existente?.intervalo_fim?.slice(0, 5) ?? '13:00',
    }
  })
}

export function JornadaEditor({
  targetProfissionalId,
  disponibilidade,
  isGestor,
  profissionais,
  profissionalAtualId,
  mostrarSeletorProfissional = true,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dias, setDias] = useState(() => buildEstado(disponibilidade))

  function toggleDia(idx: number) {
    setDias(prev => prev.map((d, i) => i === idx ? { ...d, ativo: !d.ativo } : d))
  }

  function setHora(idx: number, campo: 'jornada_inicio' | 'jornada_fim', valor: string) {
    setDias(prev => prev.map((d, i) => i === idx ? { ...d, [campo]: valor } : d))
  }

  function setIntervalo(idx: number, campo: 'intervalo_inicio' | 'intervalo_fim', valor: string) {
    setDias(prev => prev.map((d, i) => i === idx ? { ...d, [campo]: valor } : d))
  }

  function toggleIntervalo(idx: number) {
    setDias(prev => prev.map((d, i) => {
      if (i !== idx) return d

      const intervaloAtivo = !d.intervalo_ativo
      return {
        ...d,
        intervalo_ativo: intervaloAtivo,
      }
    }))
  }

  function handleSalvar() {
    startTransition(async () => {
      const payload = dias.map((dia) => ({
        dia_semana: dia.dia_semana,
        ativo: dia.ativo,
        jornada_inicio: dia.jornada_inicio,
        jornada_fim: dia.jornada_fim,
        intervalo_inicio: dia.intervalo_ativo ? dia.intervalo_inicio : null,
        intervalo_fim: dia.intervalo_ativo ? dia.intervalo_fim : null,
      }))

      const res = await salvarDisponibilidade(targetProfissionalId, payload)
      if (res.error) {
        toast.error('Erro ao salvar: ' + res.error)
      } else {
        toast.success('Jornada salva com sucesso!')
      }
    })
  }

  function handleProfissionalChange(profId: string) {
    router.push(`/configuracoes/jornada?profissional=${profId}`)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-b from-slate-50/60 to-transparent">
        <div className="flex items-center gap-2 mb-1">
          <Clock size={18} className="text-[#006b5a]" />
          <h3 className="font-bold text-slate-900">Horários de Atendimento</h3>
        </div>
        <p className="text-xs text-slate-500">
          Defina os dias e horários em que o profissional realiza atendimentos.
        </p>

        {isGestor && mostrarSeletorProfissional && profissionais.length > 0 && (
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
            <div key={diaConfig.dia_semana} className={`px-4 sm:px-5 py-3.5 transition-colors ${d.ativo ? 'bg-white' : 'bg-slate-50/60'}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
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
                <span className={`text-sm font-semibold sm:w-36 sm:shrink-0 ${d.ativo ? 'text-slate-800' : 'text-slate-400'}`}>
                  {diaConfig.label}
                </span>

              {/* Inputs de hora */}
                {d.ativo ? (
                  <div className="grid flex-1 grid-cols-1 gap-3 sm:flex sm:items-center sm:gap-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Início da jornada</label>
                      <input
                        type="time"
                        value={d.jornada_inicio}
                        onChange={e => setHora(idx, 'jornada_inicio', e.target.value)}
                        className="border border-[#bcc9c4] rounded-lg px-3 py-1.5 text-sm font-medium text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] outline-none transition-all"
                      />
                    </div>
                    <span className="hidden sm:inline text-slate-400 text-sm font-medium">→</span>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Fim da jornada</label>
                      <input
                        type="time"
                        value={d.jornada_fim}
                        onChange={e => setHora(idx, 'jornada_fim', e.target.value)}
                        className="border border-[#bcc9c4] rounded-lg px-3 py-1.5 text-sm font-medium text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] outline-none transition-all"
                      />
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 italic">Não atende</span>
                )}
              </div>

              {d.ativo && (
                <div className="mt-3 sm:ml-14 sm:pl-4 sm:border-l sm:border-slate-100">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={d.intervalo_ativo}
                      onChange={() => toggleIntervalo(idx)}
                      className="rounded border-slate-300 text-[#006b5a] focus:ring-[#006b5a]/40"
                    />
                    <span className="text-xs font-semibold text-slate-600">Possui intervalo no dia</span>
                  </label>

                  {d.intervalo_ativo && (
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:flex sm:items-center sm:gap-2">
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Início do intervalo</label>
                        <input
                          type="time"
                          value={d.intervalo_inicio}
                          onChange={e => setIntervalo(idx, 'intervalo_inicio', e.target.value)}
                          className="border border-[#bcc9c4] rounded-lg px-3 py-1.5 text-sm font-medium text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] outline-none transition-all"
                        />
                      </div>
                      <span className="hidden sm:inline text-slate-400 text-sm font-medium">→</span>
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Fim do intervalo</label>
                        <input
                          type="time"
                          value={d.intervalo_fim}
                          onChange={e => setIntervalo(idx, 'intervalo_fim', e.target.value)}
                          className="border border-[#bcc9c4] rounded-lg px-3 py-1.5 text-sm font-medium text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] outline-none transition-all"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/40">
        <button
          onClick={handleSalvar}
          disabled={isPending}
          className="flex w-full sm:w-auto items-center justify-center gap-2 px-5 py-2.5 bg-[#006b5a] text-white text-sm font-bold rounded-xl hover:bg-[#005548] transition-colors disabled:opacity-60 shadow-sm"
        >
          <CheckCircle size={16} />
          {isPending ? 'Salvando...' : 'Salvar jornada'}
        </button>
      </div>
    </div>
  )
}
