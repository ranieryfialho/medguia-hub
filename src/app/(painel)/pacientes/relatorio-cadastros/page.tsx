import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { requireModulo } from '@/lib/guard'
import { APP_TIME_ZONE, formatAppDateKey, getAppDayRangeUTC } from '@/lib/datetime'
import { Users, CalendarDays, TrendingUp, UserPlus } from 'lucide-react'
import { FiltrosCadastros, BtnGerarPdfCadastros } from '@/components/features/shared'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>
type TipoFiltro = '12meses' | 'mes' | 'semana' | 'personalizado'

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
    .select('id, created_at, origem, indicado_por, ativo')
    .eq('fonte', 'sistema')
    .gte('created_at', queryInicio)
    .order('created_at', { ascending: false })

  const { data: pacientesRaw } = queryFim
    ? await baseQuery.lte('created_at', queryFim)
    : await baseQuery

  const pacientes = pacientesRaw ?? []

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
    </div>
  )
}
