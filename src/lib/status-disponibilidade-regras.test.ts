import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  validarObservacao,
  ehStatusPersonalizado,
  opcoesSelecionaveis,
  podeEditarOpcao,
  blocoVencido,
  type OpcaoStatusRegra,
} from './status-disponibilidade-regras.ts'

function opcao(overrides: Partial<OpcaoStatusRegra> = {}): OpcaoStatusRegra {
  return { slug: 'reuniao', sistema: false, observacao_obrigatoria: false, ...overrides }
}

test('@spec:AC-001 recusa troca sem texto quando o status exige justificativa', () => {
  const exigeObservacao = opcao({ observacao_obrigatoria: true })

  const vazia = validarObservacao(exigeObservacao, '')
  assert.equal(vazia.valido, false)
  assert.match(!vazia.valido ? vazia.mensagem : '', /obrigatória/)

  const soEspacos = validarObservacao(exigeObservacao, '   ')
  assert.equal(soEspacos.valido, false)

  const nula = validarObservacao(exigeObservacao, null)
  assert.equal(nula.valido, false)
})

test('@spec:AC-002 aceita observação vazia quando o status não exige justificativa', () => {
  const naoExige = opcao({ observacao_obrigatoria: false })

  assert.equal(validarObservacao(naoExige, '').valido, true)
  assert.equal(validarObservacao(naoExige, undefined).valido, true)
  assert.equal(validarObservacao(naoExige, 'qualquer coisa').valido, true)
})

test('@spec:AC-001 aceita troca quando a observação exigida tem texto', () => {
  const exigeObservacao = opcao({ observacao_obrigatoria: true })
  assert.equal(validarObservacao(exigeObservacao, 'Reunião com fornecedor').valido, true)
})

test('@spec:AC-007 sinaliza bloco vencido quando aberto há mais de 1 hora', () => {
  const agora = new Date('2026-08-10T12:00:00Z')
  const abertoHa61Min = new Date('2026-08-10T10:59:00Z')
  const abertoHa59Min = new Date('2026-08-10T11:01:00Z')
  const abertoExatamente1h = new Date('2026-08-10T11:00:00Z')

  assert.equal(blocoVencido(abertoHa61Min, agora), true)
  assert.equal(blocoVencido(abertoHa59Min, agora), false)
  assert.equal(blocoVencido(abertoExatamente1h, agora), false)
})

test('@spec:AC-011 "Em atendimento" (ocupado, sistema) não é oferecido como escolha', () => {
  const catalogo: OpcaoStatusRegra[] = [
    { slug: 'disponivel', sistema: true, observacao_obrigatoria: false },
    { slug: 'reuniao', sistema: false, observacao_obrigatoria: false },
    { slug: 'ocupado', sistema: true, observacao_obrigatoria: false },
    { slug: 'ausente', sistema: true, observacao_obrigatoria: false },
  ]

  const selecionaveis = opcoesSelecionaveis(catalogo).map((o) => o.slug)

  assert.ok(!selecionaveis.includes('ocupado'), '"ocupado" não deveria ser selecionável')
  assert.ok(selecionaveis.includes('disponivel'), '"disponivel" deveria continuar selecionável')
  assert.ok(selecionaveis.includes('reuniao'), 'status personalizado deveria continuar selecionável')
  assert.ok(!selecionaveis.includes('ausente'), '"ausente" (sistema) não deveria ser selecionável')
})

test('@spec:AC-012 status de sistema não pode ser editado nem removido', () => {
  const deSistema = opcao({ sistema: true })
  const personalizado = opcao({ sistema: false })

  assert.equal(podeEditarOpcao(deSistema), false)
  assert.equal(podeEditarOpcao(personalizado), true)
})

test('ehStatusPersonalizado classifica corretamente sistema vs. declarado', () => {
  assert.equal(ehStatusPersonalizado(opcao({ sistema: true })), false)
  assert.equal(ehStatusPersonalizado(opcao({ sistema: false })), true)
})
