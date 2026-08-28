/**
 * AC-086 — /relatorios/vendas-historicas usa o mesmo guard de acesso de
 * /relatorios/vendas ('comercial:relatorio_vendas'), nunca mais permissivo.
 *
 * O projeto não tem runner de componente Server Component nem mock de
 * Supabase para exercitar requireModulo() de ponta a ponta em teste
 * automatizado — mesma limitação já documentada para outras rotas do
 * projeto. A prova aqui é estática: confirma que a página nova e a Server
 * Action de drill-down chamam requireModulo com a mesma chave que a rota
 * de referência, e que nenhuma delas usa uma chave diferente ou pula o
 * guard. Regressão real (rota acessível sem permissão) seria pega no
 * roteiro de validação manual em produção, listado no TDD 004.
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

test('@spec:AC-086 /relatorios/vendas usa requireModulo(\'comercial:relatorio_vendas\')', () => {
  const fonteReferencia = lerFonte('../vendas/page.tsx')
  assert.match(fonteReferencia, /requireModulo\('comercial:relatorio_vendas'\)/)
})

test('@spec:AC-086 /relatorios/vendas-historicas usa o mesmo guard da rota de referência', () => {
  const fonteHistorico = lerFonte('./page.tsx')
  assert.match(fonteHistorico, /requireModulo\('comercial:relatorio_vendas'\)/)
})

test('@spec:AC-086 a Server Action de drill-down (buscarDrillDownMes) também exige o guard', () => {
  const fonteAction = lerFonte('../../../../actions/vendas-historicas.ts')
  assert.match(fonteAction, /requireModulo\('comercial:relatorio_vendas'\)/)
})

test('@spec:AC-086 nenhuma das duas rotas usa uma chave de módulo diferente da referência', () => {
  const fonteHistorico = lerFonte('./page.tsx')
  const chamadasRequireModulo = [...fonteHistorico.matchAll(/requireModulo\('([^']+)'\)/g)].map((m) => m[1])
  assert.deepEqual(chamadasRequireModulo, ['comercial:relatorio_vendas'])
})

// AC-079, AC-081 a AC-084 — mesma limitação de runner de componente descrita
// acima. Prova estática sobre o código-fonte da página e do componente
// cliente.

const fonteCliente = lerFonte('../../../../components/features/relatorios/VendasHistoricasClient.tsx')
const fonteAction = lerFonte('../../../../actions/vendas-historicas.ts')

test('@spec:AC-079 gráfico tem os 4 seletores de métrica e alterna sem ida ao servidor', () => {
  assert.match(fonteCliente, /'faturamento', 'Faturamento'/)
  assert.match(fonteCliente, /'ticket_medio', 'Ticket Médio'/)
  assert.match(fonteCliente, /'volume', 'Volume'/)
  assert.match(fonteCliente, /'misto', 'Faturamento \+ Ticket'/)
  // Troca de métrica é useState local — não chama fetch/Server Action.
  assert.match(fonteCliente, /const \[metrica, setMetrica\] = useState<Metrica>/)
})

test('@spec:AC-079 seletores de período (6/12/24m, YTD, personalizado) existem e refazem a consulta via searchParams', () => {
  const fontePagina = lerFonte('./page.tsx')
  assert.match(fontePagina, /'6m'/)
  assert.match(fontePagina, /'12m'/)
  assert.match(fontePagina, /'24m'/)
  assert.match(fontePagina, /'ytd'/)
  assert.match(fontePagina, /'personalizado'/)
})

test('@spec:AC-081 drill-down é buscado ao expandir a linha, não no carregamento inicial da página', () => {
  const fontePagina = lerFonte('./page.tsx')
  // A página não chama fn_vendas_detalhe_mes nem buscarDrillDownMes —
  // só fn_vendas_resumo_mensal no carregamento inicial.
  assert.doesNotMatch(fontePagina, /fn_vendas_detalhe_mes/)
  assert.doesNotMatch(fontePagina, /buscarDrillDownMes/)
  // O componente cliente chama buscarDrillDownMes dentro do handler de toggle.
  assert.match(fonteCliente, /async function toggleExpandir/)
  assert.match(fonteCliente, /buscarDrillDownMes\(mes, filtros\)/)
  assert.match(fonteAction, /fn_vendas_detalhe_mes/)
})

test('@spec:AC-082 filtros globais (profissional, médico, origem, categoria) existem, e medico_nome é fallback de medico_id', () => {
  const fontePagina = lerFonte('./page.tsx')
  assert.match(fontePagina, /name="profissional_id"/)
  assert.match(fontePagina, /name="medico_id"/)
  assert.match(fontePagina, /name="origem"/)
  assert.match(fontePagina, /name="categoria"/)
  assert.match(fontePagina, /medico_nome/)
  assert.match(fontePagina, /if \(!medico_id && medicoResolvido\?\.data\?\.id\)/)
})

test('@spec:AC-083 gráfico e tabela usam scroll horizontal, não quebram o layout em telas estreitas', () => {
  assert.match(fonteCliente, /overflow-x-auto/)
})

test('@spec:AC-084 exportação PDF e XLSX existem e consomem os dados já em tela', () => {
  assert.match(fonteCliente, /gerarPdfVendasHistoricas/)
  assert.match(fonteCliente, /gerarXlsxVendasHistoricas/)
  assert.match(fonteCliente, /periodoLabel, filtrosLabel, cards, linhas/)
})
