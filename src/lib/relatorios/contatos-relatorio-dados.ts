import type { StatusContatoPadrao } from '@/lib/contatos-kanban'

export type ContagemStatusContato = Record<StatusContatoPadrao, number>

export type ContatoPorResponsavelResumo = {
  id: string | null
  nome: string
  total: number
  contagemPorStatus: ContagemStatusContato
  taxaConversao: number
}

export type ContagemColunaContato = {
  nome: string
  total: number
}

export type AtividadeContatoResponsavelResumo = {
  nome: string
  carteira: number
  contatados: number
  efetivos: number
  taxaEfetividade: number
}

export type ContatoEmRiscoResumo = {
  paciente_nome: string
  kanban_coluna_nome: string
  responsavel_nome: string | null
  dias_sem_atividade: number
}

export type AnotacaoContatoResumo = {
  paciente_nome: string
  texto: string
  autor_nome: string | null
  criado_em: string
}

export type DadosRelatorioContatos = {
  periodoLabel: string
  filtroProfissionalLabel?: string

  // Totais e taxas: geral (toda a base) x período filtrado
  totalContatos: number
  totalContatosPeriodo: number
  taxaConversaoGeral: number
  taxaConversaoPeriodo: number
  contatosSemResponsavelCount: number

  // Distribuição por status/etapa: geral x período
  contagemPorStatusGlobal: ContagemStatusContato
  contagemPorStatusPeriodo: ContagemStatusContato
  contagemPorColunaGlobal: ContagemColunaContato[]
  contagemPorColunaPeriodo: ContagemColunaContato[]

  // Performance por responsável: geral x período
  contatosPorResponsavelGlobal: ContatoPorResponsavelResumo[]
  contatosPorResponsavelPeriodo: ContatoPorResponsavelResumo[]

  // Atividade (contatados/efetivos) por responsável: geral x período
  totalContatadosGlobal: number
  totalEfetivosGlobal: number
  totalContatadosPeriodo: number
  totalEfetivosPeriodo: number
  atividadeContatosPorResponsavelGlobal: AtividadeContatoResponsavelResumo[]
  atividadeContatosPorResponsavel: AtividadeContatoResponsavelResumo[]

  // Contatos em risco (sempre a base completa, sem filtro de período)
  contatosEmRisco: ContatoEmRiscoResumo[]

  // Anotações registradas dentro do período filtrado
  anotacoes: AnotacaoContatoResumo[]
}
