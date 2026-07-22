import type { DadosRelatorioFollowUps } from './follow-ups-relatorio-dados'

export type GerarMarkdownFollowUpsInput = DadosRelatorioFollowUps

function pct(parte: number, total: number): string {
  return total > 0 ? `${((parte / total) * 100).toFixed(1)}%` : '0.0%'
}

export function gerarMarkdownFollowUps(input: GerarMarkdownFollowUpsInput): string {
  const linhas: string[] = []

  linhas.push(`# Relatório de Follow-ups`)
  linhas.push('')
  linhas.push(`### ${input.periodoLabel}`)
  linhas.push('')
  linhas.push(`_${input.filtrosLabel}_`)
  linhas.push('')

  // ── Resumo geral ────────────────────────────────────────────
  linhas.push('## Resumo Geral')
  linhas.push('')
  linhas.push(`- **Total no filtro:** ${input.total}`)
  linhas.push(`- **Pendentes:** ${input.totalPendentes}`)
  linhas.push(`- **Concluídos:** ${input.totalConcluidos}`)
  linhas.push(`- **Taxa de conclusão:** ${input.taxaConclusao}%`)
  linhas.push(`- **Tempo médio de conclusão:** ${input.tempoMedioConclusaoDias !== null ? `${input.tempoMedioConclusaoDias} dia(s)` : '—'}`)
  linhas.push(`- **Pendentes há 7+ dias (backlog):** ${input.totalPendentesAntigos}`)
  linhas.push('')

  // ── Distribuição por tipo ─────────────────────────────────────
  if (input.contagemPorTipo.length > 0) {
    linhas.push('## Distribuição por Tipo')
    linhas.push('')
    linhas.push('| Tipo | Total | % |')
    linhas.push('|---|---|---|')
    const ordenados = [...input.contagemPorTipo].sort((a, b) => b.total - a.total)
    for (const tipo of ordenados) {
      linhas.push(`| ${tipo.nome} | ${tipo.total} | ${pct(tipo.total, input.total)} |`)
    }
    linhas.push('')
  }

  // ── Distribuição por responsável ────────────────────────────
  if (input.porResponsavel.length > 0) {
    linhas.push('## Distribuição por Responsável')
    linhas.push('')
    linhas.push('| Responsável | Total | Pendentes | Concluídos | Taxa de Conclusão |')
    linhas.push('|---|---|---|---|---|')
    const ordenados = [...input.porResponsavel].sort((a, b) => b.total - a.total)
    for (const resp of ordenados) {
      linhas.push(`| ${resp.nome} | ${resp.total} | ${resp.pendentes} | ${resp.concluidos} | ${resp.taxaConclusao}% |`)
    }
    linhas.push('')
  }

  // ── Backlog: pendentes antigos ───────────────────────────────
  if (input.pendentesAntigos.length > 0) {
    linhas.push('## Backlog — Pendentes há 7+ dias')
    linhas.push('')
    linhas.push(`${input.totalPendentesAntigos} follow-up(s) pendente(s) há mais de 7 dias.`)
    linhas.push('')
    linhas.push('| Paciente | Tipo | Responsável | Dias Pendente |')
    linhas.push('|---|---|---|---|')
    const ordenados = [...input.pendentesAntigos].sort((a, b) => b.dias_pendente - a.dias_pendente)
    for (const p of ordenados) {
      linhas.push(`| ${p.paciente_nome} | ${p.tipo_nome} | ${p.responsavel_nome ?? 'Sem responsável'} | ${p.dias_pendente} |`)
    }
    linhas.push('')
  }

  return linhas.join('\n')
}

export function baixarMarkdownFollowUps(input: GerarMarkdownFollowUpsInput) {
  const conteudo = gerarMarkdownFollowUps(input)
  const blob = new Blob([conteudo], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = 'relatorio-follow-ups.md'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}
