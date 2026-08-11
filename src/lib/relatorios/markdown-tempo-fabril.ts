import { formatarMinutos, type KPIsProfissional } from './kpis-tempo-fabril.ts'
import { formatAppDate, formatAppTime } from '../datetime.ts'
import type { OpcaoStatus } from '../status-disponibilidade-cores.ts'
import { classificarBloco } from '../status-disponibilidade-regras.ts'

export type GerarMarkdownTempoFabrilInput = {
  periodoLabel: string
  kpisEquipe: KPIsProfissional[]
  profFiltro: string
  statusOpcoes: OpcaoStatus[]
}

/**
 * Deixa a observação segura dentro de uma célula de tabela Markdown.
 *
 * É texto livre digitado pelo profissional. Um `|` encerra a célula e desloca
 * todas as colunas seguintes; uma quebra de linha encerra a linha inteira e
 * quebra a tabela do ponto em diante. Nos dois casos o relatório sai
 * silenciosamente errado, sem erro nenhum — só colunas desalinhadas que alguém
 * pode ler como dado.
 */
function escaparPipe(valor: string | null): string {
  if (!valor) return ''
  return valor
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
    .trim()
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function gerarMarkdownTempoFabril({
  periodoLabel,
  kpisEquipe,
  profFiltro,
  statusOpcoes,
}: GerarMarkdownTempoFabrilInput): string {
  const kpisOrdenados = [...kpisEquipe].sort((a, b) => b.taxaOcupacao - a.taxaOcupacao)
  const profissionalSelecionado = profFiltro === 'todos'
    ? null
    : kpisEquipe.find((kpi) => kpi.profissionalId === profFiltro) ?? null
  const statusComTempo = statusOpcoes
    .filter((op) => !op.sistema && kpisEquipe.some((k) => (k.tempoStatusMin[op.slug] ?? 0) > 0))
    .sort((a, b) => a.ordem - b.ordem)

  const totalJornadaMin = kpisEquipe.reduce((acc, kpi) => acc + kpi.jornadaContratadaMin, 0)
  const totalFabrilMin = kpisEquipe.reduce((acc, kpi) => acc + kpi.tempoFabrilMin, 0)
  const totalAtendimentos = kpisEquipe.reduce((acc, kpi) => acc + kpi.qtdAtendimentos, 0)
  const taxaGeral = totalJornadaMin > 0 ? Math.round((totalFabrilMin / totalJornadaMin) * 100) : 0

  const linhas: string[] = []

  linhas.push('# Relatório de Tempo Fábril')
  linhas.push('')
  linhas.push(`### ${periodoLabel}`)
  linhas.push('')

  // ── Resumo geral ────────────────────────────────────────────
  linhas.push('## Resumo Geral')
  linhas.push('')
  linhas.push(`- **Taxa geral:** ${taxaGeral}%`)
  linhas.push(`- **Tempo fábril total:** ${formatarMinutos(totalFabrilMin)}`)
  linhas.push(`- **Jornada contratada total:** ${formatarMinutos(totalJornadaMin)}`)
  linhas.push(`- **Atendimentos:** ${totalAtendimentos}`)
  linhas.push('')

  // ── Ranking de ocupação ──────────────────────────────────────
  linhas.push('## Ranking de Ocupação')
  linhas.push('')
  linhas.push('| # | Profissional | Taxa | Tempo Fábril |')
  linhas.push('|---|---|---|---|')
  kpisOrdenados.forEach((kpi, index) => {
    linhas.push(`| ${index + 1} | ${kpi.nome} | ${kpi.taxaOcupacao}% | ${formatarMinutos(kpi.tempoFabrilMin)} |`)
  })
  linhas.push('')

  // ── Comparativo da equipe ────────────────────────────────────
  linhas.push('## Comparativo da Equipe')
  linhas.push('')
  const statusHeaders = statusComTempo.map((op) => op.label_curto)
  linhas.push(
    `| Profissional | Jornada | Tempo Fábril | Horas Agendamento |${statusHeaders.map((h) => ` ${h} |`).join('')} Taxa | Atendimentos |`,
  )
  linhas.push(`|---|---|---|---|${statusHeaders.map(() => '---|').join('')}---|---|`)
  kpisOrdenados.forEach((kpi) => {
    const statusCols = statusComTempo.map((op) => {
      const min = kpi.tempoStatusMin[op.slug] ?? 0
      return min > 0 ? formatarMinutos(min) : '—'
    })
    linhas.push(
      `| ${kpi.nome} | ${formatarMinutos(kpi.jornadaContratadaMin)} | ${formatarMinutos(kpi.tempoFabrilMin)} | ${formatarMinutos(kpi.horasAgendamentoMin)} |${statusCols.map((c) => ` ${c} |`).join('')} ${kpi.taxaOcupacao}% | ${kpi.qtdAtendimentos} |`,
    )
  })
  linhas.push('')

  // ── Detalhe individual (só quando um profissional está filtrado) ───
  if (profissionalSelecionado) {
    const kpi = profissionalSelecionado
    linhas.push(`## Detalhe Individual — ${kpi.nome}`)
    linhas.push('')
    linhas.push(`- **Tempo fábril:** ${formatarMinutos(kpi.tempoFabrilMin)}`)
    linhas.push(`- **Horas de agendamento:** ${formatarMinutos(kpi.horasAgendamentoMin)}`)
    linhas.push(`- **Jornada contratada:** ${formatarMinutos(kpi.jornadaContratadaMin)}`)
    linhas.push(`- **Taxa de ocupação:** ${kpi.taxaOcupacao}%`)
    linhas.push(`- **Atendimentos:** ${kpi.qtdAtendimentos}`)
    linhas.push(`- **Tempo médio:** ${formatarMinutos(kpi.tempoMedioMin)}`)
    linhas.push(`- **Dias subutilizados:** ${kpi.diasSubutilizados}`)
    linhas.push('')

    if (kpi.detalheStatus.length > 0) {
      linhas.push('### Conferência de Status')
      linhas.push('')
      // AC-034: Motivo é o que torna a conferência auditável.
      linhas.push('| Status | Motivo | Início | Fim | Duração |')
      linhas.push('|---|---|---|---|---|')
      let algumExpirado = false
      kpi.detalheStatus.forEach((s) => {
        const label = statusOpcoes.find((op) => op.slug === s.status)?.label ?? s.status
        const fim = s.aberto ? '**Em aberto**' : `${formatAppDate(s.fim!)} ${formatAppTime(s.fim!)}`
        // AC-035: mesma marca do PDF, para que os dois relatórios sejam
        // comparáveis linha a linha.
        const expirado = classificarBloco(s.duracaoMinutos, s.aberto) === 'expirado'
        if (expirado) algumExpirado = true
        const motivo = escaparPipe(s.observacao) || '—'
        linhas.push(`| ${label} | ${motivo} | ${formatAppDate(s.inicio)} ${formatAppTime(s.inicio)} | ${fim} | ${formatarMinutos(s.duracaoMinutos)}${expirado ? ' \\*' : ''} |`)
      })
      linhas.push('')
      if (algumExpirado) {
        linhas.push('\\* Fechado automaticamente no teto de 2h — a pessoa não encerrou o status.')
        linhas.push('')
      }

      const totaisPorStatus = new Map<string, number>()
      for (const s of kpi.detalheStatus) {
        totaisPorStatus.set(s.status, (totaisPorStatus.get(s.status) ?? 0) + s.duracaoMinutos)
      }
      const totalGeral = kpi.detalheStatus.reduce((acc, s) => acc + s.duracaoMinutos, 0)
      const totaisTexto = [...totaisPorStatus.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([slug, min]) => {
          const label = statusOpcoes.find((op) => op.slug === slug)?.label ?? slug
          return `**${label}:** ${formatarMinutos(min)}`
        })
      totaisTexto.push(`**Total:** ${formatarMinutos(totalGeral)}`)
      linhas.push(totaisTexto.join(' · '))
      linhas.push('')
    }

    if (kpi.detalheAtendimentos.length > 0) {
      linhas.push('### Atendimentos do Período')
      linhas.push('')
      linhas.push('| Paciente | Tipo de Consulta | Dia | Tempo |')
      linhas.push('|---|---|---|---|')
      kpi.detalheAtendimentos.forEach((a) => {
        linhas.push(`| ${a.pacienteNome} | ${a.tipo} | ${formatAppDate(a.data)} ${formatAppTime(a.data)} | ${formatarMinutos(a.duracaoMinutos)} |`)
      })
      linhas.push('')
    }
  }

  return linhas.join('\n')
}

export function baixarMarkdownTempoFabril(input: GerarMarkdownTempoFabrilInput) {
  const conteudo = gerarMarkdownTempoFabril(input)
  const blob = new Blob([conteudo], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const profissionalSelecionado = input.profFiltro === 'todos'
    ? null
    : input.kpisEquipe.find((kpi) => kpi.profissionalId === input.profFiltro) ?? null

  const link = document.createElement('a')
  link.href = url
  link.download = profissionalSelecionado
    ? `relatorio-tempo-fabril-${slugify(profissionalSelecionado.nome)}.md`
    : 'relatorio-tempo-fabril-equipe.md'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}
