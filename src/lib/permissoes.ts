export type NivelAcesso = string | null | undefined
export type RoleUsuario = string | null | undefined

export function isMasterSistema(nivelAcesso: NivelAcesso) {
  return nivelAcesso === 'master'
}

export function isGestorSistema(nivelAcesso: NivelAcesso) {
  return nivelAcesso === 'gestor' || isMasterSistema(nivelAcesso)
}

export function podeGerirEquipe({
  role,
  nivelAcesso,
}: {
  role?: RoleUsuario
  nivelAcesso?: NivelAcesso
}) {
  return role === 'gestor' || role === 'master' || isGestorSistema(nivelAcesso)
}
