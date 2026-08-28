// Testes de spec da feature venda-consultorio-vendas-historicas — gerados por onp-spec scaffold
import { test } from 'node:test';
import assert from 'node:assert/strict';

// US-020 — Marcar venda médica como fechada em consultório ou conversão do fisio
test('AC-061: Toggle aparece somente quando origem é Médico @spec:AC-061', () => {
  // Dado: o operador está na Aba 1 (Origem da Venda) do formulário de nova venda ou de edição
  // Quando: ele seleciona a origem `Médico` e escolhe o médico referenciador
  // Então: o toggle "Venda realizada em consultório médico?" aparece logo abaixo do campo do médico, com valor padrão desligado (conversão pelo fisioterapeuta)
  assert.fail('critério de aceite AC-061 ainda não provado — implemente este teste');
});

// US-020 — Marcar venda médica como fechada em consultório ou conversão do fisio
test('AC-062: Toggle some e valor é limpo ao trocar de origem @spec:AC-062', () => {
  // Dado: o operador marcou o toggle como ativo (venda em consultório) com origem `Médico`
  // Quando: ele troca a origem para qualquer outra (ex.: `Leads`, `Indicação`, `Campanha`)
  // Então: o toggle deixa de aparecer e o valor de `venda_em_consultorio` enviado ao salvar é `null`
  assert.fail('critério de aceite AC-062 ainda não provado — implemente este teste');
});

// US-020 — Marcar venda médica como fechada em consultório ou conversão do fisio
test('AC-063: Persistência correta em criarVenda e editarVenda @spec:AC-063', () => {
  // Dado: um formulário de nova venda ou edição com origem `Médico` e o toggle marcado
  // Quando: o operador salva a venda
  // Então: a Server Action grava `venda_em_consultorio = true` (ou `false`, se desmarcado) na tabela `vendas`, e uma tentativa de gravar `venda_em_consultorio` diferente de `null` com origem diferente de `medico` é rejeitada pelo banco (`CHECK` constraint)
  assert.fail('critério de aceite AC-063 ainda não provado — implemente este teste');
});

// US-020 — Marcar venda médica como fechada em consultório ou conversão do fisio
test('AC-064: Vendas legadas e não-médicas ficam não classificadas @spec:AC-064', () => {
  // Dado: uma venda já existente antes da migration, ou uma venda nova de origem não-médica
  // Quando: a coluna `venda_em_consultorio` é lida
  // Então: o valor é `NULL` (não classificada) — nunca `false` por default de banco
  assert.fail('critério de aceite AC-064 ainda não provado — implemente este teste');
});

// US-021 — Função canônica de "venda contável" no Postgres
test('AC-065: Agregação mensal correta com filtros @spec:AC-065', () => {
  // Dado: um intervalo de datas e filtros opcionais (profissional, médico referenciador por id, origem, categoria, modalidade)
  // Quando: `fn_vendas_resumo_mensal` é chamada
  // Então: retorna uma linha por mês do período, com `faturamento`, `qtd_vendas`, `ticket_medio` (`faturamento / qtd_vendas`, `0` quando não há vendas), `faturamento_consultorio`/`qtd_consultorio`, `faturamento_fisio`/`qtd_fisio`, `qtd_nao_classificada`, `qtd_orcamento_pendente`, `qtd_orcamento_recusado`, `top_produto` e `top_profissional` — considerando apenas vendas com `status = 'venda_confirmada'`
  assert.fail('critério de aceite AC-065 ainda não provado — implemente este teste');
});

// US-021 — Função canônica de "venda contável" no Postgres
test('AC-066: Venda confirmada sem itens conta como R$ 0,00 no denominador @spec:AC-066', () => {
  // Dado: uma venda com `status = 'venda_confirmada'` e nenhum item em `itens_venda`
  // Quando: `fn_vendas_resumo_mensal` calcula o mês correspondente
  // Então: essa venda soma `0` ao faturamento mas soma `1` a `qtd_vendas` (entra no denominador do ticket médio, nunca é descartada)
  assert.fail('critério de aceite AC-066 ainda não provado — implemente este teste');
});

// US-021 — Função canônica de "venda contável" no Postgres
test('AC-067: Mês sem vendas não quebra o MoM @spec:AC-067', () => {
  // Dado: um mês do período sem nenhuma venda confirmada
  // Quando: a linha desse mês é consumida por qualquer relatório
  // Então: `faturamento` e `qtd_vendas` aparecem como `0` e a variação MoM exibida é `—` (nunca `-100%` ou erro de divisão por zero)
  assert.fail('critério de aceite AC-067 ainda não provado — implemente este teste');
});

// US-021 — Função canônica de "venda contável" no Postgres
test('AC-068: Orçamentos ficam fora do faturamento @spec:AC-068', () => {
  // Dado: vendas com `status = 'orcamento_pendente'` ou `status = 'orcamento_recusado'` no período
  // Quando: `fn_vendas_resumo_mensal` calcula o mês
  // Então: essas vendas não somam em `faturamento` nem em `qtd_vendas`, mas aparecem em `qtd_orcamento_pendente`/`qtd_orcamento_recusado`
  assert.fail('critério de aceite AC-068 ainda não provado — implemente este teste');
});

// US-021 — Função canônica de "venda contável" no Postgres
test('AC-069: Drill-down mensal sob demanda @spec:AC-069', () => {
  // Dado: um mês específico e os mesmos filtros opcionais de `fn_vendas_resumo_mensal`
  // Quando: `fn_vendas_detalhe_mes` é chamada para esse mês
  // Então: retorna quebra por origem, quebra por categoria, ranking de médicos referenciadores e ranking de fisioterapeutas daquele mês, usando a mesma regra de venda contável
  assert.fail('critério de aceite AC-069 ainda não provado — implemente este teste');
});

// US-021 — Função canônica de "venda contável" no Postgres
test('AC-070: Funções são SECURITY DEFINER com search_path fixo @spec:AC-070', () => {
  // Dado: o código-fonte das funções `fn_vendas_resumo_mensal` e `fn_vendas_detalhe_mes`
  // Quando: a migration é inspecionada
  // Então: ambas declaram `SECURITY DEFINER` com `SET search_path = public, pg_temp`
  assert.fail('critério de aceite AC-070 ainda não provado — implemente este teste');
});

// US-022 — Segmentação consultório/fisio no relatório de vendas existente
test('AC-071: Filtro de modalidade de fechamento @spec:AC-071', () => {
  // Dado: a rota `/relatorios/vendas` com origem `Médico` filtrada ou disponível
  // Quando: o usuário seleciona o filtro de modalidade (`Todos`, `Fechados em Consultório`, `Convertidos pelo Fisioterapeuta`)
  // Então: as listagens e os cards refletem apenas as vendas da modalidade selecionada
  assert.fail('critério de aceite AC-071 ainda não provado — implemente este teste');
});

// US-022 — Segmentação consultório/fisio no relatório de vendas existente
test('AC-072: Cards de faturamento por modalidade e taxa de conversão @spec:AC-072', () => {
  // Dado: vendas de origem médica no período filtrado
  // Quando: a página é renderizada
  // Então: exibe faturamento e quantidade fechados em consultório, faturamento e quantidade convertidos pelo fisio, e a taxa de conversão da equipe (convertidas pelo fisio ÷ total de encaminhamentos médicos, incluindo orçamentos recusados no denominador; vendas com `venda_em_consultorio = NULL` ficam fora dos dois lados da conta)
  assert.fail('critério de aceite AC-072 ainda não provado — implemente este teste');
});

// US-022 — Segmentação consultório/fisio no relatório de vendas existente
test('AC-073: Tabelas de médico referenciador e profissional mostram a divisão @spec:AC-073', () => {
  // Dado: a tabela "Desempenho por Médico Referenciador" e a tabela "Desempenho por Profissional"
  // Quando: renderizadas com vendas de origem médica presentes
  // Então: exibem, respectivamente, quantidade e R$ por modalidade (consultório vs. fisio) por médico, e indicador de conversões ativas vs. atendimentos de venda já fechada por profissional
  assert.fail('critério de aceite AC-073 ainda não provado — implemente este teste');
});

// US-022 — Segmentação consultório/fisio no relatório de vendas existente
test('AC-074: Tag visual na listagem detalhada @spec:AC-074', () => {
  // Dado: uma venda de origem médica na tabela "Vendas Detalhadas"
  // Quando: a linha é renderizada
  // Então: exibe a tag `[Médico · Consultório]` ou `[Médico · Conversão Fisio]` conforme o valor de `venda_em_consultorio` (sem tag, ou tag "não classificada", quando `NULL`)
  assert.fail('critério de aceite AC-074 ainda não provado — implemente este teste');
});

// US-022 — Segmentação consultório/fisio no relatório de vendas existente
test('AC-075: PDF do relatório inclui o resumo por modalidade @spec:AC-075', () => {
  // Dado: a geração do PDF em `pdf-vendas.ts` com vendas de origem médica no período
  // Quando: o PDF é gerado
  // Então: contém o bloco de resumo do canal médico separando faturamento consultório vs. conversão fisio
  assert.fail('critério de aceite AC-075 ainda não provado — implemente este teste');
});

// US-023 — KPIs do relatório atual vêm da função canônica, sem truncamento
test('AC-076: KPIs de topo batem com a função canônica @spec:AC-076', () => {
  // Dado: um intervalo de datas e um conjunto de filtros aplicados em `/relatorios/vendas`
  // Quando: os KPIs de topo (faturamento total, volume, ticket médio) são calculados
  // Então: os valores são idênticos aos retornados por `fn_vendas_resumo_mensal` somados sobre o mesmo intervalo e filtros
  assert.fail('critério de aceite AC-076 ainda não provado — implemente este teste');
});

// US-023 — KPIs do relatório atual vêm da função canônica, sem truncamento
test('AC-077: Query de listagem usa paginação explícita @spec:AC-077', () => {
  // Dado: a query de listagem detalhada de vendas em `/relatorios/vendas`
  // Quando: o código-fonte é inspecionado
  // Então: a chamada usa `.range()` explícito (nunca busca sem limite de linhas)
  assert.fail('critério de aceite AC-077 ainda não provado — implemente este teste');
});

// US-024 — Relatório de Vendas Históricas com evolução mensal e drill-down
test('AC-078: Cards executivos de resumo @spec:AC-078', () => {
  // Dado: um período selecionado em `/relatorios/vendas-historicas`
  // Quando: a página carrega
  // Então: exibe faturamento histórico total, volume total de vendas, ticket médio consolidado, melhor mês do período e crescimento médio MoM — todos derivados das linhas de `fn_vendas_resumo_mensal`, sem chamada extra ao servidor
  assert.fail('critério de aceite AC-078 ainda não provado — implemente este teste');
});

// US-024 — Relatório de Vendas Históricas com evolução mensal e drill-down
test('AC-079: Gráfico com seletores de período e alternância de métrica @spec:AC-079', () => {
  // Dado: a página carregada
  // Quando: o usuário troca o seletor de período (6/12/24 meses, YTD, personalizado) ou a métrica exibida (faturamento, ticket médio, volume, visão mista)
  // Então: o gráfico atualiza — a troca de métrica é resolvida no cliente sobre o mesmo dataset já carregado; a troca de período refaz a consulta ao servidor
  assert.fail('critério de aceite AC-079 ainda não provado — implemente este teste');
});

// US-024 — Relatório de Vendas Históricas com evolução mensal e drill-down
test('AC-080: Tabela mês a mês com MoM @spec:AC-080', () => {
  // Dado: o período selecionado
  // Quando: a tabela analítica mês a mês é renderizada
  // Então: lista os meses em ordem cronológica decrescente, cada linha com faturamento, variação MoM de faturamento, quantidade de vendas, ticket médio, variação MoM de ticket médio, quebra consultório/fisio, top produto e top profissional do mês
  assert.fail('critério de aceite AC-080 ainda não provado — implemente este teste');
});

// US-024 — Relatório de Vendas Históricas com evolução mensal e drill-down
test('AC-081: Drill-down expansível por linha @spec:AC-081', () => {
  // Dado: uma linha de mês na tabela histórica
  // Quando: o usuário clica em "Ver Detalhes" ou na linha
  // Então: expande um painel inline com quebra por origem, quebra por categoria, ranking de médicos referenciadores e ranking de fisioterapeutas daquele mês, buscados via `fn_vendas_detalhe_mes` no momento da expansão (não no carregamento inicial da página)
  assert.fail('critério de aceite AC-081 ainda não provado — implemente este teste');
});

// US-024 — Relatório de Vendas Históricas com evolução mensal e drill-down
test('AC-082: Filtros globais por profissional, médico, origem e categoria @spec:AC-082', () => {
  // Dado: a página `/relatorios/vendas-historicas`
  // Quando: o usuário aplica filtro por profissional, por médico referenciador, por origem ou por categoria de produto
  // Então: cards, gráfico e tabela refletem o filtro aplicado; o filtro por médico aceita tanto `medico_referenciador_id` (novo) quanto `medico_nome` (compatibilidade, resolvido para id na entrada)
  assert.fail('critério de aceite AC-082 ainda não provado — implemente este teste');
});

// US-024 — Relatório de Vendas Históricas com evolução mensal e drill-down
test('AC-083: Responsividade do gráfico e da tabela @spec:AC-083', () => {
  // Dado: a página aberta em uma tela estreita (mobile)
  // Quando: o gráfico ou a tabela são renderizados
  // Então: o layout não quebra — usa scroll horizontal ou redução adaptativa de rótulos, sem overflow da página
  assert.fail('critério de aceite AC-083 ainda não provado — implemente este teste');
});

// US-024 — Relatório de Vendas Históricas com evolução mensal e drill-down
test('AC-084: Exportação PDF e XLSX @spec:AC-084', () => {
  // Dado: o período e filtros aplicados na página
  // Quando: o usuário clica em exportar
  // Então: um arquivo PDF gerencial ou uma planilha XLSX é gerado com os dados consolidados exibidos em tela
  assert.fail('critério de aceite AC-084 ainda não provado — implemente este teste');
});

// US-024 — Relatório de Vendas Históricas com evolução mensal e drill-down
test('AC-085: Link de acesso no menu lateral @spec:AC-085', () => {
  // Dado: o usuário autenticado com acesso a relatórios
  // Quando: ele abre o grupo Comercial no Sidebar
  // Então: encontra um link para `/relatorios/vendas-historicas` ao lado do link para `/relatorios/vendas`
  assert.fail('critério de aceite AC-085 ainda não provado — implemente este teste');
});

// US-025 — Controle de acesso não fica mais permissivo
test('AC-086: Rota histórica bloqueada para perfil sem permissão de relatório consolidado @spec:AC-086', () => {
  // Dado: um usuário autenticado sem permissão de acesso a `/relatorios/vendas`
  // Quando: ele tenta acessar `/relatorios/vendas-historicas`
  // Então: o acesso é negado da mesma forma que seria em `/relatorios/vendas` (mesmo guard/verificação de perfil)
  assert.fail('critério de aceite AC-086 ainda não provado — implemente este teste');
});
