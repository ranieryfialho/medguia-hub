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
  /** Extensão do arquivo original (ex.: ".jpg"), usada só para decidir o tipo de preview — nunca exibida. */
  extensao: string
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

/** Extensão do nome de um arquivo (ex.: ".jpg"), ou string vazia se não houver. */
export function extensaoDoNome(nome: string): string {
  const pontoIdx = nome.lastIndexOf('.')
  return pontoIdx > 0 && pontoIdx < nome.length - 1 ? nome.slice(pontoIdx) : ''
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
  const nome = (typeof record.nome === 'string' ? record.nome : '').trim() || 'Comprovante'

  return {
    fileId: fileId.trim(),
    fileUrl: fileUrl?.trim() || null,
    nome,
    extensao: extensaoDoNome(nome),
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

// O nome original do arquivo (ou, em dados antigos, o próprio ID do Drive)
// não é algo que o usuário reconheça — exibimos sempre um rótulo genérico.
function comNomesAmigaveis(comprovantes: ComprovanteVenda[]): ComprovanteVenda[] {
  return comprovantes.map((c, i) => {
    const sufixo = comprovantes.length > 1 ? ` ${i + 1}` : ''
    return { ...c, nome: `Comprovante de venda${sufixo}` }
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

  if (doJsonb.length > 0) return comNomesAmigaveis(doJsonb.slice(0, MAX_COMPROVANTES_VENDA))

  const legado = normalizarItem({
    file_id: venda.comprovante_pagamento_google_drive_file_id,
    file_url: venda.comprovante_pagamento_google_drive_file_url,
    nome: venda.comprovante_pagamento_nome,
  })

  return legado ? comNomesAmigaveis([legado]) : []
}

/**
 * Lê a lista enviada pelo formulário (JSON), com fallback nos campos únicos antigos.
 * Usada para persistir no banco — mantém o nome real do arquivo enviado, sem o
 * rótulo genérico (esse é só para exibição, aplicado em `parseComprovantesVenda`).
 */
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
