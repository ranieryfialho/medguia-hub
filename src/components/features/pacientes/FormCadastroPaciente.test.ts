import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// FormCadastroPaciente.tsx é JSX e não pode ser importado diretamente pelo
// `node --test` (Node não faz transform de JSX, só strip de tipos). A função
// pura que orquestra o upload de foto pós-cadastro (AC-088/AC-089) não depende
// de JSX nem de módulos do Next/React — extraímos seu código-fonte real do
// arquivo e a executamos isoladamente, para o teste quebrar se a lógica
// shippada mudar.
const sourcePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'FormCadastroPaciente.tsx')
const source = readFileSync(sourcePath, 'utf8')

const constMatch = source.match(/const MENSAGEM_FALHA_FOTO = (.+)$/m)
assert.ok(constMatch, 'MENSAGEM_FALHA_FOTO não encontrada em FormCadastroPaciente.tsx')

const match = source.match(
  /export async function enviarFotoAposCadastro\(([\s\S]*?)\): Promise<void> \{([\s\S]*?)\n\}/
)
assert.ok(match, 'enviarFotoAposCadastro não encontrada em FormCadastroPaciente.tsx')

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
  ...args: string[]
) => (...args: unknown[]) => unknown

const enviarFotoAposCadastro = new AsyncFunction(
  'pacienteId',
  'file',
  'deps',
  `const MENSAGEM_FALHA_FOTO = ${constMatch![1]}\n${match![2]}`,
) as (
  pacienteId: string,
  file: unknown,
  deps: {
    uploadFoto: (pacienteId: string, file: unknown) => Promise<{ ok: boolean }>
    toastSuccess: (mensagem: string) => void
    toastWarning: (mensagem: string) => void
  },
) => Promise<void>

test('@spec:AC-088 foto é enviada ao Drive (POST) após o paciente ser criado com sucesso', async () => {
  const chamadas: Array<{ pacienteId: string; file: unknown }> = []
  const sucessos: string[] = []
  const warnings: string[] = []

  await enviarFotoAposCadastro('paciente-123', { nome: 'foto.jpg' }, {
    uploadFoto: async (pacienteId, file) => {
      chamadas.push({ pacienteId, file })
      return { ok: true }
    },
    toastSuccess: (mensagem) => sucessos.push(mensagem),
    toastWarning: (mensagem) => warnings.push(mensagem),
  })

  assert.equal(chamadas.length, 1)
  assert.equal(chamadas[0].pacienteId, 'paciente-123')
  assert.deepEqual(chamadas[0].file, { nome: 'foto.jpg' })
  assert.equal(sucessos.length, 1)
  assert.equal(warnings.length, 0)
})

test('@spec:AC-089 resposta não-ok do Drive gera aviso, sem lançar erro (cadastro segue concluído)', async () => {
  const warnings: string[] = []
  const sucessos: string[] = []

  await assert.doesNotReject(
    enviarFotoAposCadastro('paciente-456', { nome: 'foto.png' }, {
      uploadFoto: async () => ({ ok: false }),
      toastSuccess: (mensagem) => sucessos.push(mensagem),
      toastWarning: (mensagem) => warnings.push(mensagem),
    }),
  )

  assert.equal(warnings.length, 1)
  assert.equal(sucessos.length, 0)
})

test('@spec:AC-089 exceção de rede ao subir a foto (Drive indisponível) gera aviso, sem lançar erro', async () => {
  const warnings: string[] = []

  await assert.doesNotReject(
    enviarFotoAposCadastro('paciente-789', { nome: 'foto.webp' }, {
      uploadFoto: async () => {
        throw new Error('Drive indisponível')
      },
      toastSuccess: () => {},
      toastWarning: (mensagem) => warnings.push(mensagem),
    }),
  )

  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /não pôde ser salva/)
})
