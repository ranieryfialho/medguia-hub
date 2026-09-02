import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// AvatarPaciente.tsx é JSX e não pode ser importado diretamente pelo
// `node --test` (Node não faz transform de JSX, só strip de tipos — e nem
// isso vale para a extensão `.tsx`). As funções puras que decidem o estado
// de renderização (calcularEstadoAvatar), o fallback de iniciais
// (calcularIniciais) e a URL versionada da foto (construirUrlFoto)
// extraímos seu código-fonte real do arquivo e as executamos isoladamente,
// para o teste quebrar se a lógica shippada mudar.
const sourcePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'AvatarPaciente.tsx')
const source = readFileSync(sourcePath, 'utf8')

function extrairFuncao(assinatura: string): string {
  const inicio = source.indexOf(assinatura)
  assert.ok(inicio !== -1, `"${assinatura}" não encontrada em AvatarPaciente.tsx`)
  const aberturaChave = source.indexOf('{', inicio)
  assert.ok(aberturaChave !== -1, `abertura de bloco não encontrada para "${assinatura}"`)
  const fechamentoChave = source.indexOf('\n}', aberturaChave)
  assert.ok(fechamentoChave !== -1, `fechamento de bloco não encontrado para "${assinatura}"`)
  return source.slice(aberturaChave + 1, fechamentoChave)
}

const calcularIniciaisBody = extrairFuncao('export function calcularIniciais(nome: string): string')
const construirUrlFotoBody = extrairFuncao(
  'export function construirUrlFoto(fotoDriveFileId: string, fotoAtualizadaEm?: string | null): string',
)
const calcularEstadoAvatarBody = extrairFuncao(
  'export function calcularEstadoAvatar(\n  fotoDriveFileId: string | null | undefined,\n  imagemCarregou: boolean,\n  imagemFalhou: boolean,\n): EstadoAvatarPaciente',
)
const podeAmpliarBody = extrairFuncao(
  'export function podeAmpliar(fotoDriveFileId: string | null | undefined, ampliavel: boolean): boolean',
)

const calcularIniciais = new Function('nome', calcularIniciaisBody) as (nome: string) => string

const construirUrlFoto = new Function(
  'fotoDriveFileId',
  'fotoAtualizadaEm',
  construirUrlFotoBody,
) as (fotoDriveFileId: string, fotoAtualizadaEm?: string | null) => string

const calcularEstadoAvatar = new Function(
  'fotoDriveFileId',
  'imagemCarregou',
  'imagemFalhou',
  calcularEstadoAvatarBody,
) as (
  fotoDriveFileId: string | null | undefined,
  imagemCarregou: boolean,
  imagemFalhou: boolean,
) => 'fallback' | 'carregando' | 'foto'

const podeAmpliar = new Function(
  'fotoDriveFileId',
  'ampliavel',
  podeAmpliarBody,
) as (fotoDriveFileId: string | null | undefined, ampliavel: boolean) => boolean

test('@spec:AC-097 sem fotoDriveFileId (nulo) o estado é fallback', () => {
  assert.equal(calcularEstadoAvatar(null, false, false), 'fallback')
})

test('@spec:AC-097 sem fotoDriveFileId (vazio) o estado é fallback', () => {
  assert.equal(calcularEstadoAvatar('', false, false), 'fallback')
})

test('@spec:AC-097 fallback exibe as duas primeiras iniciais do nome em caixa alta', () => {
  assert.equal(calcularIniciais('joão da silva'), 'JD')
  assert.equal(calcularIniciais('maria oliveira santos'), 'MO')
})

test('@spec:AC-097 nome com um único termo usa só a primeira letra', () => {
  assert.equal(calcularIniciais('madonna'), 'M')
})

test('@spec:AC-096 com fotoDriveFileId e imagem já carregada, o estado é foto', () => {
  assert.equal(calcularEstadoAvatar('drive-file-123', true, false), 'foto')
})

test('@spec:AC-096 com fotoDriveFileId e imagem ainda não resolvida, o estado é carregando (nunca ícone quebrado)', () => {
  assert.equal(calcularEstadoAvatar('drive-file-123', false, false), 'carregando')
})

test('@spec:AC-098 falha ao carregar (onError) faz o estado cair para fallback mesmo com fotoDriveFileId presente', () => {
  assert.equal(calcularEstadoAvatar('drive-file-123', false, true), 'fallback')
  assert.equal(calcularEstadoAvatar('drive-file-123', true, true), 'fallback')
})

test('@spec:AC-099 a URL da foto inclui fotoAtualizadaEm como parâmetro de versão (?v=)', () => {
  const url = construirUrlFoto('drive-file-123', '2026-09-02T10:00:00.000Z')
  assert.equal(url, '/api/drive/file/drive-file-123?v=2026-09-02T10%3A00%3A00.000Z')
})

test('@spec:AC-099 trocar a foto (fotoAtualizadaEm diferente) muda a URL, invalidando o cache do navegador', () => {
  const urlAntiga = construirUrlFoto('drive-file-123', '2026-09-01T08:00:00.000Z')
  const urlNova = construirUrlFoto('drive-file-123', '2026-09-02T10:00:00.000Z')
  assert.notEqual(urlAntiga, urlNova)
})

test('@spec:AC-099 sem fotoAtualizadaEm a URL ainda inclui o parâmetro ?v= (vazio)', () => {
  const url = construirUrlFoto('drive-file-123', null)
  assert.equal(url, '/api/drive/file/drive-file-123?v=')
})

test('@spec:AC-098 o <img> do avatar tem onError ligado ao estado que dispara o fallback', () => {
  assert.match(source, /onError=\{\(\) => setImagemFalhou\(true\)\}/)
})

test('@spec:AC-098 o <img> nunca é desmontado ao falhar — some por classe (hidden), preservando o layout', () => {
  const blocoImgMatch = source.match(/<img[\s\S]*?\/>/)
  assert.ok(blocoImgMatch, '<img> não encontrado em AvatarPaciente.tsx')
  assert.match(blocoImgMatch[0], /estado === 'foto' \? '' : 'hidden'/)
})

test('@spec:AC-096 o <img> é renderizado com a URL construída por construirUrlFoto quando há fotoDriveFileId', () => {
  const blocoImgMatch = source.match(/<img[\s\S]*?\/>/)
  assert.ok(blocoImgMatch, '<img> não encontrado em AvatarPaciente.tsx')
  assert.match(blocoImgMatch[0], /src=\{construirUrlFoto\(fotoDriveFileId, fotoAtualizadaEm\)\}/)
})

test('@spec:AC-097 as iniciais só são renderizadas quando o estado é fallback', () => {
  assert.match(source, /\{estado === 'fallback' && <span>\{iniciais\}<\/span>\}/)
})

test('@spec:AC-100 com foto e ampliavel ativada, podeAmpliar retorna true', () => {
  assert.equal(podeAmpliar('drive-file-123', true), true)
})

test('@spec:AC-100 o clique no avatar só dispara a abertura do lightbox quando ampliavelAtivo é verdadeiro', () => {
  assert.match(source, /onClick=\{ampliavelAtivo \? \(\) => setLightboxAberto\(true\) : undefined\}/)
})

test('@spec:AC-100 o LightboxMidia só é renderizado com lightboxAberto, ampliavelAtivo e fotoDriveFileId verdadeiros', () => {
  assert.match(source, /\{lightboxAberto && ampliavelAtivo && fotoDriveFileId && \(/)
})

test('@spec:AC-100 o LightboxMidia recebe a URL construída por construirUrlFoto (imagem ampliada, não recarregada do zero)', () => {
  const blocoLightbox = source.match(/<LightboxMidia[\s\S]*?\/>/)
  assert.ok(blocoLightbox, '<LightboxMidia> não encontrado em AvatarPaciente.tsx')
  assert.match(blocoLightbox[0], /src: construirUrlFoto\(fotoDriveFileId, fotoAtualizadaEm\)/)
})

test('@spec:AC-101 sem fotoDriveFileId (nulo), podeAmpliar retorna false mesmo com ampliavel ativada', () => {
  assert.equal(podeAmpliar(null, true), false)
})

test('@spec:AC-101 sem fotoDriveFileId (vazio), podeAmpliar retorna false mesmo com ampliavel ativada', () => {
  assert.equal(podeAmpliar('', true), false)
})

test('@spec:AC-101 com foto mas sem ampliavel, podeAmpliar retorna false', () => {
  assert.equal(podeAmpliar('drive-file-123', false), false)
})

test('@spec:AC-101 sem foto nem ampliavel, podeAmpliar retorna false', () => {
  assert.equal(podeAmpliar(null, false), false)
})

test('@spec:AC-101 o avatar não recebe role="button" nem onClick quando ampliavelAtivo é falso (nada acontece ao clicar)', () => {
  assert.match(source, /role=\{ampliavelAtivo \? 'button' : undefined\}/)
  assert.match(source, /tabIndex=\{ampliavelAtivo \? 0 : undefined\}/)
})
