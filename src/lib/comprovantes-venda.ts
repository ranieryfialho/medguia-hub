/**
 * Comprovantes de pagamento de uma venda.
 *
 * A lista completa fica em `vendas.comprovantes_pagamento` (JSONB). As colunas
 * escalares `comprovante_pagamento_*` continuam existindo e espelham o primeiro
 * item — é delas que a listagem/relatórios ainda leem, e são o fallback quando
 * a migração do JSONB ainda não rodou no ambiente.
 */

export const MAX_COMPROVANTES_VENDA = 10

export interface ComprovanteVenda {
  fileId: string
  fileUrl: string | null
  nome: string
}

/** Formato persistido no JSONB. */
export interface ComprovanteVendaRow {
  file_id: string
  file_url: string | null
  nome: string | null
}

interface VendaComComprovantes {
  comprovantes_pagamento?: unknown
  comprovante_pagamento_google_drive_file_id?: string | null
  comprovante_pagamento_google_drive_file_url?: string | null
  comprovante_pagamento_nome?: string | null
}

function normalizarItem(valor: unknown): ComprovanteVenda | null {
  if (!valor || typeof valor !== 'object') return null

  const record = valor as Record<string, unknown>
  // Aceita tanto o formato do banco (file_id) quanto o do client (fileId).
  const fileId = typeof record.file_id === 'string'
    ? record.file_id
    : typeof record.fileId === 'string'
      ? record.fileId
      : ''

  if (!fileId.trim()) return null

  const fileUrl = typeof record.file_url === 'string'
    ? record.file_url
    : typeof record.fileUrl === 'string'
      ? record.fileUrl
      : null
  const nome = typeof record.nome === 'string' ? record.nome : ''

  return {
    fileId: fileId.trim(),
    fileUrl: fileUrl?.trim() || null,
    nome: nome.trim() || 'Comprovante',
  }
}

function deduplicar(comprovantes: ComprovanteVenda[]) {
  const vistos = new Set<string>()
  return comprovantes.filter((c) => {
    if (vistos.has(c.fileId)) return false
    vistos.add(c.fileId)
    return true
  })
}

/** Lê a lista de comprovantes de uma linha de `vendas`, com fallback nas colunas antigas. */
export function parseComprovantesVenda(venda: VendaComComprovantes | null | undefined): ComprovanteVenda[] {
  if (!venda) return []

  const bruto = venda.comprovantes_pagamento
  const lista = Array.isArray(bruto)
    ? bruto
    : typeof bruto === 'string' && bruto.trim()
      ? safeParseArray(bruto)
      : []

  const doJsonb = deduplicar(
    lista.map(normalizarItem).filter((c): c is ComprovanteVenda => c !== null)
  )

  if (doJsonb.length > 0) return doJsonb.slice(0, MAX_COMPROVANTES_VENDA)

  const legado = normalizarItem({
    file_id: venda.comprovante_pagamento_google_drive_file_id,
    file_url: venda.comprovante_pagamento_google_drive_file_url,
    nome: venda.comprovante_pagamento_nome,
  })

  return legado ? [legado] : []
}

/** Lê a lista enviada pelo formulário (JSON), com fallback nos campos únicos antigos. */
export function parseComprovantesJson(json: string | null | undefined): ComprovanteVenda[] {
  if (!json?.trim()) return []
  return deduplicar(
    safeParseArray(json)
      .map(normalizarItem)
      .filter((c): c is ComprovanteVenda => c !== null)
  ).slice(0, MAX_COMPROVANTES_VENDA)
}

/** Converte para o formato do JSONB. */
export function serializarComprovantes(comprovantes: ComprovanteVenda[]): ComprovanteVendaRow[] {
  return comprovantes.map((c) => ({
    file_id: c.fileId,
    file_url: c.fileUrl,
    nome: c.nome,
  }))
}

function safeParseArray(json: string): unknown[] {
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
