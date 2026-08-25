/**
 * T-041 — painel /relatorios/auditoria-exclusoes.
 *
 * Mesma técnica de test/ui/tab-logs-paciente.test.ts: não há runner de
 * componente neste projeto, então a prova é asserção estática sobre o texto
 * do arquivo da página.
 *
 * Ver .spec/features/auditoria-exclusao-agendamentos/spec.md
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pageSrc = readFileSync(
  path.join(__dirname, '../../src/app/(painel)/relatorios/auditoria-exclusoes/page.tsx'),
  'utf-8',
)

test('@spec:AC-059 o painel nega acesso a quem não é gestor do sistema', () => {
  assert.match(
    pageSrc,
    /import \{ isGestorSistema \} from '@\/lib\/permissoes'/,
    'precisa importar isGestorSistema de src/lib/permissoes',
  )
  assert.match(
    pageSrc,
    /if \(!isGestorSistema\(profile\?\.nivel_acesso\)\) \{\s*redirect\(/,
    'usuário sem perfil de gestor precisa ser redirecionado, nunca ver o painel',
  )
})

test('@spec:AC-059 o gate roda antes de qualquer busca de dados do painel', () => {
  const indiceGate = pageSrc.search(/if \(!isGestorSistema\(profile\?\.nivel_acesso\)\)/)
  const indiceBusca = pageSrc.search(/buscarLogsAuditoriaExclusoes\(/)
  assert.notEqual(indiceGate, -1, 'gate de isGestorSistema não encontrado')
  assert.notEqual(indiceBusca, -1, 'chamada a buscarLogsAuditoriaExclusoes não encontrada')
  assert.ok(indiceGate < indiceBusca, 'o gate precisa vir antes da busca dos logs, para nunca vazar dado a quem não é gestor')
})

test('@spec:AC-060 o painel tem os 4 filtros: período, profissional, operador e motivo', () => {
  assert.match(pageSrc, /name="data_inicio"/, 'filtro de data início (período)')
  assert.match(pageSrc, /name="data_fim"/, 'filtro de data fim (período)')
  assert.match(pageSrc, /name="profissional_id"/, 'filtro de profissional')
  assert.match(pageSrc, /name="usuario_id"/, 'filtro de operador')
  assert.match(pageSrc, /name="motivo_categoria"/, 'filtro de motivo')
})

test('@spec:AC-060 os 4 filtros lidos dos searchParams são repassados juntos para a mesma chamada de busca', () => {
  const chamada = pageSrc.slice(
    pageSrc.search(/buscarLogsAuditoriaExclusoes\(\{/),
    pageSrc.search(/buscarLogsAuditoriaExclusoes\(\{/) + 600,
  )
  assert.match(chamada, /dataInicio:/, 'período (início) precisa ir na mesma chamada')
  assert.match(chamada, /dataFim:/, 'período (fim) precisa ir na mesma chamada')
  assert.match(chamada, /profissionalId:/, 'profissional precisa ir na mesma chamada')
  assert.match(chamada, /usuarioId:/, 'operador precisa ir na mesma chamada')
  assert.match(chamada, /motivoCategoria:/, 'motivo precisa ir na mesma chamada')
})

test('o formulário de filtros usa GET para refletir os filtros na própria URL do painel', () => {
  assert.match(
    pageSrc,
    /method="get"/,
    'o formulário de filtros precisa ser GET, para os filtros aplicados ficarem na URL',
  )
})
