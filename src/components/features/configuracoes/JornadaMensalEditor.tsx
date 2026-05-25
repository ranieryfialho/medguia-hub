'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parse,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { CalendarDays, CheckCircle2, CopyPlus, RotateCcw } from 'lucide-react'
import type { DiaDisponibilidade } from '@/actions/disponibilidade'
import {
  materializarJornadaMensal,
  restaurarJornadaMensalDia,
  salvarJornadaMensalDia,
  type JornadaMensalDia,
} from '@/actions/jornada-mensal'

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const ORIGEM_LABEL: Record<string, string> = {
  template: 'Template aplicado',
  ajuste_manual: 'Ajuste manual',
  folga: 'Folga',
  feriado: 'Feriado',
  extra: 'Extra',
  afastamento: 'Afastamento',
  fallback: 'Semanal',
}

type Props = {
  targetProfissionalId: string
  profissionalAtualId: string
  profissionais: { id: string; nome: string }[]
  isGestor: boolean
  mesReferencia: string
  disponibilidade: DiaDisponibilidade[]
  jornadaMensal: JornadaMensalDia[]
}

function parseMes(mesReferencia: string) {
  return parse(`${mesReferencia}-01`, 'yyyy-MM-dd', new Date())
}

function buildCalendarDays(mesReferencia: string) {
  const inicioMes = startOfMonth(parseMes(mesReferencia))
  const fimMes = endOfMonth(inicioMes)
  const inicioGrid = startOfWeek(inicioMes, { weekStartsOn: 0 })
  const fimGrid = endOfWeek(fimMes, { weekStartsOn: 0 })
  const dias: Date[] = []

  let cursor = inicioGrid
  while (cursor <= fimGrid) {
    dias.push(cursor)
    cursor = addDays(cursor, 1)
  }

  return dias
}

function normalizeTime(value: string | null | undefined, fallback: string) {
  return value?.slice(0, 5) ?? fallback
}

function toMinutos(value: string | null | undefined) {
  if (!value) return null
  const [hh, mm] = value.slice(0, 5).split(':').map(Number)
  return hh * 60 + mm
}

function formatarDelta(minutos: number) {
  const horas = Math.floor(minutos / 60)
  const mins = minutos % 60

  if (horas > 0 && mins > 0) return `${horas}h${mins}min`
  if (horas > 0) return `${horas}h`
  return `${mins}min`
}

function buildFormState(dia: {
  ativo: boolean
  jornada_inicio: string | null
  jornada_fim: string | null
  intervalo_inicio: string | null
  intervalo_fim: string | null
  observacao: string | null
}) {
  return {
    ativo: dia.ativo,
    jornada_inicio: normalizeTime(dia.jornada_inicio, '08:00'),
    jornada_fim: normalizeTime(dia.jornada_fim, '18:00'),
    intervalo_ativo: Boolean(dia.intervalo_inicio && dia.intervalo_fim),
    intervalo_inicio: normalizeTime(dia.intervalo_inicio, '12:00'),
    intervalo_fim: normalizeTime(dia.intervalo_fim, '13:00'),
    observacao: dia.observacao ?? '',
  }
}

export function JornadaMensalEditor({
  targetProfissionalId,
  profissionalAtualId,
  profissionais,
  isGestor,
  mesReferencia,
  disponibilidade,
  jornadaMensal,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedDate, setSelectedDate] = useState(() => `${mesReferencia}-01`)

  const templateMap = new Map(disponibilidade.map((dia) => [dia.dia_semana, dia]))
  const mensalMap = new Map(jornadaMensal.map((dia) => [dia.data, dia]))
  const diasCalendario = buildCalendarDays(mesReferencia)
  const inicioMes = startOfMonth(parseMes(mesReferencia))
  const diasDoMes = diasCalendario.filter((dia) => isSameMonth(dia, inicioMes))

  function resolverDia(data: Date) {
    const dataKey = format(data, 'yyyy-MM-dd')
    const mensal = mensalMap.get(dataKey)
    if (mensal) {
      return { ...mensal, data: dataKey, origemExibicao: mensal.origem }
    }

    const template = templateMap.get(data.getDay())
    if (!template?.ativo) {
      return {
        data: dataKey,
        jornada_inicio: null,
        jornada_fim: null,
        intervalo_inicio: null,
        intervalo_fim: null,
        ativo: false,
        origem: 'template' as const,
        origemExibicao: 'fallback',
        observacao: null,
      }
    }

    return {
      data: dataKey,
      jornada_inicio: template.jornada_inicio,
      jornada_fim: template.jornada_fim,
      intervalo_inicio: template.intervalo_inicio,
      intervalo_fim: template.intervalo_fim,
      ativo: true,
      origem: 'template' as const,
      origemExibicao: 'fallback',
      observacao: null,
    }
  }

  const resolvedSelectedDay = resolverDia(parse(selectedDate, 'yyyy-MM-dd', new Date()))
  const [form, setForm] = useState(() => buildFormState(resolvedSelectedDay))
  const templateDoDia = templateMap.get(parse(selectedDate, 'yyyy-MM-dd', new Date()).getDay())
  const templateResolveDia = templateDoDia?.ativo
    ? {
        ativo: true,
        jornada_inicio: templateDoDia.jornada_inicio,
        jornada_fim: templateDoDia.jornada_fim,
        intervalo_inicio: templateDoDia.intervalo_inicio,
        intervalo_fim: templateDoDia.intervalo_fim,
      }
    : {
        ativo: false,
        jornada_inicio: null,
        jornada_fim: null,
        intervalo_inicio: null,
        intervalo_fim: null,
      }

  const inicioBase = toMinutos(templateResolveDia.jornada_inicio)
  const fimBase = toMinutos(templateResolveDia.jornada_fim)
  const inicioAtual = form.ativo ? toMinutos(form.jornada_inicio) : null
  const fimAtual = form.ativo ? toMinutos(form.jornada_fim) : null
  const diferencaInicio = inicioBase !== null && inicioAtual !== null ? inicioBase - inicioAtual : null
  const diferencaFim = fimBase !== null && fimAtual !== null ? fimAtual - fimBase : null
  const jornadaInicioEfetiva = form.ativo ? form.jornada_inicio : null
  const jornadaFimEfetiva = form.ativo ? form.jornada_fim : null
  const intervaloInicioEfetivo = form.ativo && form.intervalo_ativo ? form.intervalo_inicio : null
  const intervaloFimEfetivo = form.ativo && form.intervalo_ativo ? form.intervalo_fim : null
  const diaDiferenteDoPadrao =
    form.ativo !== templateResolveDia.ativo ||
    jornadaInicioEfetiva !== (templateResolveDia.jornada_inicio ?? null) ||
    jornadaFimEfetiva !== (templateResolveDia.jornada_fim ?? null) ||
    intervaloInicioEfetivo !== (templateResolveDia.intervalo_inicio ?? null) ||
    intervaloFimEfetivo !== (templateResolveDia.intervalo_fim ?? null)

  let resumoAjuste = 'Este dia segue o padrão semanal.'
  if (!templateResolveDia.ativo && form.ativo) {
    resumoAjuste = 'Dia extra em relação ao padrão semanal.'
  } else if (templateResolveDia.ativo && !form.ativo) {
    resumoAjuste = 'Dia removido da jornada padrão.'
  } else if (templateResolveDia.ativo && form.ativo && diaDiferenteDoPadrao) {
    const partes: string[] = []
    if (diferencaInicio !== null && diferencaInicio > 0) partes.push(`entrada ${formatarDelta(diferencaInicio)} mais cedo`)
    if (diferencaInicio !== null && diferencaInicio < 0) partes.push(`entrada ${formatarDelta(Math.abs(diferencaInicio))} mais tarde`)
    if (diferencaFim !== null && diferencaFim > 0) partes.push(`saída ${formatarDelta(diferencaFim)} mais tarde`)
    if (diferencaFim !== null && diferencaFim < 0) partes.push(`saída ${formatarDelta(Math.abs(diferencaFim))} mais cedo`)
    resumoAjuste = partes.length > 0 ? `Ajuste identificado: ${partes.join(' • ')}.` : 'Ajuste manual em relação ao padrão semanal.'
  }

  function handleSelectDate(data: string) {
    setSelectedDate(data)
    setForm(buildFormState(resolverDia(parse(data, 'yyyy-MM-dd', new Date()))))
  }

  function pushFilters(next: { profissional?: string; mes?: string }) {
    const profissional = next.profissional ?? profissionalAtualId
    const mes = next.mes ?? mesReferencia
    const params = new URLSearchParams()
    params.set('mes', mes)
    if (isGestor) params.set('profissional', profissional)
    router.push(`/configuracoes/jornada?${params.toString()}`)
  }

  function handleSalvarDia() {
    startTransition(async () => {
      const res = await salvarJornadaMensalDia(targetProfissionalId, {
        data: selectedDate,
        ativo: form.ativo,
        jornada_inicio: form.ativo ? form.jornada_inicio : null,
        jornada_fim: form.ativo ? form.jornada_fim : null,
        intervalo_inicio: form.ativo && form.intervalo_ativo ? form.intervalo_inicio : null,
        intervalo_fim: form.ativo && form.intervalo_ativo ? form.intervalo_fim : null,
        observacao: form.observacao,
      })

      if (res.error) {
        toast.error(res.error)
        return
      }

      toast.success('Jornada do dia salva.')
      router.refresh()
    })
  }

  function handleAplicarTemplate() {
    startTransition(async () => {
      const res = await materializarJornadaMensal(targetProfissionalId, mesReferencia)
      if (res.error) {
        toast.error(res.error)
        return
      }

      toast.success(
        res.updated && res.updated > 0
          ? `Template aplicado em ${res.updated} dia(s).`
          : 'Nada para atualizar neste mês.',
      )
      router.refresh()
    })
  }

  function handleRestaurarDia() {
    startTransition(async () => {
      const res = await restaurarJornadaMensalDia(targetProfissionalId, selectedDate)
      if (res.error) {
        toast.error(res.error)
        return
      }

      toast.success('Dia restaurado ao template semanal.')
      router.refresh()
    })
  }

  const diasComAjuste = jornadaMensal.filter((dia) => dia.origem !== 'template').length
  const diasPlanejados = jornadaMensal.length
  const diasMaterializadosTemplate = jornadaMensal.filter((dia) => dia.origem === 'template').length
  const totalDiasMes = diasDoMes.length
  const diasPendentesMaterializacao = Math.max(0, totalDiasMes - diasPlanejados)
  const templateAplicadoIntegralmente = diasPendentesMaterializacao === 0
  const diasComOverride = jornadaMensal.filter((dia) => dia.origem !== 'template').length

  function renderDayCard(dia: Date, compact = false) {
    const resolvido = resolverDia(dia)
    const isCurrentMonth = isSameMonth(dia, inicioMes)
    const isSelected = selectedDate === resolvido.data
    const hasManual = resolvido.origemExibicao !== 'fallback' && resolvido.origemExibicao !== 'template'
    const hasMaterializedTemplate = resolvido.origemExibicao === 'template'

    return (
      <button
        key={resolvido.data}
        type="button"
        onClick={() => handleSelectDate(resolvido.data)}
        className={`${compact ? 'min-h-[120px] p-3' : 'min-h-[92px] sm:min-h-[110px] p-2.5 sm:p-3'} rounded-2xl border text-left transition-all ${
          isSelected
            ? 'border-[#006b5a] bg-[#006b5a]/5 shadow-sm'
            : hasManual
              ? 'border-amber-200 bg-amber-50/40 hover:border-amber-300'
              : hasMaterializedTemplate
                ? 'border-emerald-200 bg-emerald-50/40 hover:border-emerald-300'
                : 'border-slate-200 bg-white hover:border-[#006b5a]/40'
        } ${isCurrentMonth ? '' : 'opacity-45'}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-slate-900">{format(dia, 'd')}</span>
          <span className={`rounded-full px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold ${
            resolvido.ativo
              ? hasManual
                ? 'bg-amber-100 text-amber-700'
                : hasMaterializedTemplate
                  ? 'bg-emerald-100 text-emerald-700'
                : 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-100 text-slate-500'
          }`}>
            {ORIGEM_LABEL[resolvido.origemExibicao] ?? 'Planejado'}
          </span>
        </div>

        <div className={`${compact ? 'mt-3' : 'mt-2 sm:mt-3'} space-y-1`}>
          <p className="text-[11px] sm:text-xs font-medium text-slate-700">
            {resolvido.ativo && resolvido.jornada_inicio && resolvido.jornada_fim
              ? `${resolvido.jornada_inicio}–${resolvido.jornada_fim}`
              : 'Sem atendimento'}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-400">
            {resolvido.intervalo_inicio && resolvido.intervalo_fim
              ? `Intervalo ${resolvido.intervalo_inicio}–${resolvido.intervalo_fim}`
              : resolvido.ativo
                ? 'Sem intervalo'
                : 'Folga / indisponível'}
          </p>
          {resolvido.observacao && (
            <p
              title={resolvido.observacao}
              className="truncate text-[10px] font-medium text-[#006b5a]"
            >
              Motivo: {resolvido.observacao}
            </p>
          )}
        </div>
      </button>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-b from-slate-50/60 to-transparent">
        <div className="flex items-center gap-2 mb-1">
          <CalendarDays size={18} className="text-[#006b5a]" />
          <h3 className="font-bold text-slate-900">Planejamento Mensal</h3>
        </div>
        <p className="text-xs text-slate-500">
          Visualize o mês completo, aplique o template semanal e ajuste dias específicos sem distorcer o relatório.
        </p>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {isGestor && profissionais.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1.5">Profissional</label>
                <select
                  value={profissionalAtualId}
                  onChange={(e) => pushFilters({ profissional: e.target.value })}
                  className="w-full bg-white border border-[#bcc9c4] rounded-lg px-3 py-2 text-sm text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] transition-all font-medium"
                >
                  {profissionais.map((profissional) => (
                    <option key={profissional.id} value={profissional.id}>{profissional.nome}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1.5">Mês</label>
              <input
                type="month"
                value={mesReferencia}
                onChange={(e) => pushFilters({ mes: e.target.value })}
                className="w-full bg-white border border-[#bcc9c4] rounded-lg px-3 py-2 text-sm text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] transition-all font-medium"
              />
            </div>
          </div>

          <button
            onClick={handleAplicarTemplate}
            disabled={isPending}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#006b5a] text-white text-sm font-bold hover:bg-[#005548] transition-colors disabled:opacity-60"
          >
            <CopyPlus size={16} />
            {isPending ? 'Aplicando...' : 'Aplicar template ao mês'}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mês selecionado</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 capitalize">
              {format(inicioMes, "MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dias materializados</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{diasPlanejados} / {totalDiasMes}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ajustes manuais</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{diasComAjuste}</p>
          </div>
        </div>

        <div className={`mt-4 rounded-2xl border px-4 py-3 ${
          templateAplicadoIntegralmente
            ? 'border-emerald-200 bg-emerald-50/80'
            : 'border-amber-200 bg-amber-50/80'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 rounded-full p-2 ${
              templateAplicadoIntegralmente
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              <CheckCircle2 size={16} />
            </div>
            <div>
              <p className={`text-sm font-semibold ${
                templateAplicadoIntegralmente ? 'text-emerald-900' : 'text-amber-900'
              }`}>
                {templateAplicadoIntegralmente
                  ? `Template mensal aplicado aos ${totalDiasMes} dias do profissional.`
                  : `Template materializado em ${diasPlanejados} de ${totalDiasMes} dias do mês.`}
              </p>
              <p className={`mt-1 text-xs ${
                templateAplicadoIntegralmente ? 'text-emerald-800/80' : 'text-amber-800/80'
              }`}>
                {templateAplicadoIntegralmente
                  ? `${diasMaterializadosTemplate} dia(s) seguem o template e ${diasComOverride} possuem ajuste individual ou folga.`
                  : `Ainda existem ${diasPendentesMaterializacao} dia(s) usando apenas a referência semanal. Após aplicar o template, cada dia passa a ter registro mensal explícito.`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_360px] gap-5">
        <div className="xl:order-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dia selecionado</p>
              <h4 className="text-base sm:text-lg font-bold text-slate-900 capitalize">
                {format(parse(selectedDate, 'yyyy-MM-dd', new Date()), "EEEE, d 'de' MMMM", { locale: ptBR })}
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                {resolvedSelectedDay.origemExibicao === 'template'
                  ? 'Este dia já foi gravado no planejamento mensal com base no template semanal.'
                  : resolvedSelectedDay.origemExibicao === 'fallback'
                    ? 'Este dia ainda usa apenas a referência semanal; não há registro mensal salvo.'
                    : 'Este dia possui ajuste mensal individual e sobrepõe a jornada semanal.'}
              </p>
              <p className="mt-2 text-xs font-medium text-[#006b5a]">
                {resumoAjuste}
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#006b5a] border border-[#006b5a]/20">
              {ORIGEM_LABEL[resolvedSelectedDay.origemExibicao] ?? 'Planejado'}
            </span>
          </div>

          <div className="mt-4 space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm((prev) => ({ ...prev, ativo: e.target.checked }))}
                className="rounded border-slate-300 text-[#006b5a] focus:ring-[#006b5a]/40"
              />
              <span className="text-sm font-semibold text-slate-700">Profissional atende neste dia</span>
            </label>

            {form.ativo ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1.5">Início da jornada</label>
                    <input
                      type="time"
                      value={form.jornada_inicio}
                      onChange={(e) => setForm((prev) => ({ ...prev, jornada_inicio: e.target.value }))}
                      className="w-full border border-[#bcc9c4] rounded-lg px-3 py-2 text-sm font-medium text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1.5">Fim da jornada</label>
                    <input
                      type="time"
                      value={form.jornada_fim}
                      onChange={(e) => setForm((prev) => ({ ...prev, jornada_fim: e.target.value }))}
                      className="w-full border border-[#bcc9c4] rounded-lg px-3 py-2 text-sm font-medium text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] outline-none transition-all"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={form.intervalo_ativo}
                    onChange={(e) => setForm((prev) => ({ ...prev, intervalo_ativo: e.target.checked }))}
                    className="rounded border-slate-300 text-[#006b5a] focus:ring-[#006b5a]/40"
                  />
                  <span className="text-sm font-semibold text-slate-700">Possui intervalo no dia</span>
                </label>

                {form.intervalo_ativo && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1.5">Início do intervalo</label>
                      <input
                        type="time"
                        value={form.intervalo_inicio}
                        onChange={(e) => setForm((prev) => ({ ...prev, intervalo_inicio: e.target.value }))}
                        className="w-full border border-[#bcc9c4] rounded-lg px-3 py-2 text-sm font-medium text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1.5">Fim do intervalo</label>
                      <input
                        type="time"
                        value={form.intervalo_fim}
                        onChange={(e) => setForm((prev) => ({ ...prev, intervalo_fim: e.target.value }))}
                        className="w-full border border-[#bcc9c4] rounded-lg px-3 py-2 text-sm font-medium text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] outline-none transition-all"
                      />
                    </div>
                  </div>
                )}
              </>
            ) : null}

            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1.5">Motivo da alteração</label>
              <textarea
                value={form.observacao}
                onChange={(e) => setForm((prev) => ({ ...prev, observacao: e.target.value }))}
                rows={3}
                placeholder="Ex.: ficará 1h a mais por encaixe, sairá mais cedo por consulta, treinamento, reunião externa..."
                className="w-full border border-[#bcc9c4] rounded-lg px-3 py-2 text-sm text-[#171d1c] focus:ring-2 focus:ring-[#006b5a]/50 focus:border-[#006b5a] outline-none transition-all resize-none"
              />
              {diaDiferenteDoPadrao && (
                <p className="mt-1 text-[11px] text-amber-700">
                  Sempre informe o motivo quando o horário do dia sair do padrão semanal.
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <button
              onClick={handleSalvarDia}
              disabled={isPending}
              className="inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#006b5a] text-white text-sm font-bold hover:bg-[#005548] transition-colors disabled:opacity-60"
            >
              <CheckCircle2 size={16} />
              {isPending ? 'Salvando...' : 'Salvar ajuste do dia'}
            </button>

            <button
              onClick={handleRestaurarDia}
              disabled={isPending}
              className="inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors disabled:opacity-60"
            >
              <RotateCcw size={16} />
              Restaurar ao template semanal
            </button>
          </div>
        </div>

        <div className="xl:order-1">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:hidden">
            {diasDoMes.map((dia) => renderDayCard(dia, true))}
          </div>

          <div className="hidden xl:block">
            <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
              <div className="min-w-[44rem]">
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {DIAS_SEMANA.map((dia) => (
                    <div key={dia} className="px-2 py-1 text-[11px] sm:text-xs font-bold uppercase tracking-wide text-slate-400">
                      {dia}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {diasCalendario.map((dia) => renderDayCard(dia))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
