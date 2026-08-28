# Spec: Venda em Consultório vs. Conversão do Fisioterapeuta + Relatório de Vendas Históricas

> feature: venda-consultorio-vendas-historicas
> status: rascunho

## Contexto

Vendas de origem "médico" hoje são todas tratadas igual — não dá para saber se o médico já fechou a venda no consultório ou se o fisioterapeuta converteu uma indicação. Além disso, não existe visão histórica mês a mês de faturamento/ticket médio/volume; a apuração é manual, fora do sistema. Esta feature adiciona (1) um toggle de atribuição comercial no cadastro/edição de vendas médicas, (2) uma função canônica no Postgres que define "venda contável" uma única vez, (3) segmentação consultório/fisio no relatório de vendas existente (`/relatorios/vendas`), migrando seus KPIs de topo para a função canônica, e (4) uma rota nova `/relatorios/vendas-historicas` com evolução mensal, MoM e drill-down. Baseado em [PRD 004](../../../docs/prds/004-venda-em-consultorio-e-relatorio-historico-de-vendas.md), [RFC 004](../../../docs/rfcs/004-venda-em-consultorio-e-relatorio-historico-de-vendas.md) (Opção 2 aprovada) e [TDD 004](../../../docs/tdds/004-venda-em-consultorio-e-relatorio-historico-de-vendas.md).

## Histórias

### US-020 — Marcar venda médica como fechada em consultório ou conversão do fisio

Como operador de recepção/comercial, quero um toggle simples ao cadastrar ou editar uma venda de origem "Médico", para registrar se o médico já fechou a venda no consultório ou se o fisioterapeuta foi quem converteu a indicação na clínica.

#### AC-061 — Toggle aparece somente quando origem é Médico

- **Dado** o operador está na Aba 1 (Origem da Venda) do formulário de nova venda ou de edição
- **Quando** ele seleciona a origem `Médico` e escolhe o médico referenciador
- **Então** o toggle "Venda realizada em consultório médico?" aparece logo abaixo do campo do médico, com valor padrão desligado (conversão pelo fisioterapeuta)

#### AC-062 — Toggle some e valor é limpo ao trocar de origem

- **Dado** o operador marcou o toggle como ativo (venda em consultório) com origem `Médico`
- **Quando** ele troca a origem para qualquer outra (ex.: `Leads`, `Indicação`, `Campanha`)
- **Então** o toggle deixa de aparecer e o valor de `venda_em_consultorio` enviado ao salvar é `null`

#### AC-063 — Persistência correta em criarVenda e editarVenda

- **Dado** um formulário de nova venda ou edição com origem `Médico` e o toggle marcado
- **Quando** o operador salva a venda
- **Então** a Server Action grava `venda_em_consultorio = true` (ou `false`, se desmarcado) na tabela `vendas`, e uma tentativa de gravar `venda_em_consultorio` diferente de `null` com origem diferente de `medico` é rejeitada pelo banco (`CHECK` constraint)

#### AC-064 — Vendas legadas e não-médicas ficam não classificadas

- **Dado** uma venda já existente antes da migration, ou uma venda nova de origem não-médica
- **Quando** a coluna `venda_em_consultorio` é lida
- **Então** o valor é `NULL` (não classificada) — nunca `false` por default de banco

### US-021 — Função canônica de "venda contável" no Postgres

Como engenharia, quero uma única definição de "venda contável" compartilhada pelos dois relatórios, para que faturamento e ticket médio nunca divirjam entre `/relatorios/vendas` e `/relatorios/vendas-historicas`.

#### AC-065 — Agregação mensal correta com filtros

- **Dado** um intervalo de datas e filtros opcionais (profissional, médico referenciador por id, origem, categoria, modalidade)
- **Quando** `fn_vendas_resumo_mensal` é chamada
- **Então** retorna uma linha por mês do período, com `faturamento`, `qtd_vendas`, `ticket_medio` (`faturamento / qtd_vendas`, `0` quando não há vendas), `faturamento_consultorio`/`qtd_consultorio`, `faturamento_fisio`/`qtd_fisio`, `qtd_nao_classificada`, `qtd_orcamento_pendente`, `qtd_orcamento_recusado`, `top_produto` e `top_profissional` — considerando apenas vendas com `status = 'venda_confirmada'`

#### AC-066 — Venda confirmada sem itens conta como R$ 0,00 no denominador

- **Dado** uma venda com `status = 'venda_confirmada'` e nenhum item em `itens_venda`
- **Quando** `fn_vendas_resumo_mensal` calcula o mês correspondente
- **Então** essa venda soma `0` ao faturamento mas soma `1` a `qtd_vendas` (entra no denominador do ticket médio, nunca é descartada)

#### AC-067 — Mês sem vendas não quebra o MoM

- **Dado** um mês do período sem nenhuma venda confirmada
- **Quando** a linha desse mês é consumida por qualquer relatório
- **Então** `faturamento` e `qtd_vendas` aparecem como `0` e a variação MoM exibida é `—` (nunca `-100%` ou erro de divisão por zero)

#### AC-068 — Orçamentos ficam fora do faturamento

- **Dado** vendas com `status = 'orcamento_pendente'` ou `status = 'orcamento_recusado'` no período
- **Quando** `fn_vendas_resumo_mensal` calcula o mês
- **Então** essas vendas não somam em `faturamento` nem em `qtd_vendas`, mas aparecem em `qtd_orcamento_pendente`/`qtd_orcamento_recusado`

#### AC-069 — Drill-down mensal sob demanda

- **Dado** um mês específico e os mesmos filtros opcionais de `fn_vendas_resumo_mensal`
- **Quando** `fn_vendas_detalhe_mes` é chamada para esse mês
- **Então** retorna quebra por origem, quebra por categoria, ranking de médicos referenciadores e ranking de fisioterapeutas daquele mês, usando a mesma regra de venda contável

#### AC-070 — Funções são SECURITY DEFINER com search_path fixo

- **Dado** o código-fonte das funções `fn_vendas_resumo_mensal` e `fn_vendas_detalhe_mes`
- **Quando** a migration é inspecionada
- **Então** ambas declaram `SECURITY DEFINER` com `SET search_path = public, pg_temp`

### US-022 — Segmentação consultório/fisio no relatório de vendas existente

Como gestor comercial, quero ver no relatório de vendas atual quanto do faturamento médico veio fechado em consultório e quanto veio de conversão do fisioterapeuta, para avaliar parcerias médicas e desempenho da equipe.

#### AC-071 — Filtro de modalidade de fechamento

- **Dado** a rota `/relatorios/vendas` com origem `Médico` filtrada ou disponível
- **Quando** o usuário seleciona o filtro de modalidade (`Todos`, `Fechados em Consultório`, `Convertidos pelo Fisioterapeuta`)
- **Então** as listagens e os cards refletem apenas as vendas da modalidade selecionada

#### AC-072 — Cards de faturamento por modalidade e taxa de conversão

- **Dado** vendas de origem médica no período filtrado
- **Quando** a página é renderizada
- **Então** exibe faturamento e quantidade fechados em consultório, faturamento e quantidade convertidos pelo fisio, e a taxa de conversão da equipe (convertidas pelo fisio ÷ total de encaminhamentos médicos, incluindo orçamentos recusados no denominador; vendas com `venda_em_consultorio = NULL` ficam fora dos dois lados da conta)

#### AC-073 — Tabelas de médico referenciador e profissional mostram a divisão

- **Dado** a tabela "Desempenho por Médico Referenciador" e a tabela "Desempenho por Profissional"
- **Quando** renderizadas com vendas de origem médica presentes
- **Então** exibem, respectivamente, quantidade e R$ por modalidade (consultório vs. fisio) por médico, e indicador de conversões ativas vs. atendimentos de venda já fechada por profissional

#### AC-074 — Tag visual na listagem detalhada

- **Dado** uma venda de origem médica na tabela "Vendas Detalhadas"
- **Quando** a linha é renderizada
- **Então** exibe a tag `[Médico · Consultório]` ou `[Médico · Conversão Fisio]` conforme o valor de `venda_em_consultorio` (sem tag, ou tag "não classificada", quando `NULL`)

#### AC-075 — PDF do relatório inclui o resumo por modalidade

- **Dado** a geração do PDF em `pdf-vendas.ts` com vendas de origem médica no período
- **Quando** o PDF é gerado
- **Então** contém o bloco de resumo do canal médico separando faturamento consultório vs. conversão fisio

### US-023 — KPIs do relatório atual vêm da função canônica, sem truncamento

Como engenharia, quero que os KPIs de topo de `/relatorios/vendas` (faturamento, volume, ticket médio) venham de `fn_vendas_resumo_mensal` e que a listagem detalhada use paginação explícita, para eliminar o truncamento silencioso do PostgREST e garantir que o relatório atual e o histórico nunca divirjam.

#### AC-076 — KPIs de topo batem com a função canônica

- **Dado** um intervalo de datas e um conjunto de filtros aplicados em `/relatorios/vendas`
- **Quando** os KPIs de topo (faturamento total, volume, ticket médio) são calculados
- **Então** os valores são idênticos aos retornados por `fn_vendas_resumo_mensal` somados sobre o mesmo intervalo e filtros

#### AC-077 — Query de listagem usa paginação explícita

- **Dado** a query de listagem detalhada de vendas em `/relatorios/vendas`
- **Quando** o código-fonte é inspecionado
- **Então** a chamada usa `.range()` explícito (nunca busca sem limite de linhas)

### US-024 — Relatório de Vendas Históricas com evolução mensal e drill-down

Como gestor geral/diretor comercial, quero uma página dedicada com evolução mensal de faturamento, ticket médio e volume, comparativos MoM e detalhamento por mês, para acompanhar a evolução do negócio sem apuração manual em planilha.

#### AC-078 — Cards executivos de resumo

- **Dado** um período selecionado em `/relatorios/vendas-historicas`
- **Quando** a página carrega
- **Então** exibe faturamento histórico total, volume total de vendas, ticket médio consolidado, melhor mês do período e crescimento médio MoM — todos derivados das linhas de `fn_vendas_resumo_mensal`, sem chamada extra ao servidor

#### AC-079 — Gráfico com seletores de período e alternância de métrica

- **Dado** a página carregada
- **Quando** o usuário troca o seletor de período (6/12/24 meses, YTD, personalizado) ou a métrica exibida (faturamento, ticket médio, volume, visão mista)
- **Então** o gráfico atualiza — a troca de métrica é resolvida no cliente sobre o mesmo dataset já carregado; a troca de período refaz a consulta ao servidor

#### AC-080 — Tabela mês a mês com MoM

- **Dado** o período selecionado
- **Quando** a tabela analítica mês a mês é renderizada
- **Então** lista os meses em ordem cronológica decrescente, cada linha com faturamento, variação MoM de faturamento, quantidade de vendas, ticket médio, variação MoM de ticket médio, quebra consultório/fisio, top produto e top profissional do mês

#### AC-081 — Drill-down expansível por linha

- **Dado** uma linha de mês na tabela histórica
- **Quando** o usuário clica em "Ver Detalhes" ou na linha
- **Então** expande um painel inline com quebra por origem, quebra por categoria, ranking de médicos referenciadores e ranking de fisioterapeutas daquele mês, buscados via `fn_vendas_detalhe_mes` no momento da expansão (não no carregamento inicial da página)

#### AC-082 — Filtros globais por profissional, médico, origem e categoria

- **Dado** a página `/relatorios/vendas-historicas`
- **Quando** o usuário aplica filtro por profissional, por médico referenciador, por origem ou por categoria de produto
- **Então** cards, gráfico e tabela refletem o filtro aplicado; o filtro por médico aceita tanto `medico_referenciador_id` (novo) quanto `medico_nome` (compatibilidade, resolvido para id na entrada)

#### AC-083 — Responsividade do gráfico e da tabela

- **Dado** a página aberta em uma tela estreita (mobile)
- **Quando** o gráfico ou a tabela são renderizados
- **Então** o layout não quebra — usa scroll horizontal ou redução adaptativa de rótulos, sem overflow da página

#### AC-084 — Exportação PDF e XLSX

- **Dado** o período e filtros aplicados na página
- **Quando** o usuário clica em exportar
- **Então** um arquivo PDF gerencial ou uma planilha XLSX é gerado com os dados consolidados exibidos em tela

#### AC-085 — Link de acesso no menu lateral

- **Dado** o usuário autenticado com acesso a relatórios
- **Quando** ele abre o grupo Comercial no Sidebar
- **Então** encontra um link para `/relatorios/vendas-historicas` ao lado do link para `/relatorios/vendas`

### US-025 — Controle de acesso não fica mais permissivo

Como engenharia de segurança, quero que `/relatorios/vendas-historicas` siga o mesmo controle de acesso de `/relatorios/vendas`, para que um fisioterapeuta não consiga ler o faturamento consolidado da clínica.

#### AC-086 — Rota histórica bloqueada para perfil sem permissão de relatório consolidado

- **Dado** um usuário autenticado sem permissão de acesso a `/relatorios/vendas`
- **Quando** ele tenta acessar `/relatorios/vendas-historicas`
- **Então** o acesso é negado da mesma forma que seria em `/relatorios/vendas` (mesmo guard/verificação de perfil)

## Fora de escopo

- Cálculo automatizado de comissão/repasse financeiro para folha de pagamento.
- Forecast preditivo de faturamento por IA.
- Edição em lote retroativa de vendas passadas para marcar consultório em massa.
- Card/gráfico de vendas no dashboard (`/dashboard`) — não existe hoje e fica para V2.
- Auditoria de alteração do próprio toggle (quem mudou de `true` para `false` e quando).
- Tabela materializada de resumo mensal (Opção 3 do RFC) — reavaliada com dado real pós-go-live.
- Filtro por modalidade de fechamento no relatório histórico (`/relatorios/vendas-historicas`) — só existe hoje em `/relatorios/vendas`.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-016 | "Venda em consultório" é atributo da venda, não do médico — o mesmo médico pode fechar no consultório numa venda e apenas encaminhar em outra | confirmada | RFC 004, Suposição 1: confiança "Alta"; TDD marca como última pergunta a confirmar com a gestão antes da fase 1, mas o desenho da coluna (por venda, não por médico) já está decidido em toda a documentação |
| ASM-017 | O drill-down mensal é consultado sob demanda, para poucos meses por sessão — não para os 36 de uma vez | aberta | Suposição 3 do RFC, confiança "Média". Ação 12 do RFC reavalia aos 30 dias pós-go-live; se o padrão de uso desmentir, carregamento sob demanda vira pré-agregação |
| ASM-018 | Nenhuma venda confirmada sem itens existe na base hoje, então a correção do denominador do ticket médio (AC-066) não muda nenhum número em produção | confirmada | Medição de 27/08/2026 documentada no TDD: 0 de 179 vendas confirmadas sem itens; ticket médio idêntico (R$ 2.286,37) nas duas regras |
| ASM-019 | O `db-max-rows` do PostgREST na VPS não foi confirmado, mas não bloqueia esta entrega porque a Opção 2 (agregação no banco) é robusta em qualquer volume | aberta | Ação 1 do RFC, ainda pendente; não bloqueia fases 1-6 do TDD |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-009 | O denominador da "Taxa de Conversão da Equipe" (AC-072) inclui encaminhamentos médicos que viraram orçamento recusado? | respondida | Sim — TDD e RFC (Questão 5) recomendam incluir; sem isso a taxa é sempre 100%. Vendas com `venda_em_consultorio = NULL` ficam fora dos dois lados do cálculo. Assumido como resposta padrão; gestão pode revisar no roteiro de validação |
| Q-010 | O relatório histórico precisa de filtro por modalidade de fechamento também? | respondida | Não nesta V1 — TDD Questão 7 marca como "em aberto" mas o PRD pede o filtro apenas em `/relatorios/vendas` (seção 2.1); registrado em Fora de escopo, pode entrar depois se a gestão pedir |
