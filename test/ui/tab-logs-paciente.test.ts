/**
 * T-040 — aba "Logs" em /pacientes/[id].
 *
 * Mesma técnica de test/ui/modal-selecao-exclusao-motivo.test.ts: não há
 * runner de componente neste projeto, então a prova é asserção estática
 * sobre o texto dos arquivos.
 *
 * Ver .spec/features/auditoria-exclusao-agendamentos/spec.md
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const tabLogsSrc = readFileSync(
  path.join(__dirname, '../../src/components/features/pacientes/TabLogsPaciente.tsx'),
  'utf-8',
)
const tabsClientSrc = readFileSync(
  path.join(__dirname, '../../src/components/features/pacientes/PacienteTabsClient.tsx'),
  'utf-8',
)

test('@spec:AC-058 TabLogsPaciente busca os logs via buscarLogsExclusaoPaciente', () => {
  assert.match(
    tabLogsSrc,
    /import \{ buscarLogsExclusaoPaciente, type LogExclusaoPaciente \} from '@\/actions\/pacientes'/,
    'precisa importar a query de logs de exclusão de src/actions/pacientes.ts',
  )
  assert.match(
    tabLogsSrc,
    /buscarLogsExclusaoPaciente\(pacienteId\)/,
    'precisa chamar buscarLogsExclusaoPaciente com o pacienteId recebido por prop',
  )
})

test('@spec:AC-058 cada item da lista mostra quem excluiu, quando, o escopo, o motivo e os dados da sessão apagada', () => {
  assert.match(tabLogsSrc, /Excluído por/, 'quem excluiu')
  assert.match(tabLogsSrc, /formatarDataHora\(log\.criado_em\)/, 'quando')
  assert.match(tabLogsSrc, /ACAO_LABEL\[log\.acao\]/, 'escopo da exclusão')
  assert.match(tabLogsSrc, /log\.motivo_categoria_label/, 'categoria do motivo')
  assert.match(tabLogsSrc, /log\.motivo_observacao/, 'observação do motivo')
  assert.match(tabLogsSrc, /Sessão apagada:/, 'dados da sessão apagada')
})

test('@spec:AC-058 a aba não reordena os logs no cliente — a ordem mais recente primeiro vem da query', () => {
  assert.doesNotMatch(
    tabLogsSrc,
    /\.sort\(/,
    'a lista renderizada precisa refletir a ordem já decrescente devolvida por buscarLogsExclusaoPaciente, sem reordenar no componente',
  )
  assert.match(
    tabLogsSrc,
    /logs\.map\(\(log\) => \{/,
    'precisa mapear a lista de logs na ordem recebida',
  )
})

test('a aba de Logs traz uma nota fixa de que os registros são imutáveis', () => {
  assert.match(
    tabLogsSrc,
    /imutáveis/,
    'precisa haver uma nota fixa explicando que os logs de exclusão não podem ser alterados nem apagados',
  )
})

test('PacienteTabsClient tem a aba "logs" sem modulo (ASM-012: visível a todo usuário com acesso ao paciente)', () => {
  assert.match(
    tabsClientSrc,
    /\{ id: 'logs',\s*label: 'Logs',\s*icon: History\s*\}/,
    'a entrada de TABS para logs não deve ter a propriedade modulo, igual à aba Agendamentos',
  )
  assert.match(
    tabsClientSrc,
    /import \{ TabLogsPaciente \} from '\.\/TabLogsPaciente'/,
    'precisa importar o componente TabLogsPaciente',
  )
  assert.match(
    tabsClientSrc,
    /\{tab === 'logs'\s*&& <TabLogsPaciente pacienteId=\{pacienteId\} \/>\}/,
    'a aba logs precisa renderizar TabLogsPaciente com o pacienteId',
  )
})
