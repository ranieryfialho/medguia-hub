import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import os from 'node:os'

// route.ts importa `next/headers` (via '@/lib/supabase/server') e
// `googleapis` (via '@/lib/google-drive'), que só resolvem dentro do
// runtime do Next. Para provar o comportamento contra o código-fonte real
// (não uma reimplementação), extraímos o corpo real de `GET` e o
// importamos num módulo temporário com `createClient`/`getClienteAutenticado`
// injetados como dependências mockáveis.
const sourcePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'route.ts')
const source = readFileSync(sourcePath, 'utf8')

function extrairCorpoFuncao(nomeFuncao: string): string {
  const inicio = source.indexOf(`export async function ${nomeFuncao}(`)
  assert.ok(inicio !== -1, `${nomeFuncao} não encontrada em route.ts`)
  const aberturaChave = source.indexOf('{', source.indexOf(')', inicio))
  assert.ok(aberturaChave !== -1, `abertura de ${nomeFuncao} não encontrada`)
  const fechamentoChave = source.lastIndexOf('\n}')
  assert.ok(fechamentoChave > aberturaChave, `fechamento de ${nomeFuncao} não encontrado`)
  return source.slice(aberturaChave + 1, fechamentoChave)
}

const getBody = extrairCorpoFuncao('GET')

const moduloGerado = `
export async function GET(deps, request, { params }) {
  const { createClient, getClienteAutenticado } = deps
${getBody}
}
`

const tmpFile = path.join(os.tmpdir(), `drive-file-route-${process.pid}-${Date.now()}.ts`)
writeFileSync(tmpFile, moduloGerado, 'utf8')
process.on('exit', () => rmSync(tmpFile, { force: true }))

const { GET } = (await import(pathToFileURL(tmpFile).href)) as {
  GET: (
    deps: {
      createClient: () => Promise<{ auth: { getUser: () => Promise<{ data: { user: unknown } }> } }>
      getClienteAutenticado: () => Promise<unknown>
    },
    request: Request,
    ctx: { params: Promise<{ fileId: string }> },
  ) => Promise<Response>
}

function createClientSemSessao() {
  return async () => ({
    auth: {
      getUser: async () => ({ data: { user: null } }),
    },
  })
}

function getClienteAutenticadoNuncaDeveSerChamado() {
  return async () => {
    throw new Error('getClienteAutenticado não deveria ser chamado sem sessão válida')
  }
}

test('@spec:AC-102 requisição sem sessão válida ao proxy de leitura de foto é bloqueada com 401', async () => {
  const request = new Request('https://hub.medguia.local/api/drive/file/algum-file-id')

  const response = await GET(
    { createClient: createClientSemSessao(), getClienteAutenticado: getClienteAutenticadoNuncaDeveSerChamado() },
    request,
    { params: Promise.resolve({ fileId: 'algum-file-id' }) },
  )

  assert.equal(response.status, 401)
})
