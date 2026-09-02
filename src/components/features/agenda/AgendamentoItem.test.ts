/**
 * T-012 — avatar do paciente na agenda (views dia e semana).
 *
 * Mesma limitação de runner de componente documentada em
 * AvatarPaciente.pontos-renderizacao.test.ts: a prova aqui é estática,
 * confirmando no código-fonte que `AgendamentoItemDia`/`AgendamentoItemSemana`
 * usam `AvatarPaciente` sem `priority` (lazy sempre) e que a view mês
 * (renderizada só em src/app/(painel)/agenda/page.tsx) não é tocada.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

function lerFonte(caminhoRelativo: string) {
  return readFileSync(join(__dirname, caminhoRelativo), 'utf8')
}

const fonteAgendamentoItem = lerFonte('./AgendamentoItem.tsx')

function extrairFuncao(fonte: string, assinatura: string): string {
  const inicio = fonte.indexOf(assinatura)
  assert.notEqual(inicio, -1, `não encontrei "${assinatura}" no arquivo`)
  const fim = fonte.indexOf('\nexport function', inicio + assinatura.length)
  return fim === -1 ? fonte.slice(inicio) : fonte.slice(inicio, fim)
}

test('@spec:AC-104 AgendamentoItem importa AvatarPaciente', () => {
  assert.match(
    fonteAgendamentoItem,
    /import AvatarPaciente from '@\/components\/features\/pacientes\/AvatarPaciente'/,
  )
})

test('@spec:AC-104 @spec:AC-106 AgendamentoItemDia (view dia) renderiza AvatarPaciente sem priority', () => {
  const fonteDia = extrairFuncao(fonteAgendamentoItem, 'export function AgendamentoItemDia(')
  assert.match(fonteDia, /<AvatarPaciente/)
  assert.doesNotMatch(fonteDia, /<AvatarPaciente[\s\S]*?priority/, 'view dia não deve usar priority — precisa carregar lazy (AC-106)')
})

test('@spec:AC-104 @spec:AC-106 AgendamentoItemSemana (view semana) renderiza AvatarPaciente sem priority', () => {
  const fonteSemana = extrairFuncao(fonteAgendamentoItem, 'export function AgendamentoItemSemana(')
  assert.match(fonteSemana, /<AvatarPaciente/)
  assert.doesNotMatch(fonteSemana, /<AvatarPaciente[\s\S]*?priority/, 'view semana não deve usar priority — precisa carregar lazy (AC-106)')
})

test('@spec:AC-106 nenhum AvatarPaciente da agenda usa priority em todo o arquivo', () => {
  assert.doesNotMatch(fonteAgendamentoItem, /priority/, 'AgendamentoItem.tsx não deveria ter nenhuma ocorrência de "priority"')
})
