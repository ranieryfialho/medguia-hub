/**
 * Asserções estáticas sobre a alimentação do catálogo de status nas telas (ASM-005).
 *
 * Este arquivo existe por causa de uma fronteira que AC-025 não cobria. Aquele
 * critério prova que o componente CONSOME a regra do contador — e provava, com
 * verde, enquanto a tela de disponibilidade estava quebrada. O que faltava era
 * provar que a página ALIMENTA o componente com o catálogo certo: sem `opcoes`,
 * o componente cai no DEFAULT_OPCOES de 4 slugs e todo status criado pelo
 * gestor perde rótulo, cor, ping e contador.
 *
 * Ver .spec/features/status-personalizados-ciclo-vida/spec.md (AC-030)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const ler = (relativo: string) => readFileSync(path.join(__dirname, '../../', relativo), 'utf-8')

const PAGINA_DISPONIBILIDADE = 'src/app/(painel)/configuracoes/disponibilidade/page.tsx'

test('@spec:AC-030 a página de disponibilidade busca o catálogo do banco', () => {
  const fonte = ler(PAGINA_DISPONIBILIDADE)
  assert.match(fonte, /listarStatusOpcoes/)
})

test('@spec:AC-030 toda montagem de StatusEquipeRealtime recebe o catálogo', () => {
  const fonte = ler(PAGINA_DISPONIBILIDADE)

  // Uma montagem sem `opcoes` é exatamente o defeito de 11/08 — e havia DUAS.
  // Contar as montagens e exigir que cada uma tenha a prop pega o caso de
  // consertar só a visão que se estava olhando.
  const montagens = fonte.match(/<StatusEquipeRealtime[\s\S]*?\/>/g) ?? []

  assert.ok(montagens.length >= 2, 'a página tem as visões geral e individual')

  for (const [i, montagem] of montagens.entries()) {
    assert.match(
      montagem,
      /\bopcoes=\{/,
      `a montagem ${i + 1} de StatusEquipeRealtime precisa receber opcoes`,
    )
  }
})

test('@spec:AC-030 o painel usa a regra de agrupamento, não decide sozinho', () => {
  const fonte = ler('src/components/features/equipe/StatusEquipeRealtime.tsx')

  assert.match(fonte, /agruparPainelEquipe/)
  assert.match(fonte, /from '@\/lib\/status-painel-equipe'/)
})
