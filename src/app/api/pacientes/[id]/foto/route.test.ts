import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import os from 'node:os'

// route.ts importa `next/headers` (via '@/lib/supabase/server') e
// `googleapis`, que só resolvem dentro do runtime do Next. Para provar o
// comportamento contra o código-fonte real (não uma reimplementação),
// extraímos os corpos reais de `processarUploadFoto` e
// `processarRemocaoFoto` — as duas funções que concentram toda a regra da
// rota e recebem banco/pasta do Drive/cliente do Drive por parâmetro — e as
// importamos num módulo temporário com essas dependências injetadas como
// mocks. `POST`/`DELETE` (que só fazem a ponte com sessão/Next) ficam fora
// da prova unitária de propósito: são cobertos pelo roteiro de regressão
// manual do TDD 006, que exige sessão real do Supabase Auth.
const sourcePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'route.ts')
const source = readFileSync(sourcePath, 'utf8')

function extrairCorpoFuncao(nomeFuncao: string, marcadorFim: string): string {
  const inicio = source.indexOf(`export async function ${nomeFuncao}(`)
  assert.ok(inicio !== -1, `${nomeFuncao} não encontrada em route.ts`)
  const aberturaChave = source.indexOf('{', inicio)
  assert.ok(aberturaChave !== -1, `abertura de ${nomeFuncao} não encontrada`)
  const fim = source.indexOf(marcadorFim, aberturaChave)
  assert.ok(fim !== -1, `fim de ${nomeFuncao} não encontrado (marcador: ${marcadorFim})`)
  const fechamentoChave = source.lastIndexOf('\n}', fim)
  assert.ok(fechamentoChave > aberturaChave, `fechamento de ${nomeFuncao} não encontrado`)
  return source.slice(aberturaChave + 1, fechamentoChave)
}

const processarUploadFotoBody = extrairCorpoFuncao(
  'processarUploadFoto',
  '/** Remove a foto do paciente.',
)
const processarRemocaoFotoBody = extrairCorpoFuncao(
  'processarRemocaoFoto',
  'export async function POST(',
)

const imagemPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../../../lib/imagem.ts')
const imagemUrl = pathToFileURL(imagemPath).href

const moduloGerado = `
import { detectarMimeRealPorBytes } from '${imagemUrl}'
import { Readable } from 'node:stream'

const TAMANHO_MAXIMO_SERVIDOR_BYTES = 2 * 1024 * 1024

const EXTENSAO_POR_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function nomeArquivoFoto(pacienteId, mime) {
  const idCurto = pacienteId.replace(/-/g, '').slice(0, 8).toUpperCase()
  return \`foto_perfil_\${idCurto}.\${EXTENSAO_POR_MIME[mime]}\`
}

export async function processarUploadFoto(deps, pacienteId, file) {${processarUploadFotoBody}
}

export async function processarRemocaoFoto(deps, pacienteId) {${processarRemocaoFotoBody}
}
`

const tmpFile = path.join(os.tmpdir(), `foto-paciente-route-${process.pid}-${Date.now()}.ts`)
writeFileSync(tmpFile, moduloGerado, 'utf8')
process.on('exit', () => rmSync(tmpFile, { force: true }))

const { processarUploadFoto, processarRemocaoFoto } = (await import(pathToFileURL(tmpFile).href)) as {
  processarUploadFoto: (
    deps: {
      db: ReturnType<typeof criarDbMock>
      garantirPastaPacientePorId: (pacienteId: string) => Promise<{ success: boolean; error?: string }>
      criarClienteDrive: () => Promise<ReturnType<typeof criarDriveMock>['drive']>
    },
    pacienteId: string,
    file: File,
  ) => Promise<{ status: number; body: Record<string, unknown> }>
  processarRemocaoFoto: (
    deps: {
      db: ReturnType<typeof criarDbMock>
      garantirPastaPacientePorId: (pacienteId: string) => Promise<{ success: boolean; error?: string }>
      criarClienteDrive: () => Promise<ReturnType<typeof criarDriveMock>['drive']>
    },
    pacienteId: string,
  ) => Promise<{ status: number; body: Record<string, unknown> }>
}

type RespostaDb = { data: unknown; error?: { message: string } | null }

function criarDbMock(respostas: RespostaDb[]) {
  let indice = 0
  function proximaResposta(): RespostaDb {
    assert.ok(indice < respostas.length, `db mock chamado mais vezes do que o esperado (chamada ${indice + 1})`)
    return respostas[indice++]
  }
  function builder(): Record<string, unknown> {
    const chain: Record<string, unknown> = {
      select: () => chain,
      update: () => chain,
      eq: () => chain,
      maybeSingle: () => Promise.resolve(proximaResposta()),
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(proximaResposta()).then(resolve, reject),
    }
    return chain
  }
  return { from: () => builder() }
}

function criarDriveMock(opts: {
  criarRetornaId?: string
  criarLanca?: Error
  indisponivel?: Error
} = {}) {
  const chamadasCreate: unknown[] = []
  const chamadasUpdate: unknown[] = []
  const chamadasPermissionsCreate: unknown[] = []

  const drive = {
    files: {
      create: async (args: unknown) => {
        chamadasCreate.push(args)
        if (opts.criarLanca) throw opts.criarLanca
        return { data: { id: opts.criarRetornaId ?? 'file-novo-id' } }
      },
      update: async (args: unknown) => {
        chamadasUpdate.push(args)
        return {}
      },
    },
    permissions: {
      create: async (args: unknown) => {
        chamadasPermissionsCreate.push(args)
        return {}
      },
    },
  }

  const criarClienteDrive = async () => {
    if (opts.indisponivel) throw opts.indisponivel
    return drive
  }

  return { drive, criarClienteDrive, chamadasCreate, chamadasUpdate, chamadasPermissionsCreate }
}

function garantirPastaMock(resultado: { success: boolean; error?: string } = { success: true }) {
  const chamadas: string[] = []
  const fn = async (pacienteId: string) => {
    chamadas.push(pacienteId)
    return resultado
  }
  return { fn, chamadas }
}

function garantirPastaNuncaDeveSerChamada() {
  return async () => {
    throw new Error('garantirPastaPacientePorId não deveria ser chamada')
  }
}

function criarClienteDriveNuncaDeveSerChamado() {
  return async () => {
    throw new Error('criarClienteDrive não deveria ser chamado')
  }
}

const BYTES_JPEG_VALIDO = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
])

function arquivoJpegValido(nome = 'paciente.jpg', bytes: Uint8Array = BYTES_JPEG_VALIDO): File {
  return new File([bytes as BlobPart], nome, { type: 'image/jpeg' })
}

test('@spec:AC-088 upload com sucesso envia a foto ao Drive e retorna fotoDriveFileId e fotoAtualizadaEm', async () => {
  const db = criarDbMock([
    { data: { id: 'paciente-1', foto_drive_file_id: null }, error: null }, // select pacientes
    { data: { google_drive_folder_id: 'pasta-drive-1' }, error: null }, // select paciente_pastas_drive
    { data: null, error: null }, // update pacientes
  ])
  const { fn: garantirPastaPacientePorId, chamadas: chamadasPasta } = garantirPastaMock()
  const { criarClienteDrive, chamadasCreate, chamadasUpdate } = criarDriveMock({ criarRetornaId: 'file-abc-123' })

  const resultado = await processarUploadFoto(
    { db, garantirPastaPacientePorId, criarClienteDrive },
    'paciente-1',
    arquivoJpegValido(),
  )

  assert.equal(resultado.status, 200)
  assert.equal(resultado.body.fotoDriveFileId, 'file-abc-123')
  assert.ok(typeof resultado.body.fotoAtualizadaEm === 'string' && resultado.body.fotoAtualizadaEm.length > 0)
  assert.deepEqual(chamadasPasta, ['paciente-1'])
  assert.equal(chamadasCreate.length, 1)
  assert.equal(chamadasUpdate.length, 0) // sem foto anterior, nada a apagar
})

test('@spec:AC-089 Drive indisponível responde 502 sem alterar nenhuma coluna no banco', async () => {
  const db = criarDbMock([
    { data: { id: 'paciente-2', foto_drive_file_id: null }, error: null }, // select pacientes
    // nenhuma outra resposta enfileirada: qualquer tentativa extra de leitura/escrita falha o teste
  ])
  const { fn: garantirPastaPacientePorId, chamadas } = garantirPastaMock({ success: false, error: 'Google Drive não conectado' })

  const resultado = await processarUploadFoto(
    { db, garantirPastaPacientePorId, criarClienteDrive: criarClienteDriveNuncaDeveSerChamado() },
    'paciente-2',
    arquivoJpegValido(),
  )

  assert.equal(resultado.status, 502)
  assert.deepEqual(chamadas, ['paciente-2'])
})

test('@spec:AC-090 arquivo que não é imagem de verdade é rejeitado com 400, sem tocar no banco nem no Drive', async () => {
  const bytesPdfDisfarcado = new TextEncoder().encode('%PDF-1.4 conteúdo falso de imagem')
  const arquivoFalso = new File([bytesPdfDisfarcado], 'paciente.jpg', { type: 'image/jpeg' })

  const db = criarDbMock([]) // nenhuma chamada esperada
  const resultado = await processarUploadFoto(
    { db, garantirPastaPacientePorId: garantirPastaNuncaDeveSerChamada(), criarClienteDrive: criarClienteDriveNuncaDeveSerChamado() },
    'paciente-3',
    arquivoFalso,
  )

  assert.equal(resultado.status, 400)
})

test('@spec:AC-091 arquivo acima de 2MB é rejeitado com 400 mesmo com MIME válido declarado pelo cliente', async () => {
  const bytesGrandes = new Uint8Array(2 * 1024 * 1024 + 1)
  bytesGrandes.set(BYTES_JPEG_VALIDO)
  const arquivoGrande = new File([bytesGrandes], 'paciente.jpg', { type: 'image/jpeg' })

  const db = criarDbMock([]) // nenhuma chamada esperada
  const resultado = await processarUploadFoto(
    { db, garantirPastaPacientePorId: garantirPastaNuncaDeveSerChamada(), criarClienteDrive: criarClienteDriveNuncaDeveSerChamado() },
    'paciente-4',
    arquivoGrande,
  )

  assert.equal(resultado.status, 400)
})

test('@spec:AC-092 trocar a foto sobe a nova e apaga a anterior no Drive, sem deixar órfão', async () => {
  const db = criarDbMock([
    { data: { id: 'paciente-5', foto_drive_file_id: 'file-antigo-id' }, error: null }, // select pacientes
    { data: { google_drive_folder_id: 'pasta-drive-5' }, error: null }, // select paciente_pastas_drive
    { data: null, error: null }, // update pacientes
  ])
  const { fn: garantirPastaPacientePorId } = garantirPastaMock()
  const { criarClienteDrive, chamadasUpdate } = criarDriveMock({ criarRetornaId: 'file-novo-id' })

  const resultado = await processarUploadFoto(
    { db, garantirPastaPacientePorId, criarClienteDrive },
    'paciente-5',
    arquivoJpegValido(),
  )

  assert.equal(resultado.status, 200)
  assert.equal(resultado.body.fotoDriveFileId, 'file-novo-id')
  assert.equal(chamadasUpdate.length, 1)
  assert.deepEqual(chamadasUpdate[0], { fileId: 'file-antigo-id', requestBody: { trashed: true } })
})

test('@spec:AC-093 remover a foto move o arquivo para a lixeira do Drive e zera as colunas do paciente', async () => {
  const db = criarDbMock([
    { data: { id: 'paciente-6', foto_drive_file_id: 'file-a-remover' }, error: null }, // select pacientes
    { data: null, error: null }, // update pacientes (zera colunas)
  ])
  const { criarClienteDrive, chamadasUpdate } = criarDriveMock()

  const resultado = await processarRemocaoFoto(
    { db, garantirPastaPacientePorId: garantirPastaNuncaDeveSerChamada(), criarClienteDrive },
    'paciente-6',
  )

  assert.equal(resultado.status, 200)
  assert.deepEqual(resultado.body, { ok: true })
  assert.equal(chamadasUpdate.length, 1)
  assert.deepEqual(chamadasUpdate[0], { fileId: 'file-a-remover', requestBody: { trashed: true } })
})

test('@spec:AC-095 remover foto de paciente sem foto é idempotente (200, sem tentar apagar nada no Drive)', async () => {
  const db = criarDbMock([
    { data: { id: 'paciente-7', foto_drive_file_id: null }, error: null }, // select pacientes
    // nenhuma outra resposta: não deve haver update no banco
  ])

  const resultado = await processarRemocaoFoto(
    { db, garantirPastaPacientePorId: garantirPastaNuncaDeveSerChamada(), criarClienteDrive: criarClienteDriveNuncaDeveSerChamado() },
    'paciente-7',
  )

  assert.equal(resultado.status, 200)
  assert.deepEqual(resultado.body, { ok: true })
})

test('@spec:AC-103 nenhuma permissão pública é criada no arquivo salvo', async () => {
  const db = criarDbMock([
    { data: { id: 'paciente-8', foto_drive_file_id: null }, error: null }, // select pacientes
    { data: { google_drive_folder_id: 'pasta-drive-8' }, error: null }, // select paciente_pastas_drive
    { data: null, error: null }, // update pacientes
  ])
  const { fn: garantirPastaPacientePorId } = garantirPastaMock()
  const { criarClienteDrive, chamadasPermissionsCreate, chamadasCreate } = criarDriveMock({ criarRetornaId: 'file-sem-permissao' })

  const resultado = await processarUploadFoto(
    { db, garantirPastaPacientePorId, criarClienteDrive },
    'paciente-8',
    arquivoJpegValido(),
  )

  assert.equal(resultado.status, 200)
  assert.equal(chamadasPermissionsCreate.length, 0)
  // O upload não declara nenhum campo de permissão — herda a da pasta do paciente.
  const requestBody = (chamadasCreate[0] as { requestBody: { parents: string[] } }).requestBody
  assert.equal(requestBody.parents[0], 'pasta-drive-8')
})
