import test from 'node:test'
import assert from 'node:assert/strict'
import { slugOrigem, mapaRotulosOrigem, rotuloOrigem, origensParaOpcoes } from './origens-venda'

test('slugOrigem remove acentos e normaliza separadores', () => {
  assert.equal(slugOrigem('Indicação de Paciente'), 'indicacao_de_paciente')
  assert.equal(slugOrigem('  Instagram / Ads! '), 'instagram_ads')
  assert.equal(slugOrigem('!!!'), '')
})

test('rotuloOrigem usa o cadastro e cai para o valor quando não encontra', () => {
  const rotulos = mapaRotulosOrigem([{ valor: 'medico', nome: 'Médico' }])
  assert.equal(rotuloOrigem(rotulos, 'medico'), 'Médico')
  assert.equal(rotuloOrigem(rotulos, 'antiga'), 'antiga')
  assert.equal(rotuloOrigem(rotulos, null), 'Sem origem')
})

test('origensParaOpcoes converte cadastro em opções de formulário', () => {
  assert.deepEqual(origensParaOpcoes([{ valor: 'leads', nome: 'Leads' }]), [{ value: 'leads', label: 'Leads' }])
})
