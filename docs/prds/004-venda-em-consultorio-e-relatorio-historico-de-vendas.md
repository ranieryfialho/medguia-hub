# PRD: Venda em Consultório vs. Conversão do Fisioterapeuta e Relatório de Vendas Históricas

Atualmente, quando uma venda tem como origem "Médico", o sistema permite apenas vincular o médico referenciador, sem distinguir se a venda já foi formalizada e fechada dentro do consultório médico ou se o paciente chegou apenas com uma indicação/encaminhamento e o fisioterapeuta foi o responsável direto pela avaliação e conversão comercial. Além disso, a gestão clínica necessita de um módulo aprofundado de Vendas Históricas que vá além do gráfico simples de evolução de ticket médio (referência da tela atual do dashboard), trazendo uma visão detalhada, mês a mês, da evolução de faturamento, volume, ticket médio, canais de fechamento e comparativos mês a mês (MoM).

---

## Problema (O Porquê)

1. **Falta de Clareza na Atribuição Comercial (Consultório vs. Fisio):**  
   Hoje, todas as vendas originadas de "Médico" são tratadas de forma homogênea. A gestão e os fisioterapeutas não conseguem mensurar com exatidão:
   - Quantas vendas já chegam 100% "fechadas" pelo médico em seu consultório.
   - Quantas indicações dependem da habilidade de avaliação e poder de convencimento/conversão do fisioterapeuta na clínica.  
   Isso prejudica a avaliação justa de desempenho dos fisioterapeutas, o cálculo de comissões/bonificações e a análise de quais médicos parceiros são verdadeiros convertedores de tratamentos versus meros indicadores de contato.

2. **Visão Histórica Limitada e Pouco Analítica:**  
   Embora o dashboard exiba um gráfico preliminar de "Evolução do Ticket Médio" dos últimos 12 meses, a diretoria e os gestores não possuem uma página dedicada a **Vendas Históricas** com detalhamento analítico mensal. Falta visibilidade consolidada de:
   - Faturamento total mês a mês e variação percentual (*Month-over-Month* - MoM).
   - Ticket médio histórico discriminado por categoria de produto (tratamentos vs. consultas avulsas).
   - Composição de faturamento mensal por canal (Consultório vs. Conversão Fisio vs. Outras origens).
   - Tabela analítica mensal com *drill-down* dos principais produtos, protocolos e profissionais de cada mês.

---

## Usuários (Para Quem)

- **Gestor Geral / Diretor Comercial:**  
  *"Quero analisar mês a mês a evolução histórica do faturamento e ticket médio da clínica, comparando o crescimento MoM e sabendo com precisão quanto do nosso volume veio mastigado do consultório médico e quanto dependeu do poder de conversão da minha equipe de fisioterapeutas."*

- **Fisioterapeuta:**  
  *"Quando eu receber um paciente indicado por médico, quero que o sistema registre claramente se a venda já foi fechada no consultório ou se eu fui o responsável técnico e comercial pela conversão, para que meu mérito e indicadores de conversão sejam reconhecidos com justiça."*

- **Recepção / Comercial (Operador de Vendas):**  
  *"Ao cadastrar ou editar uma venda com origem 'Médico', quero um controle simples e direto (toggle switch) logo abaixo da seleção do médico para marcar se a venda aconteceu no consultório ou se foi convertida pelo fisio."*

---

## Requisitos (O Quê)

---

### 1. Toggle "Venda em Consultório" no Lançamento e Edição de Vendas

#### 1.1. Interface no Formulário de Nova Venda (`FormNovaVenda.tsx`) e Edição (`FormEditarVenda.tsx`)
- Na **Aba 1: Origem da Venda**, ao selecionar a opção `Médico` e escolher o **Médico Referenciador**:
  - Exibir logo abaixo do campo de busca/seleção do médico um componente de **Toggle Switch** (Interruptor):
    - **Rótulo Principal:** `Venda realizada em consultório médico?`
    - **Subtítulo / Texto Explicativo (Help Text):**
      - **Toggle ATIVO (Ligado / Verde):** *"Venda já fechada no consultório pelo médico. O fisioterapeuta recebeu o paciente com o plano pré-definido/fechado."*
      - **Toggle INATIVO (Desligado / Cinza):** *"Indicação médica. O fisioterapeuta foi o responsável pela avaliação e conversão da venda na clínica."*
  - **Valor Padrão:** `false` (Desligado / Conversão pelo Fisioterapeuta), garantindo que a marcação de venda direta em consultório seja uma escolha consciente do operador.
  - **Comportamento Condicional:**
    - O toggle só deve aparecer e ter valor persistido quando o campo `origem === 'medico'`.
    - Se o usuário trocar a origem para outro valor (ex.: "Leads", "Indicação", "Campanha"), o toggle é ocultado e o valor de `venda_em_consultorio` deve ser gravado como `false` / `null`.

#### 1.2. Persistência no Banco de Dados (`vendas`) e Server Actions
- Adicionar a coluna `venda_em_consultorio boolean NOT NULL DEFAULT false` na tabela `vendas`.
- Atualizar as Server Actions `criarVenda` e `editarVenda` em `src/actions/vendas.ts` para receber e persistir `venda_em_consultorio`.
- Garantir retrocompatibilidade com vendas já existentes (registros legados assumem `false` por padrão).

---

### 2. Alimentação e Segmentação no Relatório de Vendas (`/relatorios/vendas`)

#### 2.1. Novos Filtros e Controles
- No componente de filtro da rota `/relatorios/vendas`:
  - Ao selecionar a origem `Médico` (ou como filtro dedicado), disponibilizar o seletor de **Modalidade de Fechamento**:
    - *Todos os encaminhamentos médicos*
    - *Fechados em Consultório Médico*
    - *Convertidos pelo Fisioterapeuta*

#### 2.2. Cards de Destaque e Agregações de Origem Médica
- Na seção de análise por médico e por origem, exibir bloco comparativo:
  - **Faturamento Fechado em Consultório:** Total em R$ e quantidade de vendas fechadas pelo médico.
  - **Faturamento Convertido pelo Fisio:** Total em R$ e quantidade de vendas convertidas pela equipe clínica a partir de indicações.
  - **Taxa de Conversão da Equipe:** % de indicações médicas que foram convertidas com sucesso pelo fisioterapeuta.

#### 2.3. Tabela de Médicos Referenciadores e Desempenho por Profissional
- Na tabela **Desempenho por Médico Referenciador**:
  - Adicionar colunas ou badges dividindo:
    - *Vendas em Consultório (Qtd e R$)*
    - *Vendas Convertidas pelo Fisio (Qtd e R$)*
- Na tabela **Desempenho por Profissional (Fisioterapeuta)**:
  - Adicionar indicador de quantas vendas do profissional foram **conversões ativas** vs. **atendimentos de vendas já vindas de consultório**.
- Na tabela **Vendas Detalhadas**:
  - Adicionar tag visual na coluna de origem: `[Médico - Consultório]` ou `[Médico - Conversão Fisio]`.

#### 2.4. Atualização do Relatório em PDF (`pdf-vendas.ts`)
- Incluir no PDF gerado o resumo das vendas com origem médica separando o faturamento fechado em consultório do faturamento convertido pelos fisioterapeutas.

---

### 3. Relatório de Vendas Históricas e Evolução Mensal Detalhada

Criar uma rota dedicada `/relatorios/vendas-historicas` (com atalho no menu lateral em Relatórios e link direto no Dashboard), expandindo a referência visual da `image.png` para uma ferramenta analítica completa.

#### 3.1. Cards Executivos de Resumo Histórico (Topo da Página)
- **Faturamento Histórico Total:** Valor acumulado no período selecionado.
- **Volume Total de Vendas:** Quantidade total de vendas confirmadas.
- **Ticket Médio Consolidado:** Média geral do período (Total Faturado / Total de Vendas).
- **Melhor Mês do Período:** Mês com maior faturamento (ex.: *AGO/26 — R$ 2.800,00*).
- **Crescimento Médio MoM:** Média mensal de variação de faturamento mês a mês.

#### 3.2. Gráfico Interativo de Evolução Temporal
- **Base Visual:** Gráfico de colunas/linhas responsivo (inspirado no gráfico de *Evolução do Ticket Médio* da imagem de referência).
- **Seletores Rápidos de Período:**
  - *Últimos 6 meses*
  - *Últimos 12 meses* (Padrão)
  - *Últimos 24 meses*
  - *Ano Vigente (YTD)*
  - *Personalizado (Mês/Ano Inicial até Mês/Ano Final)*
- **Alternância de Métrica Visualizada (Tabs/Toggle do Gráfico):**
  - **Faturamento Mensal (R$)**
  - **Ticket Médio (R$)**
  - **Volume de Vendas (Qtd)**
  - **Visão Mista (Barras de Faturamento + Linha de Ticket Médio)**

#### 3.3. Tabela Analítica Mês a Mês (Detalhamento Histórico com Drill-Down)
Para cada mês do período selecionado, a tabela deve apresentar em linhas ordenadas cronologicamente (do mais recente para o mais antigo):

| Mês/Ano | Faturamento Total | Variação MoM (Faturamento) | Qtd. Vendas | Ticket Médio | Variação MoM (Ticket) | Em Consultório vs. Fisio | Top Produto do Mês | Top Profissional | Ações |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **AGO/26** | R$ 2.800,00 | <span style="color:green">▲ +64.7%</span> | 1 | R$ 2.800,00 | <span style="color:green">▲ +64.7%</span> | R$ 0,00 / R$ 2.800,00 | Protocolo Coluna | Dr. Lucas | [Ver Detalhes] |
| **JUL/26** | R$ 0,00 | — | 0 | R$ 0,00 | — | — | — | — | — |
| **...** | ... | ... | ... | ... | ... | ... | ... | ... | ... |
| **ABR/26** | R$ 1.700,00 | <span style="color:green">▲ +13.3%</span> | 1 | R$ 1.700,00 | <span style="color:green">▲ +13.3%</span> | R$ 1.700,00 / R$ 0,00 | Fisioterapia 10 Sessões | Dra. Camila | [Ver Detalhes] |
| **SET/25** | R$ 1.500,00 | — | 1 | R$ 1.500,00 | — | R$ 0,00 / R$ 1.500,00 | Avaliação + Pacote | Dr. Lucas | [Ver Detalhes] |

- **Detalhamento Expansível por Linha (Drill-Down Mensal):**
  - Ao clicar em uma linha da tabela ou no botão `Ver Detalhes`, expandir um painel inline com o raio-x do mês:
    - **Quebra por Origem no Mês:** Gráfico em rosca / tabela com % de cada origem (Médico Consultório, Médico Conversão Fisio, Leads, Indicação, etc.).
    - **Quebra por Categoria:** Proporção de faturamento entre Tratamentos e Consultas avulsas.
    - **Ranking de Médicos Referenciadores do Mês:** Quem mais encaminhou pacientes naquele mês específico.
    - **Ranking de Fisioterapeutas do Mês:** Faturamento e quantidade por profissional.

#### 3.4. Filtros Globais do Relatório Histórico
- **Filtro por Profissional:** Ver o histórico individual de vendas e evolução de ticket médio de um fisioterapeuta específico.
- **Filtro por Médico Referenciador:** Ver a evolução histórica de vendas de um médico parceiro específico ao longo dos meses.
- **Filtro por Origem da Venda:** Isolar, por exemplo, apenas vendas de "Leads" ou "Médico".
- **Filtro por Categoria de Produto:** Isolar o histórico apenas de "Tratamentos" ou "Consultas".

#### 3.5. Exportação
- Botão para exportar o relatório histórico analítico consolidado em **PDF Gerencial** e **Planilha Excel (XLSX/CSV)**.

---

## NUNCA PODE:

- Permitir que a opção "Venda realizada em consultório" seja marcada se a origem selecionada não for "Médico" (deve ser restrita exclusivamente ao canal médico).
- Deixar de computar vendas no ticket médio histórico por ausência de itens (o cálculo deve ser sempre `Faturamento Total do Mês / Quantidade de Vendas Confirmadas`).
- Incluir orçamentos pendentes ou recusados no faturamento realizado e no ticket médio histórico (orçamentos devem ter contagem e funil segregados).
- Permitir divergência entre os números apresentados no dashboard geral, no relatório de vendas convencional (`/relatorios/vendas`) e no relatório de vendas históricas (`/relatorios/vendas-historicas`) para o mesmo intervalo de datas.
- Quebrar o layout do gráfico histórico em telas menores/mobile (o componente deve manter visualização fluida com scroll horizontal ou redução adaptativa de rótulos dos meses).

---

## Métricas

- **100%** das novas vendas com origem "Médico" categorizadas entre *Fechado em Consultório* ou *Convertido pelo Fisioterapeuta*.
- **Zero** discrepâncias no cálculo de faturamento e ticket médio histórico entre relatórios.
- Tempo de carregamento do relatório histórico com até 36 meses inferior a **1.5 segundos**.
- Adoção de **100%** pela gestão na apuração mensal de desempenho de conversão da equipe clínica e retorno de parcerias médicas.

---

## Fora do Escopo (V1)

- Módulo automatizado de cálculo de comissão bancária / repasse financeiro automático para folha de pagamento (o relatório fornece os dados consolidados, mas o cálculo de folha permanece manual/exportável).
- Previsão de faturamento futuro por Inteligência Artificial (forecast preditivo) — será avaliado para a V2.
- Edição em lote retroativa de vendas passadas para marcar consultório em massa (nesta V1, edições são feitas individualmente no formulário de edição de venda).
