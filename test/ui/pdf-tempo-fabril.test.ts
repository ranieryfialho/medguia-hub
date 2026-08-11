/**
 * Asserções estáticas sobre a exportação PDF do Tempo Fábril (ASM-005).
 *
 * O PDF não é testável por execução como o Markdown: `gerarPdfTempoFabril`
 * importa `jspdf` dinamicamente e desenha num canvas. O que dá para travar é a
 * forma — colunas, larguras e o uso da regra de classificação.
 *
 * Ver .spec/features/status-personalizados-ciclo-vida/spec.md (AC-034 a AC-036)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fonte = readFileSync(
  path.join(__dirname, '../../src/lib/relatorios/pdf-tempo-fabril.ts'),
  'utf-8',
)

test('@spec:AC-036 a conferência de status do PDF tem coluna de Motivo', () => {
  assert.match(fonte, /const headers = \['Status', 'Motivo', 'Início', 'Fim', 'Duração'\]/)
  assert.match(fonte, /s\.observacao/)
})

test('@spec:AC-036 as larguras da tabela somam a largura útil da página', () => {
  // CONTENT_WIDTH = 210 - 16*2 = 178mm. Somar diferente desalinha a tabela em
  // relação a todas as outras do documento, ou a faz sangrar para fora da margem.
  const match = fonte.match(/const widths = \[(40, 52, 34, 34, 18)\]/)
  assert.ok(match, 'as larguras da tabela de status precisam estar declaradas')

  const soma = match![1].split(',').reduce((acc, n) => acc + Number(n.trim()), 0)
  assert.equal(soma, 178, 'a soma precisa bater com CONTENT_WIDTH')
})

test('@spec:AC-036 a coluna de texto livre é alinhada à esquerda', () => {
  // O padrão histórico é "primeira à esquerda, resto à direita" — bom para
  // números, péssimo para o Motivo, que ficaria colado na borda direita.
  assert.match(fonte, /aligns: \('left' \| 'right'\)\[\] = \['left', 'left', 'right', 'right', 'right'\]/)
})

test('@spec:AC-036 o texto é cortado, nunca quebrado em várias linhas', () => {
  // A linha tem altura fixa de 8mm. `maxWidth` do jsPDF QUEBRA o texto, e as
  // linhas extras transbordam para cima da linha seguinte. Com a coluna Motivo,
  // que é texto livre, isso deixaria de ser hipótese.
  assert.match(fonte, /function truncarParaLargura/)
  assert.match(fonte, /truncarParaLargura\(doc, value/)
  assert.doesNotMatch(fonte, /maxWidth: widths\[index\]/)
})

test('@spec:AC-035 o PDF usa a mesma regra de classificação da tela', () => {
  assert.match(fonte, /import \{ classificarBloco \} from '@\/lib\/status-disponibilidade-regras'/)
  assert.match(fonte, /classificarBloco\(s\.duracaoMinutos, s\.aberto\) === 'expirado'/)
  assert.match(fonte, /Fechado automaticamente no teto de 2h/)
})
