export type OrigemVenda = {
  id: string
  valor: string
  nome: string
  ativo: boolean
  ordem: number
  sistema: boolean
}

export type OpcaoOrigem = { value: string; label: string }

// Única origem com regra de negócio no código (médico referenciador e venda em consultório).
export const ORIGEM_MEDICO = 'medico'

export function slugOrigem(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function origensParaOpcoes(origens: Pick<OrigemVenda, 'valor' | 'nome'>[]): OpcaoOrigem[] {
  return origens.map((o) => ({ value: o.valor, label: o.nome }))
}

export function mapaRotulosOrigem(origens: Pick<OrigemVenda, 'valor' | 'nome'>[]): Record<string, string> {
  return Object.fromEntries(origens.map((o) => [o.valor, o.nome]))
}

// Vendas antigas sempre têm origem cadastrada (a exclusão é bloqueada em uso),
// mas o fallback evita exibir vazio caso o cadastro esteja indisponível.
export function rotuloOrigem(rotulos: Record<string, string>, valor: string | null | undefined): string {
  if (!valor) return 'Sem origem'
  return rotulos[valor] ?? valor
}
