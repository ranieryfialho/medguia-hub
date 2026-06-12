export type ModuloChave =
  | 'dashboard'
  | 'agenda'
  | 'confirmacoes:cards'
  | 'confirmacoes:semana'
  | 'confirmacoes:mensagens'
  | 'confirmacoes:testar'
  | 'contatos:base'
  | 'contatos:relatorio'
  | 'pacientes'
  | 'prontuarios'
  | 'follow_ups'
  | 'follow_ups:tipos'
  | 'follow_ups:templates'
  | 'comercial:vendas'
  | 'comercial:produtos'
  | 'comercial:relatorio_vendas'
  | 'equipe:membros'
  | 'equipe:tempo_fabril'
  | 'equipe:acessos'
  | 'configuracoes:jornada'
  | 'configuracoes:disponibilidade'
  | 'configuracoes:google_drive'

export type NivelAcesso = 'basico' | 'gestor' | 'master'
export type CargoColaborador = 'fisioterapeuta' | 'recepcionista' | 'medico' | 'gestor'

export type ModuloDefinicao = {
  chave: ModuloChave
  label: string
  rota: string
}

export type GrupoModulos = {
  label: string
  chave_grupo: string
  modulos: ModuloDefinicao[]
}

export const GRUPOS_MODULOS: GrupoModulos[] = [
  {
    label: 'Geral',
    chave_grupo: 'geral',
    modulos: [
      { chave: 'dashboard', label: 'Dashboard', rota: '/dashboard' },
      { chave: 'agenda', label: 'Agenda', rota: '/agenda' },
      { chave: 'pacientes', label: 'Pacientes', rota: '/pacientes' },
    ],
  },
  {
    label: 'Prontuários',
    chave_grupo: 'prontuarios',
    modulos: [
      { chave: 'prontuarios', label: 'Prontuários', rota: '/prontuarios' },
      { chave: 'follow_ups', label: 'Follow-ups', rota: '/follow-ups' },
      { chave: 'follow_ups:tipos', label: 'Tipos de Follow-up', rota: '/follow-ups/tipos' },
      { chave: 'follow_ups:templates', label: 'Templates de Follow-up', rota: '/follow-ups/templates' },
    ],
  },
  {
    label: 'Confirmações',
    chave_grupo: 'confirmacoes',
    modulos: [
      { chave: 'confirmacoes:cards', label: 'Cards', rota: '/confirmacoes/cards' },
      { chave: 'confirmacoes:semana', label: 'Semana', rota: '/confirmacoes/semana' },
      { chave: 'confirmacoes:mensagens', label: 'Mensagens', rota: '/confirmacoes/mensagens' },
      { chave: 'confirmacoes:testar', label: 'Testar Envios', rota: '/confirmacoes/testar' },
    ],
  },
  {
    label: 'Contatos',
    chave_grupo: 'contatos',
    modulos: [
      { chave: 'contatos:base', label: 'Base de Contatos', rota: '/contatos' },
      { chave: 'contatos:relatorio', label: 'Relatório de Contatos', rota: '/contatos/relatorio' },
    ],
  },
  {
    label: 'Comercial',
    chave_grupo: 'comercial',
    modulos: [
      { chave: 'comercial:vendas', label: 'Vendas', rota: '/vendas' },
      { chave: 'comercial:produtos', label: 'Produtos', rota: '/produtos' },
      { chave: 'comercial:relatorio_vendas', label: 'Relatório de Vendas', rota: '/relatorios/vendas' },
    ],
  },
  {
    label: 'Equipe',
    chave_grupo: 'equipe',
    modulos: [
      { chave: 'equipe:membros', label: 'Membros da Equipe', rota: '/equipe' },
      { chave: 'equipe:tempo_fabril', label: 'Tempo Fábril', rota: '/relatorios/tempo-fabril' },
      { chave: 'equipe:acessos', label: 'Gestão de Acessos', rota: '/equipe/acessos' },
      { chave: 'configuracoes:jornada', label: 'Jornada de Trabalho', rota: '/configuracoes/jornada' },
      { chave: 'configuracoes:disponibilidade', label: 'Disponibilidade', rota: '/configuracoes/disponibilidade' },
    ],
  },
  {
    label: 'Configurações',
    chave_grupo: 'configuracoes',
    modulos: [
      { chave: 'configuracoes:google_drive', label: 'Google Drive', rota: '/configuracoes/google-drive' },
    ],
  },
]

export const TODOS_MODULOS: ModuloChave[] = GRUPOS_MODULOS.flatMap(g => g.modulos.map(m => m.chave))

export type TemplatePerfilChave =
  | 'fisioterapeuta'
  | 'recepcionista'
  | 'medico'
  | 'gestor'
  | 'comercial'
  | 'completo'

export const TEMPLATES_PERFIL: Record<TemplatePerfilChave, { label: string; modulos: ModuloChave[] }> = {
  fisioterapeuta: {
    label: 'Fisioterapeuta',
    modulos: [
      'dashboard', 'agenda',
      'confirmacoes:cards', 'confirmacoes:semana',
      'pacientes', 'prontuarios', 'follow_ups',
      'configuracoes:disponibilidade',
    ],
  },
  recepcionista: {
    label: 'Recepção',
    modulos: [
      'dashboard',
      'agenda',
      'confirmacoes:cards',
      'confirmacoes:semana',
      'confirmacoes:mensagens',
      'contatos:base',
      'pacientes',
      'follow_ups',
    ],
  },
  medico: {
    label: 'Médico',
    modulos: ['dashboard'],
  },
  gestor: {
    label: 'Gestor',
    modulos: [
      'dashboard', 'agenda',
      'confirmacoes:cards', 'confirmacoes:semana', 'confirmacoes:mensagens', 'confirmacoes:testar',
      'contatos:base', 'contatos:relatorio',
      'pacientes', 'prontuarios', 'follow_ups', 'follow_ups:tipos', 'follow_ups:templates',
      'comercial:vendas', 'comercial:produtos', 'comercial:relatorio_vendas',
      'equipe:membros', 'equipe:tempo_fabril',
      'configuracoes:jornada', 'configuracoes:disponibilidade', 'configuracoes:google_drive',
    ],
  },
  comercial: {
    label: 'Comercial',
    modulos: [
      'dashboard',
      'contatos:base', 'contatos:relatorio',
      'comercial:vendas', 'comercial:produtos',
    ],
  },
  completo: {
    label: 'Acesso Completo',
    modulos: [...TODOS_MODULOS],
  },
}

export function temAcesso(modulos: string[], chave: ModuloChave): boolean {
  if (modulos.length === 0) return true
  return modulos.includes(chave)
}

export function temAcessoGrupo(modulos: string[], chave_grupo: string): boolean {
  if (modulos.length === 0) return true
  const grupo = GRUPOS_MODULOS.find(g => g.chave_grupo === chave_grupo)
  if (!grupo) return false
  return grupo.modulos.some(m => modulos.includes(m.chave))
}

export function obterPrimeiraRotaLiberadaDoGrupo(modulos: string[], chaveGrupo: string): string | null {
  const grupo = GRUPOS_MODULOS.find((item) => item.chave_grupo === chaveGrupo)
  if (!grupo) return null

  const modulo = grupo.modulos.find((item) => temAcesso(modulos, item.chave))
  return modulo?.rota ?? null
}

export function normalizarCargoOperacional(cargo: string | null | undefined): CargoColaborador {
  switch (cargo) {
    case 'fisioterapeuta':
    case 'recepcionista':
    case 'medico':
    case 'gestor':
      return cargo
    case 'master':
      return 'gestor'
    default:
      return 'medico'
  }
}

export function obterTemplatePerfilPadrao(
  cargo: string,
  nivelAcesso: string,
): TemplatePerfilChave {
  if (nivelAcesso === 'master') return 'completo'
  if (nivelAcesso === 'gestor') return 'gestor'

  switch (cargo) {
    case 'fisioterapeuta':
      return 'fisioterapeuta'
    case 'recepcionista':
      return 'recepcionista'
    case 'medico':
      return 'medico'
    case 'gestor':
      return 'gestor'
    default:
      return 'medico'
  }
}

export function obterModulosDoTemplate(template: TemplatePerfilChave): ModuloChave[] {
  return [...TEMPLATES_PERFIL[template].modulos]
}

export function inferirTemplatePerfilPorModulos(modulos: string[]): TemplatePerfilChave | 'customizado' {
  if (modulos.length === 0) return 'completo'

  const normalizados = [...new Set(modulos)].sort()
  const templates = Object.entries(TEMPLATES_PERFIL) as Array<[TemplatePerfilChave, { label: string; modulos: ModuloChave[] }]>

  for (const [chave, template] of templates) {
    const base = [...template.modulos].sort()
    if (base.length === normalizados.length && base.every((item, index) => item === normalizados[index])) {
      return chave
    }
  }

  return 'customizado'
}

export function obterModulosPadraoParaUsuario(
  cargo: string,
  nivelAcesso: string,
): ModuloChave[] {
  return obterModulosDoTemplate(obterTemplatePerfilPadrao(cargo, nivelAcesso))
}
