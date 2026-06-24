import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { requireModulo } from '@/lib/guard'
import { APP_TIME_ZONE } from '@/lib/datetime'
import { Users, CalendarDays, Cake, MessageSquare } from 'lucide-react'
import { BtnGerarPdfAniversariantes, FiltroAniversariantes, AcoesAniversariante, BtnExportarXlsxAniversariantes } from '@/components/features/shared'
import type { GerarPdfAniversariantesInput } from '@/lib/relatorios/pdf-aniversariantes'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

type PacienteRaw = {
  id: string
  nome: string | null
  telefone: string | null
  email: string | null
  convenio: string | null
  data_nascimento: string | null
}

function nomeMes(mes: number): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long' })
    .format(new Date(2000, mes - 1, 15))
    .replace(/^\w/, c => c.toUpperCase())
}

export default async function RelatorioAniversariantesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  await requireModulo('pacientes')

  const supabase = await createClient()
  const params = await searchParams

  // --- data atual no fuso da aplicação ---
  const agora = new Date()
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora)
  const [anoAtual, mesAtual, diaAtual] = todayStr.split('-').map(Number)

  // --- params da URL ---
  const mesRaw = parseInt((params.mes as string) || '0')
  const mesSelecionado = mesRaw >= 1 && mesRaw <= 12 ? mesRaw : mesAtual

  const ordemParam = (params.ordem as string) === 'alfabetica' ? 'alfabetica' : 'dia'
  const limiteBruto = Number(params.limite)
  const limite = [10, 20, 50, 100].includes(limiteBruto) ? limiteBruto : 20
  const paginaBruta = Number(params.pagina)

  // --- query única e eficiente ---
  // Busca apenas colunas necessárias de pacientes ativos com data_nascimento preenchida
  const { data: rawData } = await supabase
    .from('pacientes')
    .select('id, nome, telefone, email, convenio, data_nascimento')
    .eq('ativo', true)
    .not('data_nascimento', 'is', null)
    .order('data_nascimento')

  // --- filtra pelo mês selecionado (in-memory, zero queries extras) ---
  const doMes = ((rawData ?? []) as PacienteRaw[]).filter(p => {
    if (!p.data_nascimento) return false
    return parseInt(p.data_nascimento.split('-')[1]) === mesSelecionado
  })

  // --- enriquece com informações calculadas ---
  const todayDate = new Date(anoAtual, mesAtual - 1, diaAtual)
  const em7Dias = new Date(anoAtual, mesAtual - 1, diaAtual + 6)

  const enriched = doMes.map(p => {
    const partes = (p.data_nascimento as string).split('-').map(Number)
    const anoNasc = partes[0]
    const mesNasc = partes[1]
    const diaNasc = partes[2]

    const anivThisYear = new Date(anoAtual, mesNasc - 1, diaNasc)
    const dataValida = anivThisYear.getMonth() + 1 === mesNasc

    const isHoje = anivThisYear.getTime() === todayDate.getTime()
    const isProximos7 = anivThisYear >= todayDate && anivThisYear <= em7Dias

    const diaSemana = dataValida
      ? new Intl.DateTimeFormat('pt-BR', { weekday: 'long' })
          .format(anivThisYear)
          .replace(/^\w/, c => c.toUpperCase())
      : `Não ocorre em ${anoAtual}`

    return {
      id: p.id,
      nome: p.nome?.trim() || 'Sem nome',
      telefone: p.telefone?.trim() || '',
      email: p.email?.trim() || '',
      convenio: p.convenio?.trim() || '—',
      dataNascimento: p.data_nascimento as string,
      diaMes: `${String(diaNasc).padStart(2, '0')}/${String(mesNasc).padStart(2, '0')}`,
      idade: anoAtual - anoNasc,
      diaSemana,
      isHoje,
      isProximos7,
      diaNasc,
    }
  })

  // --- estatísticas ---
  const total = enriched.length
  const totalHoje = enriched.filter(p => p.isHoje).length
  const totalProximos7 = enriched.filter(p => p.isProximos7).length

  // --- ordenação ---
  const ordenados = [...enriched].sort((a, b) => {
    if (ordemParam === 'alfabetica') {
      return a.nome.localeCompare(b.nome, 'pt-BR')
    }
    return a.diaNasc - b.diaNasc
  })

  // --- paginação ---
  const totalPaginas = Math.max(1, Math.ceil(total / limite))
  const pagina = Math.min(
    Math.max(1, Number.isFinite(paginaBruta) && paginaBruta > 0 ? paginaBruta : 1),
    totalPaginas,
  )
  const offset = (pagina - 1) * limite
  const paginados = ordenados.slice(offset, offset + limite)

  const paginacaoLinks: Array<number | '...'> = []
  if (totalPaginas <= 7) {
    for (let p = 1; p <= totalPaginas; p++) paginacaoLinks.push(p)
  } else {
    paginacaoLinks.push(1)
    if (pagina > 4) paginacaoLinks.push('...')
    for (let p = Math.max(2, pagina - 1); p <= Math.min(totalPaginas - 1, pagina + 1); p++) {
      paginacaoLinks.push(p)
    }
    if (pagina < totalPaginas - 3) paginacaoLinks.push('...')
    paginacaoLinks.push(totalPaginas)
  }

  const labelMes = nomeMes(mesSelecionado)
  const periodoLabel = `Aniversariantes de ${labelMes}`

  const pdfInput: GerarPdfAniversariantesInput = {
    periodoLabel,
    total,
    totalHoje,
    totalProximos7,
    pacientes: ordenados.map(p => ({
      nome: p.nome,
      diaMes: p.diaMes,
      idade: p.idade,
      diaSemana: p.diaSemana,
      telefone: p.telefone,
      convenio: p.convenio,
      isHoje: p.isHoje,
      isProximos7: p.isProximos7,
    })),
  }

  const xlsxInput = {
    periodoLabel,
    pacientes: ordenados.map(p => ({
      nome: p.nome,
      diaMes: p.diaMes,
      idade: p.idade,
      diaSemana: p.diaSemana,
      telefone: p.telefone,
      email: p.email,
      convenio: p.convenio,
      isHoje: p.isHoje,
      isProximos7: p.isProximos7,
    })),
  }

  function buildUrl(overrides: { pagina?: number; limite?: number; ordem?: string } = {}) {
    const q = new URLSearchParams()
    if (mesSelecionado !== mesAtual) q.set('mes', String(mesSelecionado))
    const lim = overrides.limite ?? limite
    const ord = overrides.ordem ?? ordemParam
    const pag = overrides.pagina ?? pagina
    if (lim !== 20) q.set('limite', String(lim))
    if (ord !== 'dia') q.set('ordem', ord)
    if (pag > 1) q.set('pagina', String(pag))
    const qs = q.toString()
    return `/pacientes/relatorio-aniversariantes${qs ? `?${qs}` : ''}`
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
          <span className="text-text-primary font-medium">Aniversariantes</span>
        </div>
        <div className="flex items-start justify-between gap-4 mt-1">
          <h1 className="text-2xl font-semibold text-text-primary flex items-center gap-2">
            <Cake size={28} className="text-primary-500" />
            Relatório de Aniversariantes
          </h1>
          <div className="flex items-center gap-3">
            <Link
              href="/configuracoes/mensagens"
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#006b5a] transition-colors border border-slate-200 rounded-lg px-3 py-2 hover:border-[#006b5a]/40 bg-white"
            >
              <MessageSquare size={15} />
              Templates
            </Link>
            <BtnExportarXlsxAniversariantes {...xlsxInput} />
            <BtnGerarPdfAniversariantes {...pdfInput} />
          </div>
        </div>
        <p className="text-sm text-text-secondary mt-1">
          Pacientes que fazem aniversário em{' '}
          <strong className="text-text-primary">{labelMes}</strong>, com destaques para hoje e
          próximos 7 dias.
        </p>
      </div>

      <FiltroAniversariantes key={mesSelecionado} mesSelecionado={mesSelecionado} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Users size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">Total em {labelMes}</span>
          </div>
          <p className="text-3xl font-bold text-[#006b5a]">{total}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Cake size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">Aniversariam hoje</span>
          </div>
          <p className="text-3xl font-bold text-[#006b5a]">{totalHoje}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <CalendarDays size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">Próximos 7 dias</span>
          </div>
          <p className="text-3xl font-bold text-[#006b5a]">{totalProximos7}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Lista de Aniversariantes</h2>
          <p className="mt-1 text-sm text-slate-500">
            Ordenados por dia do mês por padrão. Linhas em verde = aniversário hoje; amarelo = próximos 7 dias.
          </p>
        </div>

        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Ordenar por
            </span>
            {[
              { valor: 'dia', label: 'Dia do mês' },
              { valor: 'alfabetica', label: 'Alfabética' },
            ].map(opcao => (
              <Link
                key={opcao.valor}
                href={buildUrl({ ordem: opcao.valor, pagina: 1 })}
                className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                  ordemParam === opcao.valor
                    ? 'bg-[#006b5a] text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {opcao.label}
              </Link>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Por página
            </span>
            {[10, 20, 50, 100].map(lim => (
              <Link
                key={lim}
                href={buildUrl({ limite: lim, pagina: 1 })}
                className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                  limite === lim
                    ? 'bg-[#006b5a] text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {lim}
              </Link>
            ))}
          </div>
        </div>

        <div className="px-5 py-2 border-b border-slate-100 flex items-center gap-5 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-green-100 border border-green-300" />
            Aniversário hoje
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-amber-100 border border-amber-300" />
            Próximos 7 dias
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr>
                <th className="text-left px-4 py-3">Nome</th>
                <th className="text-left px-4 py-3">Aniversário</th>
                <th className="text-left px-4 py-3">Completa</th>
                <th className="text-left px-4 py-3">Dia da semana</th>
                <th className="text-left px-4 py-3">Telefone</th>
                <th className="text-left px-4 py-3">Convênio</th>
                <th className="text-left px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginados.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    Nenhum paciente com aniversário em {labelMes}.
                  </td>
                </tr>
              )}
              {paginados.map(p => (
                <tr
                  key={p.id}
                  className={
                    p.isHoje
                      ? 'bg-green-50'
                      : p.isProximos7
                        ? 'bg-amber-50'
                        : ''
                  }
                >
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                    <Link
                      href={`/pacientes/${p.id}`}
                      className="hover:text-primary-500 transition-colors flex items-center gap-2"
                    >
                      {p.isHoje && <Cake size={14} className="text-green-600 shrink-0" />}
                      {p.nome}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap font-mono">
                    {p.diaMes}
                  </td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                    {p.idade} anos
                  </td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap capitalize">
                    {p.diaSemana}
                  </td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                    {p.telefone}
                  </td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                    {p.convenio}
                  </td>
                  <td className="px-4 py-3">
                    <AcoesAniversariante
                      paciente={{
                        id: p.id,
                        nome: p.nome,
                        telefone: p.telefone,
                        email: p.email,
                        idade: p.idade,
                        diaMes: p.diaMes,
                        diaSemana: p.diaSemana,
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-slate-500">
            Mostrando{' '}
            <span className="font-semibold text-slate-700">
              {total === 0 ? 0 : offset + 1}–{Math.min(offset + limite, total)}
            </span>{' '}
            de{' '}
            <span className="font-semibold text-slate-700">{total}</span>{' '}
            aniversariante{total !== 1 ? 's' : ''}
          </p>
          {totalPaginas > 1 && (
            <div className="flex flex-wrap items-center gap-1">
              <Link
                href={buildUrl({ pagina: pagina - 1 })}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  pagina === 1
                    ? 'pointer-events-none bg-slate-100 text-slate-300'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Anterior
              </Link>
              {paginacaoLinks.map((p, index) =>
                p === '...' ? (
                  <span key={`ellipsis-${index}`} className="px-2 text-sm text-slate-400">
                    …
                  </span>
                ) : (
                  <Link
                    key={p}
                    href={buildUrl({ pagina: p })}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      p === pagina
                        ? 'bg-[#006b5a] text-white'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {p}
                  </Link>
                ),
              )}
              <Link
                href={buildUrl({ pagina: pagina + 1 })}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  pagina === totalPaginas
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