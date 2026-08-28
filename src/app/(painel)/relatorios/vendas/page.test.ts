/**
 * AC-071 a AC-075, AC-077 — segmentação consultório/fisio e paginação
 * explícita em /relatorios/vendas.
 *
 * O projeto não tem runner de componente para exercitar o Server Component
 * renderizado (mesma limitação documentada no TDD 004 e já usada em
 * outras features deste projeto — ver ASM-002/ASM-005 de
 * status-personalizados-ciclo-vida). A prova aqui é estática: confirma que
 * o código-fonte contém os elementos que a especificação exige, no lugar
 * certo. Comportamento visual (o filtro realmente refiltra, o card mostra
 * o número certo) é validado à mão no roteiro de produção do TDD.
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

const fontePagina = lerFonte('./page.tsx')
const fonteFiltro = lerFonte('../../../../components/features/relatorios/FiltroOrigemMedico.tsx')
const fontePdf = lerFonte('../../../../lib/relatorios/pdf-vendas.ts')

test('@spec:AC-071 filtro de modalidade (consultório/fisio) existe e é aplicado à query', () => {
  assert.match(fonteFiltro, /name="modalidade"/)
  assert.match(fontePagina, /modalidade === 'consultorio'.*query\.eq\('venda_em_consultorio', true\)/s)
  assert.match(fontePagina, /modalidade === 'fisio'.*query\.eq\('venda_em_consultorio', false\)/s)
})

test('@spec:AC-071 filtro de modalidade só aparece condicionado a origem = medico', () => {
  const trechoModalidade = fonteFiltro.slice(fonteFiltro.indexOf('name="modalidade"') - 200, fonteFiltro.indexOf('name="modalidade"'))
  assert.match(trechoModalidade, /origem === 'medico'/)
})

test('@spec:AC-072 cards de faturamento consultório/fisio e taxa de conversão da equipe existem', () => {
  assert.match(fontePagina, /faturamentoConsultorio/)
  assert.match(fontePagina, /faturamentoFisio/)
  assert.match(fontePagina, /taxaConversaoEquipe/)
})

test('@spec:AC-072 taxa de conversão da equipe inclui orçamento recusado no denominador e exclui NULL', () => {
  assert.match(fontePagina, /statusVenda === 'venda_confirmada' \|\| statusVenda === 'orcamento_recusado'/)
  assert.match(fontePagina, /venda\.venda_em_consultorio !== null/)
})

test('@spec:AC-073 tabela de médico referenciador tem colunas de consultório e conversão fisio', () => {
  assert.match(fontePagina, /qtdConsultorio/)
  assert.match(fontePagina, /faturamentoConsultorio/)
  assert.match(fontePagina, /qtdFisio/)
  assert.match(fontePagina, /faturamentoFisio/)
})

test('@spec:AC-073 tabela de profissional tem indicador de conversões ativas vs. atendimentos de consultório', () => {
  assert.match(fontePagina, /porProfissionalModalidade/)
  assert.match(fontePagina, /conversoesFisio/)
  assert.match(fontePagina, /atendimentosConsultorio/)
})

test('@spec:AC-074 listagem detalhada exibe a tag de modalidade para vendas médicas', () => {
  assert.match(fontePagina, /\[Médico · Consultório\]/)
  assert.match(fontePagina, /\[Médico · Conversão Fisio\]/)
})

test('@spec:AC-075 PDF de vendas inclui o bloco de resumo do canal médico', () => {
  assert.match(fontePdf, /resumoMedico/)
  assert.match(fontePdf, /desenharBlocoResumoMedico/)
  assert.match(fontePagina, /resumoMedico=\{\{/)
})

test('@spec:AC-077 query de listagem usa .range() explícito e detecta truncamento via count', () => {
  assert.match(fontePagina, /count: 'exact'/)
  assert.match(fontePagina, /\.range\(0, 9999\)/)
  assert.match(fontePagina, /vendasCount !== null && vendasCount > vendas\.length/)
})
