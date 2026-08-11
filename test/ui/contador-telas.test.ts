/**
 * Asserções estáticas sobre os componentes que exibem o contador (ASM-005).
 *
 * Não renderizam JSX — não há runner de componente neste projeto. O que estas
 * asserções travam é a regressão que já aconteceu uma vez aqui: em T-010 a
 * regra existia, a action aceitava o campo, e a tela nunca o enviava. A regra
 * passava nos testes e não fazia nada. AC-021 nasceu disso.
 *
 * O contador corre o mesmo risco por três vezes: três telas, uma regra. Se
 * alguma reimplementar a conta inline, o teto de 2h passa a ter quatro fontes
 * da verdade — a classe de defeito que o RFC 002 inteiro combate.
 *
 * Ver .spec/features/status-personalizados-ciclo-vida/spec.md (AC-025)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const ler = (relativo: string) =>
  readFileSync(path.join(__dirname, '../../', relativo), 'utf-8')

const TELAS = [
  {
    nome: 'card da agenda',
    arquivo: 'src/components/features/agenda/CardStatusEquipe.tsx',
  },
  {
    nome: 'widget global de disponibilidade',
    arquivo: 'src/components/features/configuracoes/WidgetDisponibilidade.tsx',
  },
  {
    nome: 'Configurações → Disponibilidade',
    arquivo: 'src/components/features/equipe/StatusEquipeRealtime.tsx',
  },
]

for (const tela of TELAS) {
  test(`@spec:AC-025 ${tela.nome} importa a regra do contador`, () => {
    const fonte = ler(tela.arquivo)

    assert.match(
      fonte,
      /from '@\/lib\/status-disponibilidade-regras'/,
      'a tela precisa importar do módulo de regras, não reimplementar a conta',
    )
    assert.match(fonte, /tempoRestanteBlocoMs/)
    assert.match(fonte, /formatarContagemRegressiva/)
  })

  test(`@spec:AC-025 ${tela.nome} não reimplementa o teto de 2 horas`, () => {
    const fonte = ler(tela.arquivo)

    // Qualquer aritmética de duas horas escrita à mão na tela é uma segunda
    // fonte da verdade para o prazo. O teto mora em LIMITE_BLOCO_MS e só lá.
    assert.doesNotMatch(fonte, /2\s*\*\s*60\s*\*\s*60\s*\*\s*1000/)
    assert.doesNotMatch(fonte, /7_?200_?000/)
  })

  test(`@spec:AC-029 ${tela.nome} recarrega o estado sem depender do Realtime`, () => {
    const fonte = ler(tela.arquivo)

    // Entre junho e 11/08 a tabela esteve fora da publicação `supabase_realtime`
    // e nenhum evento chegou. O widget e a tela de Configurações sobreviveram
    // pelo polling de useRealtimeDisponibilidade; o card da agenda, que não o
    // tinha, ficou congelado. As três telas precisam de rede — direta ou pelo hook.
    const temRedePropria = /setInterval\([\s\S]{0,160}?,\s*60_?000\s*\)/.test(fonte)
    const herdaRedeDoHook = /useRealtimeDisponibilidade/.test(fonte)

    assert.ok(
      temRedePropria || herdaRedeDoHook,
      'a tela precisa reler o estado periodicamente, por conta própria ou pelo hook',
    )
  })

  test(`@spec:AC-025 ${tela.nome} tem relógio para o contador correr`, () => {
    const fonte = ler(tela.arquivo)

    // Sem um setInterval, o contador é calculado uma vez e congela — pareceria
    // funcionar na primeira renderização e mentiria a partir do segundo seguinte.
    assert.match(fonte, /setInterval/)
    assert.match(
      fonte,
      /setInterval\([\s\S]{0,120}?,\s*1_?000\s*\)/,
      'a cadência precisa ser de 1s: com 30s o número pularia de 47:05 para 46:35',
    )
  })
}
