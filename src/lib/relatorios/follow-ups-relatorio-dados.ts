export type ContagemPorTipoFollowUp = {
  nome: string
  cor: string | null
  total: number
}

export type FollowUpPorResponsavelResumo = {
  nome: string
  total: number
  pendentes: number
  concluidos: number
  taxaConclusao: number
}

export type FollowUpPendenteAntigoResumo = {
  paciente_nome: string
  tipo_nome: string
  responsavel_nome: string | null
  dias_pendente: number
  criado_em: string
}

export type DadosRelatorioFollowUps = {
  periodoLabel: string
  filtrosLabel: string

  // Estatísticas do conjunto filtrado (tipo/responsável/busca + período, quando informado)
  total: number
  totalPendentes: number
  totalConcluidos: number
  taxaConclusao: number
  tempoMedioConclusaoDias: number | null

  // Backlog de pendentes há mais de 7 dias — sempre sobre o total atual (sem filtro de período)
  totalPendentesAntigos: number
  pendentesAntigos: FollowUpPendenteAntigoResumo[]

  contagemPorTipo: ContagemPorTipoFollowUp[]
  porResponsavel: FollowUpPorResponsavelResumo[]
}
