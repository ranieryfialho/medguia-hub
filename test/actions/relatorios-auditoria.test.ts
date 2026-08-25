/**
 * T-041 — buscarLogsAuditoriaExclusoes / listarOpcoesFiltroAuditoria
 * (src/actions/relatorios-auditoria.ts).
 *
 * Mesma técnica de test/actions/pacientes-logs.test.ts: asserção estática
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
  path.join(__dirname, '../../src/actions/relatorios-auditoria.ts'),
  'utf-8',
)

function extrairFuncao(nome: string): string {
  const inicio = src.search(new RegExp(`export async function ${nome}\\(`))
  assert.notEqual(inicio, -1, `função ${nome} não encontrada em relatorios-auditoria.ts`)
  const fimRelativo = src.slice(inicio + 1).search(/\nexport /)
  const corpo = fimRelativo === -1 ? src.slice(inicio) : src.slice(inicio, inicio + 1 + fimRelativo)
  return corpo
}

const buscarLogsAuditoriaExclusoes = extrairFuncao('buscarLogsAuditoriaExclusoes')
const listarOpcoesFiltroAuditoria = extrairFuncao('listarOpcoesFiltroAuditoria')

test('@spec:AC-060 buscarLogsAuditoriaExclusoes consulta agendamentos_auditoria', () => {
  assert.match(
    buscarLogsAuditoriaExclusoes,
    /\.from\(['"]agendamentos_auditoria['"]\)/,
    'precisa consultar a tabela agendamentos_auditoria (T-033)',
  )
})

test('@spec:AC-060 o filtro de período aplica gte/lte sobre criado_em somente quando informado', () => {
  assert.match(
    buscarLogsAuditoriaExclusoes,
    /if \(filtros\.dataInicio\) query = query\.gte\(['"]criado_em['"],\s*filtros\.dataInicio\)/,
    'data início precisa virar .gte(criado_em, ...) condicional',
  )
  assert.match(
    buscarLogsAuditoriaExclusoes,
    /if \(filtros\.dataFim\) query = query\.lte\(['"]criado_em['"],\s*filtros\.dataFim\)/,
    'data fim precisa virar .lte(criado_em, ...) condicional',
  )
})

test('@spec:AC-060 o filtro de profissional aplica eq(profissional_id) somente quando informado', () => {
  assert.match(
    buscarLogsAuditoriaExclusoes,
    /if \(filtros\.profissionalId\) query = query\.eq\(['"]profissional_id['"],\s*filtros\.profissionalId\)/,
    'profissional precisa virar .eq(profissional_id, ...) condicional',
  )
})

test('@spec:AC-060 o filtro de operador aplica eq(usuario_id) somente quando informado', () => {
  assert.match(
    buscarLogsAuditoriaExclusoes,
    /if \(filtros\.usuarioId\) query = query\.eq\(['"]usuario_id['"],\s*filtros\.usuarioId\)/,
    'operador precisa virar .eq(usuario_id, ...) condicional',
  )
})

test('@spec:AC-060 o filtro de motivo aplica eq(motivo_categoria) somente quando informado', () => {
  assert.match(
    buscarLogsAuditoriaExclusoes,
    /if \(filtros\.motivoCategoria\) query = query\.eq\(['"]motivo_categoria['"],\s*filtros\.motivoCategoria\)/,
    'motivo precisa virar .eq(motivo_categoria, ...) condicional',
  )
})

test('@spec:AC-060 os 4 filtros são aplicados na mesma query encadeada, combinando-se com AND', () => {
  const ordemDosFiltros = [
    /if \(filtros\.dataInicio\)/,
    /if \(filtros\.dataFim\)/,
    /if \(filtros\.profissionalId\)/,
    /if \(filtros\.usuarioId\)/,
    /if \(filtros\.motivoCategoria\)/,
  ]
  let cursor = 0
  for (const regex of ordemDosFiltros) {
    const match = buscarLogsAuditoriaExclusoes.slice(cursor).search(regex)
    assert.notEqual(match, -1, `filtro ${regex} não encontrado na função — os 4 filtros precisam se acumular sobre a mesma variável query`)
    cursor += match + 1
  }
  assert.doesNotMatch(
    buscarLogsAuditoriaExclusoes,
    /\.or\(/,
    'os filtros combinados precisam ser AND (chamadas encadeadas), nunca .or(...)',
  )
})

test('@spec:AC-060 listarOpcoesFiltroAuditoria devolve as opções de profissional, operador e motivo para popular os 4 filtros', () => {
  assert.match(
    listarOpcoesFiltroAuditoria,
    /\.from\(['"]agendamentos_auditoria['"]\)/,
    'profissionais e operadores vêm dos próprios logs já gravados',
  )
  assert.match(
    listarOpcoesFiltroAuditoria,
    /\.from\(['"]motivos_exclusao_agendamento['"]\)/,
    'motivos vêm do catálogo de motivos de exclusão',
  )
  assert.match(listarOpcoesFiltroAuditoria, /profissionais/, 'precisa retornar as opções de profissional')
  assert.match(listarOpcoesFiltroAuditoria, /operadores/, 'precisa retornar as opções de operador')
  assert.match(listarOpcoesFiltroAuditoria, /motivos/, 'precisa retornar as opções de motivo')
})

test('@spec:AC-060 a paginação server-side usa .range() sobre a query já filtrada', () => {
  assert.match(
    buscarLogsAuditoriaExclusoes,
    /\.range\(from, to\)/,
    'precisa paginar com .range(from, to) para não carregar a tabela inteira',
  )
})
