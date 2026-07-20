import { LABEL_POR_STATUS_CONTATO, STATUS_CONTATO_PADRAO } from '@/lib/contatos-kanban'
import type { DadosRelatorioContatos } from './contatos-relatorio-dados'

export type GerarMarkdownContatosInput = DadosRelatorioContatos

function pct(parte: number, total: number): string {
  return total > 0 ? `${((parte / total) * 100).toFixed(1)}%` : '0.0%'
}

function bucketRisco(dias: number): string {
  return dias >= 90 ? 'Em risco (90+d)' : 'Atenção (30-89d)'
}

export function gerarMarkdownContatos(input: GerarMarkdownContatosInput): string {
  const linhas: string[] = []

  linhas.push(`# Relatório de Contatos`)
  linhas.push('')
  linhas.push(`### ${input.periodoLabel}`)
  linhas.push('')

  // ── Resumo geral ────────────────────────────────────────────
  linhas.push('## Resumo Geral')
  linhas.push('')
  linhas.push(`- **Carteira total (geral):** ${input.totalContatos}`)
  linhas.push(`- **Contatos no período:** ${input.totalContatosPeriodo}`)
  linhas.push(`- **Taxa de conversão geral:** ${input.taxaConversaoGeral}%`)
  linhas.push(`- **Taxa de conversão no período:** ${input.taxaConversaoPeriodo}%`)
  linhas.push(`- **Contatos em risco (30+ dias sem atividade):** ${input.contatosEmRisco.length}`)
  linhas.push(`- **Contatos sem responsável:** ${input.contatosSemResponsavelCount}`)
  linhas.push(`- **Anotações registradas:** ${input.anotacoes.length}`)
  linhas.push('')

  // ── Distribuição por status ─────────────────────────────────
  linhas.push('## Distribuição por Status — Geral x Período')
  linhas.push('')
  linhas.push('| Status | Geral | % Geral | Período | % Período |')
  linhas.push('|---|---|---|---|---|')
  for (const status of STATUS_CONTATO_PADRAO) {
    const geral = input.contagemPorStatusGlobal[status]
    const periodo = input.contagemPorStatusPeriodo[status]
    if (geral === 0 && periodo === 0) continue
    linhas.push(
      `| ${LABEL_POR_STATUS_CONTATO[status]} | ${geral} | ${pct(geral, input.totalContatos)} | ${periodo} | ${pct(periodo, input.totalContatosPeriodo)} |`,
    )
  }
  linhas.push('')

  // ── Etapas do Kanban ─────────────────────────────────────────
  const nomesEtapas = new Set([
    ...input.contagemPorColunaGlobal.map(c => c.nome),
    ...input.contagemPorColunaPeriodo.map(c => c.nome),
  ])
  if (nomesEtapas.size > 0) {
    linhas.push('## Etapas do Kanban — Geral x Período')
    linhas.push('')
    linhas.push('| Etapa | Geral | % Geral | Período | % Período |')
    linhas.push('|---|---|---|---|---|')
    for (const nome of nomesEtapas) {
      const geral = input.contagemPorColunaGlobal.find(c => c.nome === nome)?.total ?? 0
      const periodo = input.contagemPorColunaPeriodo.find(c => c.nome === nome)?.total ?? 0
      if (geral === 0 && periodo === 0) continue
      linhas.push(`| ${nome} | ${geral} | ${pct(geral, input.totalContatos)} | ${periodo} | ${pct(periodo, input.totalContatosPeriodo)} |`)
    }
    linhas.push('')
  }

  // ── Performance por responsável ─────────────────────────────
  if (input.contatosPorResponsavelGlobal.length > 0) {
    linhas.push('## Performance por Responsável — Geral (toda a base)')
    linhas.push('')
    linhas.push('| Responsável | Total | Agendou | Taxa de Conversão |')
    linhas.push('|---|---|---|---|')
    const ordenados = [...input.contatosPorResponsavelGlobal].sort((a, b) => b.total - a.total)
    for (const resp of ordenados) {
      linhas.push(`| ${resp.nome} | ${resp.total} | ${resp.contagemPorStatus.agendou} | ${resp.taxaConversao}% |`)
    }
    linhas.push('')
  }

  if (input.contatosPorResponsavelPeriodo.length > 0) {
    linhas.push(`## Performance por Responsável — Período (${input.periodoLabel})`)
    linhas.push('')
    linhas.push('| Responsável | Total | Agendou | Taxa de Conversão |')
    linhas.push('|---|---|---|---|')
    const ordenados = [...input.contatosPorResponsavelPeriodo].sort((a, b) => b.total - a.total)
    for (const resp of ordenados) {
      linhas.push(`| ${resp.nome} | ${resp.total} | ${resp.contagemPorStatus.agendou} | ${resp.taxaConversao}% |`)
    }
    linhas.push('')
  }

  // ── Atividade por responsável ────────────────────────────────
  const taxaEfetGeral = input.totalContatadosGlobal > 0
    ? Math.round((input.totalEfetivosGlobal / input.totalContatadosGlobal) * 100)
    : 0
  const taxaEfetPeriodo = input.totalContatadosPeriodo > 0
    ? Math.round((input.totalEfetivosPeriodo / input.totalContatadosPeriodo) * 100)
    : 0

  linhas.push('## Atividade — Geral x Período')
  linhas.push('')
  linhas.push(`- **Contatados (geral):** ${input.totalContatadosGlobal} · **Efetivos (geral):** ${input.totalEfetivosGlobal} · **Taxa efetividade (geral):** ${taxaEfetGeral}%`)
  linhas.push(`- **Contatados (período):** ${input.totalContatadosPeriodo} · **Efetivos (período):** ${input.totalEfetivosPeriodo} · **Taxa efetividade (período):** ${taxaEfetPeriodo}%`)
  linhas.push('')

  if (input.atividadeContatosPorResponsavelGlobal.length > 0) {
    linhas.push('### Atividade por Profissional — Geral')
    linhas.push('')
    linhas.push('| Profissional | Carteira | Contatados | Efetivos | Taxa de Efetividade |')
    linhas.push('|---|---|---|---|---|')
    const ordenados = [...input.atividadeContatosPorResponsavelGlobal].sort((a, b) => b.contatados - a.contatados)
    for (const item of ordenados) {
      linhas.push(`| ${item.nome} | ${item.carteira} | ${item.contatados} | ${item.efetivos} | ${item.taxaEfetividade}% |`)
    }
    linhas.push('')
  }

  if (input.atividadeContatosPorResponsavel.length > 0) {
    linhas.push(`### Atividade por Profissional — Período (${input.periodoLabel})`)
    linhas.push('')
    linhas.push('| Profissional | Carteira | Contatados | Efetivos | Taxa de Efetividade |')
    linhas.push('|---|---|---|---|---|')
    const ordenados = [...input.atividadeContatosPorResponsavel].sort((a, b) => b.contatados - a.contatados)
    for (const item of ordenados) {
      linhas.push(`| ${item.nome} | ${item.carteira} | ${item.contatados} | ${item.efetivos} | ${item.taxaEfetividade}% |`)
    }
    linhas.push('')
  }

  // ── Contatos em risco ─────────────────────────────────────────
  if (input.contatosEmRisco.length > 0) {
    const emAtencao = input.contatosEmRisco.filter(c => c.dias_sem_atividade < 90).length
    const emRisco = input.contatosEmRisco.filter(c => c.dias_sem_atividade >= 90).length

    linhas.push('## Contatos em Risco')
    linhas.push('')
    linhas.push(`${input.contatosEmRisco.length} contato(s) sem atividade há mais de 30 dias (base completa).`)
    linhas.push('')
    linhas.push(`- **Atenção (30-89 dias):** ${emAtencao}`)
    linhas.push(`- **Em risco (90+ dias):** ${emRisco}`)
    linhas.push('')

    const porResponsavel = new Map<string, number>()
    for (const c of input.contatosEmRisco) {
      const chave = c.responsavel_nome ?? 'Sem responsável'
      porResponsavel.set(chave, (porResponsavel.get(chave) ?? 0) + 1)
    }
    const respOrdenados = [...porResponsavel.entries()].sort((a, b) => b[1] - a[1])

    if (respOrdenados.length > 0) {
      linhas.push('### Por Responsável')
      linhas.push('')
      linhas.push('| Responsável | Contatos em Risco |')
      linhas.push('|---|---|')
      for (const [nome, total] of respOrdenados) {
        linhas.push(`| ${nome} | ${total} |`)
      }
      linhas.push('')
    }

    linhas.push('### Detalhamento')
    linhas.push('')
    linhas.push('| Paciente | Etapa | Responsável | Dias | Situação |')
    linhas.push('|---|---|---|---|---|')
    const ordenados = [...input.contatosEmRisco].sort((a, b) => b.dias_sem_atividade - a.dias_sem_atividade)
    for (const c of ordenados) {
      linhas.push(`| ${c.paciente_nome} | ${c.kanban_coluna_nome} | ${c.responsavel_nome ?? 'Sem responsável'} | ${c.dias_sem_atividade} | ${bucketRisco(c.dias_sem_atividade)} |`)
    }
    linhas.push('')
  }

  // ── Anotações ─────────────────────────────────────────────────
  if (input.anotacoes.length > 0) {
    linhas.push('## Anotações')
    linhas.push('')
    linhas.push('| Data | Paciente | Autor | Anotação |')
    linhas.push('|---|---|---|---|')
    const ordenadas = [...input.anotacoes].sort((a, b) => b.criado_em.localeCompare(a.criado_em))
    for (const nota of ordenadas) {
      const data = new Date(nota.criado_em).toLocaleDateString('pt-BR')
      const textoEscapado = nota.texto.replace(/\|/g, '\\|').replace(/\n/g, ' ')
      linhas.push(`| ${data} | ${nota.paciente_nome} | ${nota.autor_nome ?? '—'} | ${textoEscapado} |`)
    }
    linhas.push('')
  }

  return linhas.join('\n')
}

export function baixarMarkdownContatos(input: GerarMarkdownContatosInput) {
  const conteudo = gerarMarkdownContatos(input)
  const blob = new Blob([conteudo], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = 'relatorio-contatos.md'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}
