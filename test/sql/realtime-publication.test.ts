/**
 * Asserções estáticas sobre a migration que publica status_disponibilidade
 * para o Realtime (ASM-002).
 *
 * Ver .spec/features/status-personalizados-ciclo-vida/spec.md (AC-028, Q-002)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const arquivo = readFileSync(
  path.join(__dirname, '../../database/realtime_status_disponibilidade_publication.sql'),
  'utf-8',
)

/**
 * Só os comandos, sem as linhas de comentário.
 *
 * O cabeçalho desta migration cita `alter publication ... add table` ao explicar
 * a causa-raiz. Asserção de ORDEM sobre o texto cru encontraria essa citação
 * antes do comando de verdade e reprovaria a migration correta — a prosa que
 * documenta o defeito não pode ser confundida com o defeito.
 */
const sql = arquivo
  .split('\n')
  .filter((linha) => !/^\s*--/.test(linha))
  .join('\n')

test('@spec:AC-028 adiciona status_disponibilidade à publicação supabase_realtime', () => {
  assert.match(
    sql,
    /ALTER PUBLICATION supabase_realtime ADD TABLE public\.status_disponibilidade/i,
  )
})

test('@spec:AC-028 a adição é guardada, para poder ser reexecutada', () => {
  // O comando solto é o defeito que causou este bug: ALTER PUBLICATION ADD TABLE
  // erra com "already member of publication" na segunda execução. Uma migration
  // que quebra ao ser reaplicada some do processo na primeira recriação do
  // banco — foi exatamente o que aconteceu na mudança para o self-hosted.
  assert.match(sql, /DO \$\$/)
  assert.match(sql, /IF NOT EXISTS\s*\(/i)
  assert.match(sql, /FROM pg_publication_tables/i)

  const indiceGuarda = sql.search(/IF NOT EXISTS\s*\(/i)
  const indiceAlter = sql.search(/ALTER PUBLICATION/i)
  assert.ok(
    indiceGuarda !== -1 && indiceGuarda < indiceAlter,
    'a guarda precisa vir antes do ALTER, senão não guarda nada',
  )
})

test('@spec:AC-028 a guarda casa schema, publicação e tabela', () => {
  // Sem o schema, uma tabela homônima em outro schema satisfaria a guarda e o
  // ALTER nunca rodaria — a migration passaria em silêncio sem corrigir nada.
  const blocoGuarda = sql.slice(sql.search(/IF NOT EXISTS/i), sql.search(/ALTER PUBLICATION/i))

  assert.match(blocoGuarda, /pubname\s*=\s*'supabase_realtime'/i)
  assert.match(blocoGuarda, /schemaname\s*=\s*'public'/i)
  assert.match(blocoGuarda, /tablename\s*=\s*'status_disponibilidade'/i)
})

test('@spec:AC-028 traz a conferência do resultado', () => {
  // A migration precisa dizer se funcionou. Sem isso, aplicar é um ato de fé —
  // e foi a fé no `alter publication` de 2 meses atrás que produziu este bug.
  const posAlter = sql.slice(sql.search(/END \$\$/i))
  assert.match(posAlter, /SELECT[\s\S]*FROM pg_publication_tables/i)
})
