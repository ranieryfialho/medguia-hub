'use client'

import { Minus, Plus, X } from 'lucide-react'
import { DIAS_SEMANA, type SlotLivre } from './slide-utils'

interface Props {
  isRecorrente: boolean
  modoRecorrencia: 'padrao' | 'livre'
  slotsLivres: SlotLivre[]
  frequencia: string
  diasSelecionados: number[]
  ocorrencias: string
  protocoloRecorrenteAtivo: boolean
  tiposDoProtocolo: string[]
  diaDoMes: string
  dataAgendamento: string
  horaInicioValue: string
  horaFimValue: string
  onIsRecorrenteChange: (v: boolean) => void
  onModoChange: (v: 'padrao' | 'livre') => void
  onAddSlot: () => void
  onRemoveSlot: (id: string) => void
  onUpdateSlot: (id: string, field: keyof Omit<SlotLivre, 'id'>, value: string) => void
  onFrequenciaChange: (v: string) => void
  onToggleDia: (val: number) => void
  onOcorrenciasChange: (v: string) => void
  onAjustarOcorrencias: (delta: number) => void
}

export function SlideRecorrencia({
  isRecorrente,
  modoRecorrencia,
  slotsLivres,
  frequencia,
  diasSelecionados,
  ocorrencias,
  protocoloRecorrenteAtivo,
  tiposDoProtocolo,
  diaDoMes,
  onIsRecorrenteChange,
  onModoChange,
  onAddSlot,
  onRemoveSlot,
  onUpdateSlot,
  onFrequenciaChange,
  onToggleDia,
  onOcorrenciasChange,
  onAjustarOcorrencias,
}: Props) {
  return (
    <div className="pt-4 border-t border-[#bcc9c4]/30 space-y-6">
      {/* Toggle principal */}
      <label className="flex items-center gap-3 cursor-pointer group">
        <div className="relative">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={isRecorrente}
            onChange={(e) => onIsRecorrenteChange(e.target.checked)}
            disabled={protocoloRecorrenteAtivo}
          />
          <div className="w-11 h-6 bg-[#dee3e3] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#006b5a]" />
        </div>
        <span className="font-semibold text-[#083142]">Agendamento recorrente</span>
      </label>

      {protocoloRecorrenteAtivo && (
        <p className="text-xs text-[#006b5a] font-medium -mt-3">
          Este protocolo possui múltiplas consultas e ativa a recorrência automaticamente.
        </p>
      )}
      {protocoloRecorrenteAtivo && modoRecorrencia === 'padrao' && (
        <p className="text-xs text-[#4d635b] -mt-2">
          O numero de atendimentos vem do protocolo/agendamento. Aqui voce define apenas a sazonalidade: frequencia e dias da semana.
        </p>
      )}

      {/* Sub-toggle Padrão / Datas livres */}
      {isRecorrente && (
        <div className="flex rounded-lg border border-[#bcc9c4] overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => onModoChange('padrao')}
            className={`flex-1 py-2 text-sm font-semibold transition-colors ${modoRecorrencia === 'padrao' ? 'bg-[#006b5a] text-white' : 'bg-white text-[#6d7a75] hover:bg-[#f0f5f4]'}`}
          >
            Padrão
          </button>
          <button
            type="button"
            onClick={() => onModoChange('livre')}
            className={`flex-1 py-2 text-sm font-semibold transition-colors border-l border-[#bcc9c4] ${modoRecorrencia === 'livre' ? 'bg-[#006b5a] text-white' : 'bg-white text-[#6d7a75] hover:bg-[#f0f5f4]'}`}
          >
            Datas livres
          </button>
        </div>
      )}

      {/* Modo padrão */}
      {isRecorrente && modoRecorrencia === 'padrao' && (
        <div className="pl-3 border-l-4 border-[#006b5a]/20 space-y-6 animate-in fade-in slide-in-from-left-2 duration-300">
          <div className="space-y-1 relative">
            <label className="text-xs font-semibold text-[#6d7a75] absolute -top-2 left-3 bg-white px-1 z-10">
              Repetir a cada
            </label>
            <select
              name="frequencia"
              value={frequencia}
              onChange={(e) => onFrequenciaChange(e.target.value)}
              className="w-full bg-white border border-[#bcc9c4] rounded-lg px-4 py-3 text-[#171d1c] shadow-sm appearance-none focus:ring-2 focus:ring-[#006b5a]"
            >
              <option value="1">Semana</option>
              <option value="2">Duas semanas</option>
              <option value="3">Três semanas</option>
              <option value="mes">Mês no dia {diaDoMes}</option>
            </select>
          </div>

          {frequencia !== 'mes' && (
            <div>
              <label className="text-sm font-semibold text-[#083142] block mb-2">Repetir nos dias</label>
              <div className="flex flex-wrap gap-2">
                {DIAS_SEMANA.map((dia) => (
                  <button
                    type="button"
                    key={dia.val}
                    onClick={() => onToggleDia(dia.val)}
                    className={`w-11 h-10 rounded-lg text-sm font-bold transition-all border ${
                      diasSelecionados.includes(dia.val)
                        ? 'bg-[#f0fcf9] text-[#006b5a] border-[#006b5a]'
                        : 'bg-white text-[#6d7a75] border-[#bcc9c4] hover:border-[#6d7a75]'
                    }`}
                  >
                    {dia.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-semibold text-[#083142] block mb-3">Termina em:</label>
            <div className="flex items-center gap-3">
              <input type="radio" checked readOnly className="w-4 h-4 text-[#006b5a] focus:ring-[#006b5a] shrink-0" />
              <div className="flex items-center gap-3">
                <div className="border border-[#bcc9c4] rounded-lg flex items-center justify-between w-[120px] bg-white h-11">
                  <button
                    type="button"
                    onClick={() => onAjustarOcorrencias(-1)}
                    disabled={protocoloRecorrenteAtivo}
                    className="w-10 h-full flex items-center justify-center text-[#6d7a75] hover:bg-[#f0f5f4] transition-colors rounded-l-lg disabled:opacity-40"
                  >
                    <Minus size={18} strokeWidth={1.5} />
                  </button>
                  <input
                    type="number"
                    name="ocorrencias"
                    value={ocorrencias}
                    onChange={(e) => onOcorrenciasChange(e.target.value)}
                    onBlur={() => onOcorrenciasChange(String(Math.max(1, Math.min(365, parseInt(ocorrencias) || 1))))}
                    className="flex-1 w-full text-center focus:outline-none bg-transparent text-base font-medium text-[#171d1c] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0 m-0"
                    min="1"
                    max="365"
                    disabled={protocoloRecorrenteAtivo}
                  />
                  <button
                    type="button"
                    onClick={() => onAjustarOcorrencias(1)}
                    disabled={protocoloRecorrenteAtivo}
                    className="w-10 h-full flex items-center justify-center text-[#6d7a75] hover:bg-[#f0f5f4] transition-colors rounded-r-lg disabled:opacity-40"
                  >
                    <Plus size={18} strokeWidth={1.5} />
                  </button>
                </div>
                <span className="text-sm font-medium text-[#6d7a75]">
                  atendimentos <span className="font-normal opacity-70">(Limite igual a 365)</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modo datas livres */}
      {isRecorrente && modoRecorrencia === 'livre' && (
        <div className="pl-3 border-l-4 border-[#006b5a]/20 space-y-3 animate-in fade-in slide-in-from-left-2 duration-300">
          <p className="text-xs text-[#4d635b]">
            Defina data e horário de cada sessão individualmente, sem padrão fixo.
            {protocoloRecorrenteAtivo && ` O protocolo tem ${tiposDoProtocolo.length} sessões — adicione ${tiposDoProtocolo.length} datas.`}
          </p>

          <div className="space-y-2">
            {slotsLivres.map((slot, idx) => (
              <div key={slot.id} className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#6d7a75] w-5 shrink-0 text-right">{idx + 1}</span>
                <input
                  type="date"
                  value={slot.data}
                  onChange={(e) => onUpdateSlot(slot.id, 'data', e.target.value)}
                  className="flex-1 min-w-0 bg-white border border-[#bcc9c4] rounded-lg px-3 py-2 text-sm text-[#171d1c] focus:ring-2 focus:ring-[#006b5a] font-medium shadow-sm"
                />
                <input
                  type="time"
                  value={slot.hora_inicio}
                  onChange={(e) => onUpdateSlot(slot.id, 'hora_inicio', e.target.value)}
                  className="w-[88px] bg-white border border-[#bcc9c4] rounded-lg px-2 py-2 text-sm text-[#171d1c] focus:ring-2 focus:ring-[#006b5a] font-medium shadow-sm"
                />
                <span className="text-xs text-[#6d7a75] shrink-0">até</span>
                <input
                  type="time"
                  value={slot.hora_fim}
                  onChange={(e) => onUpdateSlot(slot.id, 'hora_fim', e.target.value)}
                  className="w-[88px] bg-white border border-[#bcc9c4] rounded-lg px-2 py-2 text-sm text-[#171d1c] focus:ring-2 focus:ring-[#006b5a] font-medium shadow-sm"
                />
                {slotsLivres.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveSlot(slot.id)}
                    className="shrink-0 w-7 h-7 flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={onAddSlot}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#006b5a] hover:text-[#004f43] transition-colors"
          >
            <Plus size={13} />
            Adicionar data
          </button>
          <p className="text-xs text-[#6d7a75]">
            {slotsLivres.length} sessão{slotsLivres.length !== 1 ? 'ões' : ''} configurada{slotsLivres.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  )
}
