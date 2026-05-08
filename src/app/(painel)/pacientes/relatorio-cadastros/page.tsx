import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { requireModulo } from '@/lib/guard'
import { APP_TIME_ZONE, formatAppDateKey } from '@/lib/datetime'
import { Users, CalendarDays, TrendingUp, UserPlus } from 'lucide-react'

function parsearOrigem(origem: string | null | undefined): string {
  if (!origem?.trim()) return 'Não informada'
  const partes = origem.split('::')
  if (partes[0].trim() === 'Meta' && partes[1]?.trim()) return `Meta (${partes[1].trim()})`
  return partes[0].trim() || 'Não informada'
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
  }).format(new Date(y, m - 1, 1))
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

export default async function RelatorioCadastrosPacientesPage() {
  await requireModulo('pacientes')

  const supabase = await createClient()

  const agora = new Date()
  const inicio12Meses = new Date(
    agora.getFullYear() - 1,
    agora.getMonth(),
    agora.getDate(),
  ).toISOString()

  const { data: pacientesRaw } = await supabase
    .from('pacientes')
    .select('id, created_at, origem, ativo')
    .eq('fonte', 'sistema')
    .gte('created_at', inicio12Meses)
    .order('created_at', { ascending: false })

  const pacientes = pacientesRaw ?? []

  const porMes = new Map<string, number>()
  const porSemana = new Map<string, number>()
  const porDia = new Map<string, number>()
  const porOrigem = new Map<string, number>()

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
  }

  const meses = Array.from(porMes.entries()).sort(([a], [b]) => b.localeCompare(a))
  const semanas = Array.from(porSemana.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 12)
  const dias = Array.from(porDia.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 30)
  const origens = Array.from(porOrigem.entries()).sort(([, a], [, b]) => b - a)

  const total = pacientes.length
  const totalMesAtual = porMes.get(getMesKey(agora.toISOString())) ?? 0
  const totalSemanaAtual = porSemana.get(getSemanaKey(agora.toISOString())) ?? 0

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
        <h1 className="text-2xl font-semibold text-text-primary flex items-center gap-2">
          <UserPlus size={28} className="text-primary-500" />
          Relatório de Cadastros
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Pacientes cadastrados nos últimos 12 meses, agrupados por dia, semana, mês e origem.
        </p>
      </div>

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

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">
            Por Semana{' '}
            <span className="text-xs font-normal text-slate-400">(últimas 12 semanas)</span>
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
              {semanas.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-slate-500">
                    Nenhum cadastro.
                  </td>
                </tr>
              )}
              {semanas.map(([key, qtd]) => (
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
            <span className="text-xs font-normal text-slate-400">(últimos 30 dias)</span>
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
              {dias.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-slate-500">
                    Nenhum cadastro.
                  </td>
                </tr>
              )}
              {dias.map(([key, qtd]) => (
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
