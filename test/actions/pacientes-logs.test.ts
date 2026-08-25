/**
 * T-040 — buscarLogsExclusaoPaciente (src/actions/pacientes.ts).
 *
 * Mesma técnica de test/actions/agenda-exclusao.test.ts: asserção estática
 * sobre o texto do arquivo, sem executar Postgres nem Next.js.
 *
 * Ver .spec/features/auditoria-exclusao-agendamentos/spec.md
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const src = readFileSync(
  path.join(__dirname, '../../src/actions/pacientes.ts'),
  'utf-8',
)

function extrairFuncao(nome: string): string {
  const inicio = src.search(new RegExp(`export async function ${nome}\\(`))
  assert.notEqual(inicio, -1, `função ${nome} não encontrada em pacientes.ts`)
  const fimRelativo = src.slice(inicio + 1).search(/\nexport /)
  const corpo = fimRelativo === -1 ? src.slice(inicio) : src.slice(inicio, inicio + 1 + fimRelativo)
  return corpo
}

const buscarLogsExclusaoPaciente = extrairFuncao('buscarLogsExclusaoPaciente')

test('@spec:AC-058 buscarLogsExclusaoPaciente busca em agendamentos_auditoria filtrando pelo paciente', () => {
  assert.match(
    buscarLogsExclusaoPaciente,
    /\.from\(['"]agendamentos_auditoria['"]\)/,
    'precisa consultar a tabela agendamentos_auditoria (T-033)',
  )
  assert.match(
    buscarLogsExclusaoPaciente,
    /\.eq\(['"]paciente_id['"],\s*pacienteId\)/,
    'precisa filtrar pelo pacienteId recebido como parâmetro',
  )
})

test('@spec:AC-058 buscarLogsExclusaoPaciente ordena da mais recente para a mais antiga', () => {
  assert.match(
    buscarLogsExclusaoPaciente,
    /\.order\(['"]criado_em['"],\s*\{\s*ascending:\s*false\s*\}\)/,
    'precisa ordenar por criado_em decrescente (mais recente primeiro)',
  )
})

test('@spec:AC-058 buscarLogsExclusaoPaciente retorna quem excluiu, quando, escopo, motivo e o snapshot da sessão apagada', () => {
  assert.match(buscarLogsExclusaoPaciente, /usuario_nome/, 'quem excluiu')
  assert.match(buscarLogsExclusaoPaciente, /criado_em/, 'quando')
  assert.match(buscarLogsExclusaoPaciente, /\bacao\b/, 'escopo da exclusão')
  assert.match(buscarLogsExclusaoPaciente, /motivo_categoria/, 'categoria do motivo')
  assert.match(buscarLogsExclusaoPaciente, /motivo_observacao/, 'observação do motivo')
  assert.match(buscarLogsExclusaoPaciente, /dados_agendamento/, 'snapshot da sessão apagada')
})

test('@spec:AC-058 a categoria do motivo é resolvida para o label do catálogo motivos_exclusao_agendamento', () => {
  assert.match(
    buscarLogsExclusaoPaciente,
    /\.from\(['"]motivos_exclusao_agendamento['"]\)/,
    'precisa consultar o catálogo de motivos para exibir o label legível',
  )
  assert.match(
    buscarLogsExclusaoPaciente,
    /motivo_categoria_label:\s*labelPorSlug\.get\(log\.motivo_categoria\)/,
    'o registro retornado precisa incluir motivo_categoria_label resolvido do catálogo',
  )
})

test('@spec:AC-058 lista vazia não gera chamada extra ao catálogo de motivos', () => {
  assert.match(
    buscarLogsExclusaoPaciente,
    /if \(!data\?\.length\) return \[\]/,
    'precisa retornar cedo quando não há logs, antes de consultar o catálogo',
  )
})
