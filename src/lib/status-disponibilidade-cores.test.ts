import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_OPCOES } from './status-disponibilidade-cores.ts'

test('@spec:AC-011 "ocupado" está reclassificado como status de sistema', () => {
  const ocupado = DEFAULT_OPCOES.find((o) => o.slug === 'ocupado')
  assert.ok(ocupado, 'opção "ocupado" deve existir no catálogo')
  assert.equal(ocupado!.sistema, true)
})

test('@spec:AC-013 rótulo de "ocupado" muda para "Em atendimento", identificador permanece', () => {
  const ocupado = DEFAULT_OPCOES.find((o) => o.slug === 'ocupado')
  assert.ok(ocupado, 'opção "ocupado" deve existir no catálogo')
  assert.equal(ocupado!.slug, 'ocupado')
  assert.equal(ocupado!.label, 'Em atendimento')
})
