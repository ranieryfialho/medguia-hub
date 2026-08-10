import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validarTrocaDeStatus } from './status-disponibilidade.ts'
import type { OpcaoStatusRegra } from '../lib/status-disponibilidade-regras.ts'

const REUNIAO_COM_OBSERVACAO_OBRIGATORIA: OpcaoStatusRegra = {
  slug: 'reuniao',
  sistema: false,
  observacao_obrigatoria: true,
}

const AUSENTE_SEM_EXIGENCIA: OpcaoStatusRegra = {
  slug: 'ausente',
  sistema: true,
  observacao_obrigatoria: false,
}

test('@spec:AC-001 recusa a troca quando o status exige observação e ela vem vazia', async () => {
  const resultado = await validarTrocaDeStatus(REUNIAO_COM_OBSERVACAO_OBRIGATORIA, '')
  assert.equal(resultado.valido, false)
  if (!resultado.valido) assert.match(resultado.mensagem, /obrigat/i)
})

test('@spec:AC-001 recusa a troca quando a observação só tem espaços', async () => {
  const resultado = await validarTrocaDeStatus(REUNIAO_COM_OBSERVACAO_OBRIGATORIA, '   ')
  assert.equal(resultado.valido, false)
})

test('@spec:AC-001 aceita a troca quando a observação exigida vem preenchida', async () => {
  const resultado = await validarTrocaDeStatus(REUNIAO_COM_OBSERVACAO_OBRIGATORIA, 'Reunião com fornecedor')
  assert.equal(resultado.valido, true)
})

test('@spec:AC-002 aceita a troca sem observação quando o status não exige justificativa', async () => {
  const resultado = await validarTrocaDeStatus(AUSENTE_SEM_EXIGENCIA, '')
  assert.equal(resultado.valido, true)
})

test('@spec:AC-002 aceita a troca com observação ausente (undefined) quando não é exigida', async () => {
  const resultado = await validarTrocaDeStatus(AUSENTE_SEM_EXIGENCIA, undefined)
  assert.equal(resultado.valido, true)
})

test('opção fora do catálogo não é bloqueada pela validação da action', async () => {
  const resultado = await validarTrocaDeStatus(null, '')
  assert.equal(resultado.valido, true)
})
