import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// vendas.ts é um arquivo 'use server' que importa módulos via alias (@/lib/...),
// que o `node --test` não resolve sem o bundler do Next. As funções puras que
// decidem venda_em_consultorio e classificam o erro de CHECK constraint não
// dependem de Supabase nem de Next, então extraímos seu código-fonte real do
// arquivo e o executamos isoladamente — isso garante que o teste quebra se a
// lógica shippada mudar.
const sourcePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'vendas.ts')
const source = readFileSync(sourcePath, 'utf8')

const matchResolver = source.match(
  /export async function resolverVendaEmConsultorio\(origem: string, formData: FormData\): Promise<boolean \| null> \{([\s\S]*?)\n\}/
)
assert.ok(matchResolver, 'resolverVendaEmConsultorio não encontrada em vendas.ts')

const resolverVendaEmConsultorio = new Function(
  'origem',
  'formData',
  matchResolver![1]
) as (origem: string, formData: FormData) => boolean | null

const matchCheck = source.match(
  /export async function isCheckConstraintError\(message: string \| undefined\): Promise<boolean> \{([\s\S]*?)\n\}/
)
assert.ok(matchCheck, 'isCheckConstraintError não encontrada em vendas.ts')

const isCheckConstraintError = new Function(
  'message',
  matchCheck![1]
) as (message: string | undefined) => boolean

function formDataComToggle(valor: string | null) {
  const formData = new FormData()
  if (valor !== null) {
    formData.set('venda_em_consultorio', valor)
  }
  return formData
}

test('@spec:AC-063 grava true quando origem é médico e toggle está marcado', () => {
  const resultado = resolverVendaEmConsultorio('medico', formDataComToggle('true'))
  assert.equal(resultado, true)
})

test('@spec:AC-063 grava false quando origem é médico e toggle está desmarcado', () => {
  const resultado = resolverVendaEmConsultorio('medico', formDataComToggle('false'))
  assert.equal(resultado, false)
})

test('@spec:AC-064 força null quando origem não é médico, mesmo com toggle enviado no FormData', () => {
  const resultado = resolverVendaEmConsultorio('leads', formDataComToggle('true'))
  assert.equal(resultado, null)
})

test('@spec:AC-064 venda legada (sem valor no FormData) fica null mesmo com origem médico', () => {
  const resultado = resolverVendaEmConsultorio('medico', formDataComToggle(null))
  assert.equal(resultado, null)
})

test('@spec:AC-063 mensagem amigável quando o banco rejeita pela CHECK constraint', () => {
  const resultado = isCheckConstraintError(
    'new row for relation "vendas" violates check constraint "vendas_consultorio_apenas_origem_medico"'
  )
  assert.equal(resultado, true)
})

test('erro de banco não relacionado à CHECK constraint não é classificado como tal', () => {
  const resultado = isCheckConstraintError('duplicate key value violates unique constraint')
  assert.equal(resultado, false)
})
