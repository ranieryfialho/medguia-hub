import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  validarArquivoImagem,
  gerarPreviewImagem,
  revogarPreviewImagem,
  detectarMimeRealPorBytes,
  TAMANHO_MAXIMO_CLIENTE_BYTES,
} from './imagem.ts'

const BYTES_JPEG_VALIDO = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
])

const BYTES_PNG_VALIDO = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
])

const BYTES_WEBP_VALIDO = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
])

function arquivoJpegValido(nome = 'paciente.jpg', bytes: Uint8Array = BYTES_JPEG_VALIDO): File {
  return new File([bytes as BlobPart], nome, { type: 'image/jpeg' })
}

test('@spec:AC-087 preview aparece imediatamente ao selecionar imagem válida (.jpg, .jpeg, .png, .webp)', async () => {
  const jpg = arquivoJpegValido('paciente.jpg')
  const validacaoJpg = await validarArquivoImagem(jpg)
  assert.equal(validacaoJpg.valido, true)

  const png = new File([BYTES_PNG_VALIDO], 'paciente.png', { type: 'image/png' })
  const validacaoPng = await validarArquivoImagem(png)
  assert.equal(validacaoPng.valido, true)

  const webp = new File([BYTES_WEBP_VALIDO], 'paciente.webp', { type: 'image/webp' })
  const validacaoWebp = await validarArquivoImagem(webp)
  assert.equal(validacaoWebp.valido, true)

  // Preview é síncrono (object URL) — não depende de rede nem de recarregar a página.
  const previewUrl = gerarPreviewImagem(jpg)
  assert.equal(typeof previewUrl, 'string')
  assert.match(previewUrl, /^blob:/)
  revogarPreviewImagem(previewUrl)
})

test('@spec:AC-090 arquivo que não é imagem de verdade é rejeitado mesmo com nome e MIME de imagem', async () => {
  const bytesTexto = new TextEncoder().encode('isto não é uma imagem, é texto puro')
  const disfarcado = new File([bytesTexto], 'foto.jpg', { type: 'image/jpeg' })

  const validacao = await validarArquivoImagem(disfarcado)

  assert.equal(validacao.valido, false)
  assert.ok(validacao.erro)

  // A checagem é pelos bytes reais, não pelo nome/extensão declarados.
  assert.equal(detectarMimeRealPorBytes(bytesTexto), null)
  assert.equal(detectarMimeRealPorBytes(BYTES_JPEG_VALIDO), 'image/jpeg')
  assert.equal(detectarMimeRealPorBytes(BYTES_PNG_VALIDO), 'image/png')
  assert.equal(detectarMimeRealPorBytes(BYTES_WEBP_VALIDO), 'image/webp')
})

test('@spec:AC-091 arquivo acima do limite é rejeitado antes de ler o conteúdo', async () => {
  const bytesGrandes = new Uint8Array(TAMANHO_MAXIMO_CLIENTE_BYTES + 1)
  bytesGrandes.set(BYTES_JPEG_VALIDO, 0) // conteúdo real é uma imagem válida — só o tamanho deveria reprovar

  const arquivoGrande = arquivoJpegValido('paciente-grande.jpg', bytesGrandes)
  const validacao = await validarArquivoImagem(arquivoGrande)

  assert.equal(validacao.valido, false)
  assert.ok(validacao.erro)
  assert.match(validacao.erro ?? '', /10MB/)

  const bytesNoLimite = new Uint8Array(TAMANHO_MAXIMO_CLIENTE_BYTES)
  bytesNoLimite.set(BYTES_JPEG_VALIDO, 0)
  const arquivoNoLimite = arquivoJpegValido('paciente-no-limite.jpg', bytesNoLimite)
  const validacaoNoLimite = await validarArquivoImagem(arquivoNoLimite)
  assert.equal(validacaoNoLimite.valido, true)
})
