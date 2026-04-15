export type ProfissionalBasico = {
  id: string
  role: string | null
}

export function podeEntrarNaAgendaOuRelatorio(
  profissional: ProfissionalBasico,
  profissionaisComJornada: Set<string>,
) {
  if (profissional.role !== 'gestor') {
    return true
  }

  return profissionaisComJornada.has(profissional.id)
}
