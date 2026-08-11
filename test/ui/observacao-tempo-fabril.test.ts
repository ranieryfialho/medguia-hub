/**
 * Asserções estáticas sobre a cadeia da observação até o Tempo Fábril (ASM-005).
 *
 * A observação atravessa cinco arquivos entre o banco e a tela: consulta →
 * tipo do histórico → tipo do detalhe → montagem do detalhe → coluna da tabela.
 * Basta um elo faltar para o dado sumir em silêncio — e foi o que aconteceu:
 * a coluna existe em produção desde 10/08, o gatilho a preenche, e o relatório
 * nunca a selecionou. AC-003 provava a escrita; nada provava a leitura.
 *
 * Cada teste aqui trava um elo.
 *
 * Ver .spec/features/status-personalizados-ciclo-vida/spec.md (AC-034, AC-035)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ler = (relativo: string) => readFileSync(path.join(__dirname, '../../', relativo), 'utf-8')

test('@spec:AC-034 a consulta do relatório traz a observação — nos dois recortes', () => {
  const fonte = ler('src/app/(painel)/relatorios/tempo-fabril/page.tsx')

  // Blocos fechados no período E blocos ainda abertos. Faltar em um dos dois
  // deixaria metade da conferência sem motivo, do jeito mais difícil de notar.
  const selects = fonte.match(/\.select\('id, profissional_id, status[^']*'\)/g) ?? []

  assert.ok(selects.length >= 2, 'a página consulta o histórico fechado e o aberto')
  for (const [i, select] of selects.entries()) {
    assert.match(select, /observacao/, `o select ${i + 1} do histórico precisa trazer observacao`)
  }
})

test('@spec:AC-034 o modelo do detalhe carrega a observação', () => {
  const fonte = ler('src/lib/relatorios/kpis-tempo-fabril.ts')

  assert.match(fonte, /StatusDetalheKPI = \{[\s\S]*?observacao: string \| null/)
  // E precisa ser realmente copiada nas duas montagens (fechados e abertos),
  // não só declarada no tipo.
  const atribuicoes = fonte.match(/observacao: h\.observacao/g) ?? []
  assert.equal(atribuicoes.length, 2, 'fechados e abertos precisam copiar a observação')
})

test('@spec:AC-034 a tabela do relatório tem coluna de motivo', () => {
  const fonte = ler('src/components/features/relatorios/TabelaTempoFabril.tsx')

  assert.match(fonte, /<th[^>]*>Motivo<\/th>/)
  assert.match(fonte, /s\.observacao/)
})

test('@spec:AC-035 o alerta vermelho deriva do teto, não é número solto', () => {
  const fonte = ler('src/components/features/relatorios/TabelaTempoFabril.tsx')

  // Era 110 fixo. Um limiar solto perde o sentido a cada mudança de teto —
  // já perdeu duas vezes em dois dias.
  assert.match(fonte, /LIMITE_ALERTA_MIN = LIMITE_BLOCO_MIN/)
  assert.doesNotMatch(fonte, /LIMITE_ALERTA_MIN = \d+/)
})

test('@spec:AC-035 a tabela distingue expirado de anômalo', () => {
  const fonte = ler('src/components/features/relatorios/TabelaTempoFabril.tsx')

  assert.match(fonte, /classificarBloco/)
  assert.match(fonte, /expirou/)
})
