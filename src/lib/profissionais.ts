export type ProfissionalBasico = {
  id: string
  role: string | null
}

export function podeEntrarNaAgendaOuRelatorio(
  profissional: ProfissionalBasico,
  profissionaisComJornada: Set<string>,
) {
  if (profissional.role === 'fisioterapeuta') {
    return true
  }

  if (profissional.role === 'gestor') {
    return profissionaisComJornada.has(profissional.id)
  }

  return false
}
