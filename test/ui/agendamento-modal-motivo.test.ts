/**
 * T-038 — passo de motivo no AgendamentoModal (avulso, pontual, série completa).
 *
 * Como em test/ui/dedup-visivel.test.ts (ASM-005): não há runner de componente
 * neste projeto, então a prova é asserção estática sobre o texto do arquivo —
 * mesma técnica de test/actions/agenda-exclusao.test.ts para o lado servidor
 * desta mesma feature.
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
  path.join(__dirname, '../../src/components/features/agenda/AgendamentoModal.tsx'),
  'utf-8',
)

function extrairFuncao(nome: string): string {
  const inicio = src.search(new RegExp(`function ${nome}\\(`))
  assert.notEqual(inicio, -1, `função ${nome} não encontrada em AgendamentoModal.tsx`)
  const fimRelativo = src.slice(inicio + 1).search(/\n  (async )?function /)
  assert.notEqual(fimRelativo, -1, `não foi possível delimitar o fim de ${nome}`)
  return src.slice(inicio, inicio + 1 + fimRelativo)
}

test('@spec:AC-044 o botão de confirmar exclusão fica desabilitado sem categoria de motivo selecionada', () => {
  assert.match(
    src,
    /const motivoValido = !!motivoCategoria && \(!categoriaSelecionada\?\.exige_observacao \|\| motivoObservacao\.trim\(\)\.length > 0\)/,
    'motivoValido precisa exigir motivoCategoria preenchido',
  )
  assert.match(
    src,
    /disabled=\{!motivoValido \|\| excluindo\}/,
    'o botão "Confirmar exclusão" precisa ficar desabilitado quando motivoValido é falso',
  )
})

test('@spec:AC-045 categoria "Outros" (exige_observacao) só libera o botão com observação preenchida (sem só espaços)', () => {
  assert.match(
    src,
    /categoriaSelecionada\?\.exige_observacao/,
    'a validação precisa consultar exige_observacao da categoria selecionada',
  )
  assert.match(
    src,
    /motivoObservacao\.trim\(\)\.length > 0/,
    'a checagem precisa usar trim() para recusar observação só com espaços',
  )
})

test('@spec:AC-046 exclusão avulsa chama deletarAgendamento com o motivo escolhido', () => {
  const handleConfirmar = extrairFuncao('handleConfirmarExclusaoComMotivo')
  assert.match(
    handleConfirmar,
    /resultado = await deletarAgendamento\(agendamento\.id, motivo\)/,
    'o caminho padrão (passoMotivo !== "unico"/"todos") precisa chamar deletarAgendamento com o motivo montado do estado',
  )
  assert.match(
    handleConfirmar,
    /categoria: motivoCategoria,/,
    'o objeto motivo precisa levar a categoria escolhida pelo usuário',
  )
})

test('@spec:AC-046 o clique em "Excluir agendamento" de um avulso abre o passo de motivo (sem excluir direto)', () => {
  assert.match(
    src,
    /onClick=\{\(\) => \{ if \(isRecorrente\) setConfirmandoExclusao\(true\); else abrirPassoMotivo\('avulso'\) \}\}/,
    'para um agendamento não recorrente, o clique precisa abrir o passo de motivo (abrirPassoMotivo(\'avulso\')), não excluir na hora',
  )
})

test('@spec:AC-047 exclusão pontual (sessão de uma recorrência) chama deletarAtendimentoPontualDaRecorrencia com o motivo', () => {
  const handleConfirmar = extrairFuncao('handleConfirmarExclusaoComMotivo')
  assert.match(
    handleConfirmar,
    /passoMotivo === 'unico'/,
    'precisa distinguir o escopo pontual (unico) dos demais',
  )
  assert.match(
    handleConfirmar,
    /resultado = await deletarAtendimentoPontualDaRecorrencia\(agendamento\.id, motivo\)/,
    'o escopo pontual precisa chamar deletarAtendimentoPontualDaRecorrencia com o motivo',
  )
  assert.match(
    src,
    /onClick=\{\(\) => abrirPassoMotivo\('unico'\)\}/,
    'o botão "Apenas este agendamento" precisa abrir o passo de motivo com escopo unico',
  )
})

test('@spec:AC-048 exclusão de série completa chama deletarTodasRecorrencias com o motivo e reforça a contagem de sessões', () => {
  const handleConfirmar = extrairFuncao('handleConfirmarExclusaoComMotivo')
  assert.match(
    handleConfirmar,
    /passoMotivo === 'todos' && agendamento\.agendamento_id/,
    'precisa distinguir o escopo de série completa (todos)',
  )
  assert.match(
    handleConfirmar,
    /resultado = await deletarTodasRecorrencias\(agendamento\.agendamento_id, motivo\)/,
    'o escopo de série completa precisa chamar deletarTodasRecorrencias com o motivo',
  )
  assert.match(
    src,
    /onClick=\{\(\) => abrirPassoMotivo\('todos'\)\}/,
    'precisa existir um botão que abra o passo de motivo com escopo série completa (todos)',
  )
  assert.match(
    src,
    /Excluir toda a série \(\{agendamento\.total_sessoes \?\? 0\} sessões\)/,
    'o botão de série completa precisa mostrar a contagem de sessões da série',
  )
  assert.match(
    src,
    /Isso vai excluir as \{agendamento\.total_sessoes \?\? 0\} sessões desta série inteira\./,
    'o passo de motivo da série completa precisa reforçar quantas sessões serão excluídas',
  )
})

test('@spec:AC-049 o aviso da série completa avisa que sessão concluída bloqueia a série inteira, sem excluir nada', () => {
  assert.match(
    src,
    /passoMotivo === 'todos' &&[\s\S]{0,400}?concluída/,
    'o passo de motivo de série completa precisa avisar sobre o bloqueio de sessão concluída antes de confirmar',
  )
  assert.match(
    src,
    /a exclusão inteira é recusada — nenhuma sessão é removida/,
    'o aviso precisa deixar claro que a recusa é da série inteira, não parcial',
  )
})

test('a categoria de motivo vem do catálogo lido do banco (motivos_exclusao_agendamento), não de uma lista hard-coded no componente', () => {
  assert.match(
    src,
    /\.from\('motivos_exclusao_agendamento'\)/,
    'o catálogo de categorias precisa ser lido da tabela motivos_exclusao_agendamento',
  )
  assert.match(
    src,
    /\.eq\('ativo', true\)/,
    'só categorias ativas devem ser oferecidas no passo de motivo',
  )
})
