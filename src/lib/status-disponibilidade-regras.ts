/**
 * Regras puras do ciclo de vida dos status personalizados.
 * Sem I/O — validação, classificação e vencimento, testáveis com node --test.
 * Ver .spec/features/status-personalizados-ciclo-vida/spec.md
 */

export type OpcaoStatusRegra = {
  slug: string
  sistema: boolean
  observacao_obrigatoria: boolean
  /**
   * Opcional porque o catálogo de exibição inclui removidos (AC-033) e vários
   * chamadores só se importam com validação de observação. Ausente = ativo.
   */
  ativo?: boolean
}

export type ResultadoValidacao =
  | { valido: true }
  | { valido: false; mensagem: string }

/**
 * Teto de vida de um bloco de status personalizado — AC-004/AC-007/AC-022.
 *
 * Precisa espelhar o `INTERVAL '2 hours'` de
 * database/status_personalizados_fallback_2h_migration.sql. São duas fontes
 * para o mesmo prazo, e é exatamente a classe de divergência que o RFC 002
 * combate — mas aqui ela é inevitável: o cron vive no Postgres e o contador
 * roda no navegador. Ao mudar o prazo, mude os dois no mesmo commit.
 */
export const LIMITE_BLOCO_MS = 2 * 60 * 60 * 1000

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
 *
 * AC-033: status removido pelo gestor (`ativo = false`) também sai da escolha.
 * Antes essa exclusão vinha de graça, porque `listarStatusOpcoes` filtrava
 * `ativo = true` na consulta. Com o catálogo de exibição passando a incluir os
 * removidos — para que blocos antigos não percam o rótulo no Tempo Fábril — a
 * regra precisa valer aqui, onde é testável, e não como efeito colateral de um
 * `WHERE` lá atrás.
 */
export function opcoesSelecionaveis<T extends OpcaoStatusRegra>(opcoes: T[]): T[] {
  return opcoes.filter(
    (opcao) => opcao.ativo !== false && (!opcao.sistema || opcao.slug === 'disponivel'),
  )
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
 * AC-007: sinaliza na tela um bloco aberto há mais de 2 horas, sem depender
 * do aviso do banco (ASM-003) — cálculo client-side sobre o momento de abertura.
 */
export function blocoVencido(abertoEm: Date, agora: Date = new Date()): boolean {
  return agora.getTime() - abertoEm.getTime() > LIMITE_BLOCO_MS
}

/** Teto do bloco em minutos — o mesmo prazo, na unidade que o relatório usa. */
export const LIMITE_BLOCO_MIN = LIMITE_BLOCO_MS / 60_000

export type ClassificacaoBloco = 'normal' | 'expirado' | 'aberto'

/**
 * AC-035: separa o bloco que o fallback fechou do bloco que merece investigação.
 *
 * Um bloco fechado exatamente no teto não foi encerrado pela pessoa — foi capado
 * pelo cron. Isso é um fato esperado do desenho, não um defeito: significa que
 * ela esqueceu de sair do status. Merece um rótulo próprio, não o vermelho de
 * anomalia.
 *
 * A tolerância de 1 minuto absorve o arredondamento de `duracao_minutos`, que é
 * coluna gerada a partir de um intervalo com segundos.
 */
export function classificarBloco(
  duracaoMinutos: number,
  aberto: boolean,
): ClassificacaoBloco {
  if (aberto) return 'aberto'
  if (duracaoMinutos >= LIMITE_BLOCO_MIN - 1) return 'expirado'
  return 'normal'
}

/**
 * AC-022/AC-026: quanto falta para o bloco expirar, em milissegundos.
 *
 * Derivado do instante de abertura — não de um evento do banco. É o que torna
 * o contador correto mesmo se o Realtime não propagar a escrita do `pg_cron`
 * (a dúvida registrada em Q-002).
 *
 * Nunca devolve negativo: passado o teto, devolve zero. Um bloco esquecido há
 * cinco horas tem "zero restante", não "menos três horas" — número negativo
 * viraria contador correndo ao contrário na tela.
 */
export function tempoRestanteBlocoMs(abertoEm: Date, agora: Date = new Date()): number {
  const decorrido = agora.getTime() - abertoEm.getTime()
  return Math.max(0, LIMITE_BLOCO_MS - decorrido)
}

/**
 * AC-023/AC-024: formata o tempo restante para exibição.
 *
 * A precisão cresce conforme o prazo aperta, que é quando ela importa:
 * - acima de uma hora → `1h47`, porque segundos ali são ruído;
 * - abaixo de uma hora → `47:05`, para dar a sensação de contagem regressiva;
 * - zerado → `expirado`, e o contador para (AC-024). A tela não pode afirmar
 *   que o profissional já voltou para "Disponível" antes de o banco ter feito
 *   isso — o cron roda a cada 10 minutos, então essa janela existe de verdade.
 */
export function formatarContagemRegressiva(restanteMs: number): string {
  if (restanteMs <= 0) return 'expirado'

  const totalSegundos = Math.floor(restanteMs / 1000)
  const horas = Math.floor(totalSegundos / 3600)
  const minutos = Math.floor((totalSegundos % 3600) / 60)

  if (horas > 0) return `${horas}h${String(minutos).padStart(2, '0')}`

  const segundos = totalSegundos % 60
  return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`
}
