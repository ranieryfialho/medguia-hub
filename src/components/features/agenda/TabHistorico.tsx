'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { buscarHistoricoPacienteResumo } from '@/actions/agenda'
import type { HistoricoPacienteResumo } from '@/actions/agenda'
import { buscarAuditoriaAtendimento } from '@/actions/confirmacoes-auditoria'
import { AuditoriaTimelineAsync } from '@/components/features/confirmacoes/AuditoriaTimeline'
import { normalizeAtendimentoStatus } from '@/lib/atendimento-status'
import {
  formatarEscalaDor, formatarMoeda, formatarStatusComercial, getResumoStatusBadgeClass,
} from './agendamento-item-utils'

type TabHistoricoProps = {
  pacienteId: string
  agendamentoId: string
  podeVerComercial: boolean
  isActive: boolean
  onVerJornada: () => void
}

export function TabHistorico({ pacienteId, agendamentoId, podeVerComercial, isActive, onVerJornada }: TabHistoricoProps) {
  const [historicoResumo, setHistoricoResumo] = useState<HistoricoPacienteResumo | null>(null)
  const [loadingHistorico, setLoadingHistorico] = useState(false)
  const [falhaHistorico, setFalhaHistorico] = useState<string | null>(null)

  useEffect(() => {
    if (!isActive || historicoResumo || loadingHistorico) return
    setLoadingHistorico(true)
    setFalhaHistorico(null)
    buscarHistoricoPacienteResumo(pacienteId).then((result) => {
      if (!result || result.error || !result.data) {
        setFalhaHistorico(result?.error ?? 'Não foi possível carregar o histórico.')
        setLoadingHistorico(false)
        return
      }
      setHistoricoResumo(result.data)
      setLoadingHistorico(false)
    })
  }, [isActive, pacienteId, historicoResumo, loadingHistorico])

  return (
    <div className={isActive ? 'space-y-4' : 'hidden'}>
      {loadingHistorico ? (
        <div className="flex items-center justify-center py-10 text-sm font-medium text-[#6d7a75]">
          Carregando histórico...
        </div>
      ) : falhaHistorico ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {falhaHistorico}
        </div>
      ) : historicoResumo ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[#f0f5f4] p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#6d7a75]">Consultas</p>
              <p className="mt-1 text-lg font-extrabold text-[#083142]">{historicoResumo.metricas.consultas_total}</p>
              <p className="text-xs text-[#6d7a75]">{historicoResumo.metricas.consultas_concluidas} concluídas</p>
            </div>
            {podeVerComercial && (
              <div className="rounded-xl bg-[#f0f5f4] p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#6d7a75]">Comercial</p>
                <p className="mt-1 text-lg font-extrabold text-[#083142]">{historicoResumo.metricas.vendas_realizadas}</p>
                <p className="text-xs text-[#6d7a75]">{historicoResumo.metricas.orcamentos_passados} orçamento(s)</p>
              </div>
            )}
            <div className="rounded-xl bg-white border border-[#bcc9c4]/40 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#6d7a75]">Não efetivas</p>
              <p className="mt-1 text-lg font-extrabold text-[#083142]">{historicoResumo.metricas.consultas_nao_efetivas}</p>
              <p className="text-xs text-[#6d7a75]">faltas, cancelamentos e reagendamentos</p>
            </div>
            {podeVerComercial && (
              <div className="rounded-xl bg-white border border-[#bcc9c4]/40 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#6d7a75]">Valor vendido</p>
                <p className="mt-1 text-lg font-extrabold text-[#083142]">{formatarMoeda(historicoResumo.metricas.valor_total_vendas)}</p>
                <p className="text-xs text-[#6d7a75]">somente vendas confirmadas</p>
              </div>
            )}
          </div>

          {historicoResumo.resumo_tipos.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#6d7a75]">Resumo por tipo</h4>
                <span className="text-[11px] text-[#6d7a75]">
                  {historicoResumo.resumo_tipos.length} tipo{historicoResumo.resumo_tipos.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-2">
                {historicoResumo.resumo_tipos.map((item) => (
                  <div key={item.tipo} className="rounded-xl border border-[#bcc9c4]/30 bg-[#fcfdfd] px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#171d1c]">{item.tipo}</p>
                        <p className="text-xs text-[#6d7a75]">{item.total} agendamento{item.total !== 1 ? 's' : ''}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#f0f5f4] px-2 py-0.5 text-[10px] font-bold text-[#3d4945]">
                        Total {item.total}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.statuses.map((statusItem) => (
                        <span
                          key={`${item.tipo}-${statusItem.status}`}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getResumoStatusBadgeClass(statusItem.status)}`}
                        >
                          {statusItem.total} {statusItem.status}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#6d7a75]">Últimas consultas</h4>
              <button
                type="button"
                onClick={onVerJornada}
                className="text-[11px] font-semibold text-[#006b5a] hover:underline"
              >
                Ver jornada completa
              </button>
            </div>
            {historicoResumo.consultas.length > 0 ? (
              <div className="space-y-2">
                {historicoResumo.consultas.map((consulta) => (
                  <div key={consulta.id} className="rounded-xl border border-[#bcc9c4]/30 bg-white px-3 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#171d1c] truncate">{consulta.tipo?.trim() || 'Sessão'}</p>
                        <p className="text-xs text-[#6d7a75]">
                          {format(new Date(consulta.data_agendamento), "dd/MM/yyyy 'às' HH:mm")}
                        </p>
                        {consulta.profissional_nome && (
                          <p className="text-xs text-[#6d7a75]">Profissional: {consulta.profissional_nome}</p>
                        )}
                      </div>
                      <span className="shrink-0 rounded-full bg-[#f0f5f4] px-2 py-0.5 text-[10px] font-bold text-[#3d4945]">
                        {normalizeAtendimentoStatus(consulta.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-[#f0f5f4] px-4 py-3 text-sm text-[#6d7a75]">
                Nenhuma consulta registrada para este paciente.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#6d7a75]">Evoluções concluídas</h4>
            {historicoResumo.evolucoes.length > 0 ? (
              <div className="space-y-2">
                {historicoResumo.evolucoes.map((item) => (
                  <div key={item.atendimento_id} className="rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#171d1c]">{item.tipo?.trim() || 'Sessão'}</p>
                        <p className="text-xs text-[#6d7a75]">
                          {format(new Date(item.data_agendamento), "dd/MM/yyyy 'às' HH:mm")}
                        </p>
                        {item.profissional_nome && (
                          <p className="text-xs text-[#6d7a75]">Profissional: {item.profissional_nome}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">Concluído</span>
                        {formatarEscalaDor(item.escala_dor) && (
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-[#5a6a65] border border-violet-200">
                            {formatarEscalaDor(item.escala_dor)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-[#3d4945]">
                      {item.evolucao && <p><span className="font-semibold text-[#083142]">Evolução: </span>{item.evolucao}</p>}
                      {item.procedimentos && <p><span className="font-semibold text-[#083142]">Procedimentos: </span>{item.procedimentos}</p>}
                      {item.observacoes && <p><span className="font-semibold text-[#083142]">Observações: </span>{item.observacoes}</p>}
                      {item.updated_at && (
                        <p className="pt-0.5 text-[10px] text-[#6d7a75]">
                          Atualizado em {format(new Date(item.updated_at), "dd/MM/yyyy 'às' HH:mm")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-[#f0f5f4] px-4 py-3 text-sm text-[#6d7a75]">
                Nenhuma evolução encontrada em atendimentos concluídos.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#6d7a75]">Ações de confirmação</h4>
            <div className="rounded-xl border border-[#bcc9c4]/30 bg-[#fcfdfd] px-3 py-3">
              <AuditoriaTimelineAsync
                atendimentoId={agendamentoId}
                buscar={buscarAuditoriaAtendimento}
                compact
              />
            </div>
          </div>

          {podeVerComercial && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#6d7a75]">Histórico comercial</h4>
              {historicoResumo.comercial.length > 0 ? (
                historicoResumo.comercial.map((item) => (
                  <div key={item.id} className="rounded-xl border border-[#bcc9c4]/30 bg-[#fcfdfd] px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#171d1c]">{formatarStatusComercial(item.status)}</p>
                        <p className="text-xs text-[#6d7a75]">
                          {format(new Date(item.data_venda), 'dd/MM/yyyy')}
                          {item.profissional_nome ? ` · ${item.profissional_nome}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-bold text-[#006b5a]">{formatarMoeda(item.total)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.origem && (
                        <span className="rounded-full bg-[#f0f5f4] px-2 py-0.5 text-[10px] font-semibold text-[#5a6a65]">
                          {item.origem}
                        </span>
                      )}
                      {item.itens_resumo.map((nome) => (
                        <span key={nome} className="rounded-full border border-[#bcc9c4]/40 bg-white px-2 py-0.5 text-[10px] font-medium text-[#3d4945]">
                          {nome}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl bg-[#f0f5f4] px-4 py-3 text-sm text-[#6d7a75]">
                  Nenhuma venda ou orçamento encontrado para este paciente.
                </div>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
