import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { requireModulo } from '@/lib/guard'
import { APP_TIME_ZONE, formatAppDateKey, getAppDayRangeUTC } from '@/lib/datetime'
import { Users, CalendarDays, TrendingUp, UserPlus } from 'lucide-react'
import { FiltrosCadastros, BtnGerarPdfCadastros, SelectCheckbox } from '@/components/features/shared'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>
type TipoFiltro = '12meses' | 'mes' | 'semana' | 'personalizado'
type OrdemDetalhe = 'data' | 'alfabetica' | 'origem'

type PacienteRelatorio = {
  id: string
  nome: string | null
  telefone: string | null
  email: string | null
  convenio: string | null
  created_at: string | null
  origem: string | null
  indicado_por: string | null
  ativo: boolean | null
}

function tipoOrigem(nome: string) {
  const n = nome.toLowerCase()
  if (n.includes('meta') || n.includes('facebook')) return 'facebook'
  if (n.includes('médico') || n.includes('medico')) return 'medico'
  return 'outro'
}

function normalizarNomeMedico(nome: string | null | undefined): string {
  if (!nome?.trim()) return 'Não informado'
  const semPrefixo = nome.trim().replace(/^(Dra?\.?\s+)/i, '').trim()
  return semPrefixo.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase())
}

function parsearOrigem(origem: string | null | undefined): string {
  if (!origem?.trim()) return 'Não informada'
  const partes = origem.split('::')
  const base = partes[0].trim()
  if (!base) return 'Não informada'
  const baseNorm = base.charAt(0).toUpperCase() + base.slice(1).toLowerCase()
  if (baseNorm === 'Facebook') return 'Facebook'
  if (baseNorm === 'Meta' && partes[1]?.trim()) {
    const canal = partes[1].trim()
    if (canal.toLowerCase() === 'facebook') return 'Facebook'
    if (canal.toLowerCase() === 'instagram') return 'Instagram'
    return canal
  }
  return baseNorm
}

function parsearAnuncioMeta(origem: string | null | undefined): string | null {
  if (!origem?.trim()) return null
  const partes = origem.split('::')
  const base = partes[0].trim().toLowerCase()

  if (base === 'facebook') {
    return partes[1]?.trim() || null
  }

  if (base !== 'meta') return null

  const canal = partes[1]?.trim() || ''
  const anuncio = partes[2]?.trim() || ''
  if (canal.toLowerCase() !== 'facebook') return null
  return anuncio || null
}

function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return 'Não informada'
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: APP_TIME_ZONE,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso))
}

function formatarIndicacao(origem: string | null | undefined, indicadoPor: string | null | undefined): string {
  const nome = indicadoPor?.trim()
  if (!nome) return '—'
  if (tipoOrigem(origem ?? '') === 'medico') return `Dr(a). ${normalizarNomeMedico(nome)}`
  return nome
}

function getSemanaKey(isoStr: string): string {
  const tzDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(isoStr))
  const [y, m, d] = tzDate.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = dt.getDay() === 0 ? 6 : dt.getDay() - 1
  dt.setDate(dt.getDate() - dow)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function getMesKey(isoStr: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).format(new Date(isoStr))
}

function formatarMes(mesKey: string): string {
  const [y, m] = mesKey.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: APP_TIME_ZONE,
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${y}-${String(m).padStart(2, '0')}-15T12:00:00Z`))
    .replace(/^\w/, c => c.toUpperCase())
    .replace('.', '')
}

function formatarSemana(mondayKey: string): string {
  const [y, m, d] = mondayKey.split('-').map(Number)
  const mon = new Date(y, m - 1, d)
  const sun = new Date(y, m - 1, d + 6)
  const fmt = (dt: Date) =>
    `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`
  return `${fmt(mon)} – ${fmt(sun)}`
}

function formatarDia(diaKey: string): string {
  const [y, mo, d] = diaKey.split('-')
  return `${d}/${mo}/${y}`
}

function getMondayKey(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = dt.getDay() === 0 ? 6 : dt.getDay() - 1
  dt.setDate(dt.getDate() - dow)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function getMonthRange(mesKey: string) {
  const [y, m] = mesKey.split('-').map(Number)
  const lastDay = new Date(y, m, 0)
  const lastStr = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
  return {
    start: getAppDayRangeUTC(`${y}-${String(m).padStart(2, '0')}-01`).start,
    end: getAppDayRangeUTC(lastStr).end,
  }
}

function getWeekRange(mondayKey: string) {
  const [y, m, d] = mondayKey.split('-').map(Number)
  const sunday = new Date(y, m - 1, d + 6)
  const sundayStr = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`
  return {
    start: getAppDayRangeUTC(mondayKey).start,
    end: getAppDayRangeUTC(sundayStr).end,
  }
}

function buildDetalhamentoUrl(
  params: Awaited<SearchParams>,
  overrides: {
    detalhe_pagina?: number
    detalhe_limite?: number
    detalhe_ordem?: OrdemDetalhe
    detalhe_origem?: string[]
  } = {},
) {
  const query = new URLSearchParams()

  for (const [key, rawValue] of Object.entries(params)) {
    if (key === 'detalhe_pagina' || key === 'detalhe_limite' || key === 'detalhe_ordem' || key === 'detalhe_origem') continue
    if (Array.isArray(rawValue)) {
      for (const value of rawValue) {
        if (typeof value === 'string') query.append(key, value)
      }
      continue
    }
    if (typeof rawValue === 'string' && rawValue) query.set(key, rawValue)
  }

  const pagina = overrides.detalhe_pagina ?? 1
  const limite = overrides.detalhe_limite
  const ordem = overrides.detalhe_ordem
  const origens = overrides.detalhe_origem ?? []

  if (pagina > 1) query.set('detalhe_pagina', String(pagina))
  if (limite && limite !== 20) query.set('detalhe_limite', String(limite))
  if (ordem && ordem !== 'data') query.set('detalhe_ordem', ordem)
  for (const origem of origens) {
    if (origem) query.append('detalhe_origem', origem)
  }

  const queryString = query.toString()
  return queryString ? `/pacientes/relatorio-cadastros?${queryString}` : '/pacientes/relatorio-cadastros'
}

export default async function RelatorioCadastrosPacientesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  await requireModulo('pacientes')

  const supabase = await createClient()
  const params = await searchParams

  const agora = new Date()
  const tipo = ((params.tipo as string) || '12meses') as TipoFiltro
  const mesParam = (params.mes as string) || ''
  const semanaParam = (params.semana as string) || ''
  const inicioParam = (params.inicio as string) || ''
  const fimParam = (params.fim as string) || ''
  const detalheLimiteRaw = Number(params.detalhe_limite)
  const detalheLimite = [10, 20, 50, 100].includes(detalheLimiteRaw) ? detalheLimiteRaw : 20
  const detalhePaginaRaw = Number(params.detalhe_pagina)
  const detalheOrdem = (['data', 'alfabetica', 'origem'].includes(params.detalhe_ordem as string)
    ? params.detalhe_ordem
    : 'data') as OrdemDetalhe
  const detalheOrigensSelecionadas = Array.from(
    new Set(
      Array.isArray(params.detalhe_origem)
        ? params.detalhe_origem.filter((origem): origem is string => !!origem)
        : typeof params.detalhe_origem === 'string' && params.detalhe_origem
          ? [params.detalhe_origem]
          : [],
    ),
  )

  let queryInicio: string
  let queryFim: string | undefined

  if (tipo === 'mes' && mesParam) {
    const range = getMonthRange(mesParam)
    queryInicio = range.start
    queryFim = range.end
  } else if (tipo === 'semana' && semanaParam) {
    const mondayKey = getMondayKey(semanaParam)
    const range = getWeekRange(mondayKey)
    queryInicio = range.start
    queryFim = range.end
  } else if (tipo === 'personalizado' && (inicioParam || fimParam)) {
    queryInicio = inicioParam
      ? getAppDayRangeUTC(inicioParam).start
      : new Date(agora.getFullYear() - 1, agora.getMonth(), agora.getDate()).toISOString()
    queryFim = fimParam ? getAppDayRangeUTC(fimParam).end : agora.toISOString()
  } else {
    queryInicio = new Date(agora.getFullYear() - 1, agora.getMonth(), agora.getDate()).toISOString()
    queryFim = undefined
  }

  const isFiltered = tipo !== '12meses'

  const baseQuery = supabase
    .from('pacientes')
    .select('id, nome, telefone, email, convenio, created_at, origem, indicado_por, ativo')
    .eq('fonte', 'sistema')
    .gte('created_at', queryInicio)
    .order('created_at', { ascending: false })

  const { data: pacientesRaw } = queryFim
    ? await baseQuery.lte('created_at', queryFim)
    : await baseQuery

  const pacientes = (pacientesRaw ?? []) as PacienteRelatorio[]

  const porMes = new Map<string, number>()
  const porSemana = new Map<string, number>()
  const porDia = new Map<string, number>()
  const porOrigem = new Map<string, number>()
  const porMedico = new Map<string, number>()
  const porAnuncioMeta = new Map<string, number>()

  for (const p of pacientes) {
    if (!p.created_at) continue

    const mesKey = getMesKey(p.created_at)
    porMes.set(mesKey, (porMes.get(mesKey) ?? 0) + 1)

    const semanaKey = getSemanaKey(p.created_at)
    porSemana.set(semanaKey, (porSemana.get(semanaKey) ?? 0) + 1)

    const diaKey = formatAppDateKey(p.created_at)
    porDia.set(diaKey, (porDia.get(diaKey) ?? 0) + 1)

    const origem = parsearOrigem(p.origem)
    porOrigem.set(origem, (porOrigem.get(origem) ?? 0) + 1)

    if (tipoOrigem(p.origem ?? '') === 'medico') {
      const medico = normalizarNomeMedico(p.indicado_por)
      porMedico.set(medico, (porMedico.get(medico) ?? 0) + 1)
    }

    const anuncio = parsearAnuncioMeta(p.origem)
    if (anuncio) {
      porAnuncioMeta.set(anuncio, (porAnuncioMeta.get(anuncio) ?? 0) + 1)
    }
  }

  const meses = Array.from(porMes.entries()).sort(([a], [b]) => b.localeCompare(a))
  const semanas = Array.from(porSemana.entries()).sort(([a], [b]) => b.localeCompare(a))
  const dias = Array.from(porDia.entries()).sort(([a], [b]) => b.localeCompare(a))
  const origens = Array.from(porOrigem.entries()).sort(([, a], [, b]) => b - a)
  const medicos = Array.from(porMedico.entries()).sort(([, a], [, b]) => b - a)
  const anunciosMeta = Array.from(porAnuncioMeta.entries()).sort(([, a], [, b]) => b - a)

  // Slicing only when viewing the full 12-month default
  const semanasExibidas = isFiltered ? semanas : semanas.slice(0, 12)
  const diasExibidos = isFiltered ? dias : dias.slice(0, 30)

  const total = pacientes.length
  const totalMesAtual = porMes.get(getMesKey(agora.toISOString())) ?? 0
  const totalSemanaAtual = porSemana.get(getSemanaKey(agora.toISOString())) ?? 0

  const periodoLabel = (() => {
    if (tipo === 'mes' && mesParam) return `Mês: ${formatarMes(mesParam)}`
    if (tipo === 'semana' && semanaParam) return `Semana: ${formatarSemana(getMondayKey(semanaParam))}`
    if (tipo === 'personalizado') {
      const de = inicioParam ? formatarDia(inicioParam) : '—'
      const ate = fimParam ? formatarDia(fimParam) : '—'
      return `Período: ${de} a ${ate}`
    }
    return 'Últimos 12 meses'
  })()

  const pdfInput = {
    periodoLabel,
    total,
    totalMesAtual,
    totalSemanaAtual,
    isFiltered,
    meses: meses.map(([key, qtd]) => ({ label: formatarMes(key), qtd })),
    semanas: semanasExibidas.map(([key, qtd]) => ({ label: formatarSemana(key), qtd })),
    dias: diasExibidos.map(([key, qtd]) => ({ label: formatarDia(key), qtd })),
    origens: origens.map(([origem, qtd]) => ({ origem, qtd })),
    medicos: medicos.map(([medico, qtd]) => ({ medico, qtd })),
    anunciosMeta: anunciosMeta.map(([anuncio, qtd]) => ({ anuncio, qtd })),
  }

  const pacientesFiltradosPorOrigem = detalheOrigensSelecionadas.length > 0
    ? pacientes.filter((paciente) => detalheOrigensSelecionadas.includes(parsearOrigem(paciente.origem)))
    : pacientes

  const pacientesOrdenados = [...pacientesFiltradosPorOrigem].sort((a, b) => {
    if (detalheOrdem === 'alfabetica') {
      return (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR')
    }

    if (detalheOrdem === 'origem') {
      const origemA = parsearOrigem(a.origem)
      const origemB = parsearOrigem(b.origem)
      const ordemOrigem = origemA.localeCompare(origemB, 'pt-BR')
      if (ordemOrigem !== 0) return ordemOrigem
      return (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR')
    }

    return (b.created_at ?? '').localeCompare(a.created_at ?? '')
  })

  const totalDetalhamento = pacientesOrdenados.length
  const totalPaginasDetalhamento = Math.max(1, Math.ceil(totalDetalhamento / detalheLimite))
  const detalhePagina = Math.min(
    Math.max(1, Number.isFinite(detalhePaginaRaw) ? detalhePaginaRaw : 1),
    totalPaginasDetalhamento,
  )
  const detalheOffset = (detalhePagina - 1) * detalheLimite
  const detalheAte = Math.min(detalheOffset + detalheLimite, totalDetalhamento)
  const detalhamentoCadastros = pacientesOrdenados.slice(detalheOffset, detalheOffset + detalheLimite).map((paciente) => ({
    id: paciente.id,
    nome: paciente.nome?.trim() || 'Sem nome',
    origem: parsearOrigem(paciente.origem),
    dataCadastro: formatarDataHora(paciente.created_at),
    indicacao: formatarIndicacao(paciente.origem, paciente.indicado_por),
    telefone: paciente.telefone?.trim() || '—',
    email: paciente.email?.trim() || '—',
    convenio: paciente.convenio?.trim() || '—',
    status: paciente.ativo === false ? 'Inativo' : 'Ativo',
  }))

  const paginasDetalhamento: Array<number | '...'> = []
  if (totalPaginasDetalhamento <= 7) {
    for (let p = 1; p <= totalPaginasDetalhamento; p++) paginasDetalhamento.push(p)
  } else {
    paginasDetalhamento.push(1)
    if (detalhePagina > 4) paginasDetalhamento.push('...')
    for (let p = Math.max(2, detalhePagina - 1); p <= Math.min(totalPaginasDetalhamento - 1, detalhePagina + 1); p++) {
      paginasDetalhamento.push(p)
    }
    if (detalhePagina < totalPaginasDetalhamento - 3) paginasDetalhamento.push('...')
    paginasDetalhamento.push(totalPaginasDetalhamento)
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-text-secondary mb-2 flex items-center gap-2">
          <Link href="/dashboard" className="hover:text-primary-500 transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <Link href="/pacientes" className="hover:text-primary-500 transition-colors">
            Pacientes
          </Link>
          <span>/</span>
          <span className="text-text-primary font-medium">Relatório de Cadastros</span>
        </div>
        <div className="flex items-start justify-between gap-4 mt-1">
          <h1 className="text-2xl font-semibold text-text-primary flex items-center gap-2">
            <UserPlus size={28} className="text-primary-500" />
            Relatório de Cadastros
          </h1>
          <BtnGerarPdfCadastros {...pdfInput} />
        </div>
        <p className="text-sm text-text-secondary mt-1">
          Pacientes cadastrados{' '}
          {tipo === '12meses' && 'nos últimos 12 meses'}
          {tipo === 'mes' && mesParam && `em ${formatarMes(mesParam)}`}
          {tipo === 'semana' && semanaParam && `na semana de ${formatarSemana(getMondayKey(semanaParam))}`}
          {tipo === 'personalizado' && `no período selecionado`}
          , agrupados por dia, semana, mês e origem.
        </p>
      </div>

      <FiltrosCadastros
        tipo={tipo}
        mes={mesParam}
        semana={semanaParam}
        inicio={inicioParam}
        fim={fimParam}
      />

      {isFiltered ? (
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <Users size={16} />
              <span className="text-xs font-semibold uppercase tracking-wide">Total no período</span>
            </div>
            <p className="text-3xl font-bold text-[#006b5a]">{total}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <Users size={16} />
              <span className="text-xs font-semibold uppercase tracking-wide">Total (12 meses)</span>
            </div>
            <p className="text-3xl font-bold text-[#006b5a]">{total}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <CalendarDays size={16} />
              <span className="text-xs font-semibold uppercase tracking-wide">Este mês</span>
            </div>
            <p className="text-3xl font-bold text-[#006b5a]">{totalMesAtual}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <TrendingUp size={16} />
              <span className="text-xs font-semibold uppercase tracking-wide">Esta semana</span>
            </div>
            <p className="text-3xl font-bold text-[#006b5a]">{totalSemanaAtual}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Por Mês</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="text-left px-4 py-3">Mês</th>
                  <th className="text-right px-4 py-3">Cadastros</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {meses.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-slate-500">
                      Nenhum cadastro no período.
                    </td>
                  </tr>
                )}
                {meses.map(([key, qtd]) => (
                  <tr key={key}>
                    <td className="px-4 py-3 font-medium text-slate-900">{formatarMes(key)}</td>
                    <td className="px-4 py-3 text-right">{qtd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Por Origem</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="text-left px-4 py-3">Origem</th>
                  <th className="text-right px-4 py-3">Cadastros</th>
                  <th className="text-right px-4 py-3">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {origens.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                      Nenhum cadastro no período.
                    </td>
                  </tr>
                )}
                {origens.map(([origem, qtd]) => (
                  <tr key={origem}>
                    <td className="px-4 py-3 font-medium text-slate-900">{origem}</td>
                    <td className="px-4 py-3 text-right">{qtd}</td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {total > 0 ? Math.round((qtd / total) * 100) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {medicos.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Por Médico Parceiro</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="text-left px-4 py-3">Médico</th>
                  <th className="text-right px-4 py-3">Cadastros</th>
                  <th className="text-right px-4 py-3">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {medicos.map(([medico, qtd]) => (
                  <tr key={medico}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {medico === 'Não informado' ? (
                        <span className="text-slate-400 italic">{medico}</span>
                      ) : (
                        `Dr(a). ${medico}`
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">{qtd}</td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {total > 0 ? Math.round((qtd / total) * 100) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {anunciosMeta.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Por Anúncio do Facebook</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="text-left px-4 py-3">Canal — Anúncio</th>
                  <th className="text-right px-4 py-3">Cadastros</th>
                  <th className="text-right px-4 py-3">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {anunciosMeta.map(([anuncio, qtd]) => (
                  <tr key={anuncio}>
                    <td className="px-4 py-3 font-medium text-slate-900">{anuncio}</td>
                    <td className="px-4 py-3 text-right">{qtd}</td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {total > 0 ? Math.round((qtd / total) * 100) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">
            Por Semana{' '}
            {!isFiltered && (
              <span className="text-xs font-normal text-slate-400">(últimas 12 semanas)</span>
            )}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr>
                <th className="text-left px-4 py-3">Semana</th>
                <th className="text-right px-4 py-3">Cadastros</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {semanasExibidas.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-slate-500">
                    Nenhum cadastro.
                  </td>
                </tr>
              )}
              {semanasExibidas.map(([key, qtd]) => (
                <tr key={key}>
                  <td className="px-4 py-3 font-medium text-slate-900">{formatarSemana(key)}</td>
                  <td className="px-4 py-3 text-right">{qtd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">
            Por Dia{' '}
            {!isFiltered && (
              <span className="text-xs font-normal text-slate-400">(últimos 30 dias)</span>
            )}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr>
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-right px-4 py-3">Cadastros</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {diasExibidos.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-slate-500">
                    Nenhum cadastro.
                  </td>
                </tr>
              )}
              {diasExibidos.map(([key, qtd]) => (
                <tr key={key}>
                  <td className="px-4 py-3 font-medium text-slate-900">{formatarDia(key)}</td>
                  <td className="px-4 py-3 text-right">{qtd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Detalhamento dos Cadastros</h2>
          <p className="mt-1 text-sm text-slate-500">
            Relação completa dos pacientes cadastrados no período com origem, data, indicação e dados de contato.
          </p>
        </div>
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/70 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ordenar por</span>
              {[
                { valor: 'data' as const, label: 'Data' },
                { valor: 'alfabetica' as const, label: 'Alfabética' },
                { valor: 'origem' as const, label: 'Origem' },
              ].map((opcao) => (
                <Link
                  key={opcao.valor}
                  href={buildDetalhamentoUrl(params, {
                    detalhe_ordem: opcao.valor,
                    detalhe_limite: detalheLimite,
                    detalhe_pagina: 1,
                    detalhe_origem: detalheOrigensSelecionadas,
                  })}
                  className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                    detalheOrdem === opcao.valor
                      ? 'bg-[#006b5a] text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {opcao.label}
                </Link>
              ))}
            </div>
            <form action="/pacientes/relatorio-cadastros" method="get" className="flex flex-col gap-2 sm:flex-row sm:items-end">
              {Array.isArray(params.tipo)
                ? params.tipo.map((value) => <input key={`tipo-${value}`} type="hidden" name="tipo" value={value} />)
                : typeof params.tipo === 'string' && <input type="hidden" name="tipo" value={params.tipo} />}
              {Array.isArray(params.mes)
                ? params.mes.map((value) => <input key={`mes-${value}`} type="hidden" name="mes" value={value} />)
                : typeof params.mes === 'string' && <input type="hidden" name="mes" value={params.mes} />}
              {Array.isArray(params.semana)
                ? params.semana.map((value) => <input key={`semana-${value}`} type="hidden" name="semana" value={value} />)
                : typeof params.semana === 'string' && <input type="hidden" name="semana" value={params.semana} />}
              {Array.isArray(params.inicio)
                ? params.inicio.map((value) => <input key={`inicio-${value}`} type="hidden" name="inicio" value={value} />)
                : typeof params.inicio === 'string' && <input type="hidden" name="inicio" value={params.inicio} />}
              {Array.isArray(params.fim)
                ? params.fim.map((value) => <input key={`fim-${value}`} type="hidden" name="fim" value={value} />)
                : typeof params.fim === 'string' && <input type="hidden" name="fim" value={params.fim} />}
              <input type="hidden" name="detalhe_ordem" value={detalheOrdem} />
              <input type="hidden" name="detalhe_limite" value={String(detalheLimite)} />
              <div className="min-w-[260px]">
                <SelectCheckbox
                  name="detalhe_origem"
                  label="Filtrar origens"
                  options={origens.map(([origem]) => origem)}
                  selectedValues={detalheOrigensSelecionadas}
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="rounded-md bg-[#006b5a] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#005346]"
                >
                  Filtrar
                </button>
                <Link
                  href={buildDetalhamentoUrl(params, {
                    detalhe_limite: detalheLimite,
                    detalhe_ordem: detalheOrdem,
                    detalhe_pagina: 1,
                    detalhe_origem: [],
                  })}
                  className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
                >
                  Limpar
                </Link>
              </div>
            </form>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Por página</span>
            {[10, 20, 50, 100].map((limite) => (
              <Link
                key={limite}
                href={buildDetalhamentoUrl(params, {
                  detalhe_limite: limite,
                  detalhe_ordem: detalheOrdem,
                  detalhe_pagina: 1,
                  detalhe_origem: detalheOrigensSelecionadas,
                })}
                className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                  detalheLimite === limite
                    ? 'bg-[#006b5a] text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {limite}
              </Link>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr>
                <th className="text-left px-4 py-3">Nome</th>
                <th className="text-left px-4 py-3">Origem</th>
                <th className="text-left px-4 py-3">Data do cadastro</th>
                <th className="text-left px-4 py-3">Indicação</th>
                <th className="text-left px-4 py-3">Telefone</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Convênio</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {detalhamentoCadastros.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    Nenhum cadastro detalhado no período.
                  </td>
                </tr>
              )}
              {detalhamentoCadastros.map((paciente) => (
                <tr key={paciente.id}>
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                    <Link href={`/pacientes/${paciente.id}`} className="hover:text-primary-500 transition-colors">
                      {paciente.nome}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{paciente.origem}</td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{paciente.dataCadastro}</td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{paciente.indicacao}</td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{paciente.telefone}</td>
                  <td className="px-4 py-3 text-slate-700">{paciente.email}</td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{paciente.convenio}</td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{paciente.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-slate-500">
            Mostrando <span className="font-semibold text-slate-700">{totalDetalhamento === 0 ? 0 : detalheOffset + 1}–{detalheAte}</span> de{' '}
            <span className="font-semibold text-slate-700">{totalDetalhamento}</span> cadastro{totalDetalhamento !== 1 ? 's' : ''}
          </p>
          {totalPaginasDetalhamento > 1 && (
            <div className="flex flex-wrap items-center gap-1">
              <Link
                href={buildDetalhamentoUrl(params, {
                  detalhe_pagina: detalhePagina - 1,
                  detalhe_limite: detalheLimite,
                  detalhe_ordem: detalheOrdem,
                  detalhe_origem: detalheOrigensSelecionadas,
                })}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  detalhePagina === 1
                    ? 'pointer-events-none bg-slate-100 text-slate-300'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Anterior
              </Link>
              {paginasDetalhamento.map((pagina, index) =>
                pagina === '...'
                  ? <span key={`ellipsis-${index}`} className="px-2 text-sm text-slate-400">…</span>
                  : (
                    <Link
                      key={pagina}
                      href={buildDetalhamentoUrl(params, {
                        detalhe_pagina: pagina,
                        detalhe_limite: detalheLimite,
                        detalhe_ordem: detalheOrdem,
                        detalhe_origem: detalheOrigensSelecionadas,
                      })}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        pagina === detalhePagina
                          ? 'bg-[#006b5a] text-white'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {pagina}
                    </Link>
                  ),
              )}
              <Link
                href={buildDetalhamentoUrl(params, {
                  detalhe_pagina: detalhePagina + 1,
                  detalhe_limite: detalheLimite,
                  detalhe_ordem: detalheOrdem,
                  detalhe_origem: detalheOrigensSelecionadas,
                })}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  detalhePagina === totalPaginasDetalhamento
                    ? 'pointer-events-none bg-slate-100 text-slate-300'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Próxima
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
