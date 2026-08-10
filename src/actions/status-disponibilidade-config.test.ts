import { test } from 'node:test'
import assert from 'node:assert/strict'
import { podeGerenciarOpcao } from './status-disponibilidade-config.ts'

import type { OpcaoStatusRegra } from '../lib/status-disponibilidade-regras.ts'

const STATUS_DE_SISTEMA: OpcaoStatusRegra = {
  slug: 'ocupado',
  sistema: true,
  observacao_obrigatoria: false,
}

const STATUS_PERSONALIZADO: OpcaoStatusRegra = {
  slug: 'reuniao',
  sistema: false,
  observacao_obrigatoria: false,
}

test('@spec:AC-012 recusa gerenciar (editar/remover) um status de sistema', async () => {
  const resultado = await podeGerenciarOpcao(STATUS_DE_SISTEMA)
  assert.equal(resultado.valido, false)
  if (!resultado.valido) assert.match(resultado.mensagem, /sistema/i)
})

test('@spec:AC-012 permite gerenciar um status personalizado', async () => {
  const resultado = await podeGerenciarOpcao(STATUS_PERSONALIZADO)
  assert.equal(resultado.valido, true)
})

test('opção fora do catálogo não é bloqueada pela guarda de gerenciamento', async () => {
  const resultado = await podeGerenciarOpcao(null)
  assert.equal(resultado.valido, true)
})
