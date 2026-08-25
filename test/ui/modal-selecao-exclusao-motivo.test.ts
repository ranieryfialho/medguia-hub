/**
 * T-039 — passo de motivo no ModalSelecaoExclusao (lote).
 *
 * Como em test/ui/agendamento-modal-motivo.test.ts (T-038): não há runner de
 * componente neste projeto, então a prova é asserção estática sobre o texto
 * do arquivo — mesma técnica de test/actions/agenda-exclusao.test.ts para o
 * lado servidor desta mesma feature.
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
  path.join(__dirname, '../../src/components/features/agenda/ModalSelecaoExclusao.tsx'),
  'utf-8',
)

function extrairFuncao(nome: string): string {
  const inicio = src.search(new RegExp(`function ${nome}\\(`))
  assert.notEqual(inicio, -1, `função ${nome} não encontrada em ModalSelecaoExclusao.tsx`)
  const fimRelativo = src.slice(inicio + 1).search(/\n  ((async )?function |if \(passoMotivo\))/)
  assert.notEqual(fimRelativo, -1, `não foi possível delimitar o fim de ${nome}`)
  return src.slice(inicio, inicio + 1 + fimRelativo)
}

test('@spec:AC-044 o botão de confirmar exclusão do lote fica desabilitado sem categoria de motivo selecionada', () => {
  assert.match(
    src,
    /const motivoValido = !!motivoCategoria && \(!categoriaSelecionada\?\.exige_observacao \|\| motivoObservacao\.trim\(\)\.length > 0\)/,
    'motivoValido precisa exigir motivoCategoria preenchido',
  )
  assert.match(
    src,
    /disabled=\{!motivoValido \|\| excluindoSelecionados\}/,
    'o botão "Confirmar exclusão" do passo de motivo precisa ficar desabilitado quando motivoValido é falso',
  )
  const handleExcluir = extrairFuncao('handleExcluirSelecionados')
  assert.match(
    handleExcluir,
    /if \(selecionados\.size === 0 \|\| !motivoValido \|\| !motivoCategoria\) return/,
    'handleExcluirSelecionados precisa recusar executar sem motivo válido, mesmo se chamado diretamente',
  )
})

test('@spec:AC-045 categoria "Outros" (exige_observacao) só libera o botão do lote com observação preenchida (sem só espaços)', () => {
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
  assert.match(
    src,
    /\{categoriaSelecionada\?\.exige_observacao && \(\s*<textarea/,
    'o campo de observação só deve aparecer quando a categoria selecionada exige_observacao',
  )
})

test('@spec:AC-050 o passo de motivo avisa que um item concluído recusa o lote inteiro, sem excluir nada', () => {
  assert.match(
    src,
    /Se algum estiver concluído, a exclusão inteira é recusada — nenhum atendimento do lote é removido\./,
    'o passo de motivo do lote precisa avisar sobre a recusa por inteiro quando algum item está concluído',
  )
  const handleExcluir = extrairFuncao('handleExcluirSelecionados')
  assert.match(
    handleExcluir,
    /if \(resultado\.error\) \{\s*toast\.error\(resultado\.error\)\s*return\s*\}/,
    'quando a Server Action recusar o lote, o erro precisa ser exibido e a função precisa retornar sem prosseguir (sem excluir parcialmente)',
  )
})

test('@spec:AC-051 exclusão do lote totalmente pendente chama deletarAtendimentosSelecionados com os ids e o motivo escolhido', () => {
  const handleExcluir = extrairFuncao('handleExcluirSelecionados')
  assert.match(
    handleExcluir,
    /const motivo: MotivoExclusao = \{\s*categoria: motivoCategoria,/,
    'o objeto motivo precisa levar a categoria escolhida pelo usuário',
  )
  assert.match(
    handleExcluir,
    /resultado = await deletarAtendimentosSelecionados\(Array\.from\(selecionados\), agendamentoPaiId, motivo\)/,
    'a exclusão do lote precisa chamar deletarAtendimentosSelecionados com os ids selecionados e o motivo montado do estado',
  )
})

test('o clique em "Excluir N atendimentos" abre o passo de motivo em vez de excluir direto', () => {
  assert.match(
    src,
    /onClick=\{abrirPassoMotivo\}/,
    'o botão de exclusão da tela de seleção precisa abrir o passo de motivo (abrirPassoMotivo), não excluir na hora',
  )
  const abrirPasso = extrairFuncao('abrirPassoMotivo')
  assert.match(
    abrirPasso,
    /setPassoMotivo\(true\)/,
    'abrirPassoMotivo precisa mudar para a tela de motivo',
  )
})

test('a categoria de motivo do lote vem do catálogo lido do banco (motivos_exclusao_agendamento), não de uma lista hard-coded no componente', () => {
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
