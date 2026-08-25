/**
 * Asserções estáticas sobre o texto de src/actions/agenda.ts (T-037): as 4
 * Server Actions de exclusão precisam ser casca fina sobre
 * fn_excluir_atendimentos (T-035) — quem valida motivo, bloqueia
 * "Concluído" e grava o log é a função no banco (já coberta por
 * test/sql/fn-excluir-atendimentos.test.ts e test/sql/auditoria-exclusao.test.ts).
 * Aqui garantimos que o TypeScript não abre um caminho de exclusão que
 * contorne a RPC — mesma técnica de test/sql/*: não executa Postgres nem
 * Next.js, só examina a forma do código.
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
  path.join(__dirname, '../../src/actions/agenda.ts'),
  'utf-8',
)

function extrairFuncao(nome: string): string {
  const inicio = src.search(new RegExp(`export async function ${nome}\\(`))
  assert.notEqual(inicio, -1, `função ${nome} não encontrada em agenda.ts`)
  const fimRelativo = src.slice(inicio + 1).search(/\nexport /)
  assert.notEqual(fimRelativo, -1, `não foi possível delimitar o fim de ${nome}`)
  return src.slice(inicio, inicio + 1 + fimRelativo)
}

const deletarAgendamento = extrairFuncao('deletarAgendamento')
const deletarAtendimentoPontualDaRecorrencia = extrairFuncao('deletarAtendimentoPontualDaRecorrencia')
const deletarTodasRecorrencias = extrairFuncao('deletarTodasRecorrencias')
const deletarAtendimentosSelecionados = extrairFuncao('deletarAtendimentosSelecionados')

const FUNCOES_DE_EXCLUSAO: Record<string, string> = {
  deletarAgendamento,
  deletarAtendimentoPontualDaRecorrencia,
  deletarTodasRecorrencias,
  deletarAtendimentosSelecionados,
}

test('@spec:AC-044 @spec:AC-057 as 4 Server Actions de exclusão exigem um parâmetro motivo (MotivoExclusao), não opcional', () => {
  const assinaturas = {
    deletarAgendamento: /export async function deletarAgendamento\(id: string, motivo: MotivoExclusao\)/,
    deletarAtendimentoPontualDaRecorrencia: /export async function deletarAtendimentoPontualDaRecorrencia\(id: string, motivo: MotivoExclusao\)/,
    deletarTodasRecorrencias: /export async function deletarTodasRecorrencias\(agendamentoId: string, motivo: MotivoExclusao\)/,
    deletarAtendimentosSelecionados: /export async function deletarAtendimentosSelecionados\(ids: string\[\], agendamentoId: string, motivo: MotivoExclusao\)/,
  }
  for (const [nome, regex] of Object.entries(assinaturas)) {
    assert.match(src, regex, `${nome} deveria exigir motivo: MotivoExclusao (sem "?")`)
  }
})

test('@spec:AC-049 @spec:AC-052 nenhuma Server Action de exclusão faz DELETE direto em atendimentos — só a RPC pode remover', () => {
  for (const [nome, corpo] of Object.entries(FUNCOES_DE_EXCLUSAO)) {
    assert.doesNotMatch(
      corpo,
      /\.from\(['"]atendimentos['"]\)\s*\n?\s*\.delete\(\)/,
      `${nome} não deveria mais chamar .from('atendimentos').delete() diretamente — isso contornaria o bloqueio de "Concluído" da RPC`,
    )
  }
})

test('@spec:AC-046 deletarAgendamento delega a exclusão avulsa para fn_excluir_atendimentos com acao exclusao_avulso', () => {
  assert.match(deletarAgendamento, /executarExclusaoTransacional\(supabaseAdmin, \{/)
  assert.match(deletarAgendamento, /acao:\s*['"]exclusao_avulso['"]/)
  assert.match(deletarAgendamento, /ids:\s*\[id\]/)
})

test('@spec:AC-047 deletarAtendimentoPontualDaRecorrencia delega para fn_excluir_atendimentos com acao exclusao_sessao_recorrente', () => {
  assert.match(deletarAtendimentoPontualDaRecorrencia, /executarExclusaoTransacional\(supabaseAdmin, \{/)
  assert.match(deletarAtendimentoPontualDaRecorrencia, /acao:\s*['"]exclusao_sessao_recorrente['"]/)
})

test('@spec:AC-047 a reposição da sessão pontual só roda depois de a RPC confirmar (sem erro)', () => {
  const idxChamadaRpc = deletarAtendimentoPontualDaRecorrencia.search(/executarExclusaoTransacional\(/)
  const idxChecagemErro = deletarAtendimentoPontualDaRecorrencia.search(/if \(resultado\.error\)/)
  const idxInsertReposicao = deletarAtendimentoPontualDaRecorrencia.search(/supabaseAdmin\.from\(['"]atendimentos['"]\)\.insert\(/)

  assert.notEqual(idxChamadaRpc, -1, 'a RPC precisa ser chamada')
  assert.notEqual(idxChecagemErro, -1, 'o erro da RPC precisa ser checado antes de repor a sessão')
  assert.notEqual(idxInsertReposicao, -1, 'a reposição (insert da nova sessão) precisa existir')
  assert.ok(idxChamadaRpc < idxChecagemErro, 'a RPC roda antes da checagem de erro')
  assert.ok(idxChecagemErro < idxInsertReposicao, 'a reposição só pode rodar depois de confirmar que a RPC não falhou')
})

test('@spec:AC-048 deletarTodasRecorrencias delega para fn_excluir_atendimentos com acao exclusao_serie_completa, cobrindo todos os ids da série', () => {
  assert.match(deletarTodasRecorrencias, /executarExclusaoTransacional\(supabaseAdmin, \{/)
  assert.match(deletarTodasRecorrencias, /acao:\s*['"]exclusao_serie_completa['"]/)
  assert.match(
    deletarTodasRecorrencias,
    /\.eq\(['"]agendamento_id['"], agendamentoId\)/,
    'os ids do escopo precisam vir de todos os atendimentos da série, não de um subconjunto calculado em TS',
  )
})

test('@spec:AC-048 deletarTodasRecorrencias não apaga a linha de agendamentos em TS — a limpeza da órfã é responsabilidade da RPC', () => {
  assert.doesNotMatch(
    deletarTodasRecorrencias,
    /\.from\(['"]agendamentos['"]\)\s*\n?\s*\.delete\(\)/,
    'a RPC já remove a linha órfã de agendamentos (v_agendamento_ids) na mesma transação — duplicar isso em TS seria um caminho fora da transação',
  )
})

test('@spec:AC-050 @spec:AC-051 deletarAtendimentosSelecionados delega o lote inteiro para fn_excluir_atendimentos com acao exclusao_lote', () => {
  assert.match(deletarAtendimentosSelecionados, /executarExclusaoTransacional\(supabaseAdmin, \{/)
  assert.match(deletarAtendimentosSelecionados, /acao:\s*['"]exclusao_lote['"]/)
  assert.match(deletarAtendimentosSelecionados, /\bids,\r?\n/, 'todos os ids selecionados pelo operador precisam ir no mesmo lote (shorthand ids,), sem filtragem em TS')
})

test('@spec:AC-056 usuario_id enviado à RPC vem sempre do contexto autenticado (ctx.userId), nunca de parâmetro do cliente', () => {
  const assinaturas = [
    /export async function deletarAgendamento\([^)]*\)/,
    /export async function deletarAtendimentoPontualDaRecorrencia\([^)]*\)/,
    /export async function deletarTodasRecorrencias\([^)]*\)/,
    /export async function deletarAtendimentosSelecionados\([^)]*\)/,
  ]
  for (const regex of assinaturas) {
    const assinatura = src.match(regex)?.[0]
    assert.ok(assinatura, `assinatura não encontrada para ${regex}`)
    assert.doesNotMatch(
      assinatura!,
      /usuario/i,
      `${assinatura} não deveria aceitar um identificador de operador vindo do chamador (AC-056: exclusão anônima é proibida, usuário só vem da sessão autenticada)`,
    )
  }

  for (const [nome, corpo] of Object.entries(FUNCOES_DE_EXCLUSAO)) {
    assert.match(
      corpo,
      /usuarioId:\s*userId/,
      `${nome} deveria repassar usuarioId a partir de userId (do contexto de requirePermissaoAgendaAdmin), não de um parâmetro`,
    )
  }
})

test('@spec:AC-057 a categoria de motivo enviada à RPC vem do parâmetro motivo, nunca hard-coded', () => {
  for (const [nome, corpo] of Object.entries(FUNCOES_DE_EXCLUSAO)) {
    assert.match(
      corpo,
      /motivo,/,
      `${nome} deveria repassar o objeto motivo recebido por parâmetro para a RPC`,
    )
  }
  assert.match(
    src,
    /p_motivo_categoria:\s*params\.motivo\.categoria/,
    'o helper que chama a RPC precisa ler a categoria do motivo recebido, não de um valor fixo',
  )
})

test('a chamada da RPC é centralizada num único helper (executarExclusaoTransacional), evitando 4 cópias divergentes', () => {
  const ocorrencias = src.match(/supabaseAdmin\.rpc\(['"]fn_excluir_atendimentos['"]/g) ?? []
  assert.equal(ocorrencias.length, 1, 'só deveria existir uma chamada literal a supabaseAdmin.rpc(\'fn_excluir_atendimentos\', ...) no arquivo inteiro')
  for (const [nome, corpo] of Object.entries(FUNCOES_DE_EXCLUSAO)) {
    assert.match(corpo, /executarExclusaoTransacional\(supabaseAdmin, \{/, `${nome} deveria usar o helper compartilhado`)
  }
})
