// Compartilhado entre src/actions/relatorios-auditoria.ts (Server Action) e a
// página do painel — não pode viver no arquivo "use server" porque um módulo
// desse tipo só pode exportar funções async (Next.js recusa o build).
export const AUDITORIA_EXCLUSOES_PAGE_SIZE = 20
