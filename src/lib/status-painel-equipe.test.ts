/**
 * Testes do agrupamento do painel "Status agora".
 * Ver .spec/features/status-personalizados-ciclo-vida/spec.md (AC-031, AC-032)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  agruparPainelEquipe,
  ehDeclarado,
  type OpcaoPainel,
} from './status-painel-equipe.ts'

const AGORA = new Date('2026-08-11T15:00:00Z')

const opcao = (over: Partial<OpcaoPainel> & { slug: string }): OpcaoPainel => ({
  label: over.slug,
  label_curto: over.slug,
  cor: 'amber',
  ordem: 10,
  sistema: false,
  ...over,
})

const CATALOGO: OpcaoPainel[] = [
  opcao({ slug: 'disponivel', label: 'Disponível', cor: 'emerald', ordem: 0, sistema: true }),
  opcao({ slug: 'ocupado', label: 'Em atendimento', cor: 'slate', ordem: 2, sistema: true }),
  opcao({ slug: 'ausente', label: 'Ausente', cor: 'slate-light', ordem: 99, sistema: true }),
  opcao({ slug: 'reuniao', label: 'Em reunião', ordem: 1 }),
  opcao({ slug: 'hora_administrativa_1784653432533', label: 'Hora administrativa', ordem: 3 }),
]

test('@spec:AC-031 status fora do catálogo é tratado como declarado, não como sistema', () => {
  // O padrão contrário foi o que escondeu o defeito: sem catálogo, todo status
  // do gestor virava chip cinza sem contador, indistinguível de status de sistema.
  assert.equal(ehDeclarado('gravacao_123', undefined), true)
  assert.equal(ehDeclarado('hora_administrativa_1784653432533', undefined), true)

  // Os três de sistema continuam reconhecidos mesmo sem catálogo — são fixos.
  assert.equal(ehDeclarado('disponivel', undefined), false)
  assert.equal(ehDeclarado('ausente', undefined), false)
  assert.equal(ehDeclarado('ocupado', undefined), false)
})

test('@spec:AC-031 com catálogo, quem manda é o campo sistema', () => {
  assert.equal(ehDeclarado('reuniao', CATALOGO.find((o) => o.slug === 'reuniao')), true)
  assert.equal(ehDeclarado('ocupado', CATALOGO.find((o) => o.slug === 'ocupado')), false)
})

test('@spec:AC-030 status personalizado do catálogo aparece com rótulo, não com identificador', () => {
  const painel = agruparPainelEquipe(
    [{ id: 'p1', nome: 'Luana Arruda' }],
    [{ profissional_id: 'p1', status: 'hora_administrativa_1784653432533', atualizado_em: '2026-08-11T14:42:00Z' }],
    CATALOGO,
    {},
    AGORA,
  )

  assert.equal(painel.declarados.length, 1)
  assert.equal(painel.declarados[0].label, 'Hora administrativa')
  assert.notEqual(painel.declarados[0].label, 'hora_administrativa_1784653432533')
})

test('@spec:AC-030 sem catálogo o identificador aparece cru — mas ainda como declarado', () => {
  // Este é o estado da tela ANTES da correção. O teste o documenta para que a
  // regressão seja visível: o rótulo feio denuncia catálogo faltando, e o item
  // continua na lista de declarados, com contador, em vez de sumir no meio dos livres.
  const painel = agruparPainelEquipe(
    [{ id: 'p1', nome: 'Luana Arruda' }],
    [{ profissional_id: 'p1', status: 'hora_administrativa_1784653432533', atualizado_em: '2026-08-11T14:42:00Z' }],
    [],
    {},
    AGORA,
  )

  assert.equal(painel.declarados.length, 1)
  assert.equal(painel.declarados[0].label, 'hora_administrativa_1784653432533')
  assert.ok(painel.declarados[0].restanteMs > 0, 'o contador precisa funcionar mesmo sem catálogo')
})

test('@spec:AC-032 separa declarados de livres, ausentes e em atendimento', () => {
  const painel = agruparPainelEquipe(
    [
      { id: 'p1', nome: 'Luana' },
      { id: 'p2', nome: 'Rafael' },
      { id: 'p3', nome: 'Victor' },
      { id: 'p4', nome: 'Myla' },
    ],
    [
      { profissional_id: 'p1', status: 'reuniao', atualizado_em: '2026-08-11T14:30:00Z' },
      { profissional_id: 'p2', status: 'disponivel', atualizado_em: '2026-08-11T15:00:00Z' },
      { profissional_id: 'p3', status: 'ocupado', atualizado_em: '2026-08-11T15:00:00Z' },
      { profissional_id: 'p4', status: 'ausente', atualizado_em: '2026-08-11T15:00:00Z' },
    ],
    CATALOGO,
    {},
    AGORA,
  )

  assert.deepEqual(painel.declarados.map((d) => d.nome), ['Luana'])
  assert.deepEqual(painel.livres.map((d) => d.nome), ['Rafael'])
  assert.deepEqual(painel.emAtendimento.map((d) => d.nome), ['Victor'])
  assert.deepEqual(painel.ausentes.map((d) => d.nome), ['Myla'])
})

test('@spec:AC-032 declarados vêm ordenados por urgência — menor prazo primeiro', () => {
  const painel = agruparPainelEquipe(
    [
      { id: 'p1', nome: 'Começou agora' },
      { id: 'p2', nome: 'Já expirou' },
      { id: 'p3', nome: 'Meio do caminho' },
    ],
    [
      { profissional_id: 'p1', status: 'reuniao', atualizado_em: '2026-08-11T14:55:00Z' },
      { profissional_id: 'p2', status: 'reuniao', atualizado_em: '2026-08-11T09:00:00Z' },
      { profissional_id: 'p3', status: 'reuniao', atualizado_em: '2026-08-11T14:00:00Z' },
    ],
    CATALOGO,
    {},
    AGORA,
  )

  assert.deepEqual(
    painel.declarados.map((d) => d.nome),
    ['Já expirou', 'Meio do caminho', 'Começou agora'],
  )
  assert.equal(painel.declarados[0].vencido, true)
  assert.equal(painel.declarados[2].vencido, false)
})

test('@spec:AC-032 o motivo declarado acompanha a pessoa', () => {
  const painel = agruparPainelEquipe(
    [{ id: 'p1', nome: 'Luana' }],
    [{ profissional_id: 'p1', status: 'reuniao', atualizado_em: '2026-08-11T14:42:00Z' }],
    CATALOGO,
    { p1: 'Contato Lead instituto' },
    AGORA,
  )

  assert.equal(painel.declarados[0].observacao, 'Contato Lead instituto')
})

test('@spec:AC-032 profissional sem linha de status cai em ausente, não some', () => {
  const painel = agruparPainelEquipe(
    [{ id: 'p1', nome: 'Sem registro' }],
    [],
    CATALOGO,
    {},
    AGORA,
  )

  assert.deepEqual(painel.ausentes.map((d) => d.nome), ['Sem registro'])
})
