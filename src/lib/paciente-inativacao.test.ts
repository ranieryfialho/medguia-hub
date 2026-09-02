import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deveExcluirFotoPorObito } from './paciente-inativacao.ts'

test('@spec:AC-112 inativação com óbito marcado deve excluir a foto', () => {
  assert.equal(deveExcluirFotoPorObito(false, true), true)
})

test('@spec:AC-113 inativação sem óbito não deve excluir a foto', () => {
  assert.equal(deveExcluirFotoPorObito(false, false), false)
})

test('@spec:AC-113 paciente permanecendo ativo não deve excluir a foto mesmo com óbito marcado', () => {
  assert.equal(deveExcluirFotoPorObito(true, true), false)
})
