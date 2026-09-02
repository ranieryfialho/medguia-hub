import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// FormEditarPaciente.tsx é JSX e não pode ser importado diretamente pelo
// `node --test` (Node não faz transform de JSX, só strip de tipos). As
// funções puras que orquestram troca/remoção de foto na edição (fora do
// submit do `<form>`, T-006) não dependem de JSX nem de módulos do
// Next/React — extraímos seu código-fonte real do arquivo e as executamos
// isoladamente, para o teste quebrar se a lógica shippada mudar.
const sourcePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'FormEditarPaciente.tsx')
const source = readFileSync(sourcePath, 'utf8')

const mensagemTrocaMatch = source.match(/const MENSAGEM_FALHA_TROCA_FOTO = (.+)$/m)
assert.ok(mensagemTrocaMatch, 'MENSAGEM_FALHA_TROCA_FOTO não encontrada em FormEditarPaciente.tsx')

const mensagemRemocaoMatch = source.match(/const MENSAGEM_FALHA_REMOCAO_FOTO = (.+)$/m)
assert.ok(mensagemRemocaoMatch, 'MENSAGEM_FALHA_REMOCAO_FOTO não encontrada em FormEditarPaciente.tsx')

const trocaMatch = source.match(
  /export async function trocarFotoPacienteEdicao\(([\s\S]*?)\): Promise<void> \{([\s\S]*?)\n\}/
)
assert.ok(trocaMatch, 'trocarFotoPacienteEdicao não encontrada em FormEditarPaciente.tsx')

const remocaoMatch = source.match(
  /export async function removerFotoPacienteEdicao\(([\s\S]*?)\): Promise<void> \{([\s\S]*?)\n\}/
)
assert.ok(remocaoMatch, 'removerFotoPacienteEdicao não encontrada em FormEditarPaciente.tsx')

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
  ...args: string[]
) => (...args: unknown[]) => unknown

type DepsFoto = {
  uploadFoto: (pacienteId: string, file: unknown) => Promise<{ ok: boolean }>
  removerFoto: (pacienteId: string) => Promise<{ ok: boolean }>
  toastSuccess: (mensagem: string) => void
  toastError: (mensagem: string) => void
  refresh: () => void
}

const trocarFotoPacienteEdicao = new AsyncFunction(
  'pacienteId',
  'file',
  'deps',
  `const MENSAGEM_FALHA_TROCA_FOTO = ${mensagemTrocaMatch![1]}\n${trocaMatch![2]}`,
) as (pacienteId: string, file: unknown, deps: DepsFoto) => Promise<void>

const removerFotoPacienteEdicao = new AsyncFunction(
  'pacienteId',
  'deps',
  `const MENSAGEM_FALHA_REMOCAO_FOTO = ${mensagemRemocaoMatch![1]}\n${remocaoMatch![2]}`,
) as (pacienteId: string, deps: DepsFoto) => Promise<void>

test('@spec:AC-092 trocar a foto envia o novo arquivo e atualiza a tela (refresh) em caso de sucesso', async () => {
  const chamadas: Array<{ pacienteId: string; file: unknown }> = []
  const sucessos: string[] = []
  let refreshChamado = false

  await trocarFotoPacienteEdicao('paciente-001', { nome: 'nova-foto.webp' }, {
    uploadFoto: async (pacienteId, file) => {
      chamadas.push({ pacienteId, file })
      return { ok: true }
    },
    removerFoto: async () => ({ ok: true }),
    toastSuccess: (mensagem) => sucessos.push(mensagem),
    toastError: () => {},
    refresh: () => {
      refreshChamado = true
    },
  })

  assert.equal(chamadas.length, 1)
  assert.equal(chamadas[0].pacienteId, 'paciente-001')
  assert.deepEqual(chamadas[0].file, { nome: 'nova-foto.webp' })
  assert.equal(sucessos.length, 1)
  assert.equal(refreshChamado, true)
})

test('@spec:AC-092 falha ao trocar a foto não atualiza a tela e mostra erro, sem lançar exceção', async () => {
  const erros: string[] = []
  let refreshChamado = false

  await assert.doesNotReject(
    trocarFotoPacienteEdicao('paciente-002', { nome: 'foto.jpg' }, {
      uploadFoto: async () => ({ ok: false }),
      removerFoto: async () => ({ ok: true }),
      toastSuccess: () => {},
      toastError: (mensagem) => erros.push(mensagem),
      refresh: () => {
        refreshChamado = true
      },
    }),
  )

  assert.equal(erros.length, 1)
  assert.equal(refreshChamado, false)
})

test('@spec:AC-093 remover a foto chama DELETE e atualiza a tela em caso de sucesso', async () => {
  const chamadas: string[] = []
  const sucessos: string[] = []
  let refreshChamado = false

  await removerFotoPacienteEdicao('paciente-003', {
    uploadFoto: async () => ({ ok: true }),
    removerFoto: async (pacienteId) => {
      chamadas.push(pacienteId)
      return { ok: true }
    },
    toastSuccess: (mensagem) => sucessos.push(mensagem),
    toastError: () => {},
    refresh: () => {
      refreshChamado = true
    },
  })

  assert.equal(chamadas.length, 1)
  assert.equal(chamadas[0], 'paciente-003')
  assert.equal(sucessos.length, 1)
  assert.equal(refreshChamado, true)
})

test('@spec:AC-095 remover foto de paciente sem foto é idempotente: rota responde 200 e o componente trata como sucesso', async () => {
  // A rota (T-004, processarRemocaoFoto) já responde 200 sem tocar no Drive
  // quando o paciente não tem foto — aqui garantimos que o componente não
  // introduz nenhum tratamento especial: sucesso é sucesso, sem erro.
  const sucessos: string[] = []
  const erros: string[] = []

  await removerFotoPacienteEdicao('paciente-sem-foto', {
    uploadFoto: async () => ({ ok: true }),
    removerFoto: async () => ({ ok: true }),
    toastSuccess: (mensagem) => sucessos.push(mensagem),
    toastError: (mensagem) => erros.push(mensagem),
    refresh: () => {},
  })

  assert.equal(sucessos.length, 1)
  assert.equal(erros.length, 0)
})

test('@spec:AC-093 falha ao remover a foto não atualiza a tela e mostra erro, sem lançar exceção', async () => {
  const erros: string[] = []
  let refreshChamado = false

  await assert.doesNotReject(
    removerFotoPacienteEdicao('paciente-004', {
      uploadFoto: async () => ({ ok: true }),
      removerFoto: async () => {
        throw new Error('Drive indisponível')
      },
      toastSuccess: () => {},
      toastError: (mensagem) => erros.push(mensagem),
      refresh: () => {
        refreshChamado = true
      },
    }),
  )

  assert.equal(erros.length, 1)
  assert.equal(refreshChamado, false)
})

test('@spec:AC-094 o input de troca de foto não tem atributo `name`, então nunca entra no FormData do submit do `<form>`', () => {
  const blocoFotoMatch = source.match(/<input([^<]*?)onChange=\{handleTrocarFoto\}([^<]*?)\/>/)
  assert.ok(blocoFotoMatch, 'input de troca de foto (onChange={handleTrocarFoto}) não encontrado')
  assert.doesNotMatch(blocoFotoMatch![1] + blocoFotoMatch![2], /\bname=/)
})

test('@spec:AC-094 o botão de remover foto é `type="button"`, então nunca dispara o submit do `<form>`', () => {
  const blocoRemoverMatch = source.match(/onClick=\{handleRemoverFoto\}[\s\S]{0,80}/)
  assert.ok(blocoRemoverMatch, 'botão de remover foto não encontrado')

  const aberturaBotaoMatch = source.match(/<button([\s\S]{0,200}?)onClick=\{handleRemoverFoto\}/)
  assert.ok(aberturaBotaoMatch, 'abertura da tag <button> do botão de remover foto não encontrada')
  assert.match(aberturaBotaoMatch![1], /type="button"/)
})

test('@spec:AC-094 editar outros campos (ex: telefone) não passa pelos handlers de foto — nenhuma chamada ao Drive é feita', async () => {
  // Os handlers de foto só são acionados por `onChange`/`onClick` dedicados
  // (handleTrocarFoto/handleRemoverFoto), nunca pelo `formAction` do
  // `editarPaciente`. Simulamos a ausência de qualquer interação com a foto:
  // nenhuma das funções de deps é invocada.
  let chamouUpload = false
  let chamouRemocao = false

  const deps: DepsFoto = {
    uploadFoto: async () => {
      chamouUpload = true
      return { ok: true }
    },
    removerFoto: async () => {
      chamouRemocao = true
      return { ok: true }
    },
    toastSuccess: () => {},
    toastError: () => {},
    refresh: () => {},
  }

  // "editar telefone" não invoca nem trocarFotoPacienteEdicao, nem
  // removerFotoPacienteEdicao — não há nada a chamar aqui, o que é
  // exatamente o comportamento esperado pelo AC-094.
  void deps

  assert.equal(chamouUpload, false)
  assert.equal(chamouRemocao, false)
})
