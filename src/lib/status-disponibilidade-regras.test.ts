import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  validarObservacao,
  ehStatusPersonalizado,
  opcoesSelecionaveis,
  podeEditarOpcao,
  blocoVencido,
  formularioDaOpcao,
  FORMULARIO_OPCAO_VAZIO,
  type OpcaoStatusRegra,
} from './status-disponibilidade-regras.ts'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

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

// ─── AC-021 — o gestor consegue marcar quais status exigem justificativa ──────

test('@spec:AC-021 o formulário carrega a exigência já configurada na opção', () => {
  const exigente = formularioDaOpcao({
    label: 'Em reunião',
    label_curto: 'reunião',
    cor: 'amber',
    observacao_obrigatoria: true,
  })

  // Este é o elo que faltava: sem ele, abrir a edição para trocar a cor
  // devolveria false e apagaria a marcação ao salvar.
  assert.equal(exigente.observacao_obrigatoria, true)

  const naoExigente = formularioDaOpcao({
    label: 'Almoço',
    label_curto: 'almoço',
    cor: 'slate',
    observacao_obrigatoria: false,
  })
  assert.equal(naoExigente.observacao_obrigatoria, false)
})

test('@spec:AC-021 opção sem o campo definido não vira undefined no formulário', () => {
  const form = formularioDaOpcao({ label: 'X', label_curto: 'x', cor: 'amber' })

  // Precisa ser false de verdade — undefined desmarcaria o checkbox de forma
  // não-controlada e o React reclamaria da troca controlado/não-controlado.
  assert.equal(form.observacao_obrigatoria, false)
})

test('@spec:AC-021 o formulário vazio traz o campo, para que criar já possa marcar', () => {
  assert.ok(
    'observacao_obrigatoria' in FORMULARIO_OPCAO_VAZIO,
    'criar um status sem o campo no estado inicial faz a action receber undefined',
  )
  assert.equal(FORMULARIO_OPCAO_VAZIO.observacao_obrigatoria, false)
})

test('@spec:AC-021 a tela de configuração liga um controle ao campo', () => {
  // As asserções acima provam o modelo; esta guarda o fio até o JSX, que
  // node --test não renderiza. É exatamente a ligação que faltava quando a
  // regra existia inteira e nunca disparava.
  const componente = readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '../components/features/configuracoes/GerenciadorStatusDisponibilidade.tsx',
    ),
    'utf-8',
  )

  assert.match(
    componente,
    /type="checkbox"[\s\S]{0,200}observacao_obrigatoria/,
    'o formulário precisa de um controle ligado a observacao_obrigatoria',
  )
  assert.match(
    componente,
    /formularioDaOpcao\(op\)/,
    'a edição precisa carregar o estado salvo, não montar o formulário à mão',
  )
})
