// Módulo cliente: valida, redimensiona e gera preview de fotos de paciente.
// A validação por magic bytes aqui é a primeira barreira (UX); a rota de
// upload (POST /api/pacientes/[id]/foto) repete a checagem no servidor —
// file.type é controlado pelo cliente e não é evidência de nada.

export const MIME_IMAGENS_ACEITAS = ['image/jpeg', 'image/png', 'image/webp'] as const
export type MimeImagemAceita = (typeof MIME_IMAGENS_ACEITAS)[number]

const EXTENSOES_ACEITAS = ['.jpg', '.jpeg', '.png', '.webp']

export const TAMANHO_MAXIMO_CLIENTE_BYTES = 10 * 1024 * 1024 // 10MB — AC-087
export const LADO_MAXIMO_REDIMENSIONADO_PX = 1024
export const QUALIDADE_WEBP = 0.8

export interface ValidacaoImagem {
  valido: boolean
  erro?: string
}

function possuiExtensaoAceita(nomeArquivo: string): boolean {
  const nomeMinusculo = nomeArquivo.toLowerCase()
  return EXTENSOES_ACEITAS.some((extensao) => nomeMinusculo.endsWith(extensao))
}

function possuiMimeAceito(mime: string): mime is MimeImagemAceita {
  return (MIME_IMAGENS_ACEITAS as readonly string[]).includes(mime)
}

/**
 * Identifica o tipo real da imagem pelos primeiros bytes do arquivo,
 * ignorando extensão e MIME declarados.
 */
export function detectarMimeRealPorBytes(bytes: Uint8Array): MimeImagemAceita | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png'
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 && // "RIFF"
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50 // "WEBP"
  ) {
    return 'image/webp'
  }

  return null
}

/**
 * Valida extensão, MIME declarado e tamanho antes de ler o conteúdo do
 * arquivo (arquivos acima do limite são rejeitados sem chamar
 * `file.arrayBuffer()`), depois confirma o tipo real pelos bytes.
 */
export async function validarArquivoImagem(file: File): Promise<ValidacaoImagem> {
  if (!possuiExtensaoAceita(file.name) || !possuiMimeAceito(file.type)) {
    return {
      valido: false,
      erro: 'Selecione uma imagem .jpg, .jpeg, .png ou .webp.',
    }
  }

  if (file.size > TAMANHO_MAXIMO_CLIENTE_BYTES) {
    return {
      valido: false,
      erro: 'A imagem selecionada passa de 10MB. Escolha um arquivo menor.',
    }
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const mimeReal = detectarMimeRealPorBytes(bytes)

  if (!mimeReal) {
    return {
      valido: false,
      erro: 'O arquivo selecionado não é uma imagem válida.',
    }
  }

  return { valido: true }
}

/** Gera a URL de preview imediato (object URL), sem ler nem redimensionar o arquivo. */
export function gerarPreviewImagem(file: File): string {
  return URL.createObjectURL(file)
}

/** Libera a URL de preview gerada por `gerarPreviewImagem`. */
export function revogarPreviewImagem(url: string): void {
  URL.revokeObjectURL(url)
}

/** Calcula largura/altura mantendo proporção, com o lado maior limitado a `ladoMaximoPx`. */
export function calcularDimensoesRedimensionadas(
  larguraOriginal: number,
  alturaOriginal: number,
  ladoMaximoPx: number = LADO_MAXIMO_REDIMENSIONADO_PX,
): { largura: number; altura: number } {
  const ladoMaior = Math.max(larguraOriginal, alturaOriginal)

  if (ladoMaior <= ladoMaximoPx) {
    return { largura: larguraOriginal, altura: alturaOriginal }
  }

  const escala = ladoMaximoPx / ladoMaior
  return {
    largura: Math.round(larguraOriginal * escala),
    altura: Math.round(alturaOriginal * escala),
  }
}

function renomearComExtensao(nomeArquivo: string, novaExtensao: string): string {
  const nomeSemExtensao = nomeArquivo.replace(/\.[^.]+$/, '')
  return `${nomeSemExtensao}.${novaExtensao}`
}

function canvasParaBlob(
  canvas: HTMLCanvasElement,
  tipo: string,
  qualidade: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, qualidade))
}

function carregarBitmap(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const imagem = new Image()
    imagem.onload = () => {
      URL.revokeObjectURL(url)
      resolve(imagem)
    }
    imagem.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível carregar a imagem selecionada.'))
    }
    imagem.src = url
  })
}

/**
 * Redimensiona a imagem para o lado maior de `ladoMaximoPx` e exporta em
 * WebP (fallback JPEG quando o navegador não suporta `toBlob` em WebP).
 * Só roda no navegador (depende de `document`/`Image`/`canvas`).
 */
export async function redimensionarImagem(
  file: File,
  ladoMaximoPx: number = LADO_MAXIMO_REDIMENSIONADO_PX,
): Promise<File> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    throw new Error('redimensionarImagem só pode rodar no navegador.')
  }

  const bitmap = await carregarBitmap(file)
  const { largura, altura } = calcularDimensoesRedimensionadas(
    bitmap.naturalWidth,
    bitmap.naturalHeight,
    ladoMaximoPx,
  )

  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura

  const contexto = canvas.getContext('2d')
  if (!contexto) {
    throw new Error('Não foi possível preparar o redimensionamento da imagem.')
  }
  contexto.drawImage(bitmap, 0, 0, largura, altura)

  const blobWebp = await canvasParaBlob(canvas, 'image/webp', QUALIDADE_WEBP)
  const blobFinal = blobWebp ?? (await canvasParaBlob(canvas, 'image/jpeg', QUALIDADE_WEBP))

  if (!blobFinal) {
    throw new Error('Não foi possível gerar a imagem redimensionada.')
  }

  const extensao = blobFinal.type === 'image/webp' ? 'webp' : 'jpg'
  return new File([blobFinal], renomearComExtensao(file.name, extensao), {
    type: blobFinal.type,
  })
}
