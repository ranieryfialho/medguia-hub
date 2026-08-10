export interface ProfissionalPeriodo {
  ativo: boolean;
  temRegistroNoPeriodo: boolean;
}

export function deveIncluirNoRelatorio(profissional: ProfissionalPeriodo): boolean {
  return profissional.ativo === true || profissional.temRegistroNoPeriodo;
}
