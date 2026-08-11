/**
 * Asserções estáticas sobre o script de diagnóstico do Realtime (ASM-002).
 *
 * O que estas asserções protegem: um diagnóstico incompleto é pior que nenhum,
 * porque produz um "está tudo certo" que não olhou o elo que quebrou. Cada
 * teste aqui trava uma das quatro condições necessárias para o evento sair do
 * Postgres e chegar ao navegador.
 *
 * Ver .spec/features/status-personalizados-ciclo-vida/spec.md (AC-027, Q-002)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sql = readFileSync(
  path.join(__dirname, '../../database/diagnostico_realtime_status.sql'),
  'utf-8',
)

test('@spec:AC-027 checa se a tabela está na publicação do Realtime', () => {
  assert.match(sql, /pg_publication_tables/i)
  assert.match(sql, /pubname\s*=\s*'supabase_realtime'/i)
  assert.match(sql, /status_disponibilidade/)
})

test('@spec:AC-027 checa a replica identity da tabela', () => {
  // Sem isso, um relreplident = 'n' explicaria o silêncio e passaria batido.
  assert.match(sql, /relreplident/i)
})

test('@spec:AC-027 checa a política de leitura, que o Realtime aplica ao assinante', () => {
  // A falha mais silenciosa: publicada, replicando, e sem política de SELECT
  // para o papel autenticado. Nenhum erro no console — só ausência de evento.
  assert.match(sql, /pg_policies/i)
  assert.match(sql, /relrowsecurity/i)
})

test('@spec:AC-027 checa as execuções recentes do job de expiração', () => {
  assert.match(sql, /cron\.job_run_details/i)
  assert.match(sql, /fechar-status-esquecidos/)
  // return_message é o que traz o "UPDATE n" — a prova de que o job escreveu.
  assert.match(sql, /return_message/i)
})

test('@spec:AC-027 usa o teto vigente de 2 horas ao apontar quem deveria ter expirado', () => {
  assert.match(sql, /INTERVAL '2 hours'/)
  assert.doesNotMatch(sql, /INTERVAL '1 hour'/)
})

test('@spec:AC-027 o diagnóstico é somente leitura', () => {
  // Um script de diagnóstico que altera estado destrói a própria evidência.
  for (const comando of [/^\s*UPDATE\s/im, /^\s*INSERT\s/im, /^\s*DELETE\s/im, /^\s*ALTER\s/im, /^\s*DROP\s/im]) {
    assert.doesNotMatch(sql, comando, `o diagnóstico não pode conter ${comando}`)
  }
})
