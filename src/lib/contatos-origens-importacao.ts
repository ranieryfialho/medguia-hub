export const ORIGENS_IMPORTACAO_CONTATOS = ['Facebook', 'Site', 'Instagram', 'WhatsApp'] as const

export type OrigemImportacaoContato = (typeof ORIGENS_IMPORTACAO_CONTATOS)[number]
