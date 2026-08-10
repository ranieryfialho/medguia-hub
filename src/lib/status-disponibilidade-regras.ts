/**
 * Regras puras do ciclo de vida dos status personalizados.
 * Sem I/O — validação, classificação e vencimento, testáveis com node --test.
 * Ver .spec/features/status-personalizados-ciclo-vida/spec.md
 */

export type OpcaoStatusRegra = {
  slug: string
  sistema: boolean
  observacao_obrigatoria: boolean
}

export type ResultadoValidacao =
  | { valido: true }
  | { valido: false; mensagem: string }

const LIMITE_BLOCO_MS = 60 * 60 * 1000 // 1 hora — AC-004/AC-007

/** AC-001, AC-002: observação só é exigida quando a opção marca observacao_obrigatoria. */
export function validarObservacao(
  opcao: OpcaoStatusRegra,
  observacao: string | null | undefined,
): ResultadoValidacao {
  if (!opcao.observacao_obrigatoria) {
    return { valido: true }
  }

  if (!observacao || observacao.trim().length === 0) {
    return { valido: false, mensagem: 'A observação é obrigatória para este status.' }
  }

  return { valido: true }
}

/** Status personalizado é o que o profissional declara — o oposto de status de sistema. */
export function ehStatusPersonalizado(opcao: OpcaoStatusRegra): boolean {
  return !opcao.sistema
}

/**
 * AC-011: status de sistema não são oferecidos como escolha, exceto 'disponivel',
 * que é o estado normal para onde o profissional sempre pode voltar.
 */
export function opcoesSelecionaveis<T extends OpcaoStatusRegra>(opcoes: T[]): T[] {
  return opcoes.filter((opcao) => !opcao.sistema || opcao.slug === 'disponivel')
}

/** AC-012: status de sistema não pode ser editado nem removido pelo gestor. */
export function podeEditarOpcao(opcao: OpcaoStatusRegra): boolean {
  return !opcao.sistema
}

/**
 * Estado do formulário de configuração de um status (criar/editar).
 * Vive aqui, e não no componente, para que o vai-e-vem entre a opção salva e o
 * formulário seja provável sem renderizar JSX — foi exatamente o elo que faltou
 * quando `observacao_obrigatoria` existia na action e nunca chegava nela.
 */
export type FormularioOpcao = {
  label: string
  label_curto: string
  cor: string
  observacao_obrigatoria: boolean
}

export const FORMULARIO_OPCAO_VAZIO: FormularioOpcao = {
  label: '',
  label_curto: '',
  cor: 'amber',
  observacao_obrigatoria: false,
}

/**
 * AC-021: abrir a edição carrega a exigência de observação já configurada —
 * sem isso, salvar qualquer outro campo apagaria a marcação silenciosamente.
 */
export function formularioDaOpcao(
  opcao: { label: string; label_curto: string; cor: string; observacao_obrigatoria?: boolean },
): FormularioOpcao {
  return {
    label: opcao.label,
    label_curto: opcao.label_curto,
    cor: opcao.cor,
    observacao_obrigatoria: opcao.observacao_obrigatoria ?? false,
  }
}

/**
 * AC-007: sinaliza na tela um bloco aberto há mais de 1 hora, sem depender
 * do aviso do banco (ASM-003) — cálculo client-side sobre o momento de abertura.
 */
export function blocoVencido(abertoEm: Date, agora: Date = new Date()): boolean {
  return agora.getTime() - abertoEm.getTime() > LIMITE_BLOCO_MS
}
