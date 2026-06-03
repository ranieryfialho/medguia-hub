'use client'

import { Minus, Plus } from 'lucide-react'
import type { ProtocoloAtendimento } from '@/actions/protocolos-atendimento'
import type { ItemProtocoloConfigurado } from './slide-utils'

interface Props {
  protocolosAtendimento: ProtocoloAtendimento[]
  selectedProtocoloAtendimentoId: string
  onAplicarProtocolo: (id: string) => void
  protocoloAtendimentoSelecionado: ProtocoloAtendimento | null
  itensProtocoloConfigurados: ItemProtocoloConfigurado[]
  totalSessoesConfiguradoNoAgendamento: number
  modoRecorrencia: 'padrao' | 'livre'
  onAtualizarQuantidadeItem: (itemId: string, valor: string | number) => void
  onAlternarSessaoItem: (itemId: string, sessao: number) => void
  onAtualizarTotalSessoes: (valor: string | number) => void
}

export function SlideProtocolo({
  protocolosAtendimento,
  selectedProtocoloAtendimentoId,
  onAplicarProtocolo,
  protocoloAtendimentoSelecionado,
  itensProtocoloConfigurados,
  totalSessoesConfiguradoNoAgendamento,
  modoRecorrencia,
  onAtualizarQuantidadeItem,
  onAlternarSessaoItem,
  onAtualizarTotalSessoes,
}: Props) {
  return (
    <div className="space-y-1 relative">
      <label className="text-xs font-semibold text-[#6d7a75] absolute -top-2 left-3 bg-white px-1 z-10">
        Protocolo de atendimento
      </label>
      <select
        value={selectedProtocoloAtendimentoId}
        onChange={(e) => onAplicarProtocolo(e.target.value)}
        className="w-full bg-white border border-[#bcc9c4] rounded-lg px-4 py-3 text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 transition-all font-medium appearance-none shadow-sm"
      >
        <option value="">Selecione um protocolo...</option>
        {protocolosAtendimento.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome} ({p.total_sessoes} sessoes)
          </option>
        ))}
      </select>

      {protocoloAtendimentoSelecionado && (
        <div className="rounded-lg border border-[#006b5a]/20 bg-[#f0fcf9] px-3 py-2 text-xs text-[#006b5a]">
          <p className="font-semibold">{protocoloAtendimentoSelecionado.nome}</p>
          <p className="mt-1 font-medium">
            Total de atendimentos deste protocolo:{' '}
            <span className="font-bold">{protocoloAtendimentoSelecionado.total_sessoes}</span>
          </p>
          <p className="mt-1 text-[11px] text-[#4d635b]">
            Ajuste a quantidade como atalho e, se precisar, escolha manualmente em quais sessoes cada item acontece.
          </p>

          <div className="mt-3 space-y-2">
            {itensProtocoloConfigurados.map((item) => (
              <div key={item.id} className="rounded-lg border border-[#006b5a]/15 bg-white/70 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#083142]">{item.tipo_consulta_nome}</p>
                    <p className="text-[11px] text-[#4d635b]">Escolha livremente em quais sessoes esse item aparece</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onAtualizarQuantidadeItem(item.id, item.sessoesSelecionadas.length - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-[#bcc9c4] bg-white text-[#6d7a75] transition-colors hover:bg-[#f0f5f4]"
                    >
                      <Minus size={14} strokeWidth={1.8} />
                    </button>
                    <input
                      type="number"
                      min="0"
                      max={totalSessoesConfiguradoNoAgendamento}
                      value={item.sessoesSelecionadas.length}
                      onChange={(e) => onAtualizarQuantidadeItem(item.id, e.target.value)}
                      onBlur={(e) => onAtualizarQuantidadeItem(item.id, e.target.value)}
                      className="h-8 w-16 rounded-md border border-[#bcc9c4] bg-white px-2 text-center text-sm font-semibold text-[#171d1c] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => onAtualizarQuantidadeItem(item.id, item.sessoesSelecionadas.length + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-[#bcc9c4] bg-white text-[#6d7a75] transition-colors hover:bg-[#f0f5f4]"
                    >
                      <Plus size={14} strokeWidth={1.8} />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Array.from({ length: totalSessoesConfiguradoNoAgendamento }, (_, i) => {
                    const sessao = i + 1
                    const selecionada = item.sessoesSelecionadas.includes(sessao)
                    return (
                      <button
                        key={`${item.id}-${sessao}`}
                        type="button"
                        onClick={() => onAlternarSessaoItem(item.id, sessao)}
                        className={`min-w-9 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                          selecionada
                            ? 'border-[#006b5a] bg-[#f0fcf9] text-[#006b5a]'
                            : 'border-[#bcc9c4] bg-white text-[#6d7a75] hover:border-[#6d7a75]'
                        }`}
                      >
                        {sessao}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-lg border border-[#006b5a]/15 bg-white/70 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-[#083142]">Total de atendimentos deste agendamento</p>
                <p className="text-[11px] text-[#4d635b]">
                  O protocolo sugere um padrao, mas voce pode ajustar para este paciente.
                </p>
              </div>
              <input
                type="number"
                min="1"
                max="365"
                value={totalSessoesConfiguradoNoAgendamento}
                onChange={(e) => onAtualizarTotalSessoes(e.target.value)}
                onBlur={(e) => onAtualizarTotalSessoes(e.target.value)}
                className="h-8 w-20 rounded-md border border-[#bcc9c4] bg-white px-2 text-center text-sm font-semibold text-[#171d1c] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <p className="mt-2 text-[11px] text-[#4d635b]">
              Padrao do protocolo: {protocoloAtendimentoSelecionado.total_sessoes} atendimento
              {protocoloAtendimentoSelecionado.total_sessoes === 1 ? '' : 's'}.
            </p>
          </div>

          {modoRecorrencia === 'padrao' && (
            <p className="mt-2 text-[11px] text-[#4d635b]">
              A sazonalidade deste caso continua sendo definida na recorrencia abaixo: frequencia e dias da semana.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
