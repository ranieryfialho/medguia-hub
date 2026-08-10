import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  montarCardsStatus,
  type ProfissionalCardInput,
  type DeclaracaoStatusInput,
  type OpcaoCatalogoInput,
} from './status-card-agenda.ts'

const OPCOES: OpcaoCatalogoInput[] = [
  { slug: 'disponivel', label: 'Disponível', cor: 'emerald' },
  { slug: 'reuniao', label: 'Em reunião', cor: 'amber' },
  { slug: 'ocupado', label: 'Em atendimento', cor: 'slate' },
  { slug: 'ausente', label: 'Ausente', cor: 'slate-light' },
]

function profissional(overrides: Partial<ProfissionalCardInput> = {}): ProfissionalCardInput {
  return { profissionalId: 'prof-1', nome: 'Dra. Ana', ativo: true, ...overrides }
}

function declaracao(overrides: Partial<DeclaracaoStatusInput> = {}): DeclaracaoStatusInput {
  return {
    profissionalId: 'prof-1',
    slug: 'reuniao',
    observacao: 'Reunião com fornecedor',
    iniciadoEm: new Date('2026-08-10T11:30:00Z'),
    ...overrides,
  }
}

test('@spec:AC-008 o card mostra nome, status com cor do catálogo, observação e tempo decorrido', () => {
  const agora = new Date('2026-08-10T12:05:00Z')

  const cards = montarCardsStatus([profissional()], [declaracao()], [], OPCOES, agora)

  assert.equal(cards.length, 1)
  const [card] = cards
  assert.equal(card.profissionalId, 'prof-1')
  assert.equal(card.nome, 'Dra. Ana')
  assert.equal(card.emAtendimento, false)
  assert.deepEqual(card.statusPrincipal, { slug: 'reuniao', label: 'Em reunião', cor: 'amber' })
  assert.equal(card.observacao, 'Reunião com fornecedor')
  assert.equal(card.tempoDecorridoMin, 35)
})

test('@spec:AC-009 com atendimento em curso, o principal é "Em atendimento" e a declaração vira secundária', () => {
  const agora = new Date('2026-08-10T12:05:00Z')

  const cards = montarCardsStatus(
    [profissional()],
    [declaracao()],
    ['prof-1'],
    OPCOES,
    agora,
  )

  assert.equal(cards.length, 1)
  const [card] = cards
  assert.equal(card.emAtendimento, true)
  assert.deepEqual(card.statusPrincipal, { slug: 'ocupado', label: 'Em atendimento', cor: 'slate' })
  // a declaração continua disponível como informação secundária: horário e observação
  assert.equal(card.observacao, 'Reunião com fornecedor')
  assert.equal(card.tempoDecorridoMin, 35)
  assert.deepEqual(card.iniciadoEm, new Date('2026-08-10T11:30:00Z'))
})

test('@spec:AC-020 com atendimento em curso, o rótulo declarado continua legível ao lado da observação', () => {
  const cards = montarCardsStatus(
    [profissional()],
    [declaracao()],
    ['prof-1'],
    OPCOES,
    new Date('2026-08-10T12:05:00Z'),
  )

  const [card] = cards
  // sem isto a tela mostraria: Em atendimento / "Reunião com fornecedor"
  // e o leitor entenderia que a observação descreve o atendimento.
  assert.deepEqual(card.declaracao, { slug: 'reuniao', label: 'Em reunião', cor: 'amber' })
  assert.equal(card.statusPrincipal.label, 'Em atendimento')
})

test('@spec:AC-020 sem atendimento em curso não há declaração secundária a exibir', () => {
  const cards = montarCardsStatus(
    [profissional()],
    [declaracao()],
    [],
    OPCOES,
    new Date('2026-08-10T12:05:00Z'),
  )

  // o status principal JÁ é a declaração — repeti-la ao lado seria redundante
  assert.equal(cards[0].declaracao, null)
  assert.equal(cards[0].statusPrincipal.label, 'Em reunião')
})

test('@spec:AC-010 profissional desligado não aparece no card, mesmo com declaração remanescente', () => {
  const desligado = profissional({ profissionalId: 'prof-2', nome: 'Dr. Bruno', ativo: false })
  const declaracaoRemanescente = declaracao({ profissionalId: 'prof-2' })

  const cards = montarCardsStatus([desligado], [declaracaoRemanescente], [], OPCOES, new Date())

  assert.equal(cards.length, 0)
})

test('@spec:AC-010 filtra só o profissional desligado quando há mais de um na lista', () => {
  const ativo = profissional({ profissionalId: 'prof-1' })
  const desligado = profissional({ profissionalId: 'prof-2', nome: 'Dr. Bruno', ativo: false })

  const cards = montarCardsStatus(
    [ativo, desligado],
    [declaracao({ profissionalId: 'prof-1' }), declaracao({ profissionalId: 'prof-2' })],
    [],
    OPCOES,
    new Date('2026-08-10T12:05:00Z'),
  )

  assert.equal(cards.length, 1)
  assert.equal(cards[0].profissionalId, 'prof-1')
})

test('opção fora do catálogo cai num rótulo de fallback em vez de quebrar', () => {
  const cards = montarCardsStatus(
    [profissional()],
    [declaracao({ slug: 'inexistente' })],
    [],
    OPCOES,
    new Date('2026-08-10T12:05:00Z'),
  )

  assert.deepEqual(cards[0].statusPrincipal, { slug: 'inexistente', label: 'inexistente', cor: 'slate' })
})
