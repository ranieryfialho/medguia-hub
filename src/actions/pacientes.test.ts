import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import os from 'node:os'

// pacientes.ts é um arquivo 'use server' que importa módulos via alias
// (@/lib/..., @/actions/...), que o `node --test` não resolve sem o bundler
// do Next. `criarPaciente` decide se retorna `pacienteId` (AC-107/108/109) e
// se aguarda a pasta do Drive antes de retornar (AC-110) — para provar isso
// contra o código-fonte real (não uma reimplementação), extraímos o corpo
// real das funções envolvidas de pacientes.ts, escrevemos um módulo .ts
// temporário com essas mesmas funções (recebendo `supabase` e
// `garantirPastaPacientePorId` como parâmetros injetados em vez de criados
// internamente) e importamos esse arquivo — assim o teste quebra se a lógica
// shippada mudar.
const sourcePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pacientes.ts')
const source = readFileSync(sourcePath, 'utf8')

function extrairCorpo(regex: RegExp, nome: string): string {
  const match = source.match(regex)
  assert.ok(match, `${nome} não encontrada em pacientes.ts`)
  return match![1]
}

const normalizarCPFBody = extrairCorpo(
  /function normalizarCPF\(cpf: string\): string \{([\s\S]*?)\n\}/,
  'normalizarCPF',
)
const normalizarTextoBody = extrairCorpo(
  /function normalizarTexto\(valor: string\): string \{([\s\S]*?)\n\}/,
  'normalizarTexto',
)
const normalizarTelefoneBody = extrairCorpo(
  /function normalizarTelefone\(telefone: string\): string \{([\s\S]*?)\n\}/,
  'normalizarTelefone',
)
const normalizarEmailBody = extrairCorpo(
  /function normalizarEmail\(email: string\): string \{([\s\S]*?)\n\}/,
  'normalizarEmail',
)

const buscarFull = extrairCorpo(
  /async function buscarPossiveisDuplicadosPaciente\(([\s\S]*?)\n\}/,
  'buscarPossiveisDuplicadosPaciente',
)
// buscarFull contém a lista de parâmetros tipada + `): Promise<PacienteDuplicado[]> {` + corpo.
// Descarta tudo até o `{` de abertura do corpo, mantendo só o corpo real.
const buscarBodyMatch = buscarFull.match(/\): Promise<PacienteDuplicado\[\]> \{\r?\n([\s\S]*)$/)
assert.ok(buscarBodyMatch, 'corpo de buscarPossiveisDuplicadosPaciente não encontrado')
const buscarBody = buscarBodyMatch![1]

const criarPacienteMatch = source.match(
  /export async function criarPaciente\(prevState: PacienteFormState \| null, formData: FormData\) \{([\s\S]*?)\n\}/
)
assert.ok(criarPacienteMatch, 'criarPaciente não encontrada em pacientes.ts')
// A função real cria seu próprio cliente supabase (`const supabase = await
// createClient()`) — no teste ele chega como parâmetro injetado, então essa
// linha precisa sair para não sobrescrever o mock.
const criarPacienteBody = criarPacienteMatch![1].replace(
  /^\s*const supabase = await createClient\(\)\r?\n/,
  '',
)

const moduloGerado = `
function normalizarCPF(cpf) {${normalizarCPFBody}
}
function normalizarTexto(valor) {${normalizarTextoBody}
}
function normalizarTelefone(telefone) {${normalizarTelefoneBody}
}
function normalizarEmail(email) {${normalizarEmailBody}
}
async function buscarPossiveisDuplicadosPaciente(supabase, dadosPaciente, pacienteIdIgnorar) {
${buscarBody}
}
export async function criarPaciente(supabase, garantirPastaPacientePorId, revalidatePath, redirect, prevState, formData) {${criarPacienteBody}
}
`

const tmpFile = path.join(os.tmpdir(), `pacientes-ac107-110-${process.pid}-${Date.now()}.ts`)
writeFileSync(tmpFile, moduloGerado, 'utf8')
after(() => {
  rmSync(tmpFile, { force: true })
})

const { criarPaciente } = (await import(pathToFileURL(tmpFile).href)) as {
  criarPaciente: (
    supabase: unknown,
    garantirPastaPacientePorId: (pacienteId: string) => Promise<{ success: boolean }>,
    revalidatePath: (path: string) => void,
    redirect: (path: string) => never,
    prevState: null,
    formData: FormData,
  ) => Promise<Record<string, unknown>>
}

type RespostaSupabase = { data: unknown; error?: { message: string } | null }

function criarSupabaseMock(respostas: RespostaSupabase[]) {
  let indice = 0
  function proximaResposta(): RespostaSupabase {
    assert.ok(indice < respostas.length, 'supabase mock chamado mais vezes do que o esperado')
    return respostas[indice++]
  }

  function builder(): Record<string, unknown> {
    const chain: Record<string, unknown> = {
      select: () => chain,
      insert: () => chain,
      eq: () => chain,
      neq: () => chain,
      ilike: () => chain,
      limit: () => chain,
      maybeSingle: () => Promise.resolve(proximaResposta()),
      single: () => Promise.resolve(proximaResposta()),
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(proximaResposta()).then(resolve, reject),
    }
    return chain
  }

  return { from: () => builder() }
}

function formDataPaciente(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData()
  formData.set('nome', overrides.nome ?? 'Fulano de Tal')
  formData.set('cpf', overrides.cpf ?? '')
  formData.set('telefone', overrides.telefone ?? '11999998888')
  formData.set('email', overrides.email ?? 'fulano@example.com')
  if (overrides.confirmar_duplicado) formData.set('confirmar_duplicado', overrides.confirmar_duplicado)
  return formData
}

function garantirPastaMockOk() {
  const chamadas: string[] = []
  const fn = async (pacienteId: string) => {
    chamadas.push(pacienteId)
    return { success: true }
  }
  return { fn, chamadas }
}

function redirectMockQueNuncaDeveSerChamado() {
  return () => {
    throw new Error('redirect() não deveria ser chamado por criarPaciente')
  }
}

test('@spec:AC-107 cadastro bem-sucedido retorna o id do paciente criado, sem redirect do servidor', async () => {
  const supabase = criarSupabaseMock([
    { data: [], error: null }, // busca de duplicados por nome: nenhum candidato
    { data: { id: 'paciente-novo-123', nome: 'Fulano de Tal' }, error: null }, // insert
  ])
  const { fn: garantirPastaPacientePorId, chamadas } = garantirPastaMockOk()

  const resultado = await criarPaciente(
    supabase,
    garantirPastaPacientePorId,
    () => {},
    redirectMockQueNuncaDeveSerChamado(),
    null,
    formDataPaciente(),
  )

  assert.equal(resultado.pacienteId, 'paciente-novo-123')
  assert.equal(resultado.error, undefined)
  assert.deepEqual(chamadas, ['paciente-novo-123'])
})

test('@spec:AC-108 CPF duplicado não retorna pacienteId, não cria paciente e não chama a pasta do Drive', async () => {
  const supabase = criarSupabaseMock([
    { data: { id: 'paciente-existente' }, error: null }, // checagem de CPF encontra duplicado
  ])
  const { fn: garantirPastaPacientePorId, chamadas } = garantirPastaMockOk()

  const resultado = await criarPaciente(
    supabase,
    garantirPastaPacientePorId,
    () => {},
    redirectMockQueNuncaDeveSerChamado(),
    null,
    formDataPaciente({ cpf: '123.456.789-09' }),
  )

  assert.equal(resultado.pacienteId, undefined)
  assert.match(String(resultado.error ?? ''), /CPF/)
  assert.deepEqual(chamadas, [])
})

test('@spec:AC-109 candidato a duplicado por nome não retorna pacienteId e não chama a pasta do Drive', async () => {
  const supabase = criarSupabaseMock([
    {
      data: [
        {
          id: 'paciente-parecido',
          nome: 'Fulano de Tal',
          cpf: null,
          telefone: null,
          email: null,
          data_nascimento: null,
          ativo: true,
        },
      ],
      error: null,
    }, // busca de duplicados por nome
  ])
  const { fn: garantirPastaPacientePorId, chamadas } = garantirPastaMockOk()

  const resultado = await criarPaciente(
    supabase,
    garantirPastaPacientePorId,
    () => {},
    redirectMockQueNuncaDeveSerChamado(),
    null,
    formDataPaciente(),
  )

  assert.equal(resultado.pacienteId, undefined)
  assert.ok(resultado.warning)
  assert.equal((resultado.duplicateCandidates as unknown[]).length, 1)
  assert.deepEqual(chamadas, [])
})

test('@spec:AC-110 criarPaciente aguarda garantirPastaPacientePorId antes de retornar (não é fire-and-forget)', async () => {
  const supabase = criarSupabaseMock([
    { data: [], error: null }, // busca de duplicados por nome: nenhum candidato
    { data: { id: 'paciente-novo-456', nome: 'Fulano de Tal' }, error: null }, // insert
  ])

  let pastaResolvida = false
  const garantirPastaPacientePorId = async (_pacienteId: string) => {
    await new Promise((resolve) => setTimeout(resolve, 20))
    pastaResolvida = true
    return { success: true }
  }

  const resultado = await criarPaciente(
    supabase,
    garantirPastaPacientePorId,
    () => {},
    redirectMockQueNuncaDeveSerChamado(),
    null,
    formDataPaciente(),
  )

  // Se a chamada fosse fire-and-forget (`void garantirPastaPacientePorId(...)`),
  // a promise de criarPaciente teria resolvido antes do timeout de 20ms acima,
  // e pastaResolvida ainda estaria false neste ponto.
  assert.equal(pastaResolvida, true)
  assert.equal(resultado.pacienteId, 'paciente-novo-456')
})
