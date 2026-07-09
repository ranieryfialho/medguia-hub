'use client'

import { createPortal } from 'react-dom'
import { X, CalendarPlus, User, Search, Clock, LoaderCircle } from 'lucide-react'
import { formatarFaixasJornada } from '@/lib/jornada'
import { useAgendamentoForm, type SlideProps } from './useAgendamentoForm'
import { SlideRecorrencia } from './SlideRecorrencia'
import { SlideProtocolo } from './SlideProtocolo'

export type { SlideProps }

export function SlideNovoAgendamento(props: SlideProps) {
  const {
    comboboxRef,
    formId,
    open,
    loading,
    error,
    isControlled,
    modoEdicao,
    setIsOpen,
    handleClose,
    handleSubmit,
    // Paciente
    pacientesFiltrados,
    loadingPacientes,
    erroPacientes,
    selectedPacienteId,
    pacienteSearch,
    setPacienteSearch,
    setSelectedPacienteId,
    pacienteDropdownOpen,
    setPacienteDropdownOpen,
    selecionarPaciente,
    // Profissional
    tipoProfissional,
    setTipoProfissional,
    selectedProfissionalId,
    setSelectedProfissionalId,
    profissionalSelecionado,
    profissionalSelecionadoEhMedico,
    profissionaisFiltrados,
    selectedPlanoSaude,
    setSelectedPlanoSaude,
    // Tipo
    modoAtendimento,
    setModoAtendimento,
    selectedTipo,
    setSelectedTipo,
    handleTipoChange,
    opcoesTipoConsulta,
    tiposAtivos,
    // Protocolo
    selectedProtocoloAtendimentoId,
    protocoloAtendimentoSelecionado,
    itensProtocoloConfigurados,
    tiposDoProtocolo,
    totalSessoesConfiguradoNoAgendamento,
    protocoloRecorrenteAtivo,
    aplicarProtocoloAtendimento,
    atualizarQuantidadeItemProtocolo,
    alternarSessaoItemProtocolo,
    atualizarTotalSessoesProtocoloAgendamento,
    // Data / hora
    dataAgendamento,
    setDataAgendamento,
    diaDoMes,
    horaInicioValue,
    horaFimValue,
    setHoraFimValue,
    handleHoraInicioChange,
    // Disponibilidade
    disponibilidadeSelecionada,
    horarioPreenchido,
    horarioValidoNaDisponibilidade,
    // Recorrência
    isRecorrente,
    modoRecorrencia,
    slotsLivres,
    frequencia,
    setFrequencia,
    diasSelecionados,
    ocorrencias,
    setOcorrencias,
    handleIsRecorrenteChange,
    handleModoRecorrenciaChange,
    handleAddSlot,
    handleRemoveSlot,
    handleUpdateSlot,
    toggleDia,
    ajustarOcorrencias,
    // Outros
    marcouRetorno,
    setMarcouRetorno,
    observacoesValue,
    setObservacoesValue,
    loadingDetalhesAtendimento,
    planos,
    protocolosAtendimento,
  } = useAgendamentoForm(props)

  const slide = open ? (
    <div className="fixed inset-0 z-[500] pointer-events-none">
      <button
        type="button"
        aria-label="Fechar agendamento"
        onClick={handleClose}
        className="absolute inset-0 bg-[#171d1c]/40 backdrop-blur-sm pointer-events-auto"
      />
      <div className="absolute inset-y-0 right-0 w-full max-w-lg pointer-events-auto">
        <div className="flex h-full w-full flex-col bg-white shadow-2xl">

          {/* Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-[#bcc9c4]/30 flex items-center justify-between bg-white shrink-0 safe-top">
            <h2 className="text-lg sm:text-xl font-bold text-[#083142]">
              {modoEdicao ? 'Editar agendamento' : 'Novo agendamento'}
            </h2>
            <button type="button" onClick={handleClose} className="p-2 border border-[#bcc9c4] text-[#3d4945] hover:bg-[#dee3e3] rounded-lg transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-8 sm:py-6 scrollbar-thin scrollbar-thumb-slate-200 overscroll-contain">
            <form id={formId} onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">

              {/* Paciente */}
              <div className="space-y-1 relative">
                <label className="text-xs font-semibold text-[#6d7a75] absolute -top-2 left-3 bg-white px-1 z-10">Paciente *</label>
                <div className="relative" ref={comboboxRef}>
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#3d4945]/50">
                    {selectedPacienteId ? <User size={18} /> : <Search size={18} />}
                  </div>
                  <input
                    type="text"
                    placeholder="Pesquisar paciente pelo nome..."
                    value={pacienteSearch}
                    onChange={(e) => { setPacienteSearch(e.target.value); setSelectedPacienteId(''); setPacienteDropdownOpen(true) }}
                    onFocus={() => setPacienteDropdownOpen(true)}
                    disabled={loadingPacientes && pacientesFiltrados.length === 0}
                    className="w-full bg-white border border-[#bcc9c4] rounded-lg pl-11 pr-4 py-3 text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] transition-all font-medium shadow-sm"
                  />
                  <input type="hidden" name="paciente_id" value={selectedPacienteId} />
                  {loadingPacientes && pacienteSearch.trim().length >= 2 && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-[#6d7a75]">
                      <LoaderCircle size={14} className="animate-spin" />
                      <span>Buscando pacientes...</span>
                    </div>
                  )}
                  {erroPacientes && <div className="mt-2 text-sm text-red-600">{erroPacientes}</div>}
                  {pacienteDropdownOpen && (
                    <div className="absolute z-[520] w-full mt-1 bg-white border border-[#bcc9c4] rounded-lg shadow-xl max-h-56 overflow-y-auto">
                      {pacienteSearch.trim().length < 2 ? (
                        <p className="px-4 py-3 text-sm text-[#6d7a75]">Digite pelo menos 2 letras para buscar.</p>
                      ) : loadingPacientes ? (
                        <div className="px-4 py-3 text-sm text-[#6d7a75] flex items-center gap-2">
                          <LoaderCircle size={14} className="animate-spin" />
                          <span>Buscando pacientes...</span>
                        </div>
                      ) : erroPacientes ? (
                        <p className="px-4 py-3 text-sm text-red-600">{erroPacientes}</p>
                      ) : pacientesFiltrados.length > 0 ? (
                        pacientesFiltrados.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onMouseDown={() => selecionarPaciente(p)}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors font-medium ${
                              selectedPacienteId === p.id ? 'bg-[#f0fcf9] text-[#006b5a]' : 'text-[#171d1c] hover:bg-[#f0f5f4]'
                            }`}
                          >
                            {p.nome}
                          </button>
                        ))
                      ) : (
                        <p className="px-4 py-3 text-sm text-[#6d7a75]">Nenhum paciente encontrado.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Profissional */}
              <div className="space-y-3">
                <div className="flex rounded-lg border border-[#bcc9c4] overflow-hidden shadow-sm">
                  <button type="button" onClick={() => { setTipoProfissional('fisioterapeuta'); setSelectedProfissionalId('') }}
                    className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${tipoProfissional === 'fisioterapeuta' ? 'bg-[#006b5a] text-white' : 'bg-white text-[#6d7a75] hover:bg-[#f0f5f4]'}`}>
                    Fisioterapeuta
                  </button>
                  <button type="button" onClick={() => { setTipoProfissional('medico'); setSelectedProfissionalId('') }}
                    className={`flex-1 py-2.5 text-sm font-semibold transition-colors border-l border-[#bcc9c4] ${tipoProfissional === 'medico' ? 'bg-[#006b5a] text-white' : 'bg-white text-[#6d7a75] hover:bg-[#f0f5f4]'}`}>
                    Médico
                  </button>
                </div>
                <div className="space-y-1 relative">
                  <label className="text-xs font-semibold text-[#6d7a75] absolute -top-2 left-3 bg-white px-1 z-10">Profissional *</label>
                  <select name="profissional_id" required value={selectedProfissionalId} onChange={(e) => setSelectedProfissionalId(e.target.value)}
                    className="w-full bg-white border border-[#bcc9c4] rounded-lg px-4 py-3 text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] transition-all font-medium appearance-none shadow-sm">
                    <option value="">Selecione uma opção</option>
                    {profissionaisFiltrados.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
                {tipoProfissional === 'medico' && (
                  <div className="space-y-1 relative">
                    <label className="text-xs font-semibold text-[#6d7a75] absolute -top-2 left-3 bg-white px-1 z-10">Plano de Saúde</label>
                    <select name="plano_saude" value={selectedPlanoSaude} onChange={(e) => setSelectedPlanoSaude(e.target.value)}
                      className="w-full bg-white border border-[#bcc9c4] rounded-lg px-4 py-3 text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] transition-all font-medium appearance-none shadow-sm">
                      <option value="">Selecione um plano...</option>
                      {planos.map((p) => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Tipo de atendimento */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-[#6d7a75]">Tipo de atendimento *</p>
                {!modoEdicao && protocolosAtendimento.length > 0 && (
                  <div className="mb-4 space-y-4">
                    <div className="space-y-2">
                      <span className="block text-xs font-semibold text-[#6d7a75]">Como deseja montar o atendimento?</span>
                      <div className="grid grid-cols-2 rounded-lg border border-[#bcc9c4] bg-[#f5faf9] p-1">
                        <button type="button"
                          onClick={() => { setModoAtendimento('avulso'); aplicarProtocoloAtendimento('') }}
                          className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${modoAtendimento === 'avulso' ? 'bg-white text-[#006b5a] shadow-sm' : 'text-[#6d7a75] hover:text-[#083142]'}`}>
                          Atendimento avulso
                        </button>
                        <button type="button"
                          onClick={() => { setModoAtendimento('protocolo'); if (!selectedProtocoloAtendimentoId) setSelectedTipo('') }}
                          className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${modoAtendimento === 'protocolo' ? 'bg-white text-[#006b5a] shadow-sm' : 'text-[#6d7a75] hover:text-[#083142]'}`}>
                          Protocolo
                        </button>
                      </div>
                    </div>
                    {modoAtendimento === 'protocolo' && (
                      <SlideProtocolo
                        protocolosAtendimento={protocolosAtendimento}
                        selectedProtocoloAtendimentoId={selectedProtocoloAtendimentoId}
                        onAplicarProtocolo={aplicarProtocoloAtendimento}
                        protocoloAtendimentoSelecionado={protocoloAtendimentoSelecionado}
                        itensProtocoloConfigurados={itensProtocoloConfigurados}
                        totalSessoesConfiguradoNoAgendamento={totalSessoesConfiguradoNoAgendamento}
                        modoRecorrencia={modoRecorrencia}
                        onAtualizarQuantidadeItem={atualizarQuantidadeItemProtocolo}
                        onAlternarSessaoItem={alternarSessaoItemProtocolo}
                        onAtualizarTotalSessoes={atualizarTotalSessoesProtocoloAgendamento}
                      />
                    )}
                  </div>
                )}
                {(modoEdicao || modoAtendimento !== 'protocolo') && (
                  <>
                    <select name="tipo" required value={selectedTipo} onChange={(e) => handleTipoChange(e.target.value)}
                      className="w-full bg-white border border-[#bcc9c4] rounded-lg px-4 py-3 text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 transition-all font-medium appearance-none shadow-sm">
                      <option value="">Selecione uma opção</option>
                      {opcoesTipoConsulta.map((t) => <option key={t.id} value={t.nome}>{t.nome}</option>)}
                    </select>
                    {tiposAtivos.length === 0 && (
                      <p className="text-xs text-amber-700 font-medium mt-2">
                        Nenhum tipo ativo cadastrado. Use `Pacientes &gt; Tipos de consulta`.
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Data / hora */}
              {(() => {
                const bloqueado = isRecorrente && modoRecorrencia === 'livre'
                const inputCls = (extra = '') =>
                  bloqueado
                    ? `w-full min-w-0 rounded-lg transition-all font-medium bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed ${extra}`
                    : `w-full min-w-0 bg-white border border-[#bcc9c4] rounded-lg text-[#171d1c] focus:ring-2 focus:ring-[#006b5a] transition-all font-medium shadow-sm ${extra}`
                const labelCls = bloqueado
                  ? 'text-xs font-semibold text-slate-400 absolute -top-2 left-3 bg-slate-100 px-1 z-10'
                  : 'text-xs font-semibold text-[#6d7a75] absolute -top-2 left-3 bg-white px-1 z-10'
                return (
                  <div className="grid grid-cols-12 gap-3 sm:gap-4">
                    <div className="col-span-12 sm:col-span-6 space-y-1 relative mt-2">
                      <label className={labelCls}>Data {bloqueado ? '' : '*'}</label>
                      <input type="date" name="data" value={dataAgendamento} onChange={(e) => setDataAgendamento(e.target.value)}
                        required={!bloqueado} disabled={bloqueado} className={inputCls('px-4 py-2.5 text-sm')} />
                    </div>
                    <div className="col-span-6 sm:col-span-3 space-y-1 relative mt-2">
                      <label className={labelCls}>Início {bloqueado ? '' : '*'}</label>
                      <input type="time" name="hora_inicio" value={horaInicioValue} onChange={(e) => handleHoraInicioChange(e.target.value)}
                        required={!bloqueado} disabled={bloqueado} className={inputCls('px-3 py-2.5 text-sm')} />
                    </div>
                    <div className="col-span-6 sm:col-span-3 space-y-1 relative mt-2">
                      <label className={labelCls}>Fim {bloqueado ? '' : '*'}</label>
                      <input type="time" name="hora_fim" value={horaFimValue} onChange={(e) => setHoraFimValue(e.target.value)}
                        required={!bloqueado} disabled={bloqueado} className={inputCls('px-3 py-2.5 text-sm')} />
                    </div>
                  </div>
                )
              })()}

              {/* Hint de disponibilidade */}
              {(() => {
                if (!selectedProfissionalId || !dataAgendamento || profissionalSelecionadoEhMedico) return null
                if (disponibilidadeSelecionada === null) return null
                const nomeProfissional = profissionalSelecionado?.nome ?? 'Profissional'
                const NOMES_DIA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
                const diaSemana = disponibilidadeSelecionada?.diaSemana ?? new Date(`${dataAgendamento}T00:00:00`).getDay()
                const disp = disponibilidadeSelecionada?.disponibilidade ?? null
                if (!disp) return (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-700 font-semibold">
                    <Clock size={13} />
                    {nomeProfissional.split(' ')[0]} não atende às {NOMES_DIA[diaSemana]}s
                  </div>
                )
                return (
                  <div className={`px-3 py-2 rounded-lg border text-xs font-semibold ${horarioPreenchido && !horarioValidoNaDisponibilidade ? 'bg-red-50 border-red-300 text-red-700' : 'bg-[#f0fcf9] border-[#006b5a]/20 text-[#006b5a]'}`}>
                    <div className="flex items-center gap-2">
                      <Clock size={13} />
                      Disponível: {formatarFaixasJornada(disp)}
                    </div>
                    {horarioPreenchido && !horarioValidoNaDisponibilidade && (
                      <p className="mt-1">O horário escolhido cruza um período indisponível, como o intervalo do dia.</p>
                    )}
                  </div>
                )
              })()}

              {/* Recorrência */}
              {!modoEdicao && (
                <SlideRecorrencia
                  isRecorrente={isRecorrente}
                  modoRecorrencia={modoRecorrencia}
                  slotsLivres={slotsLivres}
                  frequencia={frequencia}
                  diasSelecionados={diasSelecionados}
                  ocorrencias={ocorrencias}
                  protocoloRecorrenteAtivo={protocoloRecorrenteAtivo}
                  tiposDoProtocolo={tiposDoProtocolo}
                  diaDoMes={diaDoMes}
                  dataAgendamento={dataAgendamento}
                  horaInicioValue={horaInicioValue}
                  horaFimValue={horaFimValue}
                  onIsRecorrenteChange={handleIsRecorrenteChange}
                  onModoChange={handleModoRecorrenciaChange}
                  onAddSlot={handleAddSlot}
                  onRemoveSlot={handleRemoveSlot}
                  onUpdateSlot={handleUpdateSlot}
                  onFrequenciaChange={setFrequencia}
                  onToggleDia={toggleDia}
                  onOcorrenciasChange={setOcorrencias}
                  onAjustarOcorrencias={ajustarOcorrencias}
                />
              )}

              {/* Retorno */}
              <div className="pt-4 border-t border-[#bcc9c4]/30">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input type="checkbox" className="sr-only peer" checked={marcouRetorno} onChange={(e) => setMarcouRetorno(e.target.checked)} />
                    <div className="w-11 h-6 bg-[#dee3e3] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4f46e5]" />
                  </div>
                  <div>
                    <span className="font-semibold text-[#083142]">Retorno</span>
                    <p className="text-xs text-[#6d7a75]">Marque se este é um agendamento de retorno</p>
                  </div>
                </label>
              </div>

              {/* Observações */}
              <div className="space-y-1 relative pt-4">
                <label className="text-xs font-semibold text-[#6d7a75] absolute top-2 left-3 bg-white px-1 z-10">Observações</label>
                <textarea name="observacoes" rows={3} value={observacoesValue} onChange={(e) => setObservacoesValue(e.target.value)}
                  placeholder="Motivo da consulta, queixas principais..."
                  className="w-full bg-white border border-[#bcc9c4] rounded-lg px-4 py-3 pt-6 text-[#171d1c] focus:ring-2 focus:ring-[#006b5a] transition-all font-medium resize-none shadow-sm" />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-[#ba1a1a]/10 border border-[#ba1a1a]/20 text-[#ba1a1a] text-sm font-bold text-center">
                  {error}
                </div>
              )}
              {loadingDetalhesAtendimento && (
                <div className="p-3 rounded-lg bg-[#006b5a]/10 border border-[#006b5a]/20 text-[#006b5a] text-sm font-semibold text-center">
                  Carregando detalhes do atendimento...
                </div>
              )}
            </form>
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-6 border-t border-[#bcc9c4]/30 bg-[#f5faf9] shrink-0" style={{ paddingTop: '14px', paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))' }}>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3">
              <button type="button" onClick={handleClose} className="w-full sm:w-auto px-6 py-2.5 rounded-lg font-bold text-[#3d4945] bg-white border border-[#bcc9c4] hover:bg-[#dee3e3] transition-colors">
                Cancelar
              </button>
              <button form={formId} type="submit" disabled={loading} className="w-full sm:w-auto bg-[#006b5a] text-white px-8 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-[#004f43] transition-colors shadow-md disabled:opacity-70">
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      {!isControlled && (
        <button type="button" onClick={() => setIsOpen(true)}
          className="w-full bg-white text-[#006b5a] border-2 border-[#006b5a] rounded-xl py-3 font-bold flex items-center justify-center gap-2 hover:bg-[#f0f5f4] transition-colors">
          <CalendarPlus size={20} />
          <span>Novo Agendamento</span>
        </button>
      )}
      {typeof document !== 'undefined' ? createPortal(slide, document.body) : null}
    </>
  )
}
