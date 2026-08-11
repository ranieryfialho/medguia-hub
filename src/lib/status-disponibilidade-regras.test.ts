import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  validarObservacao,
  ehStatusPersonalizado,
  opcoesSelecionaveis,
  podeEditarOpcao,
  blocoVencido,
  tempoRestanteBlocoMs,
  formatarContagemRegressiva,
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

test('@spec:AC-007 sinaliza bloco vencido quando aberto há mais de 2 horas', () => {
  const agora = new Date('2026-08-10T12:00:00Z')
  const abertoHa2h01 = new Date('2026-08-10T09:59:00Z')
  const abertoHa1h59 = new Date('2026-08-10T10:01:00Z')
  const abertoExatamente2h = new Date('2026-08-10T10:00:00Z')

  assert.equal(blocoVencido(abertoHa2h01, agora), true)
  assert.equal(blocoVencido(abertoHa1h59, agora), false)
  // Exatamente no teto ainda não venceu — quem vence é quem PASSOU dele.
  assert.equal(blocoVencido(abertoExatamente2h, agora), false)
})

test('@spec:AC-022 o tempo restante é o teto menos o decorrido', () => {
  const agora = new Date('2026-08-10T12:00:00Z')

  // Recém-aberto: o teto inteiro.
  assert.equal(tempoRestanteBlocoMs(new Date('2026-08-10T12:00:00Z'), agora), 2 * 60 * 60 * 1000)
  // Aberto há uma hora: metade.
  assert.equal(tempoRestanteBlocoMs(new Date('2026-08-10T11:00:00Z'), agora), 60 * 60 * 1000)
  // Aberto há 13 min: 1h47 restantes — o exemplo que AC-023 formata.
  assert.equal(tempoRestanteBlocoMs(new Date('2026-08-10T11:47:00Z'), agora), (60 + 47) * 60 * 1000)
  // Aberto há 1h47: 13 min restantes.
  assert.equal(tempoRestanteBlocoMs(new Date('2026-08-10T10:13:00Z'), agora), 13 * 60 * 1000)
})

test('@spec:AC-022 o tempo restante nunca é negativo', () => {
  const agora = new Date('2026-08-10T12:00:00Z')

  // Exatamente no teto: zerado.
  assert.equal(tempoRestanteBlocoMs(new Date('2026-08-10T10:00:00Z'), agora), 0)
  // Esquecido há 5 horas — o caso real de produção em 10/08, que chegou a 2d20h.
  // Sem o piso em zero isto seria -3h e o contador correria ao contrário na tela.
  assert.equal(tempoRestanteBlocoMs(new Date('2026-08-10T07:00:00Z'), agora), 0)
})

test('@spec:AC-023 acima de uma hora o contador aparece em horas e minutos', () => {
  assert.equal(formatarContagemRegressiva(2 * 60 * 60 * 1000), '2h00')
  assert.equal(formatarContagemRegressiva((60 + 47) * 60 * 1000), '1h47')
  // Um minuto acima da hora cheia ainda é faixa de horas — e o minuto vem
  // com zero à esquerda, senão "1h5" se lê como uma hora e cinquenta.
  assert.equal(formatarContagemRegressiva((60 + 5) * 60 * 1000), '1h05')
})

test('@spec:AC-023 abaixo de uma hora o contador aparece em minutos e segundos', () => {
  assert.equal(formatarContagemRegressiva(47 * 60 * 1000 + 5_000), '47:05')
  assert.equal(formatarContagemRegressiva(60 * 60 * 1000 - 1_000), '59:59')
  assert.equal(formatarContagemRegressiva(9_000), '00:09')
})

test('@spec:AC-024 ao zerar, o contador para e o bloco fica marcado como expirado', () => {
  const agora = new Date('2026-08-10T12:00:00Z')
  const vencidoHa3h = new Date('2026-08-10T09:00:00Z')

  // A janela real: o bloco venceu, mas o cron só passa a cada 10 minutos.
  // Nesse intervalo a tela mostra "expirado" — não some, nem conta ao contrário.
  assert.equal(blocoVencido(vencidoHa3h, agora), true)
  assert.equal(formatarContagemRegressiva(tempoRestanteBlocoMs(vencidoHa3h, agora)), 'expirado')

  // E o rótulo não muda conforme o atraso aumenta: parado é parado.
  const vencidoHa2Dias = new Date('2026-08-08T12:00:00Z')
  assert.equal(formatarContagemRegressiva(tempoRestanteBlocoMs(vencidoHa2Dias, agora)), 'expirado')
})

test('@spec:AC-026 o contador é derivado da abertura, sem depender de evento novo do banco', () => {
  // Mesmo bloco, dois instantes de leitura: o valor muda só com o relógio.
  // Nenhum parâmetro representa "chegou aviso do Realtime" — não existe entrada
  // para isso, então não há como o contador ficar refém dela.
  const abertura = new Date('2026-08-10T10:00:00Z')

  assert.equal(
    formatarContagemRegressiva(tempoRestanteBlocoMs(abertura, new Date('2026-08-10T10:30:00Z'))),
    '1h30',
  )
  assert.equal(
    formatarContagemRegressiva(tempoRestanteBlocoMs(abertura, new Date('2026-08-10T11:15:00Z'))),
    '45:00',
  )
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

test('@spec:AC-033 status removido pelo gestor sai da escolha, mas não da exibição', () => {
  // O catálogo de exibição inclui removidos, para que blocos já registrados sob
  // eles não percam o rótulo no Tempo Fábril. Cabe a esta regra tirá-los da
  // lista de escolha — antes isso vinha do WHERE da consulta, fora de teste.
  const catalogoCompleto: OpcaoStatusRegra[] = [
    { slug: 'disponivel', sistema: true, observacao_obrigatoria: false, ativo: true },
    { slug: 'reuniao', sistema: false, observacao_obrigatoria: true, ativo: true },
    { slug: 'gravacao_mkt_1784656463413', sistema: false, observacao_obrigatoria: false, ativo: false },
  ]

  const selecionaveis = opcoesSelecionaveis(catalogoCompleto).map(o => o.slug)

  assert.deepEqual(selecionaveis, ['disponivel', 'reuniao'])
  assert.ok(
    !selecionaveis.includes('gravacao_mkt_1784656463413'),
    'um status removido não pode voltar a ser oferecido',
  )
})

test('@spec:AC-033 opção sem o campo ativo é tratada como ativa', () => {
  // Vários chamadores montam a opção só com o que a validação precisa. Ausência
  // do campo não pode significar "removido", ou o widget ficaria sem escolhas.
  const semCampo: OpcaoStatusRegra[] = [
    { slug: 'reuniao', sistema: false, observacao_obrigatoria: false },
  ]

  assert.deepEqual(opcoesSelecionaveis(semCampo).map(o => o.slug), ['reuniao'])
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
